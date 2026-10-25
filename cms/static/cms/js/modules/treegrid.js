const controlSelector = 'a[href], button, input, select, textarea, [role="button"], [contenteditable]';
let sequence = 0;
const TYPEAHEAD_DELAY = 500;
const PAGE_ROWS = 10;

export function identify(element, prefix = 'cms-treegrid') {
    if (!element.id) {
        element.id = `${prefix}-${++sequence}`;
    }
    return element.id;
}

export function attribute(element, name, value) {
    if (!element) {
        return;
    }
    if (value === undefined || value === null) {
        element.removeAttribute(name);
    } else if (element.getAttribute(name) !== String(value)) {
        element.setAttribute(name, String(value));
    }
}

export function visible(element) {
    return !!element.getClientRects().length && window.getComputedStyle(element).visibility !== 'hidden';
}

export function controls(cell) {
    const items = cell.controls || [
        ...(cell.element.matches(controlSelector) ? [cell.element] : []),
        ...cell.element.querySelectorAll(controlSelector)
    ];

    return items.filter(element => visible(element) && !element.disabled &&
        !element.closest('[role="menu"], [aria-disabled="true"], .cms-btn-disabled'));
}

/** Shared row-first APG treegrid navigation; adapters own rendering and actions. */
export default class TreeGrid {
    constructor(root, adapter) {
        this.root = root;
        this.adapter = adapter;
        this.currentId = null;
        this.outside = true;
        this.search = '';
        this.lastTyped = 0;
        this.keydown = this.keydown.bind(this);
        this.focusin = this.focusin.bind(this);
        this.focusout = this.focusout.bind(this);
        root.addEventListener('keydown', this.keydown, true);
        root.addEventListener('focusin', this.focusin);
        root.addEventListener('focusout', this.focusout);
        this.refresh();
    }

    destroy() {
        this.root.removeEventListener('keydown', this.keydown, true);
        this.root.removeEventListener('focusin', this.focusin);
        this.root.removeEventListener('focusout', this.focusout);
    }

    refresh() {
        const removedFocus = this.focusedElement && !this.focusedElement.isConnected &&
            document.activeElement === document.body;

        this.rows = this.adapter.rows();
        const selected = this.adapter.selected?.() || this.currentId;
        const available = this.rows.filter(row => visible(row.element) && !row.header);
        const current = available.find(row => row.id === selected) || available[0];

        this.currentId = current?.id;
        attribute(this.root, 'role', 'treegrid');
        attribute(this.root, 'aria-label', this.adapter.label);
        attribute(this.root, 'aria-multiselectable', 'false');
        attribute(this.root, 'tabindex', available.length ? '-1' : '0');
        attribute(this.root, 'aria-rowcount', this.rows.length);
        attribute(this.root, 'aria-colcount', Math.max(0, ...this.rows.map(row => row.cells.length)));
        attribute(this.root, 'aria-owns', this.rows.filter(row => visible(row.element) || row.header)
            .map(row => identify(row.element)).join(' '));
        this.rows.forEach((row, index) => this.prepareRow(row, index));
        this.syncTabindex();
        if (removedFocus && current) {
            this.focusRow(current);
        }
    }

    prepareRow(row, index) {
        attribute(row.element, 'role', 'row');
        attribute(row.element, 'aria-rowindex', index + 1);
        attribute(row.element, 'aria-level', row.header ? undefined : row.level);
        attribute(row.element, 'aria-expanded', row.expanded);
        attribute(row.element, 'aria-selected', row.header ? undefined : row.id === this.currentId);
        attribute(row.element, 'aria-labelledby', row.header ? undefined : identify(row.cells[0].element));
        attribute(row.element, 'aria-owns', row.cells.map(cell => identify(cell.element)).join(' '));
        row.cells.forEach((cell, column) => {
            attribute(cell.element, 'role', row.header ? 'columnheader' : 'gridcell');
            attribute(cell.element, 'aria-colindex', column + 1);
            attribute(cell.element, 'tabindex', '-1');
        });
    }

