import keyboard from '../keyboard';
import $ from 'jquery';

const toolbarSelector = '.cms-toolbar, .cms-toolbar-trigger';
const eventNamespace = '.cms.toolbar.focus';

function focusableItems(toolbar) {
    return toolbar.find('a[href], button, input, select, textarea, [tabindex]')
        .filter(':visible')
        .filter(function() {
            return this.tabIndex >= 0 && !this.disabled && $(this).css('visibility') !== 'hidden' &&
                !$(this).closest('[inert], [aria-disabled="true"], .cms-btn-disabled, ' +
                    '.cms-toolbar-item-navigation-disabled').length;
        });
}

function restoreFocus(element) {
    const target = element?.isConnected && $(element).is(':visible') ? element : document.body;
    const tabindex = target.getAttribute('tabindex');

    // The shortcut can be invoked with the body (or other page content) focused.
    target.setAttribute('tabindex', '-1');
    target.focus();
    if (tabindex === null) {
        target.removeAttribute('tabindex');
    } else {
        target.setAttribute('tabindex', tabindex);
    }
}

/** Focus the toolbar and keep keyboard navigation inside it until Escape. */
export default function () {
    const data = CMS.config.lang.shortcutAreas[0].shortcuts.toolbar;
    let active = false;
    let previousFocus = null;

    keyboard.setContext('cms');
    keyboard.bind(data.shortcut.split(' / '), event => {
        const toolbar = $(CMS.settings.toolbar === 'expanded' ? '.cms-toolbar' : '.cms-toolbar-trigger');
        const items = focusableItems(toolbar);
        const navigation = items.filter('.cms-toolbar-item-navigation > li > a');
        const target = navigation[0] || items[0];

        if (!target) {
            return;
        }
        event.preventDefault();
        if (!active || !$(document.activeElement).closest(toolbarSelector).length) {
            previousFocus = document.activeElement;
        }
        active = true;
        target.focus();
    }, 'global');

    // Delegate so toolbar refreshes do not discard the focus cycle. Keeping the
    // handler on the toolbar also lets dialogs and sideframes manage their focus.
    $(document).off(eventNamespace).on('keydown' + eventNamespace, toolbarSelector, event => {
        if (!active || event.altKey || event.ctrlKey || event.metaKey) {
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            active = false;
            restoreFocus(previousFocus);
        } else if (event.key === 'Tab') {
            event.preventDefault();
            const items = focusableItems($(event.currentTarget));
            const index = items.index(document.activeElement);
            const next = index + (event.shiftKey ? -1 : 1);

            if (items.length) {
                items.eq((next + items.length) % items.length)[0].focus();
            }
        }
    });
}
