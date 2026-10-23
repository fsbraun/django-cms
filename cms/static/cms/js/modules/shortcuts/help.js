import Modal from '../cms.modal';
import $ from 'jquery';

import keyboard from '../keyboard';
import tmpl from '../tmpl';
import template from './help.html';

let helpClickHandler;

/**
 * Binds [?] to open modal with shorcuts listing.
 *
 * @function initHelpShortcut
 * @public
 */
export default function initHelpShortcut() {
    var shortcutAreas = CMS.config.lang.shortcutAreas;
    var modal = new Modal({
        width: 600,
        height: 600,
        resizable: false,
        minimizable: false,
        maximizable: false
    });

    /**
     * openModal
     *
     * @private
     * @param {Event} e
     */
    function openModal(e) {
        e.preventDefault();

        modal.open({
            title: CMS.config.lang.shortcuts,
            width: 600,
            height: 660,
            html: tmpl(template, { shortcutAreas: shortcutAreas })
        });
        $(document).trigger('click.cms.toolbar');
    }

    keyboard.setContext('cms');
    keyboard.bind('?', openModal, 'global');
    if (helpClickHandler) {
        document.removeEventListener('click', helpClickHandler, true);
    }
    helpClickHandler = event => {
        if (!event.target.closest('.cms-show-shortcuts')) {
            return;
        }
        // Toolbar menus stop bubbling clicks. Capture native activation so Enter,
        // mouse clicks, and replacement toolbar markup all use the same action.
        event.stopPropagation();
        // The submenu closes behind the dialog. Return focus to its visible
        // top-level trigger when the dialog is dismissed.
        const menu = event.target.closest('.cms-toolbar-item-navigation > li');

        menu?.querySelector(':scope > a')?.focus();
        openModal(event);
    };
    document.addEventListener('click', helpClickHandler, true);
}
