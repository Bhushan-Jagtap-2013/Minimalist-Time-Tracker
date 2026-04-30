const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    timeout: 15000,
    use: {
        headless: false,
        viewport: { width: 1024, height: 768 },
    },
});
