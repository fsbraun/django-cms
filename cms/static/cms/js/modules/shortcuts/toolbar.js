import keyboard from '../keyboard';
import $ from 'jquery';

import ToolbarKeyboard from '../cms.toolbar.keyboard';

const toolbarSelector = '.cms-toolbar, .cms-toolbar-trigger';
let navigation;

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

/** Focus the toolbar without adding an extra Tab stop or trapping Tab. */
export default function () {
    const data = CMS.config.lang.shortcutAreas[0].shortcuts.toolbar;
    let active = false;
    let previousFocus = null;

    navigation?.destroy();
    navigation = new ToolbarKeyboard();
    navigation.onEscape = () => {
        if (active) {
            active = false;
            restoreFocus(previousFocus);
        }
    };
    navigation.onExit = () => {
        active = false;
    };
    keyboard.setContext('cms');
    keyboard.bind(data.shortcut.split(' / '), event => {
        navigation.prepare();
        const toolbar = document.querySelector(CMS.settings.toolbar === 'expanded' ?
            '.cms-toolbar' : '.cms-toolbar-trigger');
        const target = toolbar && navigation.current.get(toolbar);

        if (!target) {
            return;
        }
        event.preventDefault();
        if (!active || !$(document.activeElement).closest(toolbarSelector).length) {
            previousFocus = document.activeElement;
        }
        active = true;
        navigation.closeMenus();
        navigation.focus(target);
    }, 'global');
    return navigation;
}
