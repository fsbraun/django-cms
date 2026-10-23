/* global PointerEvent */
import { trap, untrap } from '../trap.js';
import keyboard from '../keyboard.js';
import $ from 'jquery';


const queryAll = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const query = (selector, root = document) => root?.querySelector(selector);
const triggerPointerUp = el => {
    if (el?.tagName === 'BUTTON') {
        el.click();
    } else if (el) {
        el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    }
};
const triggerClick = el => {
    if (el) {
        el.click();
    }
};
const setTabIndex = (elements, value) => elements.forEach(el => el.setAttribute('tabindex', value));
const removeTabIndex = elements => elements.forEach(el => el.removeAttribute('tabindex'));
const focusElement = el => {
    if (el) {
        el.focus();
    }
};

function restoreFocus(element) {
    const target = element?.isConnected && element.getClientRects().length ? element : document.body;
    const tabindex = target.getAttribute('tabindex');

    target.setAttribute('tabindex', '-1');
    target.focus();
    if (tabindex === null) {
        target.removeAttribute('tabindex');
    } else {
        target.setAttribute('tabindex', tabindex);
    }
}

/** Add to the focused plugin, or the active placeholder when no plugin is focused. */
function addToSelection(event) {
    const board = query('.cms-structure');

    if (!board?.getClientRects().length) {
        return;
    }
    const active = document.activeElement;
    const plugin = active.closest('.cms-structure .cms-draggable');
    const area = active.closest('.cms-structure .cms-dragarea') || query('.cms-dragarea', board);
    const selector = plugin ? ':scope > .cms-dragitem > .cms-submenu-add' :
        ':scope > .cms-dragbar > .cms-submenu-add';
    const button = query(selector, plugin || area);

    if (!button || button.disabled || button.matches('.cms-btn-disabled, [aria-disabled="true"]')) {
        return;
    }
    event?.preventDefault();
    button.focus();
    triggerPointerUp(button);
}

/**
 * Binds shortcuts:
 * [esc] go back to global "cms" context
 * [enter] when focusing the placeholder - go to it's first plugin
 * [+] / [a] add plugin to placeholder
 * [x] expand all / collapse all
 * [s] open settings menu for current placeholder
 *
 * @function bindPlaceholderKeys
 * @private
 */
var bindPlaceholderKeys = function (exit) {
    keyboard.setContext('placeholders');
    keyboard.bind('escape', exit);

    keyboard.bind('enter', function () {
        keyboard.setContext('plugins');
        const area = document.activeElement.closest('.cms-dragarea');

        if (!area) {
            return;
        }
        const plugins = queryAll('.cms-dragitem', area);

        if (!plugins.length) {
            return;
        }
        setTabIndex(plugins, '0');
        focusElement(plugins[0]);
        trap(area);
        keyboard.setContext('plugins');
    });

    keyboard.bind(['+', 'a'], addToSelection);

    keyboard.bind('x', function () {
        const area = document.activeElement.closest('.cms-dragarea');

        if (!area) {
            return;
        }
        const toggler = queryAll('.cms-dragbar-toggler a, .cms-dragbar-toggler button', area)
            .find(element => element.getClientRects().length);

        triggerClick(toggler);
    });

    keyboard.bind(['!', 's'], function () {
        const area = document.activeElement.closest('.cms-dragarea');

        if (!area) {
            return;
        }
        const settingsBtn = query('.cms-submenu-settings', area);

        triggerPointerUp(settingsBtn);
        keyboard.setContext('placeholder-actions');
        const submenuItem = query('.cms-submenu-item a', area);

        focusElement(submenuItem);
        const dropdownInner = query('.cms-dropdown-inner', area);

        trap(dropdownInner);
    });
};


/**
 * Binds shortcuts:
 * [esc] go back to "placeholders" context
 *
 * @function bindPlaceholderActionKeys
 * @private
 */
var bindPlaceholderActionKeys = function () {
    keyboard.setContext('placeholder-actions');
    keyboard.bind('escape', function () {
        const dropdown = document.activeElement.closest('.cms-dropdown-inner');

        if (!dropdown) {
            return;
        }
        const area = dropdown.closest('.cms-dragarea');
        const settingsBtn = query('.cms-submenu-settings', area);

        triggerPointerUp(settingsBtn);
        untrap(dropdown);
        focusElement(area);
        keyboard.setContext('placeholders');
    });
};

