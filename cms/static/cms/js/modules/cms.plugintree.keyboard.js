import $ from 'jquery';
import keyboard from './keyboard';
import { Helpers } from './cms.base';
import TreeGrid, { attribute, identify, controls, visible } from './treegrid';

/** Apply the shared treegrid model to each placeholder's plugin hierarchy. */
export default class PluginTreeKeyboard {
    constructor(root) {
        this.root = root;
        this.grids = new Map();
        this.modalOrigins = new WeakMap();
        this.schedule = this.schedule.bind(this);
        this.observer = new window.MutationObserver(this.schedule);
        this.observer.observe(root, { childList: true, subtree: true, attributes: true,
            attributeFilter: ['class', 'hidden'] });
        Helpers.removeEventListener('modal-load.plugintree modal-closed.plugintree');
        Helpers.addEventListener('modal-load.plugintree', (event, { instance }) => {
            const origin = this.controllerFor(document.activeElement);

            if (origin) {
                this.modalOrigins.set(instance, origin);
            }
        });
        Helpers.addEventListener('modal-closed.plugintree', (event, { instance }) => {
            const origin = this.modalOrigins.get(instance);

            if (origin && document.activeElement === document.body && visible(root)) {
                origin.refresh();
                origin.focusRow(origin.rows.find(row => row.id === origin.currentId));
            }
            this.modalOrigins.delete(instance);
        });
        this.prepare();
    }

    text(key, fallback) {
        return CMS.config.lang?.[key] || fallback;
    }

    schedule() {
        if (!this.pending) {
            this.pending = true;
            Promise.resolve().then(() => {
                this.pending = false;
                this.prepare();
            });
        }
    }

    controllerFor(element) {
        const root = element.closest('.cms-draggables-root');

        return this.grids.get(root);
    }

    prepare() {
        this.prepareSearch();
        this.root.querySelectorAll('.cms-draggables-root').forEach(root => {
            if (this.grids.has(root)) {
                this.grids.get(root).refresh();
            } else {
                this.create(root);
            }
        });
        this.grids.forEach((controller, root) => {
            if (!root.isConnected) {
                controller.destroy();
                this.grids.delete(root);
            }
        });
    }

    create(root) {
        const controller = new TreeGrid(root, {
            label: root.getAttribute('aria-label') || this.text('plugins', 'Plugins'),
            rows: () => this.rows(root),
            select: () => {
                keyboard.setContext('plugins');
                this.lastGrid = controller;
            },
            toggle: (row, expanded) => {
                const label = row.element.querySelector('.cms-dragitem-text');

                if (label.getAttribute('aria-expanded') === String(expanded)) {
                    return;
                }
                label.click();
                return new Promise(resolve => window.setTimeout(resolve, 0));
            },
            activate: (row, column, target) => this.activate(controller, row, { column, target }),
            find: () => this.find(),
            exit: () => keyboard.setContext('cms')
        });

        this.grids.set(root, controller);
    }

    rows(root) {
        const gridId = identify(root, 'cms-plugin-treegrid');
        const names = [this.text('plugin', 'Plugin'), this.text('edit', 'Edit'),
            this.text('add', 'Add plugin'), this.text('actions', 'Actions')];
        const header = this.header(root, names);
        const rows = Array.from(root.querySelectorAll('.cms-draggable > .cms-dragitem')).map(element => {
            const plugin = element.parentElement;
            const key = plugin.className.match(/cms-draggable-(\d+)/)?.[1] || identify(plugin);
            const id = `${gridId}-row-${key}`;
            const label = element.querySelector(':scope > .cms-dragitem-text');
            const children = plugin.querySelector(':scope > .cms-collapsable-container');
            const expanded = children?.querySelector(':scope > .cms-draggable') ?
                !children.classList.contains('cms-hidden') : undefined;

            attribute(element, 'id', id);
            attribute(plugin, 'role', 'none');
            attribute(children, 'role', 'none');
            attribute(children, 'aria-label', null);
            attribute(label, 'id', `${id}-title`);
            attribute(label, 'aria-expanded', expanded);
            const cells = [{ element: label }, ...['edit', 'add', 'settings'].map((action, index) =>
                this.actionCell(element, action, { name: names[index + 1], rowId: id }))];

            return { id, element, cells, expanded,
                parentId: plugin.parentElement.closest('.cms-draggable')?.querySelector(':scope > .cms-dragitem')?.id,
                label: label.textContent.replace(/\s+/g, ' ').trim(),
                level: $(plugin).parentsUntil(root, '.cms-draggable').length + 1 };
        });

        return [header, ...rows];
    }

    header(root, names) {
        let element = root.parentElement.querySelector(':scope > .cms-treegrid-headers');

        if (!element) {
            element = document.createElement('div');
            element.className = 'cms-treegrid-headers';
            names.forEach(name => {
                const cell = document.createElement('span');

                cell.textContent = name;
                element.append(cell);
            });
            root.before(element);
        }
        return { id: identify(element), element, cells: Array.from(element.children).map(cell => ({ element: cell })),
            header: true, navigable: false };
    }

