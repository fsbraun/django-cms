import $ from 'jquery';
import { syncDisclosure, prepareSettingsMenu } from '../../../static/cms/js/modules/cms.structureboard.accessibility';

function press(element, key, shiftKey = false) {
    const event = new window.KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });

    element.dispatchEvent(event);
    return event;
}

describe('Structure board disclosures', () => {
    let host;
    let row;

    beforeEach(() => {
        host = $('<div class="cms-draggable"><div class="cms-dragitem">' +
            '<span class="cms-dragitem-text"><strong>Container</strong> title</span></div>' +
            '<div class="cms-collapsable-container cms-hidden"><div class="cms-draggable"></div></div></div>')
            .appendTo(document.body);
        row = host.children('.cms-dragitem');
    });
    afterEach(() => host.remove());

    it('exposes a named native disclosure and updates its restored expanded state', () => {
        syncDisclosure(row);
        const button = row.children('button');
        const children = host.children('.cms-collapsable-container');

        expect(button.text()).toBe('Container title');
        expect(button.attr('aria-expanded')).toBe('false');
        expect(document.getElementById(button.attr('aria-controls'))).toBe(children[0]);
        children.removeClass('cms-hidden');
        syncDisclosure(row);
        expect(button.attr('aria-expanded')).toBe('true');
    });

    it('removes disclosure semantics when the last child is deleted and restores them for new children', () => {
        syncDisclosure(row);
        host.find('.cms-collapsable-container').empty();
        syncDisclosure(row);
        expect(row.children('button').length).toBe(0);
        expect(row.children('span').attr('aria-expanded')).toBeUndefined();
        host.find('.cms-collapsable-container').append('<div class="cms-draggable"></div>');
        syncDisclosure(row);
        expect(row.children('button').attr('aria-expanded')).toBe('false');
    });
});

describe('Structure board action menus', () => {
    let host;
    let trigger;
    let menu;
    let close;

    beforeEach(() => {
        host = $('<div><button type="button">Actions for Text</button><div>' +
            '<div class="cms-submenu-item"><a href="#">Copy</a></div>' +
            '<div class="cms-submenu-item cms-submenu-item-disabled"><a href="#">Paste</a></div>' +
            '<div class="cms-submenu-item"><a href="#">Delete</a></div></div></div>').appendTo(document.body);
        trigger = host.children('button');
        menu = host.children('div');
        close = vi.fn(() => menu.hide());
        prepareSettingsMenu(trigger, menu, close);
    });
    afterEach(() => host.remove());

    it('connects the trigger and menu and skips disabled actions with arrow keys', () => {
        const actions = menu.find('a');

        expect(trigger.attr('aria-controls')).toBe(menu.attr('id'));
        expect(menu.attr('aria-labelledby')).toBe(trigger.attr('id'));
        expect(actions.eq(1).attr('aria-disabled')).toBe('true');
        actions[0].focus();
        press(actions[0], 'ArrowDown');
        expect(document.activeElement).toBe(actions[2]);
        press(actions[2], 'Home');
        expect(document.activeElement).toBe(actions[0]);
        press(actions[0], 'End');
        expect(document.activeElement).toBe(actions[2]);
        press(actions[2], 'ArrowDown');
        expect(document.activeElement).toBe(actions[0]);
    });

    it('closes on Escape and restores focus', () => {
        const action = menu.find('a')[0];

        action.focus();
        expect(press(action, 'Escape').defaultPrevented).toBe(true);
        expect(close).toHaveBeenCalledOnce();
        expect(document.activeElement).toBe(trigger[0]);
    });

    it('closes on Tab without preventing the next normal tab stop', () => {
        const action = menu.find('a')[0];

        action.focus();
        expect(press(action, 'Tab').defaultPrevented).toBe(false);
        expect(close).toHaveBeenCalledOnce();
        expect(document.activeElement).toBe(trigger[0]);
    });

    it('blocks disabled actions and supports Space activation', () => {
        const actions = menu.find('a');
        const activated = vi.fn();

        host.on('click', 'a', activated);
        actions[1].click();
        expect(activated).not.toHaveBeenCalled();
        press(actions[0], ' ');
        expect(activated).toHaveBeenCalledOnce();
    });
});
