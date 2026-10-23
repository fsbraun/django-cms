import { userEvent } from 'vitest/browser';
import CMS from '../../../static/cms/js/modules/cms.base';
import keyboard from '../../../static/cms/js/modules/keyboard';
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
        keyboard.unbind(['+', 'a', 'f > p'], 'cms');
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
