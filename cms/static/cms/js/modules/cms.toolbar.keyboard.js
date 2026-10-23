import $ from 'jquery';

const toolbarSelector = '.cms-toolbar, .cms-toolbar-trigger';
const controlSelector = 'a[href], button, input, select, textarea, [tabindex]';
const menuSelector = '[role="menu"]';
const navigationKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter', ' ', 'Escape'];
let controlId = 0;

function visible(element) {
    return element.getClientRects().length > 0 && window.getComputedStyle(element).visibility !== 'hidden';
}

function disabled(element) {
    return element.disabled || !!element.closest(
        '[aria-disabled="true"], .cms-btn-disabled, .cms-toolbar-item-navigation-disabled'
    );
}

function identify(element) {
    if (!element.id) {
        element.id = `cms-toolbar-control-${++controlId}`;
    }
    return element.id;
}

function handlesEvent(event, toolbar) {
    return toolbar && !toolbar.querySelector('.cms-form-login') &&
        !event.altKey && !event.ctrlKey && !event.metaKey;
}

function nativeLinkSpace(event, menu) {
    return event.key === ' ' && !menu && event.target.matches('a:not([role="button"])');
}

/** One Tab stop per toolbar, with independent keyboard navigation inside menus. */
export default class ToolbarKeyboard {
    constructor() {
        this.originalTabindex = new WeakMap();
        this.current = new WeakMap();
        this.prepare = this.prepare.bind(this);
        this.keydown = this.keydown.bind(this);
        this.keyup = this.keyup.bind(this);
        this.click = this.click.bind(this);
        this.pointerup = this.pointerup.bind(this);
        this.focusin = this.focusin.bind(this);
        this.focusout = this.focusout.bind(this);
        document.addEventListener('keydown', this.keydown, true);
        document.addEventListener('keyup', this.keyup, true);
        document.addEventListener('click', this.click, true);
        document.addEventListener('pointerup', this.pointerup, true);
        document.addEventListener('focusin', this.focusin);
        document.addEventListener('focusout', this.focusout);
        this.observer = new window.MutationObserver(this.prepare);
        document.querySelectorAll(toolbarSelector).forEach(toolbar => {
            this.observer.observe(toolbar, {
                subtree: true, childList: true, attributes: true,
                attributeFilter: ['class', 'style', 'hidden', 'disabled', 'inert']
            });
        });
        this.observer.observe(document.documentElement, {
            attributes: true, attributeFilter: ['class', 'dir']
        });
        this.prepare();
    }

    destroy() {
        this.observer.disconnect();
        document.querySelectorAll(toolbarSelector).forEach(toolbar => {
            toolbar.querySelectorAll(controlSelector).forEach(element => {
                if (this.originalTabindex.has(element)) {
                    element.tabIndex = this.originalTabindex.get(element);
                }
            });
        });
        document.removeEventListener('keydown', this.keydown, true);
        document.removeEventListener('keyup', this.keyup, true);
        document.removeEventListener('click', this.click, true);
        document.removeEventListener('pointerup', this.pointerup, true);
        document.removeEventListener('focusin', this.focusin);
        document.removeEventListener('focusout', this.focusout);
    }

    controls(toolbar) {
        return Array.from(toolbar.querySelectorAll(controlSelector)).filter(element => {
            if (!this.originalTabindex.has(element)) {
                this.originalTabindex.set(element, element.tabIndex);
            }
            return !element.closest(menuSelector) && this.originalTabindex.get(element) >= 0 &&
                visible(element) && !disabled(element) && !element.closest('[inert]');
        });
    }

    menuFor(control) {
        if (!control) {
            return null;
        }
        if (control.matches('.cms-dropdown-toggle')) {
            return control.closest('.cms-dropdown')?.querySelector('.cms-dropdown-menu');
        }
        return control.parentElement?.matches('li') ? control.parentElement.querySelector(':scope > ul') : null;
    }

    triggerFor(menu) {
        return menu.parentElement.querySelector(':scope > a, :scope > button') ||
            menu.closest('.cms-dropdown')?.querySelector('.cms-dropdown-toggle');
    }

