import { userEvent } from 'vitest/browser';
import $ from 'jquery';
import PageTreeDropdowns from '../../../static/cms/js/modules/cms.pagetree.dropdown';
import PageTreeKeyboard from '../../../static/cms/js/modules/cms.pagetree.keyboard';
import 'jstree';
import '../../../static/cms/js/libs/jstree/jstree.grid.min';
import styles from '../../../static/cms/css/5.2.0dev1/cms.pagetree.css?raw';

const dropdownMarkup = (id, lazy = false) => `
    <div class="cms-pagetree-dropdown js-cms-pagetree-dropdown" ${lazy ? 'data-lazy-url="/actions/"' : ''}>
        <a id="options-${id}" href="#" class="js-cms-pagetree-dropdown-trigger">Options ${id}</a>
        <div class="cms-pagetree-dropdown-menu js-cms-pagetree-dropdown-menu">
            <ul><li><a id="copy-${id}" href="#">Copy</a></li>
            <li><a id="disabled-${id}" class="cms-pagetree-dropdown-item-disabled" href="#">Paste</a></li>
            <li><a id="delete-${id}" href="#">Delete</a></li></ul>
        </div>
    </div>`;

const focus = id => document.getElementById(id).focus();
const focused = id => expect(document.activeElement).toBe(document.getElementById(id));

function setup(markup) {
    fixture.set(`<style>${styles}</style><button id="before">Before</button>
        <div class="cms-pagetree">${markup}</div><button id="after">After</button>`);
    const container = $('.cms-pagetree');
    const dropdowns = new PageTreeDropdowns({ container });

    new PageTreeKeyboard(container);
    return dropdowns;
}