/**
 * Binds shortcuts:
 * [esc] leave structure board keyboard navigation
 * [e] edit plugin
 * [+] / [a] add child plugin
 * [x] expand / collapse plugin
 * [s] open settings menu
 *
 * @function bindPluginKeys
 * @private
 */
var bindPluginKeys = function (exit) {
    keyboard.setContext('plugins');
    keyboard.bind('escape', exit);

    keyboard.bind('e', function () {
        const plugin = document.activeElement.closest('.cms-dragitem');

        if (!plugin) {
            return;
        }
        const editBtn = query('.cms-submenu-edit', plugin);

        triggerClick(editBtn);
    });
    keyboard.bind(['+', 'a'], addToSelection);

    keyboard.bind('x', function () {
        const plugin = document.activeElement.closest('.cms-dragitem');

        if (!plugin) {
            return;
        }
        const textBtn = query('.cms-dragitem-text', plugin);

        triggerClick(textBtn);
    });
    keyboard.bind(['!', 's'], function () {
        const plugin = document.activeElement.closest('.cms-dragitem');

        if (!plugin) {
            return;
        }
        const settingsBtn = query('.cms-submenu-settings', plugin);

        triggerPointerUp(settingsBtn);
        keyboard.setContext('plugin-actions');
        const submenuItem = query('.cms-submenu-item a', plugin);

        focusElement(submenuItem);
        const dropdownInner = query('.cms-dropdown-inner', plugin);

        trap(dropdownInner);
    });
};

/**
 * Binds shortcuts:
 * [esc] go back to "plugins" context
 *
 * @function bindPluginActionKeys
 * @private
 */
var bindPluginActionKeys = function () {
    keyboard.setContext('plugin-actions');
    keyboard.bind('escape', function () {
        const dropdown = document.activeElement.closest('.cms-dropdown-inner');

        if (!dropdown) {
            return;
        }
        const plugin = dropdown.closest('.cms-dragitem');
        const settingsBtn = query('.cms-submenu-settings', plugin);

        triggerPointerUp(settingsBtn);
        untrap(dropdown);
        focusElement(plugin);
        keyboard.setContext('plugins');
    });
};

/**
 * Binds [f p] / [alt+p] shortcuts to focus first placeholder.
 * Opens structure mode when the board is closed.
 *
 * @function initPlaceholders
 * @public
 */
export default function initPlaceholders() {
    const data = CMS.config.lang.shortcutAreas[1].shortcuts.placeholders;
    let previousFocus = null;
    const rememberFocus = origin => {
        if (origin && !origin.closest('.cms-structure, .cms-modal')) {
            previousFocus = origin;
        }
    };

    const exit = event => {
        const board = query('.cms-structure');

        if (!board?.contains(document.activeElement) || CMS.API?.StructureBoard?.dragging) {
            return;
        }
        event?.preventDefault();
        event?.stopPropagation();
        queryAll('.cms-structure-content, .cms-dragarea, .cms-dropdown-inner', board).forEach(untrap);
        removeTabIndex(queryAll('.cms-dragarea, .cms-dragitem', board));
        keyboard.setContext('cms');
        restoreFocus(previousFocus);
        previousFocus = null;
    };

    $(document).off('.cms.structurefocus')
        .on('focusin.cms.structurefocus', '.cms-structure', event => {
            rememberFocus(event.relatedTarget);
        })
        .on('keydown.cms.structurefocus', '.cms-structure', event => {
            if (event.key === 'Escape') {
                exit(event);
            }
        });

    bindPlaceholderKeys(exit);
    bindPlaceholderActionKeys();
    bindPluginKeys(exit);
    bindPluginActionKeys();

    keyboard.setContext('cms');
    keyboard.bind(['+', 'a'], addToSelection);

    keyboard.bind(data.shortcut.split(' / '), async function (event) {
        event?.preventDefault();
        const board = query('.cms-structure');

        rememberFocus(document.activeElement);

        if (!board?.getClientRects().length) {
            const structureBoard = CMS.API?.StructureBoard;

            if (!structureBoard) {
                return;
            }
            try {
                if (await structureBoard.show() === false) {
                    return;
                }
            } catch {
                // Loading failures are handled by the board's navigation fallback.
                return;
            }
        }
        const dragareas = queryAll('.cms-structure .cms-dragarea')
            .filter(area => area.getClientRects().length);

        if (!dragareas.length || keyboard.getContext() === 'modal') {
            return;
        }

        setTabIndex(dragareas, '0');
        focusElement(dragareas[0]);
        trap(query('.cms-structure-content'));
        keyboard.setContext('placeholders');
    }, 'global');
}