    prepare() {
        document.querySelectorAll(toolbarSelector).forEach(toolbar => {
            if (toolbar.querySelector('.cms-form-login')) {
                return;
            }
            toolbar.querySelectorAll(controlSelector).forEach(element => {
                if (!this.originalTabindex.has(element)) {
                    this.originalTabindex.set(element, element.tabIndex);
                }
            });
            this.prepareMenus(toolbar);
            const controls = this.controls(toolbar);
            const remembered = this.current.get(toolbar);
            const current = controls.includes(remembered) ? remembered : controls[0];

            toolbar.querySelectorAll(controlSelector).forEach(element => {
                if (element.closest(menuSelector)) {
                    element.tabIndex = -1;
                } else {
                    if (!this.originalTabindex.has(element)) {
                        this.originalTabindex.set(element, element.tabIndex);
                    }
                    element.tabIndex = element === current ? 0 : -1;
                }
            });
            this.current.set(toolbar, current);
        });
    }

    prepareMenus(toolbar) {
        toolbar.querySelectorAll('.cms-icon').forEach(icon => icon.setAttribute('aria-hidden', 'true'));
        toolbar.querySelectorAll('.cms-toolbar-item-navigation').forEach(list => {
            list.setAttribute('role', 'presentation');
        });
        toolbar.querySelectorAll('.cms-toolbar-item-navigation li, .cms-dropdown-menu > li').forEach(item => {
            item.setAttribute('role', item.matches('.cms-toolbar-item-navigation-break') ? 'separator' : 'none');
        });
        toolbar.querySelectorAll('.cms-toolbar-item-navigation li > ul, .cms-dropdown-menu').forEach(menu => {
            const trigger = this.triggerFor(menu);

            if (!trigger) {
                return;
            }
            menu.setAttribute('role', 'menu');
            menu.setAttribute('aria-labelledby', identify(trigger));
            trigger.setAttribute('aria-haspopup', 'menu');
            trigger.setAttribute('aria-controls', identify(menu));
            trigger.setAttribute('aria-expanded', String(visible(menu)));
            if (!trigger.closest(menuSelector)) {
                trigger.setAttribute('role', 'button');
            }
            menu.querySelectorAll('a, button').forEach(item => {
                item.setAttribute('role', 'menuitem');
                item.setAttribute('aria-disabled', String(this.isDisabledItem(item)));
            });
        });
        toolbar.querySelectorAll('[role="menuitem"]').forEach(control => {
            if (!control.closest(menuSelector)) {
                control.removeAttribute('role');
            }
        });
        toolbar.querySelectorAll('.cms-btn, .cms-toolbar-item-buttons > a').forEach(control => {
            if (!control.closest(menuSelector)) {
                control.setAttribute('role', 'button');
            }
        });
    }

    isDisabledItem(item) {
        return item.disabled || item.matches('.cms-btn-disabled') ||
            item.parentElement.matches('.cms-toolbar-item-navigation-disabled');
    }

    focus(control) {
        control?.focus();
    }

    focusin(event) {
        const toolbar = event.target.closest(toolbarSelector);

        if (toolbar && !event.target.closest(menuSelector)) {
            this.current.set(toolbar, event.target);
            this.prepare();
        }
    }

    focusout(event) {
        const toolbar = event.target.closest(toolbarSelector);

        if (toolbar && !toolbar.contains(event.relatedTarget)) {
            this.closeMenus();
        }
    }

    closeMenus() {
        $(document).trigger('click.cms.toolbar');
        document.querySelectorAll(toolbarSelector).forEach(toolbar => {
            toolbar.querySelectorAll(menuSelector).forEach(menu => {
                menu.style.display = 'none';
                this.triggerFor(menu)?.setAttribute('aria-expanded', 'false');
            });
            toolbar.querySelectorAll('.cms-toolbar-item-navigation-hover').forEach(item => {
                item.classList.remove('cms-toolbar-item-navigation-hover');
            });
            toolbar.querySelectorAll('.cms-dropdown-open').forEach(item => item.classList.remove('cms-dropdown-open'));
        });
    }

    openMenu(control, last = false) {
        const menu = this.menuFor(control);

        if (!menu || disabled(control)) {
            return;
        }
        if (control.closest(menuSelector)) {
            control.parentElement.parentElement.querySelectorAll(':scope > li > ul').forEach(sibling => {
                sibling.style.display = 'none';
                this.triggerFor(sibling)?.setAttribute('aria-expanded', 'false');
            });
        } else {
            this.focus(control);
            this.closeMenus();
        }
        menu.style.display = 'block';
        control.parentElement.classList.add('cms-toolbar-item-navigation-hover');
        control.closest('.cms-dropdown')?.classList.add('cms-dropdown-open');
        control.setAttribute('aria-expanded', 'true');
        const items = this.menuItems(menu);

        this.focus(items[last ? items.length - 1 : 0]);
        CMS.API?.Toolbar?._handleLongMenus?.();
    }

