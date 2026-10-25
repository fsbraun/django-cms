import $ from 'jquery';
import TreeGrid, { attribute, identify, controls, visible } from './treegrid';

/** Associate jsTree's parallel visual columns with logical treegrid rows. */
export default class PageTreeKeyboard {
    constructor(container, labels = {}) {
        this.container = container;
        this.labels = { tree: 'Pages', page: 'Page', information: 'Page information', actions: 'Actions',
            ...Object.fromEntries(Object.entries(labels).filter(([, value]) => value)) };
        this.grids = new Map();
        this.schedule = this.schedule.bind(this);
        container.on('ready.jstree redraw.jstree after_open.jstree after_close.jstree move_node.jstree', this.schedule);
        container.on('focusout.cms.pagetree.keyboard', this.schedule);
        this.prepare();
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

    prepare() {
        this.container.find('.jstree-grid-wrapper').each((index, root) => {
            if (this.grids.has(root)) {
                this.grids.get(root).controller.refresh();
            } else {
                this.create(root);
            }
        });
        this.grids.forEach((grid, root) => {
            if (!root.isConnected) {
                grid.controller.destroy();
                grid.observer.disconnect();
                this.grids.delete(root);
            }
        });
    }

    create(root) {
        const treeElement = root.querySelector('.jstree');
        const instance = () => $(treeElement).jstree(true);
        const controller = new TreeGrid(root, {
            label: this.labels.tree,
            typeahead: true,
            rows: () => this.rows(root, treeElement),
            selected: () => instance()?.get_selected?.()[0],
            select: row => {
                const tree = instance();

                if (tree && !tree.is_selected(row.id)) {
                    tree.deselect_all(true);
                    tree.select_node(row.id, true, true);
                }
            },
            toggle: (row, expanded) => new Promise(resolve => {
                const tree = instance();

                if (expanded) {
                    tree.open_node(row.id, resolve);
                } else {
                    tree.close_node(row.id);
                    resolve();
                }
            }),
            activate: (row, column, target) => this.activate(controller, row, { column, target })
        });
        const observer = new window.MutationObserver(this.schedule);

        observer.observe(root, { childList: true, subtree: true, attributes: true,
            attributeFilter: ['class', 'style', 'hidden'] });
        this.grids.set(root, { controller, observer });
    }

    headers(root, columns) {
        let headerRow = root.querySelector('.cms-treegrid-headers');

        if (!headerRow) {
            headerRow = document.createElement('div');
            headerRow.className = 'cms-treegrid-headers';
            root.prepend(headerRow);
        }
        const cells = columns.map((column, index) => {
            const header = column.querySelector('.jstree-grid-header');
            let element = header;

            if (!header || !visible(header)) {
                element = headerRow.children[index];
                if (!element) {
                    element = document.createElement('span');
                    headerRow.append(element);
                }
            }
            const fallback = [this.labels.page, this.labels.information][index] || this.labels.actions;
            const label = header?.textContent.trim() || fallback;

            attribute(element, 'aria-label', label);
            return { element };
        });

        return { id: identify(headerRow), element: headerRow, cells, header: true,
            navigable: cells.some(cell => controls(cell).length) };
    }

    rows(root, tree) {
        if (!tree) {
            return [];
        }
        attribute(tree, 'role', 'none');
        attribute(tree, 'tabindex', '-1');
        attribute(tree, 'aria-activedescendant', null);
        tree.querySelectorAll('ul').forEach(group => attribute(group, 'role', 'none'));
        root.querySelectorAll('.jstree-grid-column, .jstree-grid-midwrapper').forEach(column => {
            attribute(column, 'role', 'none');
        });
        const columns = Array.from(root.querySelectorAll('.jstree-grid-column'));
        const header = this.headers(root, columns);
        const cells = Array.from(root.querySelectorAll('[data-jstreegrid]'));
        const data = Array.from(tree.querySelectorAll('.jstree-node')).map(element => {
            const title = element.querySelector(':scope > .jstree-anchor');
            const extra = cells.filter(cell => cell.getAttribute('data-jstreegrid') === element.id);
            const label = title.textContent.replace(/\s+/g, ' ').trim();

            attribute(title, 'aria-label', label);
            return {
                id: element.id, element, label,
                level: $(element).parents('.jstree-node').length + 1,
                parentId: element.parentElement.closest('.jstree-node')?.id,
                expanded: element.matches('.jstree-leaf') ? undefined : element.matches('.jstree-open'),
                cells: [{ element: title }, ...extra.map(cell => ({ element: cell }))]
            };
        });

        return [header, ...data];
    }

    activate(controller, row, { column, target }) {
        if (column <= 0 && row.expanded !== undefined) {
            controller.toggle(row, !row.expanded);
            return;
        }
        const candidates = column <= 0 ? row.cells.slice(1).flatMap(cell => controls(cell)) :
            controls(row.cells[column]);
        const action = candidates.includes(target) ? target : candidates[0];

        action?.click();
    }

    destroy() {
        this.container.off(
            'ready.jstree redraw.jstree after_open.jstree after_close.jstree move_node.jstree', this.schedule
        );
        this.container.off('.cms.pagetree.keyboard');
        this.grids.forEach(grid => {
            grid.controller.destroy();
            grid.observer.disconnect();
        });
        this.grids.clear();
    }
}
