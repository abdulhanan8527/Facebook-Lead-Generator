document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const themeToggle = document.getElementById('themeToggle');
  const cookieImportBtn = document.getElementById('cookieImportBtn');
  const loginBtn = document.getElementById('loginBtn');
  const startScrapingBtn = document.getElementById('startScrapingBtn');
  const exportCSVBtn = document.getElementById('exportCSVBtn');
  const exportExcelBtn = document.getElementById('exportExcelBtn');
  const loginStatus = document.getElementById('loginStatus');
  const scrapingLogs = document.getElementById('scrapingLogs');
  const previewTable = document.querySelector('#previewTable tbody');
  const jobCount = document.getElementById('jobCount');

  // App state
  let currentTheme = 'light';
  let isLoggedIn = false;
  let cookies = null;
  let scrapedJobs = [];
  let scrapedData = []; // Make sure this is at the top with other state variables


  // Theme toggle
themeToggle.addEventListener('change', (e) => {
  currentTheme = e.target.checked ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
});

  // Cookie import
cookieImportBtn.addEventListener('click', async () => {
  updateLog('Importing cookies...');
  
  try {
    const result = await window.electronAPI.importCookies();
    
    if (result.success) {
      cookies = result.cookies;
      isLoggedIn = true;
      loginStatus.textContent = 'Status: Logged in (via cookies)';
      updateLog('Cookies imported successfully!', 'success');
    } else {
      updateLog(`Error: ${result.error}`, 'error');
    }
  } catch (error) {
    updateLog(`Error: ${error.message}`, 'error');
  }
});

  // Login button
