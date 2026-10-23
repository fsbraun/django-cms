import $ from 'jquery';

let dropdownId = 0;
const disabledSelector = '.cms-pagetree-dropdown-item-disabled, [aria-disabled="true"], :disabled';

/** Dropdowns and their keyboard interactions are delegated for lazy-loaded rows. */
class PageTreeDropdowns {
    constructor(options) {
        this.options = $.extend(true, {}, {
            dropdownSelector: '.js-cms-pagetree-dropdown',
            triggerSelector: '.js-cms-pagetree-dropdown-trigger',
            menuSelector: '.js-cms-pagetree-dropdown-menu',
            openCls: 'cms-pagetree-dropdown-menu-open'
        }, options);

        this.click = 'click.cms.pagetree.dropdown';
        this._setupUI();
        this._events();
        this._prepareDropdowns();
    }

    _setupUI() {
        this.ui = {
            container: this.options.container,
            document: $(document)
        };
    }

    _prepareDropdowns() {
        this.ui.container.find(this.options.dropdownSelector).each((index, element) => {
            this._prepareDropdown($(element));
        });
    }

    _prepareDropdown(dropdown) {
        const trigger = dropdown.find(this.options.triggerSelector).first();
        const menu = dropdown.find(this.options.menuSelector).first();
        const hasActions = !!(menu.find('a, button').length || dropdown.data('lazyUrl'));

        if (!trigger.length || !menu.length) {
            return;
        }
        if (!trigger.attr('id')) {
            trigger.attr('id', `cms-pagetree-trigger-${++dropdownId}`);
        }
        if (!menu.attr('id')) {
            menu.attr('id', `cms-pagetree-menu-${++dropdownId}`);
        }
        trigger.attr({
            role: 'button',
            tabindex: '0',
            'aria-expanded': String(dropdown.hasClass(this.options.openCls)),
            'aria-controls': menu.attr('id')
        });
        if (hasActions) {
            trigger.attr('aria-haspopup', 'menu');
        }
        menu.attr({
            role: hasActions ? 'menu' : 'region',
            tabindex: '-1',
            'aria-labelledby': trigger.attr('id')
        });
        if (hasActions) {
            menu.find('ul, li').attr('role', 'presentation');
            menu.find('.cms-pagetree-dropdown-separator').attr('role', 'separator');
            menu.find('a, button').attr({ role: 'menuitem', tabindex: '-1' });
            menu.find('.cms-pagetree-dropdown-item-disabled').attr('aria-disabled', 'true');
        }
    }