    actionCell(row, action, { name, rowId }) {
        let element = row.querySelector(`:scope > .cms-treegrid-cell-${action}`);
        const button = row.querySelector(`:scope > .cms-submenu-${action}`);

        if (!element) {
            element = document.createElement('span');
            element.className = `cms-treegrid-action-cell cms-treegrid-cell-${action}`;
            row.append(element);
        }
        attribute(element, 'id', `${rowId}-${action}`);
        attribute(element, 'aria-label', name);
        attribute(element, 'aria-disabled', !button || button.disabled);
        const owned = button ? [identify(button)] : [];

        if (action === 'settings') {
            const menu = row.querySelector(':scope > .cms-submenu-dropdown');

            if (menu) {
                owned.push(identify(menu));
            }
        }
        attribute(element, 'aria-owns', owned.join(' '));
        return { element, controls: button ? [button] : [] };
    }

    activate(controller, row, { column, target }) {
        if (column <= 0) {
            if (row.expanded === undefined) {
                row.element.querySelector('.cms-submenu-edit')?.click();
            } else {
                controller.toggle(row, !row.expanded);
            }
        } else {
            const available = controls(row.cells[column]);

            (available.includes(target) ? target : available[0])?.click();
        }
    }

    prepareSearch() {
        const content = this.root.querySelector('.cms-structure-content');

        if (!content || content.querySelector(':scope > .cms-treegrid-find')) {
            return;
        }
        const panel = document.createElement('div');
        const toggle = document.createElement('button');
        const form = document.createElement('div');
        const input = document.createElement('input');
        const status = document.createElement('span');

        panel.className = 'cms-treegrid-find';
        toggle.type = 'button';
        toggle.textContent = this.text('findPlugins', 'Find plugins');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-controls', identify(form));
        form.hidden = true;
        input.type = 'search';
        input.setAttribute('aria-label', toggle.textContent);
        status.setAttribute('role', 'status');
        status.setAttribute('aria-atomic', 'true');
        input.addEventListener('input', () => {
            this.matches = Array.from(this.grids.values()).flatMap(controller => controller.rows
                .filter(row => !row.header && row.label.toLocaleLowerCase().includes(input.value.toLocaleLowerCase()))
                .map(row => ({ row, controller })));
            this.matchIndex = 0;
            status.textContent = this.text('pluginMatches', 'Matching plugins: %s').replace('%s', this.matches.length);
        });
        input.addEventListener('keydown', event => this.searchKeydown(event));
        toggle.addEventListener('click', () => {
            if (form.hidden) {
                this.find();
            } else {
                this.closeSearch();
            }
        });
        form.append(input, status);
        panel.append(toggle, form);
        content.prepend(panel);
        this.searchUI = { toggle, form, input, status };
    }

    find() {
        const { toggle, form, input } = this.searchUI;

        this.searchOrigin = document.activeElement;
        form.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
        input.focus();
        input.select();
        input.dispatchEvent(new window.Event('input'));
    }

    closeSearch() {
        this.searchUI.form.hidden = true;
        this.searchUI.toggle.setAttribute('aria-expanded', 'false');
        (this.searchOrigin?.isConnected ? this.searchOrigin : this.searchUI.toggle).focus();
    }

    searchKeydown(event) {
        if (!['Enter', 'Escape', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (event.key === 'Escape') {
            this.closeSearch();
        } else if (event.key === 'Enter') {
            this.revealMatch();
        } else if (this.matches.length) {
            const delta = event.key === 'ArrowDown' ? 1 : -1;

            this.matchIndex = (this.matchIndex + delta + this.matches.length) % this.matches.length;
            this.searchUI.status.textContent = this.matches[this.matchIndex].row.label;
        }
    }

    async revealMatch() {
        const match = this.matches[this.matchIndex];

        if (!match) {
            return;
        }
        let ancestor = match.controller.rows.find(row => row.id === match.row.parentId);
        const ancestors = [];

        while (ancestor) {
            ancestors.unshift(ancestor);
            const parentId = ancestor.parentId;

            ancestor = match.controller.rows.find(row => row.id === parentId);
        }
        for (const row of ancestors) {
            await match.controller.toggle(row, true);
        }
        this.searchUI.form.hidden = true;
        this.searchUI.toggle.setAttribute('aria-expanded', 'false');
        match.controller.refresh();
        match.controller.focusRow(match.controller.rows.find(row => row.id === match.row.id));
    }

    destroy() {
        this.observer.disconnect();
        Helpers.removeEventListener('modal-load.plugintree modal-closed.plugintree');
        this.grids.forEach(controller => controller.destroy());
    }
}
