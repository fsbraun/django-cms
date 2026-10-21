/* global KeyboardEvent */
import CMS from '../../../static/cms/js/modules/cms.base';
import Modal from '../../../static/cms/js/modules/cms.modal';
import Messages from '../../../static/cms/js/modules/cms.messages';
import Sideframe from '../../../static/cms/js/modules/cms.sideframe';
import initPlaceholders from '../../../static/cms/js/modules/shortcuts/placeholders';
import keyboard from '../../../static/cms/js/modules/keyboard';
import { trap, untrap, isTrapping } from '../../../static/cms/js/modules/trap';
import $ from 'jquery';

window.CMS = CMS;

const settleFocus = () => new Promise(resolve => setTimeout(resolve, 0));

describe('accessibility regressions', () => {
    let modal;
    let messages;

    beforeEach(() => {
        fixture.setBase('cms/tests/frontend/unit/fixtures');
        CMS.config = { lang: { loading: 'Loading' } };
        CMS.settings = { toolbar: 'expanded' };
        CMS.API.Tooltip = { hide: vi.fn() };
        CMS.API.Messages = { open: vi.fn() };
    });

    afterEach(() => {
        modal?._setModalState(false);
        clearTimeout(messages?.timer);
        clearTimeout(messages?.announcementTimer);
        vi.useRealTimers();
        keyboard.setContext('cms');
        fixture.cleanup();
        modal = null;
        messages = null;
    });

    it('allows focus to leave iframe fields for the dialog footer in both directions', async () => {
        fixture.load('modal.html');
        modal = new Modal();
        modal.ui.modal.show();
        const iframe = document.createElement('iframe');

        modal.ui.frame.append(iframe);
        iframe.contentDocument.body.innerHTML = '<input id="field" aria-label="Name">';
        modal.ui.modalButtons.html('<button id="save">Save</button>');
        modal._setModalState(true);
        trap(iframe.contentDocument.body, modal.ui.modal[0]);
        const field = iframe.contentDocument.getElementById('field');
        const save = document.getElementById('save');

        field.focus();
        field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        // Simulate the browser's default Tab destination; the trap must allow it.
        save.focus();
        await settleFocus();
        expect(document.activeElement).toBe(save);

        field.focus();
        field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
        modal.ui.closeAndCancel[0].focus();
        await settleFocus();
        expect(document.activeElement).toBe(modal.ui.closeAndCancel[0]);
    });

    it('allows markup content to reach footer controls', async () => {
        fixture.load('modal.html');
        modal = new Modal();
        modal._loadMarkup({ html: '<input id="field" aria-label="Name">', title: 'Edit' });
        modal.ui.modal.show();
        modal.ui.modalButtons.html('<button id="save">Save</button>');
        modal._setModalState(true);
        const field = document.getElementById('field');
        const save = document.getElementById('save');

        field.focus();
        field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        save.focus();
        await settleFocus();
        expect(document.activeElement).toBe(save);
    });

    it('restores background interaction on minimize and preserves existing inert regions', () => {
        fixture.load('modal.html');
        const background = document.createElement('button');
        const alreadyInert = document.createElement('div');

        alreadyInert.inert = true;
        fixture.el.append(background, alreadyInert);
        modal = new Modal();
        modal.ui.modal.addClass('cms-modal-open');
        modal._setModalState(true);
        expect(background.inert).toBe(true);
        expect(modal.ui.modal.attr('aria-modal')).toBe('true');

        modal.minimize();
        expect(background.inert).toBe(false);
        expect(alreadyInert.inert).toBe(true);
        expect(isTrapping(modal.ui.modal[0])).toBe(false);

        modal.minimize();
        expect(background.inert).toBe(true);
        modal._setModalState(false);
        expect(background.inert).toBe(false);
        expect(alreadyInert.inert).toBe(true);
    });

    it('does not toggle native modal buttons twice on Enter', () => {
        fixture.load('modal.html');
        modal = new Modal();
        const minimize = vi.spyOn(modal, 'minimize');

        modal._events();
        modal.ui.minimizeButton[0].click();
        modal.ui.minimizeButton.trigger(new $.Event('keyup', { keyCode: CMS.KEYS.ENTER }));
        expect(minimize).toHaveBeenCalledTimes(1);
    });

    it('closes the focused plugin menu rather than an earlier placeholder menu', () => {
        fixture.set(`
            <div class="cms-dragarea" tabindex="0">
                <div class="cms-dropdown-inner" id="earlier-menu"></div>
                <div class="cms-dragitem" tabindex="0">
                    <div class="cms-submenu-settings"></div>
                    <div class="cms-dropdown-inner" id="active-menu">
                        <a href="#" id="menu-action">Copy</a>
                    </div>
                </div>
            </div>`);
        CMS.config.lang.shortcutAreas = [{}, { shortcuts: { placeholders: { shortcut: 'alt+p' } } }];
        initPlaceholders();
        const dropdown = document.getElementById('active-menu');
        const toggle = vi.fn();

        document.querySelector('.cms-submenu-settings').addEventListener('pointerup', toggle);
        trap(dropdown);
        document.getElementById('menu-action').focus();
        keyboard.setContext('plugin-actions');
        keyboard.pressKey('Escape');
        expect(toggle).toHaveBeenCalledTimes(1);
        expect(isTrapping(dropdown)).toBe(false);
        expect(document.activeElement).toBe(document.querySelector('.cms-dragitem'));
        expect(keyboard.getContext()).toBe('plugins');
        untrap(dropdown);
    });

    it('closes and restores focus from the focused placeholder menu', () => {
        fixture.set(`
            <div class="cms-dropdown-inner" id="earlier-menu"></div>
            <div class="cms-dragarea" tabindex="0">
                <div class="cms-submenu-settings"></div>
                <div class="cms-dropdown-inner" id="active-menu"><a href="#" id="menu-action">Copy all</a></div>
            </div>`);
        CMS.config.lang.shortcutAreas = [{}, { shortcuts: { placeholders: { shortcut: 'alt+p' } } }];
        initPlaceholders();
        const dropdown = document.getElementById('active-menu');
        const toggle = vi.fn();

        document.querySelector('.cms-submenu-settings').addEventListener('pointerup', toggle);
        trap(dropdown);
        document.getElementById('menu-action').focus();
        keyboard.setContext('placeholder-actions');
        keyboard.pressKey('Escape');
        expect(toggle).toHaveBeenCalledTimes(1);
        expect(isTrapping(dropdown)).toBe(false);
        expect(document.activeElement).toBe(document.querySelector('.cms-dragarea'));
        expect(keyboard.getContext()).toBe('placeholders');
        untrap(dropdown);
    });

    it('keeps an explicitly persistent message open with a dismiss button', () => {
        fixture.load('messages.html');
        vi.useFakeTimers();
        messages = new Messages();
        const close = vi.spyOn(messages, 'close');

        messages.open({ message: 'Please review this error', delay: 0 });
        vi.advanceTimersByTime(10000);
        expect(close).not.toHaveBeenCalled();
        expect(messages.ui.messages.find('button.cms-messages-close')).toBeVisible();
        messages.ui.messages.find('button.cms-messages-close')[0].click();
        expect(close).toHaveBeenCalledTimes(1);
    });

    it('announces success and errors through separate persistent live regions', () => {
        fixture.load('messages.html');
        vi.useFakeTimers();
        messages = new Messages();
        messages.open({ message: '<strong>Saved</strong>', delay: 0 });
        vi.advanceTimersByTime(0);
        expect(document.querySelector('[role="status"]').textContent).toBe('Saved');
        expect(document.querySelector('[role="alert"]').textContent).toBe('');
        messages.open({ message: 'Save failed', error: true, delay: 0 });
        vi.advanceTimersByTime(0);
        expect(document.querySelector('[role="status"]').textContent).toBe('');
        expect(document.querySelector('[role="alert"]').textContent).toBe('Save failed');
    });

    it('keeps native history button disabled states in sync', () => {
        fixture.load('sideframe.html');
        const sideframe = new Sideframe();

        sideframe.history = { back: [], forward: [] };
        sideframe._updateHistoryButtons();
        expect(sideframe.ui.historyBack[0].disabled).toBe(true);
        expect(sideframe.ui.historyForward[0].disabled).toBe(true);
        sideframe.history = { back: ['previous', 'current'], forward: ['next'] };
        sideframe._updateHistoryButtons();
        expect(sideframe.ui.historyBack[0].disabled).toBe(false);
        expect(sideframe.ui.historyForward[0].disabled).toBe(false);
    });
});
