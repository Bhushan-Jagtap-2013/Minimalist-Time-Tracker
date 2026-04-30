const { test, expect } = require('@playwright/test');
const path = require('path');

const FILE_URL = 'file:///' + path.resolve(__dirname, '../study-tracker.html').replace(/\\/g, '/') + '?test=1';

// Injects a mock File System Access API so tests don't trigger OS file dialogs
async function mockFileSystem(page) {
    await page.addInitScript(() => {
        let fileContent = '# Study Log\n\n';
        const handle = {
            name: 'study-log-test.md',
            getFile: async () => new File([fileContent], 'study-log-test.md', { type: 'text/markdown' }),
            createWritable: async () => ({
                write: async (c) => { fileContent = c; },
                close: async () => {},
            }),
        };
        window.showSaveFilePicker = async () => handle;
        window.showOpenFilePicker = async () => [handle];
    });
}

async function connectFile(page) {
    await page.click('button:has-text("Create new")');
    await expect(page.locator('#fileStatus')).toHaveText('study-log-test.md');
}

test.describe('File gate', () => {
    test('Start is blocked without a file connected', async ({ page }) => {
        await page.goto(FILE_URL);
        await page.click('#startBtn');
        await expect(page.locator('.toast')).toContainText('Connect a log file first');
    });

    test('File bar shows connected after creating a file', async ({ page }) => {
        await mockFileSystem(page);
        await page.goto(FILE_URL);
        await connectFile(page);
        await expect(page.locator('#fileBar')).toHaveClass(/connected/);
    });
});

test.describe('Goal modal', () => {
    test.beforeEach(async ({ page }) => {
        await mockFileSystem(page);
        await page.goto(FILE_URL);
        await connectFile(page);
    });

    test('Goal modal appears when Start is clicked', async ({ page }) => {
        await page.click('#startBtn');
        await expect(page.locator('#goalOverlay')).toHaveClass(/open/);
    });

    test('Skipping goal starts the session', async ({ page }) => {
        await page.click('#startBtn');
        await page.click('#goalOverlay .btn-ghost');
        await expect(page.locator('#goalOverlay')).not.toHaveClass(/open/);
        await expect(page.locator('#status')).toHaveText('studying');
    });

    test('Entering goal and clicking Start begins session', async ({ page }) => {
        await page.click('#startBtn');
        await page.fill('#goalInput', 'Solve 3 LeetCode mediums');
        await page.click('#goalOverlay .btn-primary');
        await expect(page.locator('#status')).toHaveText('studying');
    });

    test('Pressing Enter in goal input starts session', async ({ page }) => {
        await page.click('#startBtn');
        await page.fill('#goalInput', 'Review system design');
        await page.press('#goalInput', 'Enter');
        await expect(page.locator('#status')).toHaveText('studying');
    });
});

test.describe('Timer and check-in', () => {
    test.beforeEach(async ({ page }) => {
        await mockFileSystem(page);
        await page.goto(FILE_URL);
        await connectFile(page);
        await page.click('#startBtn');
        await page.click('#goalOverlay .btn-ghost'); // skip goal
    });

    test('Check-in modal opens after 1-second timer fires', async ({ page }) => {
        await expect(page.locator('#overlay')).toHaveClass(/open/, { timeout: 4000 });
        await expect(page.locator('#status')).toHaveText('check-in');
    });

    test('Submitting without status shows error', async ({ page }) => {
        await expect(page.locator('#overlay')).toHaveClass(/open/, { timeout: 4000 });
        await page.click('button:has-text("Log it")');
        await expect(page.locator('.toast')).toContainText('Please select a status');
    });

    test('Skip check-in restarts timer', async ({ page }) => {
        await expect(page.locator('#overlay')).toHaveClass(/open/, { timeout: 4000 });
        await page.locator('#overlay button:has-text("Skip")').click();
        await expect(page.locator('#overlay')).not.toHaveClass(/open/);
        await expect(page.locator('#status')).toHaveText('studying');
    });

    test('Check-in Yes shows topic and focus questions', async ({ page }) => {
        await expect(page.locator('#overlay')).toHaveClass(/open/, { timeout: 4000 });
        await page.click('[data-v="Yes"]');
        await expect(page.locator('#qTopic')).not.toHaveClass(/hidden/);
        await expect(page.locator('#qFocus')).not.toHaveClass(/hidden/);
    });

    test('Check-in Distracted shows trigger question', async ({ page }) => {
        await expect(page.locator('#overlay')).toHaveClass(/open/, { timeout: 4000 });
        await page.click('[data-v="Distracted"]');
        await expect(page.locator('#qTrigger')).not.toHaveClass(/hidden/);
    });

    test('Submitting Yes check-in logs and restarts timer', async ({ page }) => {
        await expect(page.locator('#overlay')).toHaveClass(/open/, { timeout: 4000 });
        await page.click('[data-v="Yes"]');
        await page.click('[data-v="LeetCode"]');
        await page.click('[data-v="High"]');
        await page.click('button:has-text("Log it")');
        await expect(page.locator('.toast')).toContainText('Logged');
        await expect(page.locator('#sCheckins')).toHaveText('1');
        await expect(page.locator('#sMin')).toHaveText('5');
    });
});