    syncTabindex() {
        this.rows.forEach(row => {
            const active = row.id === (this.tabRowId || this.currentId);

            attribute(row.element, 'tabindex', active ? '0' : '-1');
            const selected = row.header ? undefined : row.id === this.currentId;

            attribute(row.element, 'aria-selected', selected);
            row.cells.forEach(cell => {
                attribute(cell.element, 'tabindex', '-1');
                const all = cell.controls ? [...cell.controls] :
                    Array.from(cell.element.querySelectorAll(controlSelector));

                if (cell.element.matches(controlSelector)) {
                    all.push(cell.element);
                }
                all.filter(element => !element.closest('[role="menu"]')).forEach(element => {
                    const tabbable = active && !this.outside && controls(cell).includes(element);

                    attribute(element, 'tabindex', tabbable ? '0' : '-1');
                });
            });
        });
    }

    rowFor(element) {
        return [...this.rows].reverse().find(row => row.element.contains(element) ||
            row.cells.some(cell => cell.element.contains(element) || cell.controls?.includes(element)));
    }

    focusin(event) {
        if (event.target.closest('[role="menu"]')) {
            return;
        }
        const row = this.rowFor(event.target);

        if (row) {
            this.focusedElement = event.target;
            this.tabRowId = row.id;
            this.outside = false;
            if (!row.header) {
                this.currentId = row.id;
                this.adapter.select?.(row);
            }
            this.syncTabindex();
        }
    }

    focusout(event) {
        if (!this.root.contains(event.relatedTarget)) {
            this.outside = true;
            this.tabRowId = this.currentId;
            this.syncTabindex();
        }
    }

    focusRow(row) {
        if (row) {
            row.element.focus();
        }
    }

    focusCell(row, index) {
        const cell = row?.cells[index];

        if (cell) {
            (controls(cell)[0] || cell.element).focus();
        }
    }

    columnFor(row, element) {
        return row.cells.findIndex(cell => cell.element.contains(element) || cell.controls?.includes(element));
    }

    async toggle(row, expanded) {
        await this.adapter.toggle?.(row, expanded);
        this.refresh();
    }

    tab(event, row) {
        const items = [row.element, ...row.cells.flatMap(cell => controls(cell))];
        const index = items.indexOf(event.target);
        let next = items[index + (event.shiftKey ? -1 : 1)];

        if (index < 0) {
            next = this.nextCellControl(row, event);
        }
        if (next && next !== row.element) {
            event.preventDefault();
            next.focus();
        } else if (event.shiftKey && next === row.element) {
            event.preventDefault();
            row.element.focus();
        } else {
            this.leave(event);
        }
    }

    nextCellControl(row, event) {
        const column = this.columnFor(row, event.target);
        const cells = event.shiftKey ? row.cells.slice(0, column) : row.cells.slice(column + 1);
        const candidates = cells.flatMap(cell => controls(cell));
        const next = candidates[event.shiftKey ? candidates.length - 1 : 0];

        return next || (event.shiftKey ? row.element : null);
    }

    leave(event) {
        const outside = Array.from(document.querySelectorAll(controlSelector + ', [tabindex]'))
            .filter(element => !this.root.contains(element) && element.tabIndex >= 0 && visible(element) &&
                !element.disabled && !element.closest('[inert], [aria-disabled="true"]'));
        const direction = event.shiftKey ? window.Node.DOCUMENT_POSITION_PRECEDING :
            window.Node.DOCUMENT_POSITION_FOLLOWING;
        // compareDocumentPosition returns a bit mask.
        // eslint-disable-next-line no-bitwise
        const candidates = outside.filter(element => this.root.compareDocumentPosition(element) & direction);
        const target = candidates[event.shiftKey ? candidates.length - 1 : 0];

        this.outside = true;
        this.tabRowId = this.currentId;
        this.syncTabindex();
        if (target) {
            event.preventDefault();
            target.focus();
        }
        this.adapter.exit?.();
    }

