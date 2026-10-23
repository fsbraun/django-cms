import $ from 'jquery';

let controlId = 0;

/** Keep disclosure semantics in sync after restoring state or updating plugins. */
function syncRowDisclosure(row) {
    const children = row.siblings('.cms-collapsable-container');
    let label = row.children('.cms-dragitem-text');
    const expandable = children.children('.cms-draggable').length > 0;

    row.toggleClass('cms-dragitem-collapsable', expandable);
    if (!label.length) {
        return;
    }
    const tag = expandable ? 'BUTTON' : 'SPAN';

    if (label[0].tagName !== tag) {
        const replacement = $(document.createElement(tag));

        replacement.attr('class', label.attr('class')).attr('title', label.attr('title'));
        replacement.append(label.contents());
        const focused = label.is(':focus');

        label.replaceWith(replacement);
        label = replacement;
        if (focused) {
            const target = expandable ? label : row.children('.cms-submenu-edit, .cms-submenu-settings').first();

            target[0]?.focus();
        }
    }
    if (expandable) {
        if (!children.attr('id')) {
            children.attr('id', `cms-plugin-children-${++controlId}`);
        }
        label.attr({
            type: 'button',
            'aria-controls': children.attr('id'),
            'aria-expanded': String(!children.hasClass('cms-hidden'))
        });
    } else {
        label.removeAttr('type aria-controls aria-expanded');
    }
}

export function syncDisclosure(rows) {
    rows.each(function() {
        syncRowDisclosure($(this));
    });
}

function focusMenuItem(items, index, key) {
    let next = (index + (key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;

    if (key === 'Home') {
        next = 0;
    } else if (key === 'End') {
        next = items.length - 1;
    }
    items[next]?.focus();
}

/** Match page-tree menus: arrows/Home/End, Escape, and Tab from the trigger. */
export function prepareSettingsMenu(trigger, menu, close) {
    if (!trigger.attr('id')) {
        trigger.attr('id', `cms-plugin-actions-${++controlId}`);
    }
    if (!menu.attr('id')) {
        menu.attr('id', `cms-plugin-menu-${++controlId}`);
    }
    trigger.attr({ 'aria-haspopup': 'menu', 'aria-controls': menu.attr('id') });
    menu.attr({ role: 'menu', tabindex: '-1', 'aria-labelledby': trigger.attr('id') });
    menu.find('.cms-submenu-item').attr('role', 'presentation');
    menu.find('a, button').attr({ role: 'menuitem', tabindex: '-1' }).each(function() {
        const item = $(this);

        item.attr('aria-disabled', String(item.parent().hasClass('cms-submenu-item-disabled')));
        if (!item.attr('aria-label') && item.text().trim()) {
            // CSS icon glyphs must not become part of the accessible name.
            item.attr('aria-label', item.text().trim());
        }
    });
    menu.off('click.cms.structuremenu').on('click.cms.structuremenu', '[aria-disabled="true"]', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
    });
    menu.off('keydown.cms.structuremenu').on('keydown.cms.structuremenu', event => {
        const items = menu.find('a, button').filter(':visible').filter(function() {
            return !this.disabled && $(this).attr('aria-disabled') !== 'true';
        });
        const index = items.index(document.activeElement);

        if (event.key === 'Escape' || event.key === 'Tab') {
            close();
            trigger[0]?.focus();
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
            }
        } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            event.stopPropagation();
            focusMenuItem(items, index, event.key);
        } else if (event.key === ' ' && items.is(event.target)) {
            event.preventDefault();
            event.target.click();
        }
    });
}