    menuItems(menu) {
        return Array.from(menu.querySelectorAll('[role="menuitem"]'))
            .filter(item => item.closest(menuSelector) === menu && visible(item));
    }

    move(items, current, { key, backwards = false }) {
        let index = items.indexOf(current) + (backwards ? -1 : 1);

        if (key === 'Home') {
            index = 0;
        } else if (key === 'End') {
            index = items.length - 1;
        }
        this.focus(items[(index + items.length) % items.length]);
    }

    closeMenu(menu) {
        const trigger = this.triggerFor(menu);

        menu.querySelectorAll(menuSelector).forEach(child => {
            child.style.display = 'none';
            this.triggerFor(child)?.setAttribute('aria-expanded', 'false');
        });
        menu.style.display = 'none';
        trigger?.setAttribute('aria-expanded', 'false');
        trigger?.parentElement.classList.remove('cms-toolbar-item-navigation-hover');
        menu.closest('.cms-dropdown')?.classList.remove('cms-dropdown-open');
        this.focus(trigger);
    }

    menuKeydown(event, menu) {
        const control = event.target.closest('[role="menuitem"]');

        if (event.key === 'Escape' ||
            (event.key === 'ArrowLeft' && this.triggerFor(menu)?.closest(menuSelector))) {
            this.closeMenu(menu);
        } else if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
            this.move(this.menuItems(menu), control, { key: event.key, backwards: event.key === 'ArrowUp' });
        } else if (event.key === 'ArrowRight') {
            this.openMenu(control);
        } else if (event.key === 'Enter' || event.key === ' ') {
            this.activate(control);
        }
    }

    activate(control) {
        if (!control || disabled(control)) {
            return;
        }
        if (this.menuFor(control)) {
            this.openMenu(control);
        } else {
            control.click();
        }
    }

    keydown(event) {
        const toolbar = event.target.closest(toolbarSelector);

        if (!handlesEvent(event, toolbar)) {
            return;
        }
        const menu = event.target.closest(menuSelector);

        if (event.key === 'Tab') {
            if (menu) {
                this.focus(this.rootTrigger(menu));
            }
            this.closeMenus();
            this.onExit?.();
            return;
        }
        if (!navigationKeys.includes(event.key) || event.target.matches('input, select, textarea, [contenteditable]')) {
            return;
        }
        event.stopPropagation();
        if (nativeLinkSpace(event, menu)) {
            return;
        }
        event.preventDefault();
        if (menu) {
            this.menuKeydown(event, menu);
        } else {
            this.toolbarKeydown(event, toolbar);
        }
    }

    toolbarKeydown(event, toolbar) {
        const rtl = window.getComputedStyle(toolbar).direction === 'rtl';
        const control = event.target.closest(controlSelector);

        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            this.closeMenus();
            this.move(this.controls(toolbar), control, {
                key: event.key, backwards: (event.key === 'ArrowLeft') !== rtl
            });
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            this.openMenu(control, event.key === 'ArrowUp');
        } else if (event.key === 'Enter' || event.key === ' ') {
            this.activate(control);
        } else if (event.key === 'Escape') {
            this.closeMenus();
            this.onEscape?.();
        }
    }

    rootTrigger(menu) {
        let trigger = this.triggerFor(menu);

        while (trigger?.closest(menuSelector)) {
            trigger = this.triggerFor(trigger.closest(menuSelector));
        }
        return trigger;
    }

    keyup(event) {
        if (event.target.closest(toolbarSelector) && !event.target.closest('.cms-form-login') &&
            [...navigationKeys, 'Tab'].includes(event.key)) {
            event.stopPropagation();
        }
    }

    pointerup(event) {
        if (event.target.closest('.cms-toolbar .cms-dropdown-toggle')) {
            event.stopPropagation();
        }
    }

    click(event) {
        const toolbar = event.target.closest(toolbarSelector);
        const control = event.target.closest(controlSelector);

        if (!toolbar) {
            this.closeMenus();
            return;
        }
        if (!control) {
            return;
        }
        if (disabled(control)) {
            event.preventDefault();
            event.stopPropagation();
        } else if (this.menuFor(control)) {
            event.preventDefault();
            event.stopPropagation();
            if (control.getAttribute('aria-expanded') === 'true') {
                this.closeMenu(this.menuFor(control));
            } else {
                this.openMenu(control);
            }
        } else {
            const menu = control.closest(menuSelector);

            if (menu && visible(menu)) {
                this.focus(this.rootTrigger(menu));
                this.closeMenus();
            }
        }
    }
}
