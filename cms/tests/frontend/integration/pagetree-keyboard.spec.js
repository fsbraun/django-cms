const { test, expect, settings } = require('./helpers/fixtures');

for (const sidePanel of [false, true]) {
    test(`page-tree Tab navigation in the ${sidePanel ? 'side panel' : 'full admin'}`, async ({
        authenticatedPage: page, cms
    }) => {
        const treeUrl = `${settings.adminUrl}cms/pagecontent/`;
        await page.goto(treeUrl);
        // The integration server may start with an empty database.
        if (await page.locator('.cms-pagetree-empty').count()) {
            await cms.addPage({ title: 'Keyboard navigation' });
            await page.goto(treeUrl);
        }
        let tree = page;
        if (sidePanel) {
            await page.goto(settings.editUrl);
            await page.waitForFunction(() => window.CMS?.API?.Sideframe);
            await page.evaluate(url => CMS.API.Sideframe.open({ url }), treeUrl);
            tree = page.frameLocator('.cms-sideframe iframe');
        }
        await expect(tree.locator('.jstree-anchor').first()).toBeVisible();
        await tree.locator('.cms-pagetree-header-search-btn').focus();
        await page.keyboard.press('Tab');
        const sites = tree.locator('.cms-pagetree-sites-list > a');
        await expect(sites).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(tree.locator('.cms-pagetree-sites-list [role="menuitem"]').first()).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(tree.locator('.cms-pagetree-header-create')).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(tree.locator('.js-cms-pagetree-languages')).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(tree.locator('.cms-pagetree-header-create')).toBeFocused();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await expect(tree.locator('.cms-pagetree-section-nav .js-cms-pagetree-options')).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(tree.locator('.js-pagetree-header-lang')).toBeFocused();
        await page.keyboard.press('Tab');
        const title = tree.locator('.jstree-anchor').first();
        await expect(title).toBeFocused();
        const nodeId = await title.evaluate(element => element.parentElement.id);
        const cells = tree.locator(`[data-jstreegrid="${nodeId}"]`);
        const actions = cells.locator('a[href]:visible');
        // Walk the visible inline links, excluding anything inside a closed menu.
        for (const action of await actions.all()) {
            if (await action.evaluate(element => !!element.closest('.js-cms-pagetree-dropdown-menu'))) {
                continue;
            }
            await page.keyboard.press('Tab');
            await expect(action).toBeFocused();
        }
        const options = cells.locator('.js-cms-pagetree-options');
        await expect(options).toBeFocused();
        await page.keyboard.press('Enter');
        const menu = cells.locator('.js-cms-pagetree-actions-dropdown [role="menu"]');
        await expect(menu).not.toHaveAttribute('aria-busy', 'true');
        await expect(menu.locator('[role="menuitem"]:not([aria-disabled="true"])').first()).toBeFocused();
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Escape');
        await expect(options).toBeFocused();
        await expect(options).toHaveAttribute('aria-expanded', 'false');
        if (sidePanel) {
            await expect(page.locator('.cms-sideframe iframe')).toBeVisible();
        }
    });
}