    _events() {
        const that = this;

        this.ui.container.on('ready.jstree redraw.jstree after_open.jstree', () => this._prepareDropdowns());
        this.ui.container.on('focusin.cms.pagetree.dropdown', this.options.triggerSelector, function() {
            that._prepareDropdown($(this).closest(that.options.dropdownSelector));
        });
        this.ui.container.on(this.click, this.options.triggerSelector, function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            that._toggleDropdown(this);
        });
        this.ui.container.on('keydown.cms.pagetree.dropdown', this.options.triggerSelector, function(e) {
            if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
                e.preventDefault();
                e.stopImmediatePropagation();
                const dropdown = $(this).closest(that.options.dropdownSelector);

                if (dropdown.hasClass(that.options.openCls) && e.key.startsWith('Arrow')) {
                    that._focusItem(dropdown, e.key === 'ArrowUp');
                } else {
                    that._toggleDropdown(this, e.key === 'ArrowUp');
                }
            } else if (e.key === 'Escape') {
                that.closeAllDropdowns();
            }
        });
        this.ui.container.on('keydown.cms.pagetree.dropdown', this.options.menuSelector, e => this._menuKeydown(e));
        this.ui.container.on('focusout.cms.pagetree.dropdown', this.options.dropdownSelector, function(e) {
            if (!this.contains(e.relatedTarget)) {
                that._closeDropdown($(this));
            }
        });
        this.ui.container.on(this.click, this.options.menuSelector, e => e.stopImmediatePropagation());
        this.ui.container.on(this.click, this.options.menuSelector + ' a, ' + this.options.menuSelector + ' button',
            function(e) {
                if ($(this).is(disabledSelector)) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    return;
                }
                const dropdown = $(this).closest(that.options.dropdownSelector);

                that.closeAllDropdowns();
                // Local actions such as Copy leave this page in place.
                dropdown.find(that.options.triggerSelector)[0]?.focus();
            });
        this.ui.document.on(this.click, () => this.closeAllDropdowns());
    }

    _items(dropdown) {
        return dropdown.find(this.options.menuSelector).find('a, button').filter(':visible').not(disabledSelector);
    }

    _focusItem(dropdown, last = false) {
        const items = this._items(dropdown);
        const target = items.length ? items.eq(last ? -1 : 0) : dropdown.find(this.options.menuSelector);

        target[0]?.focus();
    }

    _menuKeydown(event) {
        const dropdown = $(event.currentTarget).closest(this.options.dropdownSelector);
        const trigger = dropdown.find(this.options.triggerSelector);
        const items = this._items(dropdown);
        const index = items.index(document.activeElement);

        if (event.key === 'Escape' || event.key === 'Tab') {
            this._closeDropdown(dropdown);
            trigger[0]?.focus();
            // Tab proceeds from the trigger, including through the grid's row order.
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
            }
        } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            event.stopPropagation();
            this._moveItem(items, index, event.key);
        } else if (event.key === ' ' && items.is(event.target)) {
            event.preventDefault();
            event.target.click();
        }
    }

    _moveItem(items, index, key) {
        if (!items.length) {
            return;
        }
        let next = index + (key === 'ArrowUp' ? -1 : 1);

        if (key === 'Home') {
            next = 0;
        } else if (key === 'End') {
            next = items.length - 1;
        }
        items.eq((next + items.length) % items.length)[0].focus();
    }

    _toggleDropdown(trigger, last = false) {
        const dropdown = $(trigger).closest(this.options.dropdownSelector);

        if (dropdown.hasClass(this.options.openCls)) {
            this.closeAllDropdowns();
            return false;
        }
        this.closeAllDropdowns();
        dropdown.addClass(this.options.openCls);
        this._prepareDropdown(dropdown);
        this._focusItem(dropdown, last);
        const request = this._loadContent(dropdown);

        if (request) {
            request.done(() => {
                this._prepareDropdown(dropdown);
                // A late response must not steal focus after Tab, Escape or another menu.
                if (dropdown.hasClass(this.options.openCls) && dropdown[0].contains(document.activeElement)) {
                    this._focusItem(dropdown, last);
                }
            });
        }
    }

    _loadContent(dropdown) {
        const data = dropdown.data();
        const LOADER_SHOW_TIMEOUT = 200;

        if (!data.lazyUrl || data.loaded) {
            return false;
        }
        if (data.loading) {
            return data.loading;
        }
        const menu = dropdown.find(this.options.menuSelector);
        const loaderTimeout = setTimeout(() => {
            dropdown.find('.js-cms-pagetree-dropdown-loader').addClass('cms-loader');
        }, LOADER_SHOW_TIMEOUT);

        menu.attr('aria-busy', 'true');
        const request = $.ajax({ url: data.lazyUrl, data: data.lazyUrlData });

        dropdown.data('loading', request);
        request.done(response => {
            if (menu[0].contains(document.activeElement)) {
                menu[0].focus();
            }
            menu.html(response);
            dropdown.data('loaded', true);
        }).always(() => {
            clearTimeout(loaderTimeout);
            dropdown.find('.js-cms-pagetree-dropdown-loader').removeClass('cms-loader');
            menu.removeAttr('aria-busy');
            dropdown.removeData('loading');
        });
        return request;
    }

    _closeDropdown(dropdown) {
        dropdown.removeClass(this.options.openCls);
        dropdown.find(this.options.triggerSelector).attr('aria-expanded', 'false');
    }

    closeAllDropdowns() {
        this._closeDropdown(this.ui.container.find(this.options.dropdownSelector));
    }
}

// Define default options on the prototype for test compatibility
PageTreeDropdowns.prototype.options = {
    dropdownSelector: '.js-cms-pagetree-dropdown',
    triggerSelector: '.js-cms-pagetree-dropdown-trigger',
    menuSelector: '.js-cms-pagetree-dropdown-menu',
    openCls: 'cms-pagetree-dropdown-menu-open'
};

export default PageTreeDropdowns;
