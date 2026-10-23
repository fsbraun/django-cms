import { userEvent } from 'vitest/browser';
import CMS from '../../../static/cms/js/modules/cms.base';
import keyboard from '../../../static/cms/js/modules/keyboard';
import $ from 'jquery';
import { untrap, isTrapping } from '../../../static/cms/js/modules/trap';
import initPlaceholders from '../../../static/cms/js/modules/shortcuts/placeholders';

describe('structure board add shortcut', () => {
    let added;

    beforeEach(() => {
        window.CMS = CMS;
        CMS.config = { lang: { shortcutAreas: [{}, { shortcuts: { placeholders: { shortcut: 'f > p' } } }] } };
        fixture.set(`
            <button id="outside">Page action</button>
            <div class="cms-structure"><div class="cms-dragarea" tabindex="0" id="area">
                <div class="cms-dragbar">
                    <button id="expand">Expand all</button>
                    <button class="cms-submenu-add" id="placeholder-add">Add to placeholder</button>
                </div>
                <div class="cms-draggable"><div class="cms-dragitem">
                    <button id="plugin-label">Container</button>
                    <button class="cms-submenu-add" id="plugin-add">Add child</button>
                    <input aria-label="Plugin field" id="field">
                </div></div>
            </div></div>
        `);
        added = vi.fn();
        document.getElementById('placeholder-add').onclick = () => added('placeholder');
        document.getElementById('plugin-add').onclick = () => added('plugin');
        initPlaceholders();
    });

    afterEach(async () => {
        $(document).off('.cms.structurefocus');
        keyboard.unbind(['+', 'a'], 'cms');
        keyboard.unbind('f > p', 'global');
        keyboard.setContext('cms');
        await userEvent.cleanup();
        fixture.cleanup();
    });

    it('adds to the focused placeholder from the normal Tab navigation context', async () => {
        document.getElementById('expand').focus();
        await userEvent.keyboard('a');
        expect(added).toHaveBeenCalledExactlyOnceWith('placeholder');
    });

    it('adds to the focused plugin in both normal and legacy navigation contexts', async () => {
        for (const context of ['cms', 'placeholders', 'plugins']) {
            added.mockClear();
            keyboard.setContext(context);
            document.getElementById('plugin-label').focus();
            await userEvent.keyboard('a');
            expect(added).toHaveBeenCalledExactlyOnceWith('plugin');
        }
    });

    it('uses the first placeholder when focus is outside the board', async () => {
        document.getElementById('outside').focus();
        await userEvent.keyboard('a');
        expect(added).toHaveBeenCalledExactlyOnceWith('placeholder');
    });

    it('does not fall back to the placeholder when the selected plugin cannot accept children', async () => {
        document.getElementById('plugin-add').disabled = true;
        document.getElementById('plugin-label').focus();
        await userEvent.keyboard('a');
        expect(added).not.toHaveBeenCalled();
    });

    it('does not interfere with typing or activate while the board is hidden', async () => {
        document.getElementById('field').focus();
        await userEvent.keyboard('a');
        expect(document.getElementById('field').value).toBe('a');
        document.querySelector('.cms-structure').style.display = 'none';
        document.getElementById('outside').focus();
        await userEvent.keyboard('a');
        expect(added).not.toHaveBeenCalled();
    });
});