describe('page tree keyboard navigation', () => {
    afterEach(async () => {
        $('.jstree').jstree('destroy');
        $(document).off('.cms.pagetree.dropdown').off('.cms.pagetree.keyboard');
        vi.restoreAllMocks();
        await userEvent.cleanup();
        fixture.cleanup();
    });

    it('includes Sites and New Page in Tab order even without any grid rows', async () => {
        setup(`<button id="search">Search</button>${dropdownMarkup('sites')}
            <a id="new-page" href="#">New Page</a><select id="language"><option>English</option></select>`);
        focus('search');
        await userEvent.tab();
        focused('options-sites');
        await userEvent.keyboard('{Enter}');
        focused('copy-sites');
        await userEvent.tab();
        focused('new-page');
        await userEvent.tab();
        focused('language');
        await userEvent.tab({ shift: true });
        focused('new-page');
        await userEvent.tab({ shift: true });
        focused('options-sites');
    });

    it('opens with Enter or Space, navigates enabled actions and returns focus on Escape', async () => {
        setup(dropdownMarkup('one'));
        focus('options-one');
        await userEvent.keyboard('{Enter}');
        focused('copy-one');
        expect($('#options-one').attr('aria-expanded')).toBe('true');
        expect($('#options-one').attr('aria-controls')).toBe($('.js-cms-pagetree-dropdown-menu').attr('id'));
        expect($('#disabled-one').attr('aria-disabled')).toBe('true');
        await userEvent.keyboard('{ArrowDown}');
        focused('delete-one');
        await userEvent.keyboard('{ArrowDown}');
        focused('copy-one');
        await userEvent.keyboard('{ArrowUp}');
        focused('delete-one');
        await userEvent.keyboard('{Home}');
        focused('copy-one');
        await userEvent.keyboard('{End}{Escape}');
        focused('options-one');
        expect($('#options-one').attr('aria-expanded')).toBe('false');
        await userEvent.keyboard(' ');
        focused('copy-one');
    });

    it('opens at the last item with ArrowUp and lets Tab leave in either direction', async () => {
        setup(dropdownMarkup('one'));
        focus('options-one');
        await userEvent.keyboard('{ArrowUp}');
        focused('delete-one');
        await userEvent.tab();
        focused('after');
        expect($('#options-one').attr('aria-expanded')).toBe('false');
        focus('options-one');
        await userEvent.keyboard('{ArrowDown}');
        focused('copy-one');
        await userEvent.tab({ shift: true });
        focused('before');
        expect($('#options-one').attr('aria-expanded')).toBe('false');
    });

    it('closes when focus or a pointer click moves outside and opens only one dropdown', async () => {
        setup(dropdownMarkup('one') + dropdownMarkup('two'));
        focus('options-one');
        await userEvent.keyboard('{Enter}');
        focus('after');
        expect($('#options-one').attr('aria-expanded')).toBe('false');
        document.getElementById('options-one').click();
        document.getElementById('options-two').click();
        focused('copy-two');
        expect($('#options-one').attr('aria-expanded')).toBe('false');
        document.getElementById('after').click();
        expect($('#options-two').attr('aria-expanded')).toBe('false');
    });

    it('activates actions once with Enter or Space and guards disabled actions', async () => {
        setup(dropdownMarkup('one'));
        const activated = vi.fn(event => event.preventDefault());
        $('.cms-pagetree').on('click.test', 'a[role="menuitem"]', activated);
        focus('options-one');
        await userEvent.keyboard('{Enter}');
        await userEvent.keyboard(' ');
        expect(activated).toHaveBeenCalledTimes(1);
        focused('options-one');
        await userEvent.keyboard('{Enter}{Enter}');
        expect(activated).toHaveBeenCalledTimes(2);
        await userEvent.keyboard('{Enter}');
        document.getElementById('disabled-one').click();
        expect(activated).toHaveBeenCalledTimes(2);
        expect($('#options-one').attr('aria-expanded')).toBe('true');
    });

    it('focuses lazy-loaded actions and ignores a late response after closing', async () => {
        const requests = [new $.Deferred(), new $.Deferred()];
        vi.spyOn($, 'ajax').mockImplementationOnce(() => requests[0]).mockImplementationOnce(() => requests[1]);
        setup(dropdownMarkup('one', true) + dropdownMarkup('two', true));
        focus('options-one');
        await userEvent.keyboard('{Enter}');
        requests[0].resolve('<ul><li><a id="loaded" href="#">Loaded action</a></li></ul>');
        focused('loaded');
        expect($('#loaded').attr('role')).toBe('menuitem');
        await userEvent.keyboard('{Escape}');
        focus('options-two');
        await userEvent.keyboard('{Enter}{Escape}');
        requests[1].resolve('<a id="late" href="#">Late action</a>');
        focused('options-two');
        expect($('#options-two').attr('aria-expanded')).toBe('false');
    });

    it('supports empty menus and the non-interactive legend without trapping focus', async () => {
        setup(`<div class="js-cms-pagetree-dropdown">
            <div id="legend" class="js-cms-pagetree-dropdown-trigger">Legend</div>
            <div class="cms-pagetree-dropdown-menu js-cms-pagetree-dropdown-menu"><p>Information</p></div>
        </div>`);
        focus('legend');
        await userEvent.keyboard(' ');
        expect(document.activeElement.getAttribute('role')).toBe('region');
        await userEvent.keyboard('{ArrowDown}{Escape}');
        focused('legend');
        await userEvent.keyboard('{Enter}');
        await userEvent.tab();
        focused('after');
    });

    async function setupTree() {
        setup('<div id="tree"></div>');
        const tree = $('#tree');
        const node = id => ({
            id,
            text: id,
            data: {
                preview: `<a href="#" id="view-${id}">View ${id}</a>`,
                options: `<a href="#" id="settings-${id}">Settings ${id}</a>${dropdownMarkup(id)}`
            }
        });
        const ready = new Promise(resolve => tree.one('ready.jstree', resolve));
        tree.jstree({
            core: {
                animation: 0,
                themes: { name: 'django-cms', url: false },
                data: [{ ...node('one'), children: [node('child')] }, node('two')]
            },
            grid: { columns: [{ tree: true }, { value: 'preview' }, { value: 'options' }] },
            plugins: ['grid']
        });
        await ready;
        return tree.jstree(true);
    }

    it('Tabs through actual jsTree grid rows in both directions and preserves tree arrow keys', async () => {
        const tree = await setupTree();
        const order = ['one_anchor', 'view-one', 'settings-one', 'options-one',
            'two_anchor', 'view-two', 'settings-two', 'options-two', 'after'];
        focus('before');
        for (const id of order) {
            await userEvent.tab();
            focused(id);
            if (id !== 'after') {
                expect(window.getComputedStyle(document.activeElement).outlineStyle).toBe('solid');
                expect(window.getComputedStyle(document.activeElement).outlineWidth).toBe('2px');
            }
        }
        for (const id of order.slice(0, -1).reverse().concat('before')) {
            await userEvent.tab({ shift: true });
            focused(id);
        }
        focus('one_anchor');
        await userEvent.keyboard('{ArrowDown}');
        focused('two_anchor');
        await userEvent.keyboard('{ArrowUp}{ArrowRight}');
        expect(tree.is_open('one')).toBe(true);
        focus('options-one');
        await userEvent.tab();
        focused('child_anchor');
        focus('one_anchor');
        await userEvent.keyboard('{ArrowLeft}');
        expect(tree.is_closed('one')).toBe(true);
        focus('options-one');
        await userEvent.tab();
        focused('two_anchor');
    });

    it('returns to the visual row after menu Tab and still works after a redraw', async () => {
        const tree = await setupTree();
        tree.redraw(true);
        focus('options-one');
        await userEvent.keyboard('{Enter}');
        focused('copy-one');
        await userEvent.tab();
        focused('two_anchor');
        focus('options-two');
        await userEvent.keyboard('{Enter}');
        await userEvent.tab({ shift: true });
        focused('settings-two');
        expect($('#options-two').attr('aria-expanded')).toBe('false');
    });

    it('skips hidden or disabled row actions and retains column header links in the Tab order', async () => {
        await setupTree();
        $('.jstree-grid-header').last().show().append('<a id="header" href="#">Language</a>');
        $('#settings-one').hide();
        $('#settings-two').addClass('cms-btn-disabled').attr('aria-disabled', 'true');
        focus('before');
        await userEvent.tab();
        focused('header');
        await userEvent.tab();
        focused('one_anchor');
        focus('view-one');
        await userEvent.tab();
        focused('options-one');
        focus('options-two');
        await userEvent.tab({ shift: true });
        focused('view-two');
    });

    it('keeps an all-disabled menu escapable and permits retrying a failed lazy request', async () => {
        const failed = new $.Deferred();
        const retry = new $.Deferred();
        const ajax = vi.spyOn($, 'ajax').mockReturnValueOnce(failed).mockReturnValueOnce(retry);
        setup(dropdownMarkup('one', true));
        $('#copy-one, #delete-one').addClass('cms-pagetree-dropdown-item-disabled');
        focus('options-one');
        await userEvent.keyboard('{Enter}');
        expect(document.activeElement.getAttribute('role')).toBe('menu');
        failed.reject();
        expect($('.js-cms-pagetree-dropdown-menu').attr('aria-busy')).toBeUndefined();
        await userEvent.keyboard('{ArrowDown}{Escape}{Enter}');
        expect(ajax).toHaveBeenCalledTimes(2);
        await userEvent.tab();
        focused('after');
        retry.resolve('<a href="#">Loaded action</a>');
        focused('after');
        expect($('#options-one').attr('aria-expanded')).toBe('false');
    });
});