    moveRow(row, column, delta) {
        const rows = this.rows.filter(item => visible(item.element) && (!item.header || item.navigable));
        const index = rows.indexOf(row);
        const next = rows[Math.max(0, Math.min(rows.length - 1, index + delta))];

        if (column < 0) {
            this.focusRow(next?.header ? rows[index] : next);
        } else {
            this.focusCell(next, Math.min(column, next.cells.length - 1));
        }
    }

    horizontal(row, column, right) {
        if (column >= 0) {
            if (!right && column === 0) {
                this.focusRow(row);
            } else {
                this.focusCell(row, column + (right ? 1 : -1));
            }
        } else if (right && row.expanded === false) {
            this.toggle(row, true);
        } else if (!right && row.expanded === true) {
            this.toggle(row, false);
        } else if (right) {
            this.focusCell(row, 0);
        }
    }

    boundary(row, column, event) {
        const last = event.key === 'End';
        const rows = this.rows.filter(item => visible(item.element) && !item.header);

        if (column < 0 || event.ctrlKey) {
            const target = rows[last ? rows.length - 1 : 0];

            if (column < 0) {
                this.focusRow(target);
            } else {
                this.focusCell(target, Math.min(column, target.cells.length - 1));
            }
        } else {
            this.focusCell(row, last ? row.cells.length - 1 : 0);
        }
    }

    typeahead(event, row) {
        const printable = /^[\p{L}\p{N}]$/u.test(event.key);

        if (!this.adapter.typeahead || !printable || event.altKey || event.ctrlKey || event.metaKey) {
            return false;
        }
        const time = Date.now();

        this.search = time - this.lastTyped > TYPEAHEAD_DELAY ? event.key : this.search + event.key;
        this.lastTyped = time;
        const rows = this.rows.filter(item => !item.header && visible(item.element));
        const index = rows.indexOf(row);
        const ordered = [...rows.slice(index + 1), ...rows.slice(0, index + 1)];
        const repeated = Array.from(this.search).every(char => char === this.search[0]);
        const query = (repeated ? this.search[0] : this.search).toLocaleLowerCase();
        const match = ordered.find(item => item.label.trim().toLocaleLowerCase().startsWith(query));

        this.focusRow(match);
        return true;
    }

    keydown(event) {
        const interactive = event.target.closest('[role="menu"], input, textarea, select, [contenteditable]');

        if (event.defaultPrevented || interactive) {
            return;
        }
        const row = this.rowFor(event.target);

        if (!row) {
            return;
        }
        if (event.key === 'Tab') {
            this.tab(event, row);
            return;
        }
        const column = event.target === row.element ? -1 : this.columnFor(row, event.target);
        const handled = this.navigate(event, row, column) || this.typeahead(event, row);

        if (handled) {
            event.preventDefault();
            event.stopPropagation();
        }
    }

    navigate(event, row, column) {
        if (event.altKey || event.metaKey || (event.ctrlKey && !['Home', 'End'].includes(event.key))) {
            return false;
        }
        const actions = {
            ArrowUp: () => this.moveRow(row, column, -1),
            ArrowDown: () => this.moveRow(row, column, 1),
            PageUp: () => this.moveRow(row, column, -PAGE_ROWS),
            PageDown: () => this.moveRow(row, column, PAGE_ROWS),
            ArrowLeft: () => this.horizontal(row, column, false),
            ArrowRight: () => this.horizontal(row, column, true),
            Home: () => this.boundary(row, column, event),
            End: () => this.boundary(row, column, event),
            Enter: () => this.adapter.activate(row, column, event.target),
            ' ': () => this.adapter.activate(row, column, event.target),
            '/': () => this.adapter.find?.(row)
        };
        const action = actions[event.key];

        if (!action || (event.key === '/' && !this.adapter.find)) {
            return false;
        }
        action();
        return true;
    }
}