describe('focus placeholders shortcut', () => {
    let previousBoard;
    let board;

    beforeEach(() => {
        window.CMS = CMS;
        CMS.config = { lang: { shortcutAreas: [{}, { shortcuts: { placeholders: { shortcut: 'f > p / alt+p' } } }] } };
        CMS.API = CMS.API || {};
        previousBoard = CMS.API.StructureBoard;
        fixture.set(`
            <button id="focus-origin">Page action</button>
            <input id="page-next" aria-label="Next page field">
            <div class="cms-structure" style="display:none"><div class="cms-structure-content"></div></div>
        `);
        board = document.querySelector('.cms-structure');
        initPlaceholders();
        document.getElementById('focus-origin').focus();
    });

    afterEach(async () => {
        $(document).off('.cms.structurefocus');
        document.querySelectorAll('.cms-dragarea').forEach(untrap);
        untrap(document.querySelector('.cms-structure-content'));
        keyboard.unbind(['+', 'a'], 'cms');
        keyboard.unbind(['f > p', 'alt+p'], 'global');
        keyboard.setContext('cms');
        CMS.API.StructureBoard = previousBoard;
        await userEvent.cleanup();
        fixture.cleanup();
    });

    it('opens the board and waits for loaded placeholders before focusing them', async () => {
        let finishLoading;
        const loading = new Promise(resolve => {
            finishLoading = resolve;
        });

        CMS.API.StructureBoard = { show: vi.fn(() => loading.then(() => {
            board.style.display = 'block';
            board.firstChild.innerHTML = '<div class="cms-dragarea" id="loaded-area">Content</div>';
        })) };
        await userEvent.keyboard('fp');
        expect(CMS.API.StructureBoard.show).toHaveBeenCalledOnce();
        expect(document.activeElement.id).toBe('focus-origin');
        finishLoading();
        await vi.waitFor(() => expect(document.activeElement.id).toBe('loaded-area'));
        expect(keyboard.getContext()).toBe('placeholders');
    });

    it('focuses an already open board without opening it again', async () => {
        board.style.display = 'block';
        board.firstChild.innerHTML = '<div class="cms-dragarea" id="existing-area">Content</div>';
        CMS.API.StructureBoard = { show: vi.fn() };
        await userEvent.keyboard('fp');
        expect(CMS.API.StructureBoard.show).not.toHaveBeenCalled();
        expect(document.activeElement.id).toBe('existing-area');
    });

    it('releases all board traps and returns focus when Escape is pressed from a plugin', async () => {
        board.style.display = 'block';
        board.firstChild.innerHTML = '<div class="cms-dragarea" id="existing-area">' +
            '<div class="cms-draggable"><div class="cms-dragitem" id="plugin-row">' +
            '<button id="plugin-action">Edit</button></div></div></div>';
        await userEvent.keyboard('fp{Enter}');
        expect(keyboard.getContext()).toBe('plugins');
        expect(isTrapping(document.getElementById('existing-area'))).toBe(true);
        document.getElementById('plugin-action').focus();
        await userEvent.keyboard('fp{Enter}{Escape}');
        expect(document.activeElement.id).toBe('focus-origin');
        expect(keyboard.getContext()).toBe('cms');
        expect(isTrapping(board.firstChild)).toBe(false);
        expect(isTrapping(document.getElementById('existing-area'))).toBe(false);
        expect(board.querySelector('.cms-dragarea').hasAttribute('tabindex')).toBe(false);
        expect(document.getElementById('plugin-row').hasAttribute('tabindex')).toBe(false);
        await userEvent.tab();
        expect(document.activeElement.id).toBe('page-next');
    });

    it('leaves the board from ordinary keyboard navigation, including a focused input', async () => {
        board.style.display = 'block';
        board.firstChild.innerHTML = '<div class="cms-dragarea"><input id="board-field" aria-label="Filter"></div>';
        document.getElementById('board-field').focus();
        await userEvent.keyboard('{Escape}');
        expect(document.activeElement.id).toBe('focus-origin');
        expect(keyboard.getContext()).toBe('cms');
    });

    it('falls back to the page body when the entry control no longer exists', async () => {
        board.style.display = 'block';
        board.firstChild.innerHTML = '<div class="cms-dragarea">Content</div>';
        await userEvent.keyboard('fp');
        document.getElementById('focus-origin').remove();
        await userEvent.keyboard('{Escape}');
        expect(document.activeElement).toBe(document.body);
        expect(document.body.hasAttribute('tabindex')).toBe(false);
    });

    it('leaves focus alone when opening is unavailable or fails', async () => {
        const refused = vi.fn(() => Promise.resolve(false));
        const failed = vi.fn(() => Promise.reject(new Error('load failed')));

        for (const show of [refused, failed]) {
            CMS.API.StructureBoard = { show };
            await userEvent.keyboard('fp');
            expect(document.activeElement.id).toBe('focus-origin');
            expect(keyboard.getContext()).toBe('cms');
        }
    });
});