test.describe('Session completion', () => {
    test.beforeEach(async ({ page }) => {
        await mockFileSystem(page);
        await page.goto(FILE_URL);
        await connectFile(page);
        await page.click('#startBtn');
        await page.click('#goalOverlay .btn-ghost');
        await expect(page.locator('#overlay')).toHaveClass(/open/, { timeout: 4000 });
    });

    test('Selecting Done opens completion modal', async ({ page }) => {
        await page.click('[data-v="Done"]');
        await page.click('button:has-text("Log it")');
        await expect(page.locator('#completionOverlay')).toHaveClass(/open/);
    });

    test('Completion modal requires a selection', async ({ page }) => {
        await page.click('[data-v="Done"]');
        await page.click('button:has-text("Log it")');
        await page.click('#completionOverlay button:has-text("Done")');
        await expect(page.locator('.toast')).toContainText('Please select a completion level');
    });

    test('Selecting completion ends the session', async ({ page }) => {
        await page.click('[data-v="Done"]');
        await page.click('button:has-text("Log it")');
        await page.click('[data-v="All of it"]');
        await page.click('#completionOverlay button:has-text("Done")');
        await expect(page.locator('#status')).toHaveText('session ended');
        await expect(page.locator('#startBtn')).toHaveText('Start');
    });
});

test.describe('Pause flow', () => {
    test.beforeEach(async ({ page }) => {
        await mockFileSystem(page);
        await page.goto(FILE_URL);
        await connectFile(page);
        await page.click('#startBtn');
        await page.click('#goalOverlay .btn-ghost');
    });

    test('Pausing opens pause reason modal', async ({ page }) => {
        await page.click('#startBtn');
        await expect(page.locator('#pauseOverlay')).toHaveClass(/open/);
    });

    test('Selecting pause reason closes modal and shows Resume', async ({ page }) => {
        await page.click('#startBtn');
        await page.click('button:has-text("Break")');
        await expect(page.locator('#pauseOverlay')).not.toHaveClass(/open/);
        await expect(page.locator('#startBtn')).toHaveText('Resume');
    });

    test('Resuming after pause restarts timer', async ({ page }) => {
        await page.click('#startBtn');
        await page.click('button:has-text("Break")');
        await page.click('#startBtn');
        await expect(page.locator('#status')).toHaveText('studying');
    });
});

test.describe('File name suggestion', () => {
    test('New file suggested name includes today\'s date', async ({ page }) => {
        const today = new Date().toLocaleDateString('en-CA');
        let suggestedName = '';
        await page.addInitScript((date) => {
            window.showSaveFilePicker = async (opts) => {
                window._suggestedName = opts.suggestedName;
                let fileContent = '';
                return {
                    name: opts.suggestedName,
                    getFile: async () => new File([fileContent], opts.suggestedName),
                    createWritable: async () => ({
                        write: async (c) => { fileContent = c; },
                        close: async () => {},
                    }),
                };
            };
        }, today);
        await page.goto(FILE_URL);
        await page.click('button:has-text("Create new")');
        suggestedName = await page.evaluate(() => window._suggestedName);
        expect(suggestedName).toBe(`study-log-${today}.md`);
    });
});
