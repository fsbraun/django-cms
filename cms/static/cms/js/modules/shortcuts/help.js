import Modal from '../cms.modal';

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
    }

    keyboard.setContext('cms');
    keyboard.bind('?', openModal);
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
        openModal(event);
    };
    document.addEventListener('click', helpClickHandler, true);
}
