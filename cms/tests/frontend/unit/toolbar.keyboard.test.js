import { userEvent } from 'vitest/browser';
import $ from 'jquery';
import CMS from '../../../static/cms/js/modules/cms.base';
import keyboard from '../../../static/cms/js/modules/keyboard';
import initToolbarShortcut from '../../../static/cms/js/modules/shortcuts/toolbar';

const focused = id => expect(document.activeElement).toBe(document.getElementById(id));

describe('toolbar focus shortcut', () => {
    beforeEach(() => {
        window.CMS = CMS;
        CMS.config = { lang: { shortcutAreas: [{ shortcuts: { toolbar: { shortcut: 'f > t / alt+t' } } }] } };
        CMS.settings = { toolbar: 'expanded' };
        fixture.set(`
            <a href="#" id="before">Page content</a>
            <input id="after" aria-label="Next page field">
            <div class="cms-toolbar">
                <a href="#" id="logo">Logo</a>
                <ul class="cms-toolbar-item-navigation">
                    <li><a href="#" id="menu">Menu</a>
                        <ul id="submenu" style="display:none">
                            <li><a href="#" id="submenu-item">Settings</a></li>
                            <li class="cms-toolbar-item-navigation-disabled"><a href="#">Disabled item</a></li>
                        </ul>
                    </li>
                </ul>
                <a href="#" style="display:none">Hidden</a>
                <a href="#" aria-disabled="true">Unavailable</a>
                <button disabled>Disabled</button>
                <a href="#" tabindex="-1">Not tabbable</a>
                <a href="#" id="last">Edit</a>
            </div>
            <div class="cms-toolbar-trigger" style="display:none"><a href="#" id="trigger">Expand</a></div>
            <div id="dialog" style="display:none">
                <input id="field"><input id="dialog-next" aria-label="Next dialog field">
            </div>
        `);
        initToolbarShortcut();
        document.getElementById('before').focus();
    });

    afterEach(async () => {
        $(document).off('.cms.toolbar.focus');
        keyboard.unbind(['f > t', 'alt+t'], 'cms');
        keyboard.setContext('cms');
        await userEvent.cleanup();
        fixture.cleanup();
    });

    it('cycles forward and backward after f t, skipping hidden and disabled controls', async () => {
        await userEvent.keyboard('ft');
        focused('menu');
        await userEvent.tab();
        focused('last');
        await userEvent.tab();
        focused('logo');
        await userEvent.tab({ shift: true });
        focused('last');
        await userEvent.tab({ shift: true });
        focused('menu');
    });

    it('releases the cycle on Escape and restores the original page focus', async () => {
        await userEvent.keyboard('ft');
        await userEvent.keyboard('ft');
        await userEvent.keyboard('{Escape}');
        focused('before');
        await userEvent.tab();
        focused('after');
        document.getElementById('last').focus();
        await userEvent.tab();
        expect($('.cms-toolbar')[0].contains(document.activeElement)).toBe(false);
    });

    it('includes open menu items and allows Escape from a toolbar input', async () => {
        await userEvent.keyboard('ft');
        $('#submenu').show();
        await userEvent.tab();
        focused('submenu-item');
        await userEvent.tab();
        focused('last');
        $('.cms-toolbar').append('<input id="toolbar-field">');
        await userEvent.tab();
        focused('toolbar-field');
        await userEvent.keyboard('{Escape}');
        focused('before');
    });

    it('does not trap focus in a dialog opened from the toolbar', async () => {
        await userEvent.keyboard('ft');
        $('#dialog').show();
        document.getElementById('field').focus();
        await userEvent.tab();
        focused('dialog-next');
        $('#dialog').hide();
        document.getElementById('last').focus();
        await userEvent.tab();
        focused('logo');
        await userEvent.keyboard('{Escape}');
        focused('before');
    });

    it('supports a collapsed toolbar and the alt+t alternative', async () => {
        CMS.settings.toolbar = 'collapsed';
        $('.cms-toolbar').hide();
        $('.cms-toolbar-trigger').show();
        await userEvent.keyboard('{Alt>}t{/Alt}');
        focused('trigger');
        await userEvent.tab();
        focused('trigger');
        await userEvent.tab({ shift: true });
        focused('trigger');
        await userEvent.keyboard('{Escape}');
        focused('before');
    });

    it('falls back to the document when the original focus target is removed', async () => {
        await userEvent.keyboard('ft');
        $('#before').remove();
        await userEvent.keyboard('{Escape}');
        expect(document.activeElement).toBe(document.body);
        expect(document.body.hasAttribute('tabindex')).toBe(false);
    });
});
