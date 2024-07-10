from collections import defaultdict
from functools import partial
from logging import getLogger
from typing import Optional

from django.contrib import messages
from django.contrib.sites.models import Site
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.urls import NoReverseMatch
from django.utils.functional import cached_property
from django.utils.module_loading import autodiscover_modules
from django.utils.translation import (
    get_language_from_request,
    gettext_lazy as _,
)

from cms.utils import get_current_site
from cms.utils.conf import get_cms_setting
from cms.utils.i18n import (
    get_default_language_for_site,
    is_language_prefix_patterns_used,
)
from menus.base import Menu, NavigationNode
from menus.exceptions import NamespaceAlreadyRegistered
from menus.models import CacheKey

logger = getLogger('menus')


ROOT_NODES = None


def _build_nodes_inner_for_whole_menu(nodes):
    """
    This is an easier to test "inner loop" building the menu tree structure
    for one menu (one language, one site)
    """

    to_delete = set()  # Keep a list of nodes with non-existing parents for deletion
    root_nodes = list()

    for namespace, inner_nodes in nodes.items():
        for node_id, node in inner_nodes.items():
            # For when the node has a parent_id, but we haven't seen it yet.
            # We must not append it to the final list in this case!

            # If we have seen the parent_id already...
            if node.parent_id in nodes.get(node.namespace or namespace, {}):
                # Implicit parent namespace by menu.__name__
                node.parent_namespace = node.parent_namespace or namespace
                parent = nodes[node.namespace or namespace][node.parent_id]
                parent.children.append(node)
                node.parent = parent
            elif node.parent_id:
                node.namespace = node.namespace or namespace
                to_delete.add(node)
            else:
                # No parent, this is a root node.
                root_nodes.append(node)

    # Broken tree: delete all nodes (and their descendants) that have a non-existing parent
    for node in to_delete:
        namespace = node.namespace
        for desc in node.get_descendants() + [node]:
            desc.parent = None  # Remove partially calculated relations
            desc.children = []
            del nodes[desc.namespace or namespace][desc.id]

    nodes[ROOT_NODES] = root_nodes
    return nodes


def _as_node_list(node_dict):
    """
    Turns node dictionary into node list.
    """
    return [node for ns, nd in node_dict.items() if isinstance(nd, dict) for node in nd.values() ]


def _get_menu_class_for_instance(menu_class, instance):
    """
    Returns a new menu class that subclasses
    menu_class but is bound to instance.
    This means it sets the "instance" attribute of the class.
    """
    attrs = {'instance': instance}
    class_name = menu_class.__name__
    meta_class = type(menu_class)
    return meta_class(class_name, (menu_class,), attrs)


