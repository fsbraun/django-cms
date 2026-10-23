const { test, expect, settings } = require('./helpers/fixtures');

test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto(settings.editUrl);
    await expect(page.locator('html')).toHaveClass(/cms-ready/);
    await page.evaluate(() => {
        const content = document.createElement('div');
        content.innerHTML = '<button id="keyboard-origin">Page action</button><input id="keyboard-next" aria-label="Next page field">';
        document.body.prepend(content);
        content.firstChild.focus();
    });
});

test('f t cycles through the live toolbar in both directions until Escape', async ({ authenticatedPage: page }) => {
    const toolbar = page.locator('.cms-toolbar');
    await page.keyboard.press('f');
    await page.keyboard.press('t');
    const firstMenu = toolbar.locator('.cms-toolbar-item-navigation > li > a:visible').first();
    await expect(firstMenu).toBeFocused();
    const inToolbar = () => toolbar.evaluate(element => element.contains(document.activeElement));
    const controlCount = await toolbar.locator('a:visible, button:visible, input:visible').count();
    const visited = new Set();
    for (const direction of ['Tab', 'Shift+Tab']) {
        for (let i = 0; i < controlCount + 2; i++) {
            await page.keyboard.press(direction);
            expect(await inToolbar()).toBe(true);
            visited.add(await toolbar.evaluate(element =>
                Array.from(element.querySelectorAll('a, button, input')).indexOf(document.activeElement)));
        }
    }
    expect(visited.size).toBeGreaterThan(2);
    await page.keyboard.press('Escape');
    await expect(page.locator('#keyboard-origin')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#keyboard-next')).toBeFocused();
});

test('open toolbar menus stay in the cycle and Escape leaves the toolbar', async ({ authenticatedPage: page }) => {
    await page.keyboard.press('f');
    await page.keyboard.press('t');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('.cms-toolbar-item-navigation > li > ul')))
        .toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('#keyboard-origin')).toBeFocused();
    await expect(page.locator('.cms-toolbar-item-navigation-hover')).toHaveCount(0);
});

test('Enter opens the Shortcuts dialog from the toolbar and returns focus on close', async ({ authenticatedPage: page }) => {
    await page.keyboard.press('f');
    await page.keyboard.press('t');
    await page.keyboard.press('Enter');
    const shortcuts = page.locator('a.cms-show-shortcuts, .cms-show-shortcuts a').first();

    await expect(shortcuts).toBeVisible();
    await shortcuts.focus();
    await page.keyboard.press('Enter');
    const modal = page.getByRole('dialog', { name: 'Shortcuts', exact: true });

    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
    await expect(shortcuts).toBeFocused();
});
