
import { userEvent } from 'vitest/browser';
import keyboard from '../../../static/cms/js/modules/keyboard';

describe('keyboard', () => {
    it('works as usual', () => {
        const callback = jasmine.createSpy();

        keyboard.bind('1', callback);
        keyboard.pressKey('1');
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('modifies callback execution to stop when inputs are focused', () => {
        const callback = jasmine.createSpy();

        keyboard.bind('1', callback);

        // Create and focus an input element
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();

        keyboard.pressKey('1');
        expect(callback).not.toHaveBeenCalled();

        // Cleanup
        document.body.removeChild(input);
    });
});


describe('global navigation shortcuts', () => {
    afterEach(async () => {
        keyboard.unbind(['f > p', 'f > t', '?'], 'global');
        keyboard.unbind('e', 'plugins');
        keyboard.setContext('cms');
        await userEvent.cleanup();
        fixture.cleanup();
    });

    it('keeps global sequences and help available in all structure navigation contexts', async () => {
        const placeholders = vi.fn();
        const toolbar = vi.fn();
        const help = vi.fn();

        keyboard.bind('f > p', placeholders, 'global');
        keyboard.bind('f > t', toolbar, 'global');
        keyboard.bind('?', help, 'global');
        for (const context of ['cms', 'placeholders', 'plugins', 'placeholder-actions', 'plugin-actions']) {
            keyboard.setContext(context);
            await userEvent.keyboard('fpft?');
        }
        expect(placeholders).toHaveBeenCalledTimes(5);
        expect(toolbar).toHaveBeenCalledTimes(5);
        expect(help).toHaveBeenCalledTimes(5);
    });

    it('keeps ordinary actions scoped to their navigation context', async () => {
        const edit = vi.fn();

        keyboard.bind('e', edit, 'plugins');
        keyboard.setContext('placeholders');
        await userEvent.keyboard('e');
        expect(edit).not.toHaveBeenCalled();
        keyboard.setContext('plugins');
        await userEvent.keyboard('e');
        expect(edit).toHaveBeenCalledOnce();
    });

    it('preserves typing and modal keyboard handling', async () => {
        const help = vi.fn();

        keyboard.bind('?', help, 'global');
        fixture.set('<input id="global-shortcut-field" aria-label="Text">');
        document.getElementById('global-shortcut-field').focus();
        await userEvent.keyboard('?');
        expect(document.getElementById('global-shortcut-field').value).toBe('?');
        document.getElementById('global-shortcut-field').blur();
        keyboard.setContext('modal');
        await userEvent.keyboard('?');
        expect(help).not.toHaveBeenCalled();
    });
});
