import { userEvent } from 'vitest/browser';
import $ from 'jquery';
import CMS from '../../../static/cms/js/modules/cms.base';
import keyboard from '../../../static/cms/js/modules/keyboard';
import initToolbarShortcut from '../../../static/cms/js/modules/shortcuts/toolbar';

const focused = id => expect(document.activeElement).toBe(document.getElementById(id));

describe('toolbar keyboard navigation', () => {
    let navigation;

    beforeEach(() => {
        window.CMS = CMS;
        CMS.config = { lang: { shortcutAreas: [{ shortcuts: { toolbar: { shortcut: 'f > t / alt+t' } } }] } };
        CMS.settings = { toolbar: 'expanded' };
        fixture.set(`
            <a href="#" id="before">Page content</a>
            <div class="cms-toolbar" role="toolbar" aria-label="CMS toolbar">
                <a href="#" id="logo">Logo</a>
                <ul class="cms-toolbar-item-navigation">
                    <li><a href="#" id="menu">Menu</a>
                        <ul id="submenu" style="display:none">
                            <li><a href="#" id="submenu-item">Settings</a></li>
                            <li class="cms-toolbar-item-navigation-disabled">
                                <a href="#" id="disabled-item">Disabled</a></li>
                            <li class="cms-toolbar-item-navigation-children"><a href="#" id="nested">Languages</a>
                                <ul style="display:none"><li><a href="#" id="nested-item">English</a></li></ul>
                            </li>
                        </ul>
                    </li>
                </ul>
                <a href="#" style="display:none">Hidden</a>
                <a href="#" aria-disabled="true">Unavailable</a>
                <button disabled>Disabled</button>
                <a href="#" tabindex="-1">Not tabbable</a>
                <a href="#" role="button" id="last">Edit</a>
            </div>
            <div class="cms-toolbar-trigger" style="display:none"><a href="#" id="trigger">Expand</a></div>
            <input id="after" aria-label="Next page field">
            <div id="dialog" style="display:none">
                <input id="field"><input id="dialog-next" aria-label="Next dialog field">
            </div>
        `);
        navigation = initToolbarShortcut();
        document.getElementById('before').focus();
    });

    afterEach(async () => {
        navigation.destroy();
        keyboard.unbind(['f > t', 'alt+t'], 'global');
        keyboard.unbind('space', 'cms');
        keyboard.setContext('cms');
        await userEvent.cleanup();
        fixture.cleanup();
    });

    it('has one Tab stop and lets Tab enter and leave the toolbar', async () => {
        expect($('.cms-toolbar [tabindex="0"]').length).toBe(1);
        await userEvent.tab();
        focused('logo');
        await userEvent.tab();
        focused('after');
        await userEvent.tab({ shift: true });
        focused('logo');
        await userEvent.tab({ shift: true });
        focused('before');
    });

    it('uses arrows, Home, and End to navigate enabled toolbar controls', async () => {
        await userEvent.keyboard('ft');
        focused('logo');
        await userEvent.keyboard('{ArrowRight}');
        focused('menu');
        await userEvent.keyboard('{ArrowRight}');
        focused('last');
        await userEvent.keyboard('{ArrowRight}');
        focused('logo');
        await userEvent.keyboard('{ArrowLeft}');
        focused('last');
        await userEvent.keyboard('{Home}');
        focused('logo');
        await userEvent.keyboard('{End}');
        focused('last');
        await userEvent.tab();
        focused('after');
        await userEvent.tab({ shift: true });
        focused('last');
    });

    it('uses visual arrow direction in RTL toolbars', async () => {
        $('.cms-toolbar').attr('dir', 'rtl');
        await userEvent.keyboard('ft{ArrowRight}');
        focused('last');
        await userEvent.keyboard('{ArrowLeft}');
        focused('logo');
    });

    it('opens menus with Enter and navigates nested menus independently', async () => {
        await userEvent.keyboard('ft{ArrowRight}{Enter}');
        focused('submenu-item');
        expect($('#menu').attr('aria-expanded')).toBe('true');
        expect($('#submenu').attr('aria-labelledby')).toBe('menu');
        await userEvent.keyboard('{ArrowDown}');
        focused('disabled-item');
        const activate = vi.fn();

        $('#disabled-item').on('click', activate);
        await userEvent.keyboard('{Enter}');
        expect(activate).not.toHaveBeenCalled();
        await userEvent.keyboard('{End}{ArrowRight}');
        focused('nested-item');
        await userEvent.keyboard('{Escape}');
        focused('nested');
        await userEvent.keyboard('{Home}');
        focused('submenu-item');
        await userEvent.keyboard('{Escape}');
        focused('menu');
        expect($('#menu').attr('aria-expanded')).toBe('false');
        await userEvent.keyboard('{Escape}');
        focused('before');
    });

    it('opens the last menu item with Up and leaves the menu on Tab', async () => {
        await userEvent.keyboard('ft{ArrowRight}{ArrowUp}');
        focused('nested');
        await userEvent.tab();
        focused('after');
        expect($('#submenu').css('display')).toBe('none');
        await userEvent.tab({ shift: true });
        focused('menu');
        await userEvent.keyboard('{ArrowDown}');
        focused('submenu-item');
        await userEvent.tab({ shift: true });
        focused('before');
    });

    it('closes menus when focus leaves through a global shortcut', async () => {
        keyboard.bind('f > p', () => document.getElementById('after').focus(), 'global');
        await userEvent.keyboard('ft{ArrowRight}{Enter}fp');
        focused('after');
        expect($('#menu').attr('aria-expanded')).toBe('false');
        keyboard.unbind('f > p', 'global');
    });

    it('activates toolbar buttons once with Enter and Space without toggling structure mode', async () => {
        const activate = vi.fn(event => event.preventDefault());
        const toggleStructure = vi.fn();

        $('#last').on('click', activate);
        keyboard.bind('space', toggleStructure, 'cms');
        await userEvent.keyboard('ft{End}{Enter} ');
        expect(activate).toHaveBeenCalledTimes(2);
        expect(toggleStructure).not.toHaveBeenCalled();
    });

    it('preserves independent dialog focus handling', async () => {
        await userEvent.keyboard('ft');
        $('#dialog').show();
        document.getElementById('field').focus();
        await userEvent.tab();
        focused('dialog-next');
    });

    it('supports a collapsed toolbar without trapping Tab', async () => {
        CMS.settings.toolbar = 'collapsed';
        $('.cms-toolbar').hide();
        $('.cms-toolbar-trigger').show();
        await userEvent.keyboard('{Alt>}t{/Alt}');
        focused('trigger');
        await userEvent.tab();
        focused('after');
    });

    it('prepares replacement toolbar controls and preserves a single Tab stop', async () => {
        $('.cms-toolbar').html('<button id="replacement-first">First</button>' +
            '<button id="replacement-last">Last</button>');
        await vi.waitFor(() => expect($('#replacement-last').attr('tabindex')).toBe('-1'));
        await userEvent.keyboard('ft');
        focused('replacement-first');
        await userEvent.keyboard('{ArrowRight}');
        focused('replacement-last');
        expect($('.cms-toolbar [tabindex="0"]').length).toBe(1);
    });

    it('supports action dropdowns with Up/Down, Space, and Escape', async () => {
        $('.cms-toolbar').append('<div class="cms-dropdown">' +
            '<button class="cms-dropdown-toggle" id="more">More actions</button>' +
            '<ul class="cms-dropdown-menu" style="display:none">' +
            '<li><a href="#" id="dropdown-item">Publish</a></li></ul></div>');
        navigation.prepare();
        await userEvent.keyboard('ft{End} ');
        focused('dropdown-item');
        await userEvent.keyboard('{Escape}');
        focused('more');
        await userEvent.keyboard('{ArrowDown}');
        focused('dropdown-item');
    });

    it('keeps pointer activation of menu triggers working', async () => {
        await userEvent.click(document.getElementById('menu'));
        focused('submenu-item');
        expect($('#menu').attr('aria-expanded')).toBe('true');
        document.body.click();
        expect($('#menu').attr('aria-expanded')).toBe('false');
    });

    it('leaves the toolbar login form in the normal Tab sequence', async () => {
        navigation.destroy();
        $('.cms-toolbar').html('<form class="cms-form-login">' +
            '<input id="username"><input id="password"><button id="login">Login</button></form>');
        navigation = initToolbarShortcut();
        document.getElementById('username').focus();
        await userEvent.tab();
        focused('password');
        await userEvent.tab();
        focused('login');
    });

    it('falls back to the document when the shortcut origin is removed', async () => {
        await userEvent.keyboard('ft');
        $('#before').remove();
        await userEvent.keyboard('{Escape}');
        expect(document.activeElement).toBe(document.body);
    });
});
