const { test, expect, settings } = require('./helpers/fixtures');

test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto(settings.editUrl);
    await expect(page.locator('html')).toHaveClass(/cms-ready/);
    await page.evaluate(() => {
        const content = document.createElement('div');
        content.innerHTML = '<button id="keyboard-origin">Page action</button><input id="keyboard-next" aria-label="Next page field">';
        document.body.prepend(content);
        const after = document.createElement('button');

        after.id = 'keyboard-after-toolbar';
        after.textContent = 'Next control after toolbar';
        document.querySelector('.cms-toolbar').after(after);
        content.firstChild.focus();
    });
});

test('toolbar has one Tab stop, uses arrows, and lets Tab leave', async ({ authenticatedPage: page }) => {
    const toolbar = page.getByRole('toolbar', { name: 'django CMS toolbar' });

    await page.locator('#keyboard-next').focus();
    await page.keyboard.press('Tab');
    await expect(toolbar.getByRole('link', { name: 'django CMS', exact: true })).toBeFocused();
    await expect(toolbar.locator('[tabindex="0"]')).toHaveCount(1);
    await expect(toolbar.locator('[tabindex="0"]')).toHaveCSS('outline-style', 'solid');
    await page.keyboard.press('ArrowRight');
    await expect(toolbar.locator('.cms-toolbar-item-navigation > li > a').first()).toBeFocused();
    await page.keyboard.press('End');
    await expect(toolbar.locator('[tabindex="0"]')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#keyboard-after-toolbar')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(toolbar.locator('[tabindex="0"]')).toBeFocused();
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('#keyboard-next')).toBeFocused();
});

test('toolbar menus use arrow keys and Escape returns to their trigger', async ({ authenticatedPage: page }) => {
    await page.keyboard.press('f');
    await page.keyboard.press('t');
    await page.keyboard.press('ArrowRight');
    const trigger = page.locator('.cms-toolbar-item-navigation > li > a').first();

    await page.keyboard.press('Enter');
    const menu = page.locator(`#${await trigger.getAttribute('aria-controls')}`);

    await expect(menu.getByRole('menuitem').first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem').nth(1)).toBeFocused();
    await page.keyboard.press('Home');
    await expect(menu.getByRole('menuitem').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await expect(menu).not.toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#keyboard-origin')).toBeFocused();
});

test('Enter opens the Shortcuts dialog from the toolbar', async ({ authenticatedPage: page }) => {
    await page.keyboard.press('f');
    await page.keyboard.press('t');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    const shortcuts = page.locator('a.cms-show-shortcuts, .cms-show-shortcuts a').first();

    await expect(shortcuts).toBeVisible();
    await shortcuts.focus();
    await page.keyboard.press('Enter');
    const modal = page.getByRole('dialog', { name: 'Shortcuts', exact: true });

    await expect(modal).toBeVisible();
    await expect(page.locator('.cms-toolbar-item-navigation-hover')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
    await expect(page.locator('.cms-toolbar-item-navigation > li > a').first()).toBeFocused();
});


test('f p opens the closed structure board and focuses its first placeholder', async ({ authenticatedPage: page }) => {
    const edit = page.locator('.cms-btn-switch-edit');

    if (await edit.count()) {
        await page.goto(await edit.getAttribute('href'));
        await expect(page.locator('html')).toHaveClass(/cms-ready/);
    }
    const board = page.getByRole('region', { name: 'Page structure' });

    if (await board.isVisible()) {
        await page.locator('.cms-toolbar-item-cms-mode-switcher a').first().focus();
        await page.keyboard.press('Enter');
    }
    await expect(board).not.toBeVisible();
    await page.keyboard.press('f');
    await page.keyboard.press('p');
    await expect(board).toBeVisible();
    await expect(board.locator('.cms-dragarea').first()).toBeFocused();
});


test('f p, f t, and ? work while structure navigation and the toolbar are active', async ({ authenticatedPage: page }) => {
    const edit = page.locator('.cms-btn-switch-edit');

    if (await edit.count()) {
        await page.goto(await edit.getAttribute('href'));
        await expect(page.locator('html')).toHaveClass(/cms-ready/);
    }
    const area = page.locator('.cms-structure .cms-dragarea').first();
    const toolbarItem = page.locator('.cms-toolbar').getByRole('link', { name: 'django CMS', exact: true });

    await page.keyboard.press('f');
    await page.keyboard.press('p');
    await expect(area).toBeFocused();
    await page.keyboard.press('f');
    await page.keyboard.press('t');
    await expect(toolbarItem).toBeFocused();
    await page.keyboard.press('f');
    await page.keyboard.press('p');
    await expect(area).toBeFocused();
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog', { name: 'Shortcuts', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(area).toBeFocused();
    await page.keyboard.press('f');
    await page.keyboard.press('t');
    await expect(toolbarItem).toBeFocused();
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog', { name: 'Shortcuts', exact: true })).toBeVisible();
});


test('pointer menu activation and the responsive More menu remain usable', async ({ authenticatedPage: page }) => {
    const toolbar = page.getByRole('toolbar', { name: 'django CMS toolbar' });
    const firstMenu = toolbar.locator('.cms-toolbar-item-navigation > li > a').first();

    await firstMenu.click();
    await expect(firstMenu).toHaveAttribute('aria-expanded', 'true');
    const menu = page.locator(`#${await firstMenu.getAttribute('aria-controls')}`);

    await expect(menu.getByRole('menuitem').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(firstMenu).toBeFocused();
    await page.setViewportSize({ width: 640, height: 900 });
    const more = toolbar.locator('.cms-toolbar-more > a');

    await expect(more).toBeVisible();
    await expect(toolbar.locator('[tabindex="0"]')).toHaveCount(1);
    await more.focus();
    await page.keyboard.press('ArrowDown');
    const moreMenu = toolbar.locator('.cms-toolbar-more > ul');

    await expect(moreMenu.locator('[role="menuitem"]:focus')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(more).toBeFocused();
    await expect(moreMenu).not.toBeVisible();
});