class MenuRenderer:
    # The main logic behind this class is to decouple
    # the singleton menu pool from the menu rendering logic.
    # By doing this we can be sure that each request has its
    # private instance that will always have the same attributes.

    selected: Optional[list[NavigationNode]] = None
    #: The selected node, if any
    post_cut: bool = False
    #: Whether the nodes have been cut
    nodes_by_level: Optional[list[list[NavigationNode]]] = None
    #: The nodes grouped by level

    def __init__(self, pool, request):
        self.pool = pool
        # It's important this happens on init
        # because we need to make sure that a menu renderer
        # points to the same registered menus as long as the
        # instance lives.
        self.menus = pool.get_registered_menus(for_rendering=True)
        self.request = request
        self.request_language = None
        if is_language_prefix_patterns_used():
            self.request_language = get_language_from_request(request, check_path=True)
        if not self.request_language:
            self.request_language = get_default_language_for_site(get_current_site().pk)
        self.site = Site.objects.get_current(request)
        toolbar = getattr(request, "toolbar", None)
        self.edit_or_preview = toolbar.edit_mode_active or toolbar.preview_mode_active if toolbar else False

    @property
    def cache_key(self):
        prefix = get_cms_setting('CACHE_PREFIX')

        key = f"{prefix}menu_nodes_{self.request_language}_{self.site.pk}"

        if self.request.user.is_authenticated:
            key += f"_{self.request.user.pk}_user"

        if self.edit_or_preview:
            key += ':edit'
        else:
            key += ':public'
        return key

    @cached_property
    def is_cached(self):
        db_cache_key_lookup = CacheKey.objects.filter(
            key=self.cache_key,
            language=self.request_language,
            site=self.site.pk,
        )
        return db_cache_key_lookup.exists()

    def _build_nodes(self):
        """
        This is slow. Caching must be used.
        One menu is built per language and per site.

        Namespaces: they are ID prefixes to avoid node ID clashes when plugging
        multiple trees together.

        - We iterate on the list of nodes.
        - We store encountered nodes in a dict (with namespaces):
            done_nodes[<namespace>][<node's id>] = node
        - When a node has a parent defined, we look up that parent in done_nodes
            if it's found:
                set the node as the node's parent's child (re-read this)
            else:
                the node is put at the bottom of the list
        """
        key = self.cache_key

        cached_nodes = cache.get(key, None)

        if cached_nodes and self.is_cached:
            # Only use the cache if the key is present in the database.
            # This prevents a condition where keys which have been removed
            # from the database due to a change in content, are still used.
            return cached_nodes

        toolbar = getattr(self.request, 'toolbar', None)

        nodes = defaultdict(dict)
        for menu_class_name in self.menus:
            menu = self.get_menu(menu_class_name)
            menu.namespace = menu_class_name
            try:
                menu.get_nodes_dict(self.request, nodes)
            except NoReverseMatch:
                # Apps might raise NoReverseMatch if an apphook does not yet
                # exist, skip them instead of crashing
                if toolbar and toolbar.is_staff:
                    messages.error(
                        self.request,
                        _('Menu %s cannot be loaded. Please, make sure all its urls exist and can be resolved.') %
                        menu_class_name
                    )
                logger.error("Menu %s could not be loaded." % menu_class_name, exc_info=True)
            # nodes is a list of navigation nodes (page tree in cms + others)

        final_nodes = _build_nodes_inner_for_whole_menu(nodes)
        cache.set(key, final_nodes, get_cms_setting('CACHE_DURATIONS')['menus'])

        if not self.is_cached:
            # No need to invalidate the internal lookup cache,
            # just set the value directly.
            self.__dict__['is_cached'] = True
            # We need to have a list of the cache keys for languages and sites that
            # span several processes - so we follow the Django way and share through
            # the database. It's still cheaper than recomputing every time!
            # This way we can selectively invalidate per-site and per-language,
            # since the cache is shared but the keys aren't
            CacheKey.objects.create(key=key, language=self.request_language, site=self.site.pk)
        return final_nodes

    def _mark_children(self, nodes, level):
        for node in nodes:
            node.level = level
            if node.is_selected(self.request):
                self.selected = node
                if node.parent:
                    for sibling in node.parent.children:
                        sibling.sibling = True
                for descendant in node.get_descendants():
                    descendant.descendant = True
                for ancestor in node.get_ancestors():
                    ancestor.ancestor = True
            self._mark_children(node.children, level + 1)

    def _mark_nodes(self, nodes):
        self.selected = []
        for node in nodes[ROOT_NODES]:
            node.level = 0
            if node.is_selected(self.request):
                node.selected = True
                self.selected.append(node)
                for sibling in nodes[ROOT_NODES]:
                    sibling.sibling = True
                for descendant in node.get_descendants():
                    descendant.descendant = True
            if node.children:
                self._mark_children(node.children, 1)
        return _as_node_list(nodes)

    def apply_modifiers(self, nodes, namespace=None, root_id=None, post_cut=False, breadcrumb=False):
        # Only fetch modifiers when they're needed.
        # We can do this because unlike menu classes,
        # modifiers can't change on a request basis.
        for cls in self.pool.get_registered_modifiers():
            inst = cls(renderer=self)
            nodes = inst.modify(
                self.request, nodes, namespace, root_id, post_cut, breadcrumb)
        return nodes

    def get_nodes(self, namespace=None, root_id=None, breadcrumb=False):
        nodes = self._build_nodes()
        nodes = self._mark_nodes(nodes)
        nodes = self.apply_modifiers(
            nodes=nodes,
            namespace=namespace,
            root_id=root_id,
            post_cut=False,
            breadcrumb=breadcrumb,
        )
        return nodes

    def get_menu(self, menu_name):
        MenuClass = self.menus[menu_name]
        return MenuClass(renderer=self)


