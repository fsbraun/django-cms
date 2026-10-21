const { test, expect, settings } = require('./helpers/fixtures');

test('wizard Tab navigation includes its footer and restores focus on close', async ({ authenticatedPage: page }) => {
    await page.goto(settings.editUrl);
    const trigger = page.locator('a[data-rel="modal"][href*="cms_wizard"]');
    await trigger.focus();
    await page.keyboard.press('Enter');
    const modal = page.locator('.cms-modal');
    const frame = modal.locator('iframe').contentFrame();
    const choice = frame.locator('[role="radio"][tabindex="0"]');
    const next = modal.locator('.cms-modal-buttons .cms-btn-action');
    const cancel = modal.locator('.cms-modal-buttons a').filter({ hasText: 'Cancel' });

    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    await expect(modal).toHaveAccessibleName(/.+/);
    await expect(modal.locator('iframe')).toHaveAttribute('title', /.+/);
    await expect(next).toBeVisible();
    await choice.focus();
    await page.keyboard.press('Tab');
    await expect(next).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(choice).toBeFocused();

    await cancel.focus();
    await page.keyboard.press('Tab');
    await expect(modal.getByRole('button', { name: 'Minimize', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(cancel).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(page.locator('.cms-toolbar')).not.toHaveAttribute('inert', '');
});

test('page-tree controls have meaningful accessible names', async ({ authenticatedPage: page }) => {
    await page.goto(`${settings.adminUrl}cms/pagecontent/`);
    await expect(page.locator('.cms-pagetree-header-search-btn')).toHaveAccessibleName('Search');
    await expect(page.locator('.cms-pagetree-header-filter-trigger a')).toHaveAccessibleName('Filter pages');
    await expect(page.locator('.cms-pagetree-sites-list > a')).toHaveAccessibleName('Sites');
    await expect(page.locator('.js-cms-pagetree-languages')).toHaveAccessibleName('Language');
});

test('persistent notifications are announced and keyboard-dismissible', async ({ authenticatedPage: page }) => {
    await page.goto(settings.editUrl);
    await page.waitForFunction(() => window.CMS?.API?.Messages);
    await page.evaluate(() => CMS.API.Messages.open({ message: 'Please review this error', error: true, delay: 0 }));
    const alert = page.locator('.cms-messages-alert');
    const dismiss = page.locator('.cms-messages-close');

    await expect(alert).toHaveAttribute('role', 'alert');
    await expect(alert).toHaveText('Please review this error');
    await expect(dismiss).toHaveRole('button');
    await expect(dismiss).toHaveAccessibleName('Close');
    await dismiss.focus();
    await page.keyboard.press('Space');
    await expect(page.locator('.cms-messages')).not.toBeVisible();
});
