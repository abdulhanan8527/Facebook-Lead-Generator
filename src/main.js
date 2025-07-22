const { Launcher: chromeLauncher } = require('chrome-launcher');
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { scrapePostData,scrapeGroupMembers,scrapeSearchResults } = require('./scraper');
const { exportToCSV, exportToExcel } = require('./scraper');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: true
    }
  });

  mainWindow.loadFile('src/index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC handlers
ipcMain.handle('facebook-login', async (event, { email, password }) => {
  let browser;
  let page;
  try {
    const installations = await chromeLauncher.getInstallations();
    if (installations.length === 0) {
      return { success: false, error: 'Chrome not found. Please install Chrome.' };
    }

    browser = await puppeteer.launch({
      headless: false,
      executablePath: installations[0],
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-notifications'],
      ignoreDefaultArgs: ['--disable-extensions'],
      defaultViewport: null
    });
    
    page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36');
    
    // Navigate directly to login page
    await page.goto('https://www.facebook.com/login.php', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Fill login form
    await page.waitForSelector('#email', { timeout: 10000 });
    await page.type('#email', email);
    await page.type('#pass', password);
    
    // Click login button
    const [response] = await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }),
      page.click('button[name="login"]')
    ]);

    // Check for 2FA
    if (page.url().includes('checkpoint')) {
      console.log('2FA detected');
      
      // Prompt user for 2FA code
      const code = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Cancel', 'Submit'],
        title: 'Two-Factor Authentication',
        message: 'Enter your 2FA code:',
        detail: 'Facebook requires two-factor authentication for your account.',
        input: true,
        inputPlaceholder: '6-digit code'
      });
      
      if (code.response === 0 || !code.inputs || !code.inputs[0]) {
        return { success: false, error: '2FA canceled by user' };
      }
      
      const twoFACode = code.inputs[0];
      
      // Enter 2FA code
      await page.waitForSelector('input[name="approvals_code"]', { timeout: 5000 });
      await page.type('input[name="approvals_code"]', twoFACode);
      
      // Submit 2FA
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }),
        page.click('button[name="submit[Submit Code]"]')
      ]);
      
      // Handle "Remember Browser" prompt
      if (page.url().includes('checkpoint')) {
        await page.waitForSelector('input[value="dont_save"]', { timeout: 3000 });
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }),
          page.click('input[value="dont_save"]')
        ]);
      }
    }

    // Verify login success
    await page.waitForSelector('[aria-label="Facebook"]', { timeout: 10000 });
    const cookies = await page.cookies();
    
    if (cookies.some(c => c.name === 'c_user')) {
      return { success: true, cookies };
    } else {
      return { success: false, error: 'Login failed after 2FA' };
    }
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error.message };
  } finally {
    if (browser) await browser.close();
  }
});

ipcMain.handle('import-cookies', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      const cookies = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'));
      return { success: true, cookies };
    }
    return { success: false, error: 'No file selected' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('scrape-post-data', async (event, { url, limit, cookies }) => {
  try {
    if (!cookies || cookies.length === 0) {
      return { success: false, error: 'Please login first' };
    }
    
    const results = await scrapePostData(url, limit, cookies);
    return { success: true, data: results };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('scrape-group-members', async (e, { url, limit, cookies }) => {
  if (!cookies?.length) return { success: false, error: 'Please login first' };
  try {
    const data = await scrapeGroupMembers(url, limit, cookies);
    return { success: true, data };
  } catch(e) { return { success: false, error: e.message } }
});

ipcMain.handle('scrape-search-results', async (e, { url, limit, cookies }) => {
  if (!cookies?.length) return { success: false, error: 'Please login first' };
  try {
    const data = await scrapeSearchResults(url, limit, cookies);
    return { success: true, data };
  } catch(e) { return { success: false, error: e.message } }
});

ipcMain.handle('export-to-csv', async (event, data) => {
    try {
        const result = await exportToCSV(data);
        return result; // Make sure to return the full result object
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('export-to-excel', async (event, data) => {
    try {
        const result = await exportToExcel(data);
        return result; // Make sure to return the full result object
    } catch (error) {
        return { success: false, error: error.message };
    }
});