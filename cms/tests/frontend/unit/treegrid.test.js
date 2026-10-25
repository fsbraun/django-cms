import { userEvent } from 'vitest/browser';
import TreeGrid from '../../../static/cms/js/modules/treegrid';

const focused = id => expect(document.activeElement.id).toBe(id);

describe('shared treegrid keyboard model', () => {
    let grid;
    let expanded;
    let selected;
    let activate;

    beforeEach(() => {
        expanded = false;
        selected = null;
        activate = vi.fn();
        fixture.set(`<button id="before">Before</button><div id="grid">
            <div id="parent"><span id="parent-title">  Parent  </span>
                <span id="parent-action"><button id="edit-parent">Edit parent</button></span></div>
            <div id="child" hidden><span id="child-title">Child</span>
                <span id="child-action"><button id="edit-child">Edit child</button></span></div>
            <div id="last"><span id="last-title">Last</span>
                <span id="last-action"><button id="edit-last">Edit last</button></span></div>
        </div><button id="after">After</button>`);
        const rows = () => ['parent', 'child', 'last'].map(id => ({
            id, element: document.getElementById(id), label: document.getElementById(id + '-title').textContent,
            parentId: id === 'child' ? 'parent' : undefined,
            level: id === 'child' ? 2 : 1,
            expanded: id === 'parent' ? expanded : undefined,
            cells: ['title', 'action'].map(suffix => ({ element: document.getElementById(id + '-' + suffix) }))
        }));

        grid = new TreeGrid(document.getElementById('grid'), {
            label: 'Content', rows, typeahead: true, selected: () => selected,
            select: row => {
                selected = row.id;
            },
            toggle: (row, value) => {
                expanded = value;
                document.getElementById('child').hidden = !value;
            },
            activate
        });
        document.getElementById('before').focus();
    });

    afterEach(async () => {
        grid.destroy();
        await userEvent.cleanup();
        fixture.cleanup();
    });

    it('exposes named rows, cells, hierarchy, selection, and column indices', () => {
        expect(grid.root.getAttribute('role')).toBe('treegrid');
        expect(grid.root.getAttribute('aria-label')).toBe('Content');
        expect(document.getElementById('parent').getAttribute('aria-expanded')).toBe('false');
        expect(document.getElementById('child').getAttribute('aria-level')).toBe('2');
        expect(document.getElementById('parent-title').getAttribute('aria-colindex')).toBe('1');
        expect(document.getElementById('last').getAttribute('aria-expanded')).toBeNull();
    });

    it('uses arrows between visible rows and expands collapsed branches', async () => {
        await userEvent.tab();
        focused('parent');
        await userEvent.keyboard('{ArrowDown}');
        focused('last');
        await userEvent.keyboard('{Home}{ArrowRight}');
        await vi.waitFor(() => expect(expanded).toBe(true));
        await userEvent.keyboard('{ArrowDown}');
        focused('child');
        await userEvent.keyboard('{ArrowUp}{ArrowLeft}');
        await vi.waitFor(() => expect(expanded).toBe(false));
        await userEvent.keyboard('{End}');
        focused('last');
    });

    it('navigates cells horizontally and keeps the same column vertically', async () => {
        await userEvent.tab();
        await userEvent.keyboard('{ArrowDown}{ArrowRight}');
        focused('last-title');
        await userEvent.keyboard('{ArrowRight}');
        focused('edit-last');
        await userEvent.keyboard('{ArrowUp}');
        focused('edit-parent');
        await userEvent.keyboard('{Home}');
        focused('parent-title');
        await userEvent.keyboard('{ArrowLeft}');
        focused('parent');
    });

    it('Tabs only through the current row and returns to the selected row on re-entry', async () => {
        await userEvent.tab();
        await userEvent.keyboard('{End}');
        await userEvent.tab();
        focused('edit-last');
        await userEvent.tab();
        focused('after');
        await userEvent.tab({ shift: true });
        focused('last');
        await userEvent.tab({ shift: true });
        focused('before');
    });

    it('Tabs from a static cell to the next row control, rather than skipping the controls', async () => {
        await userEvent.tab();
        await userEvent.keyboard('{End}{ArrowRight}');
        focused('last-title');
        await userEvent.tab();
        focused('edit-last');
    });

    it('normalizes type-ahead labels and activates once with Enter and Space', async () => {
        await userEvent.tab();
        await userEvent.keyboard('l');
        focused('last');
        await userEvent.keyboard('p');
        await new Promise(resolve => window.setTimeout(resolve, 510));
        await userEvent.keyboard('p');
        focused('parent');
        await userEvent.keyboard('{Enter} ');
        expect(activate).toHaveBeenCalledTimes(2);
    });

    it('retains selection and restores focus when the selected row is replaced', async () => {
        await userEvent.tab();
        await userEvent.keyboard('{End}');
        const old = document.getElementById('last');

        old.replaceWith(old.cloneNode(true));
        grid.refresh();
        focused('last');
        expect(document.getElementById('last').getAttribute('aria-selected')).toBe('true');
    });
});