loginBtn.addEventListener('click', async () => {
  const email = document.getElementById('fbEmail').value;
  const password = document.getElementById('fbPassword').value;
  
  if (!email || !password) {
    updateLog('Please enter both email and password', 'error');
    return;
  }
  
  updateLog(`Attempting login with email: ${email}`);
  
  try {
    const result = await window.electronAPI.facebookLogin({ email, password });
    
    if (result.success) {
      cookies = result.cookies;
      isLoggedIn = true;
      loginStatus.textContent = 'Status: Logged in';
      updateLog('Login successful!', 'success');
      
      // Save cookies to file for future use
      const cookieStr = JSON.stringify(cookies, null, 2);
      const blob = new Blob([cookieStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'facebook_cookies.json';
      a.click();
      
      updateLog('Cookies saved to facebook_cookies.json', 'info');
    } else {
      updateLog(`Error: ${result.error}`, 'error');
    }
  } catch (error) {
    updateLog(`Error: ${error.message}`, 'error');
  }
});

  // Start scraping button
startScrapingBtn.addEventListener('click', async () => {
      const type = document.getElementById('sourceType').value;

      if (!isLoggedIn) {
          updateLog('Please login or import cookies first', 'error');
          return;
      }
      
      const url = document.getElementById('targetUrl').value;
      const limit = parseInt(document.getElementById('jobLimit').value);
      
      if (!url) {
          updateLog('Please enter a valid Facebook post URL', 'error');
          return;
      }
      
      if (!url.includes('facebook.com')) {
          updateLog('Please enter a valid Facebook URL', 'error');
          return;
      }
      
      updateLog(`Starting scraping from ${url} (limit: ${limit})`);
      startScrapingBtn.disabled = true;
      
      try {
          let result;
          if (type === 'post') {
            result = await window.electronAPI.scrapePostData({ url, limit, cookies });
          } else if (type === 'group') {
            result = await window.electronAPI.scrapeGroupMembers({ url, limit, cookies });
          } else {
            result = await window.electronAPI.scrapeSearchResults({ url, limit, cookies });
          }
          
          if (result && result.success) {
              scrapedData = result.data;
              updateLog(`Successfully scraped ${scrapedData.length} profiles`, 'success');
              updateJobCount(scrapedData.length);
              updatePreviewTable(scrapedData);
              
              // Enable export buttons
              exportCSVBtn.disabled = false;
              exportExcelBtn.disabled = false;
          } else {
              updateLog(result?.error || 'Unknown error occurred during scraping', 'error');
          }
      } catch (error) {
          console.error('Scraping error:', error);
          updateLog(`Scraping failed: ${error.message}`, 'error');
      } finally {
          startScrapingBtn.disabled = false;
      }
});

exportCSVBtn.addEventListener('click', async () => {
  if (scrapedData.length === 0) {
      updateLog('No data to export', 'error');
      return;
  }
  
  updateLog('Exporting to CSV...');
  try {
      const result = await window.electronAPI.exportToCSV(scrapedData);
      if (result.success) {
          // Show the full path in the log
          updateLog(`CSV exported successfully to: ${result.path}`, 'success');
          
          // Also show a shortened version in a new line for better readability
          const shortPath = result.path.replace(/^.*[\\\/]/, '');
          updateLog(`File: ${shortPath}`, 'info');
      } else {
          updateLog(`Export failed: ${result.error}`, 'error');
          if (result.path) {
              updateLog(`Attempted path: ${result.path}`, 'error');
          }
      }
  } catch (error) {
      updateLog(`Export error: ${error.message}`, 'error');
  }
});

exportExcelBtn.addEventListener('click', async () => {
    if (scrapedData.length === 0) {
        updateLog('No data to export', 'error');
        return;
    }
    
    updateLog('Exporting to Excel...');
    try {
        const result = await window.electronAPI.exportToExcel(scrapedData);
        if (result.success) {
            // Show the full path in the log
            updateLog(`Excel exported successfully to: ${result.path}`, 'success');
            
            // Also show a shortened version in a new line for better readability
            const shortPath = result.path.replace(/^.*[\\\/]/, '');
            updateLog(`File: ${shortPath}`, 'info');
        } else {
            updateLog(`Export failed: ${result.error}`, 'error');
            if (result.path) {
                updateLog(`Attempted path: ${result.path}`, 'error');
            }
        }
    } catch (error) {
        updateLog(`Export error: ${error.message}`, 'error');
    }
});

// Helper functions
function updateLog(message, type = 'info') {
  const logEntry = document.createElement('div');
  logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  
  switch (type) {
    case 'error':
      logEntry.style.color = 'var(--error-color)';
      break;
    case 'success':
      logEntry.style.color = 'var(--success-color)';
      break;
    default:
      logEntry.style.color = 'var(--text-color)';
  }
  
  scrapingLogs.appendChild(logEntry);
  scrapingLogs.scrollTop = scrapingLogs.scrollHeight;
}

function updateJobCount(count) {
  jobCount.textContent = `${count} profiles found`;
}

// Update the table population function
function updatePreviewTable(data) {
      const tableBody = document.querySelector('#previewTable tbody');
      tableBody.innerHTML = ''; // Clear existing rows
      
      data.slice(0, 10).forEach(person => {
          const row = document.createElement('tr');
          
          const nameCell = document.createElement('td');
          nameCell.textContent = person.name || 'N/A';

          // Profile URL
          const profileCell = document.createElement('td');
          if (person.profileUrl) {
            const link = document.createElement('a');
            link.href = person.profileUrl;
            link.textContent = 'Profile';
            link.target = '_blank';
            profileCell.appendChild(link);
          } 
          else {
              profileCell.textContent = 'N/A';
          }
        
          // Email
          const emailCell = document.createElement('td');
          emailCell.textContent = person.email || 'N/A';
          
          // Phone
          const phoneCell = document.createElement('td');
          phoneCell.textContent = person.phone || 'N/A';
          
          row.appendChild(nameCell);
          row.appendChild(emailCell);
          row.appendChild(phoneCell);
          row.appendChild(profileCell);
          
          tableBody.appendChild(row);
      });
      console.log('Preview data sample:', data.slice(0, 3));
}
});