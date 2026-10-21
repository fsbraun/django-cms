const { test, expect } = require('@playwright/test');
const path = require('path');

const cmsStatic = path.resolve(__dirname, '../../../static/cms');

// Exercise the actual admin script with a changelist-shaped fixture. Python
// tests separately verify the markup produced by admin_action_button().
test.beforeEach(async ({ page }) => {
    await page.setContent(`
        <html lang="en"><head><title>Action buttons</title></head><body>
        <form><input type="hidden" name="csrfmiddlewaretoken" value="test-token">
        <table id="result_list"><tbody><tr><td class="field-list_actions">
            <a id="inline-post" class="btn cms-action-btn js-action cms-form-post-method js-keep-sideframe"
               role="button" href="https://example.test/archive" title="Archive" aria-label="Archive"><span aria-hidden="true">A</span></a>
            <a id="view" class="btn cms-action-btn js-action cms-form-get-method js-keep-sideframe"
               href="https://example.test/view" title="View" aria-label="View"><span aria-hidden="true">V</span></a>
            <a id="delete" class="btn cms-action-btn cms-burger-action-btn js-action cms-form-post-method js-keep-sideframe"
               role="button" href="https://example.test/delete" title="Delete" aria-label="Delete"><span aria-hidden="true">D</span></a>
            <a id="disabled" class="btn cms-action-btn cms-burger-action-btn js-action cms-form-post-method inactive"
               role="button" aria-disabled="true" tabindex="-1" title="Unavailable" aria-label="Unavailable"><span aria-hidden="true">U</span></a>
            <a id="edit" class="btn cms-action-btn cms-burger-action-btn js-action cms-form-get-method js-close-sideframe"
               href="https://example.test/edit" title="Edit" aria-label="Edit"><span aria-hidden="true">E</span></a>
        </td><td><a id="next-row" href="#next">Next row</a></td></tr></tbody></table></form>
        </body></html>`);
    await page.addStyleTag({ path: path.join(cmsStatic, 'css/5.2.0dev1/cms.admin.css') });
    await page.addScriptTag({ path: path.join(cmsStatic, 'js/libs/jquery.min.js') });
    await page.evaluate(() => {
        window.django = { jQuery: window.jQuery };
        window.gettext = text => text === 'Actions' ? 'Row actions' : text;
        window.sideframeCloses = 0;
        window.submissions = [];
        window.originalClicks = 0;
        window.CMS = { API: { Sideframe: { close: () => window.sideframeCloses++ } }, config: { csrf: 'fallback-token' } };
        document.getElementById('delete').addEventListener('click', () => window.originalClicks++);
        HTMLFormElement.prototype.submit = function() {
            window.submissions.push({
                method: this.method,
                action: this.action,
                csrf: this.querySelector('[name=csrfmiddlewaretoken]').value
            });
        };
    });
    await page.addScriptTag({ path: path.join(cmsStatic, 'js/admin/actions.js') });
    await expect(page.getByRole('button', { name: 'Row actions' })).toBeVisible();
});

test('opens with the keyboard, traverses enabled actions, and returns focus on Escape', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Row actions' });
    await page.locator('#view').focus();
    await page.keyboard.press('Tab');
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('menu', { name: 'Row actions' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('Tab closes the portalled menu and continues from its row', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Row actions' });
    await trigger.focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Tab');
    await expect(page.locator('#next-row')).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.focus();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('#view')).toBeFocused();
});

test('menu conversion preserves POST, CSRF, sideframe flags and original handlers', async ({ page }) => {
    await page.getByRole('button', { name: 'Row actions' }).click();
    await page.keyboard.press('Space');
    expect(await page.evaluate(() => window.submissions)).toEqual([
        { method: 'post', action: 'https://example.test/delete', csrf: 'test-token' }
    ]);
    expect(await page.evaluate(() => window.originalClicks)).toBe(1);
    expect(await page.evaluate(() => window.sideframeCloses)).toBe(0);
    await expect(page.locator('#edit')).toHaveAttribute('href', 'https://example.test/edit');
    await expect(page.locator('#edit')).toHaveClass(/js-close-sideframe/);
});

test('disabled actions stay disabled after moving into the menu', async ({ page }) => {
    await page.getByRole('button', { name: 'Row actions' }).click();
    const disabled = page.getByRole('menuitem', { name: 'Unavailable' });
    await expect(disabled).toHaveAttribute('aria-disabled', 'true');
    expect(await disabled.getAttribute('href')).toBeNull();
    await disabled.dispatchEvent('click');
    expect(await page.evaluate(() => window.submissions)).toEqual([]);
    expect(await page.evaluate(() => window.sideframeCloses)).toBe(0);
});

test('inline POST actions support Space without navigating', async ({ page }) => {
    await page.getByRole('button', { name: 'Archive' }).focus();
    await page.keyboard.press('Space');
    expect(await page.evaluate(() => window.submissions.length)).toBe(1);
});