class MenuPool:

    def __init__(self):
        self.menus = {}
        self.modifiers = []
        self.discovered = False

    def get_renderer(self, request):
        self.discover_menus()
        # Returns a menu pool wrapper that is bound
        # to the given request and can perform
        # operations based on the given request.
        return MenuRenderer(pool=self, request=request)

    def discover_menus(self):
        if self.discovered:
            return
        autodiscover_modules('cms_menus')
        from menus.modifiers import register
        register()
        self.discovered = True

    def get_registered_menus(self, for_rendering=False):
        """
        Returns all registered menu classes.

        :param for_rendering: Flag that when True forces us to include
            all CMSAttachMenu subclasses, even if they're not attached.
        """
        self.discover_menus()
        registered_menus = {}

        for menu_class_name, menu_cls in self.menus.items():
            if isinstance(menu_cls, Menu):
                # A Menu **instance** was registered,
                # this is non-standard, but acceptable.
                menu_cls = menu_cls.__class__
            if hasattr(menu_cls, "get_instances"):
                # It quacks like a CMSAttachMenu.
                # Expand the one CMSAttachMenu into multiple classes.
                # Each class is bound to the instance the menu is attached to.
                _get_menu_class = partial(_get_menu_class_for_instance, menu_cls)

                instances = menu_cls.get_instances() or []
                for instance in instances:
                    # For each instance, we create a unique class
                    # that is bound to that instance.
                    # Doing this allows us to delay the instantiation
                    # of the menu class until it's needed.
                    # Plus we keep the menus consistent by always
                    # pointing to a class instead of an instance.
                    namespace = f"{menu_class_name}:{instance.pk}"
                    registered_menus[namespace] = _get_menu_class(instance)

                if not instances and not for_rendering:
                    # The menu is a CMSAttachMenu but has no instances,
                    # normally we'd just ignore it but it's been
                    # explicitly set that we are not rendering these menus
                    # via the (for_rendering) flag.
                    registered_menus[menu_class_name] = menu_cls
            elif hasattr(menu_cls, "get_nodes"):
                # This is another type of Menu, cannot be expanded, but must be
                # instantiated, none-the-less.
                registered_menus[menu_class_name] = menu_cls
            else:
                raise ValidationError(
                    "Something was registered as a menu, but isn't.")
        return registered_menus

    def get_registered_modifiers(self):
        return self.modifiers

    def clear(self, site_id=None, language=None, all=False):
        """
        This invalidates the cache for a given menu (site_id and language)
        """
        if all:
            cache_keys = CacheKey.objects.get_keys()
        else:
            cache_keys = CacheKey.objects.get_keys(site_id, language)

        to_be_deleted = cache_keys.distinct().values_list('key', flat=True)

        if to_be_deleted:
            cache.delete_many(to_be_deleted)
            cache_keys.delete()

    def register_menu(self, menu_cls):
        from menus.base import Menu
        assert issubclass(menu_cls, Menu)
        if menu_cls.__name__ in self.menus:
            raise NamespaceAlreadyRegistered(
                f"[{menu_cls.__name__}] a menu with this name is already registered")
        # Note: menu_cls should still be the menu CLASS at this point.
        self.menus[menu_cls.__name__] = menu_cls

    def register_modifier(self, modifier_class):
        from menus.base import Modifier
        assert issubclass(modifier_class, Modifier)
        if modifier_class not in self.modifiers:
            self.modifiers.append(modifier_class)

    def get_menus_by_attribute(self, name, value):
        """
        Returns the list of menus that match the name/value criteria provided.
        """
        # Note that we are limiting the output to only single instances of any
        # specific menu class. This is to address issue (#4041) which has
        # cropped-up in 3.0.13/3.0.0.
        # By setting for_rendering to False
        # we're limiting the output to menus
        # that are registered and have instances
        # (in case of attached menus).
        menus = self.get_registered_menus(for_rendering=False)
        return sorted(
            {(menu.__name__, menu.name) for menu_class_name, menu in menus.items()
             if getattr(menu, name, None) == value}
        )

    def get_nodes_by_attribute(self, nodes, name, value):
        return [node for node in nodes if node.attr.get(name, None) == value]


menu_pool = MenuPool()
