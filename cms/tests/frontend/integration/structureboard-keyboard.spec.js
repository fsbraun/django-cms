const { test, expect, settings } = require('./helpers/fixtures');

test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto(settings.editUrl);
    await expect(page.locator('html')).toHaveClass(/cms-ready/);
    const edit = page.locator('.cms-btn-switch-edit');

    if (await edit.count()) {
        await page.goto(await edit.getAttribute('href'));
        await expect(page.locator('html')).toHaveClass(/cms-ready/);
    }
    const switcher = page.locator('.cms-toolbar-item-cms-mode-switcher a').first();

    if (!(await page.locator('.cms-structure').isVisible())) {
        await switcher.focus();
        await page.keyboard.press('Enter');
    }
    await expect(page.getByRole('region', { name: 'Page structure' })).toBeVisible();
});

test('plugin disclosures and actions work with the keyboard', async ({ authenticatedPage: page }) => {
    const board = page.getByRole('region', { name: 'Page structure' });
    const row = board.locator('.cms-dragitem-collapsable').first();
    const disclosure = row.locator('> button.cms-dragitem-text');
    const children = page.locator(`#${await disclosure.getAttribute('aria-controls')}`);

    await disclosure.focus();
    if ((await disclosure.getAttribute('aria-expanded')) === 'true') {
        await page.keyboard.press('Space');
    }
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Enter');
    await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    await expect(children.locator('> .cms-draggable').first()).toBeVisible();
    await expect(children).toHaveRole('list');
    await page.keyboard.press('Tab');
    await expect(row.locator('> .cms-submenu-edit')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(row.locator('> .cms-submenu-add')).toBeFocused();
    await page.keyboard.press('Tab');
    const actions = row.locator('> .cms-submenu-settings');

    await expect(actions).toBeFocused();
    await page.keyboard.press('Enter');
    const menu = row.locator('> .cms-submenu-dropdown');

    await expect(actions).toHaveAttribute('aria-expanded', 'true');
    await expect(menu).toHaveRole('menu');
    await expect(menu.locator('[role="menuitem"]:focus')).toHaveCount(1);
    await page.keyboard.press('End');
    await expect(menu.getByRole('menuitem', { name: 'Delete', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(actions).toBeFocused();
    await expect(actions).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('ArrowUp');
    await expect(menu.getByRole('menuitem', { name: 'Delete', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(menu).not.toBeVisible();
    await expect(children.locator('> .cms-draggable > .cms-dragitem > button').first()).toBeFocused();
});

test('plugin picker keeps search and dialog controls reachable, including with no results', async ({ authenticatedPage: page }) => {
    const trigger = page.locator('.cms-structure .cms-dragbar > .cms-submenu-add').first();

    await trigger.focus();
    await page.keyboard.press('Space');
    const modal = page.locator('.cms-modal');
    const search = modal.getByRole('textbox', { name: 'Filter plugins', exact: true });

    await expect(search).toBeFocused();
    await search.fill('no-plugin-could-match-this-query');
    await expect(modal.locator('.cms-plugin-picker-status')).toHaveText('0 plugins available');
    await page.keyboard.press('Tab');
    await expect(modal.getByRole('button', { name: 'Minimize', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(search).toBeFocused();
    await search.fill('');
    await expect(modal.locator('.cms-submenu-item a').first()).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(modal.locator('.cms-submenu-item a:focus')).toHaveCount(1);
    await page.keyboard.press('Shift+Tab');
    await expect(search).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
    await expect(trigger).toBeFocused();
});

test('placeholder expansion and plugin editing restore usable focus', async ({ authenticatedPage: page }) => {
    const area = page.locator('.cms-structure .cms-dragarea').filter({
        has: page.locator('.cms-dragitem-collapsable')
    }).first();
    const expand = area.getByRole('button', { name: 'Expand all', exact: true });
    const collapse = area.getByRole('button', { name: 'Collapse all', exact: true });

    if (await collapse.isVisible()) {
        await collapse.focus();
        await page.keyboard.press('Enter');
    }
    await expand.focus();
    await page.keyboard.press('Space');
    await expect(collapse).toBeFocused();
    for (const button of await area.locator('button.cms-dragitem-text').all()) {
        await expect(button).toHaveAttribute('aria-expanded', 'true');
    }
    await page.keyboard.press('Enter');
    await expect(expand).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(area.locator('.cms-dragbar > .cms-submenu-add')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(area.locator('.cms-dragbar > .cms-submenu-settings')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(expand).toBeFocused();
    const edit = area.locator('.cms-draggables-root > .cms-draggable > .cms-dragitem > .cms-submenu-edit').first();

    await edit.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.cms-modal')).toBeVisible();
    await page.locator('.cms-modal-close').focus();
    await page.keyboard.press('Space');
    await expect(page.locator('.cms-modal')).not.toBeVisible();
    await expect(edit).toBeFocused();
});

test('a adds to the focused placeholder or plugin during normal Tab navigation', async ({ authenticatedPage: page }) => {
    const area = page.locator('.cms-structure .cms-dragarea').filter({
        has: page.locator('.cms-dragitem-collapsable')
    }).first();
    const expand = area.getByRole('button', { name: 'Expand all', exact: true });
    const collapse = area.getByRole('button', { name: 'Collapse all', exact: true });
    const toggler = (await expand.isVisible()) ? expand : collapse;

    await toggler.focus();
    await page.keyboard.press('a');
    await expect(page.locator('.cms-modal .cms-plugin-picker')).toBeVisible();
    await expect(area.locator('> .cms-draggables > .cms-add-plugin-placeholder')).toBeAttached();
    await page.keyboard.press('Escape');
    if (await expand.isVisible()) {
        await expand.focus();
        await page.keyboard.press('Enter');
    }
    const row = area.locator('.cms-draggable .cms-draggable > .cms-dragitem-collapsable').first();

    await row.locator('> button.cms-dragitem-text').focus();
    await page.keyboard.press('a');
    await expect(page.locator('.cms-modal .cms-plugin-picker')).toBeVisible();
    await expect(row.locator('..').locator('> .cms-collapsable-container > .cms-add-plugin-placeholder')).toBeAttached();
    await page.keyboard.press('Escape');
});
