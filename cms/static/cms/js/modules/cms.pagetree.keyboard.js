import $ from 'jquery';

const focusableSelector = 'a[href], button, input, select, textarea, [tabindex], [contenteditable], summary, iframe';

function tabbable(elements) {
    return elements.filter(':visible').filter(function() {
        return this.tabIndex >= 0 && !this.disabled &&
            !$(this).closest('[inert], [aria-disabled="true"], .cms-btn-disabled').length;
    });
}

/** Include all page-tree controls in Tab navigation, in visual row order. */
export default class PageTreeKeyboard {
    constructor(container) {
        this.container = container;
        $(document).on('keydown.cms.pagetree.keyboard', event => this._onKeydown(event));
    }

    _rowOrder(grid) {
        const cellsByNode = new Map();
        const order = tabbable(grid.find('.jstree-grid-header').find(focusableSelector)).get();

        grid.find('[data-jstreegrid]').each(function() {
            const id = this.getAttribute('data-jstreegrid');

            if (!cellsByNode.has(id)) {
                cellsByNode.set(id, []);
            }
            cellsByNode.get(id).push(this);
        });
        grid.find('.jstree-node > .jstree-anchor').filter(':visible').each(function() {
            const id = this.parentNode.id;
            const rowCells = $(cellsByNode.get(id) || []);

            order.push(this);
            order.push(...tabbable(rowCells.find(focusableSelector)).filter(function() {
                return !$(this).closest('.js-cms-pagetree-dropdown-menu').length;
            }).get());
        });
        return order;
    }

    _tabOrder(grids, nativeOrder) {
        const visited = new Set();
        const order = [];

        // Include tree anchors even when jsTree gives them tabindex=-1.
        nativeOrder.add('.jstree-node > .jstree-anchor:visible').each((index, element) => {
            const grid = $(element).closest('.jstree-grid-wrapper')[0];

            if (!grids.includes(grid)) {
                order.push(element);
            } else if (!visited.has(grid)) {
                visited.add(grid);
                order.push(...this._rowOrder($(grid)));
            }
        });
        return order;
    }

    _onKeydown(event) {
        if (event.key !== 'Tab' || event.isDefaultPrevented() || event.altKey || event.ctrlKey || event.metaKey) {
            return;
        }
        const grids = this.container.find('.jstree-grid-wrapper').get();

        this._moveFocus(event, grids);
    }

    _moveFocus(event, grids) {
        const nativeOrder = tabbable($(focusableSelector));
        const order = this._tabOrder(grids, nativeOrder);
        const active = document.activeElement;
        const index = order.indexOf(active);
        const next = order[index + (event.shiftKey ? -1 : 1)];
        const currentGrid = $(active).closest('.jstree-grid-wrapper')[0];
        const inPageTree = this.container.has(active).length || this.container.has(next).length;

        // Safari's default Tab behavior skips ordinary links. Control the header
        // and empty trees as well as rows so Sites and New Page remain reachable.
        if (index < 0 || !inPageTree) {
            return;
        }
        if (next) {
            event.preventDefault();
            next.focus();
        } else if (currentGrid) {
            // At the document boundary let the browser move to its own chrome.
            const boundary = nativeOrder.filter(function() {
                return currentGrid.contains(this);
            });

            boundary.eq(event.shiftKey ? 0 : -1)[0]?.focus();
        }
    }
}
