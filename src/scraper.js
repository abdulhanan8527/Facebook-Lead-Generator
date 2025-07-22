const { Launcher: chromeLauncher } = require('chrome-launcher'); // Add to top
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createObjectCsvWriter } = require('csv-writer');
const XLSX = require('xlsx');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;

puppeteer.use(StealthPlugin());

function getDownloadsPath() {
  return path.join(os.homedir(), 'Downloads');
}

async function getChromePath() {
  const installations = await chromeLauncher.getInstallations();
  if (installations.length === 0) {
    throw new Error('Chrome not found. Please install Chrome.');
  }
  return installations[0];
}

// async function scrapePostData(url, limit = 50, cookies = null) {
//   const chromePath = await getChromePath();
//   const browser = await puppeteer.launch({
//     headless: false,
//     executablePath: chromePath,
//     args: ['--no-sandbox', '--disable-setuid-sandbox']
//   });

//   const page = await browser.newPage();
//   if (cookies) await page.setCookie(...cookies);
  
//   // Navigate to Facebook first
//   await page.goto('https://www.facebook.com', { 
//     waitUntil: 'networkidle2', 
//     timeout: 60000 
//   });
  
//   // Go to the target post
//   console.log(`Navigating to post: ${url}`);
//   await page.goto(url, { 
//     waitUntil: 'networkidle2', 
//     timeout: 120000
//   });
  
//   // Wait for comments to appear
//   console.log('Waiting for comments...');
//   await page.waitForSelector('div[role="article"]', { timeout: 30000 });

//   // Function to expand comment buttons
//   async function expandComments() {
//     const buttonXPaths = [
//       "//span[contains(., 'See more')]",
//       "//span[contains(., 'View more replies')]",
//       "//span[contains(., 'See previous comments')]",
//       "//span[contains(., 'View more comments')]",
//       "//div[@aria-label='See more comments']"
//     ];
    
//     for (const xpath of buttonXPaths) {
//       const buttons = await page.$x(xpath);
//       for (const btn of buttons) {
//         try {
//           await btn.click();
//           await page.waitForTimeout(1000);
//         } catch (e) {
//           // Ignore if not clickable
//         }
//       }
//     }
//   }

//   // Initial expansion
//   await expandComments();
  
//   // Aggressive scrolling to load all comments
//   console.log('Scrolling to load comments...');
//   let scrollAttempts = 0;
//   const maxScrolls = 100; // Increased from 50 to 100
//   let lastHeight = 0;
  
//   while (scrollAttempts < maxScrolls) {
//     // Scroll to the bottom
//     await page.evaluate(() => {
//       window.scrollTo(0, document.body.scrollHeight);
//     });
    
//     // Wait for content to load
//     await page.waitForTimeout(3000);
    
//     // Try to expand any new buttons
//     await expandComments();
    
//     // Check if we've reached the bottom
//     const newHeight = await page.evaluate(() => document.body.scrollHeight);
//     if (newHeight === lastHeight) {
//       break; // No more content to load
//     }
//     lastHeight = newHeight;
    
//     scrollAttempts++;
//   }

//   // Extract commenter profiles
//   console.log('Extracting commenters...');
//   const commentLeads = await page.evaluate(() => {
//     const results = new Map();
    
//     document.querySelectorAll('div[role="article"]').forEach(block => {
//       try {
//         // Find all candidate profile links
//         const anchors = block.querySelectorAll('a[role="link"][href*="facebook.com"]');
        
//         // Find the most likely profile link
//         let profileAnchor = null;
//         for (const anchor of anchors) {
//           const href = anchor.href;
//           if (href.includes('/profile.php') || 
//               /facebook\.com\/[^/]+\/?$/.test(href)) {
//             profileAnchor = anchor;
//             break;
//           }
//         }
        
//         // Fallback to first anchor if no obvious profile found
//         if (!profileAnchor && anchors.length > 0) {
//           profileAnchor = anchors[0];
//         }
        
//         if (!profileAnchor) return;
        
//         // Extract name from image alt text if available
//         let name = 'Unknown';
//         const img = profileAnchor.querySelector('img');
//         if (img && img.alt) {
//           name = img.alt
//             .replace('Profile picture', '')
//             .replace('Avatar', '')
//             .replace('Chats with ', '')
//             .trim();
//         } else {
//           name = profileAnchor.textContent
//             .trim()
//             .replace('Chats with ', '')
//             .split('\n')[0];
//         }
        
//         // Clean profile URL
//         const profileUrl = profileAnchor.href.split('?')[0].replace(/\/$/, '');
        
//         // Deduplicate by URL
//         if (!results.has(profileUrl)) {
//           results.set(profileUrl, {
//             name,
//             profileUrl
//           });
//         }
//       } catch (e) {
//         console.error('Comment extraction error', e);
//       }
//     });
    
//     return Array.from(results.values());
//   });

//   console.log(`Found ${commentLeads.length} commenters, processing up to ${limit}`);
  
//   // Process profiles in batches
//   const processed = [];
//   const batchSize = 3;
//   const processLimit = Math.min(commentLeads.length, limit);
  
//   for (let i = 0; i < processLimit; i += batchSize) {
//     const batch = commentLeads.slice(i, i + batchSize);
//     const batchResults = await Promise.all(
//       batch.map(lead => 
//         extractContactInfo(browser, lead.profileUrl, lead.name)
//           .then(info => ({
//             name: info.name,
//             profileUrl: lead.profileUrl,
//             email: info.email,
//             phone: info.phone,
//             source: 'Post Comment',
//             timestamp: new Date().toISOString()
//           }))
//           .catch(e => {
//             console.error(`Profile processing failed: ${lead.profileUrl}`, e.message);
//             return {
//               name: lead.name,
//               profileUrl: lead.profileUrl,
//               email: null,
//               phone: null,
//               source: 'Post Comment',
//               timestamp: new Date().toISOString()
//             };
//           }))
//     );
    
//     processed.push(...batchResults);
//     console.log(`Processed ${processed.length} of ${processLimit} profiles`);
//     await page.waitForTimeout(2000); // Rate limiting
//   }

//   await browser.close();
//   return processed.slice(0, limit);
// }

async function scrapePostData(url, limit = 50, cookies = null) {
  const chromePath = await getChromePath();
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  if (cookies) await page.setCookie(...cookies);
  
  // Navigate to Facebook first
  await page.goto('https://www.facebook.com', { 
    waitUntil: 'networkidle2', 
    timeout: 60000 
  });
  
  // Go to the target post
  console.log(`Navigating to post: ${url}`);
  await page.goto(url, { 
    waitUntil: 'networkidle2', 
    timeout: 120000
  });
  
  // Wait for comments to appear
  console.log('Waiting for comments...');
  await page.waitForSelector('div[role="article"]', { timeout: 30000 });

  // Function to expand comment buttons
  async function expandComments() {
    const buttonXPaths = [
      "//span[contains(., 'See more')]",
      "//span[contains(., 'View more replies')]",
      "//span[contains(., 'See previous comments')]",
      "//span[contains(., 'View more comments')]",
      "//div[@aria-label='See more comments']"
    ];
    
    for (const xpath of buttonXPaths) {
      const buttons = await page.$x(xpath);
      for (const btn of buttons) {
        try {
          await btn.click();
          await page.waitForTimeout(1000);
        } catch (e) {
          // Ignore if not clickable
        }
      }
    }
  }

  // Initial expansion
  await expandComments();
  
  // Aggressive scrolling to load all comments with comment counting
  console.log('Scrolling to load comments...');
  let scrollAttempts = 0;
  const maxScrolls = 100;
  let lastCommentCount = 0;
  let noNewCount = 0;
  const maxNoNew = 5;
  
  while (scrollAttempts < maxScrolls && noNewCount < maxNoNew) {
    // Scroll to the bottom
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    
    // Wait for content to load with variable timeout
    await page.waitForTimeout(2000 + Math.random() * 2000);
    
    // Try to expand any new buttons
    await expandComments();
    
    // Check current comment count
    const currentComments = await page.$$('div[role="article"]');
    const currentCount = currentComments.length;
    console.log(`Scroll ${scrollAttempts + 1}: ${currentCount} comments`);
    
    // Check if we have enough comments
    if (currentCount >= limit * 2) {
      console.log(`Reached sufficient comments (${currentCount}), stopping scroll`);
      break;
    }
    
    // Check if new comments were loaded
    if (currentCount > lastCommentCount) {
      lastCommentCount = currentCount;
      noNewCount = 0; // reset counter
    } else {
      noNewCount++;
      console.log(`No new comments (${noNewCount}/${maxNoNew})`);
    }
    
    scrollAttempts++;
  }

  // Final expansion
  await expandComments();
  await page.waitForTimeout(3000);

  // Extract commenter profiles
  console.log('Extracting commenters...');
  const commentLeads = await page.evaluate(() => {
    const results = new Map();
    
    document.querySelectorAll('div[role="article"]').forEach(block => {
      try {
        // Find all candidate profile links
        const anchors = block.querySelectorAll('a[role="link"][href*="facebook.com"]');
        
        // Find the most likely profile link
        let profileAnchor = null;
        for (const anchor of anchors) {
          const href = anchor.href;
          if (href.includes('/profile.php') || 
              /facebook\.com\/[^/]+\/?$/.test(href)) {
            profileAnchor = anchor;
            break;
          }
        }
        
        // Fallback to first anchor if no obvious profile found
        if (!profileAnchor && anchors.length > 0) {
          profileAnchor = anchors[0];
        }
        
        if (!profileAnchor) return;
        
        // Extract name from image alt text if available
        let name = 'Unknown';
        const img = profileAnchor.querySelector('img');
        if (img && img.alt) {
          name = img.alt
            .replace('Profile picture', '')
            .replace('Avatar', '')
            .replace('Chats with ', '')
            .trim();
        } else {
          name = profileAnchor.textContent
            .trim()
            .replace('Chats with ', '')
            .split('\n')[0];
        }
        
        // Clean profile URL
        const profileUrl = profileAnchor.href.split('?')[0].replace(/\/$/, '');
        
        // Deduplicate by URL
        if (!results.has(profileUrl)) {
          results.set(profileUrl, {
            name,
            profileUrl
          });
        }
      } catch (e) {
        console.error('Comment extraction error', e);
      }
    });
    
    return Array.from(results.values());
  });

  console.log(`Found ${commentLeads.length} commenters, processing up to ${limit}`);
  
  // Process profiles in batches
  const processed = [];
  const batchSize = 3;
  const processLimit = Math.min(commentLeads.length, limit);
  
  for (let i = 0; i < processLimit; i += batchSize) {
    const batch = commentLeads.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(lead => 
        extractContactInfo(browser, lead.profileUrl, lead.name)
          .then(info => ({
            name: info.name,
            profileUrl: lead.profileUrl,
            email: info.email,
            phone: info.phone,
            source: 'Post Comment',
            timestamp: new Date().toISOString()
          }))
          .catch(e => {
            console.error(`Profile processing failed: ${lead.profileUrl}`, e.message);
            return {
              name: lead.name,
              profileUrl: lead.profileUrl,
              email: null,
              phone: null,
              source: 'Post Comment',
              timestamp: new Date().toISOString()
            };
          }))
    );
    
    processed.push(...batchResults);
    console.log(`Processed ${processed.length} of ${processLimit} profiles`);
    await page.waitForTimeout(2000); // Rate limiting
  }

  await browser.close();
  return processed.slice(0, limit);
}

async function scrapeGroupMembers(url, limit = 50, cookies = null) {
  const chromePath = await getChromePath();
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36');

  // Set cookies and navigate
  if (cookies) await page.setCookie(...cookies);
  await page.goto('https://www.facebook.com', { waitUntil: 'networkidle2', timeout: 60000 });
  
  // Construct proper members URL
  const cleanUrl = url.split('?')[0].replace(/\/$/, '');
  const membersUrl = `${cleanUrl}/members/`;
  await page.goto(membersUrl, { waitUntil: 'networkidle2', timeout: 60000 });
  
  // Wait for member list to load
  await page.waitForSelector('div[role="list"]', { timeout: 15000 });

  let leads = [];
  const MAX_SCROLL_ATTEMPTS = 20;
  let scrollAttempts = 0;
  const collectedProfileIds = new Set();

  while (leads.length < limit && scrollAttempts < MAX_SCROLL_ATTEMPTS) {
    // Scroll to load more members
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000);
    scrollAttempts++;
    
    // Extract member data from current page
    const newLeads = await page.$$eval(
      'div[role="listitem"]',
      (containers, limit, currentIds) => {
        return containers.map(container => {
          const link = container.querySelector('a[role="link"][href*="/"]');
          if (!link) return null;
          
          // Extract user ID from URL
          const href = link.href;
          const userIdMatch = href.match(/\/(profile\.php\?id=\d+)/) || 
                             href.match(/\/user\/(\d+)/) || 
                             href.match(/\/(\d+)[\/?]/);
          if (!userIdMatch) return null;
          
          const userId = userIdMatch[1].replace('profile.php?id=', '');
          if (currentIds.includes(userId)) return null;
          
          // Extract name - more reliable method
          let name = 'Unknown';
          const nameElement = container.querySelector('span[dir="auto"]') || 
                             container.querySelector('div[dir="auto"]') ||
                             link.querySelector('span, div');
          
          if (nameElement) {
            name = nameElement.textContent
              .trim()
              .replace(/\s+/g, ' ')
              .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
              .split('\n')[0];
          }
          
          // Clean name from titles/descriptions
          name = name.replace(/\s*\([^)]*\)|\s*\{.*?\}|\s*\[.*?\]|Verified account|Seo Specialist|\(Seo\)|\(The Web Guy\)|\(Nomi\)|\(Rao\)|\(学力\)/gi, '')
                     .trim();
          
          // Construct proper profile URL
          const profileUrl = `https://www.facebook.com/profile.php?id=${userId}`;
          
          return { name, profileUrl, userId };
        }).filter(lead => lead !== null).slice(0, limit - currentIds.length);
      },
      limit - leads.length,
      [...collectedProfileIds]
    );

    // Process new leads
    for (const lead of newLeads) {
      if (!collectedProfileIds.has(lead.userId)) {
        collectedProfileIds.add(lead.userId);
        leads.push({
          name: lead.name,
          profileUrl: lead.profileUrl,
          userId: lead.userId,
          source: 'Group Member',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // Process profiles in parallel with rate limiting
  const processedLeads = [];
  const parallelWorkers = 3;
  
  for (let i = 0; i < leads.length; i += parallelWorkers) {
    const batch = leads.slice(i, i + parallelWorkers);
    const results = await Promise.all(
      batch.map(lead => extractContactInfo(browser, lead.profileUrl, lead.name)
        .then(contactInfo => ({
                  ...lead, 
                  name: contactInfo.name,
                  email: contactInfo.email,
                  phone: contactInfo.phone
              })))
    );
    
    processedLeads.push(...results);
    await page.waitForTimeout(2500); // Rate limit between batches
  }

  await browser.close();
  return processedLeads.slice(0, limit);
}

async function extractContactInfo(browser, profileUrl, fallbackName = 'Unknown') {
  const page = await browser.newPage();
  
  try {
    // Navigate to profile
    await page.goto(profileUrl, { 
      waitUntil: 'domcontentloaded', 
      timeout: 40000 
    });

    // Check for restricted content - more reliable method
    const isRestricted = await page.evaluate(() => {
      // Check for specific error elements
      const errorElement = document.querySelector('div[data-sigil="error"]') || 
                          document.querySelector('img[alt*="restricted"]') ||
                          document.querySelector('div[aria-label*="Content Not Found"]');
      
      // Check for error text patterns
      const bodyText = document.body.innerText || '';
      const errorPatterns = [
        /This Content Isn't Available/i,
        /Content Not Found/i,
        /enable JavaScript/i,
        /log in/i,
        /restricted/i,
        /page isn't available/i
      ];
      
      return !!errorElement || errorPatterns.some(pattern => pattern.test(bodyText));
    });

    if (isRestricted) {
      console.log(`🔒 Skipped restricted/private profile: ${profileUrl}`);
      return { 
        name: fallbackName, 
        profileUrl, 
        email: null, 
        phone: null 
      };
    }

    // 🟢 NAME EXTRACTION - Fixed "Chats" issue
    let name = await page.evaluate(() => {
      // Try multiple selectors in priority order
      const selectors = [
        'h1', 
        'h2',
        'div.x1ey2m1c.xds687c.xg01cxk.x47corl.x10l6tqk.x17qophe.x13vifvy', // Facebook profile name class
        'span.x1lliihq.x193iq5w.x6ikm8r.x10wlt62.xlyipyv.xuxw1ft', // Another Facebook name class
        'strong span',
        '[role="heading"]',
        'title'
      ];
      
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent && el.textContent.trim() !== '') {
          let name = el.textContent.trim();
          // Clean name from Facebook-specific prefixes
          if (name.startsWith('Chats with ')) {
            name = name.replace('Chats with ', '');
          }
          return name;
        }
      }
      return 'Unknown';
    });

    // Final fallback if still empty
    if (!name || name === '' || name === 'Unknown') {
      name = await page.title()
        .then(t => t.replace(/\| Facebook.*/i, '').replace('Chats with ', '').trim())
        .catch(() => fallbackName);
    }

    // 🟢 EMAIL EXTRACTION - Original reliable method
    const textContent = await page.evaluate(() => document.body.innerText || '');
    const emailMatch = textContent.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
    const email = emailMatch ? emailMatch[0] : null;

    // 🟢 PHONE EXTRACTION - Fixed selector error
    let phone = null;
    
    try {
      // NEW METHOD: Find phone using icon detection
      const phoneIcon = await page.$('svg[aria-label="Mobile phone"]');
      if (phoneIcon) {
        // Traverse up to parent container
        const contactSection = await phoneIcon.evaluateHandle(el => 
          el.closest('div[class]')
        );
        
        if (contactSection) {
          const phoneText = await contactSection.evaluate(el => el.textContent || '');
          const phoneMatch = phoneText.match(/(?:\+?(\d{1,3})[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}\b/);
          if (phoneMatch) phone = phoneMatch[0];
        }
      }
    } catch (e) {
      console.error('Contact section error:', e.message);
    }
    
    // Fallback to content scanning if not found via icon
    if (!phone) {
      try {
        // Phone regex pattern
        const phoneRegex = /(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})\b/g;
        
        let phoneMatches = [];
        let match;
        
        while ((match = phoneRegex.exec(textContent)) !== null) {
          // Validate phone number format
          const digits = match[0].replace(/\D/g, '');
          if (digits.length >= 10 && digits.length <= 12) {
            // Check surrounding characters
            const before = textContent[match.index - 1] || '';
            const after = textContent[match.index + match[0].length] || '';
            if (!/\d/.test(before) && !/\d/.test(after)) {
              phoneMatches.push(match[0]);
            }
          }
        }
        
        if (phoneMatches.length > 0) phone = phoneMatches[0];
      } catch (e) {
        console.error('Phone scan error:', e.message);
      }
    }

    console.log(`✅ Scraped: ${name} | Email: ${email || 'N/A'} | Phone: ${phone || 'N/A'}`);
    return { name, profileUrl, email, phone };

  } catch (err) {
    console.error('❌ Profile scrape failed:', profileUrl, err.message);
    return { name: fallbackName, profileUrl, email: null, phone: null };
  } finally {
    await page.close();
  }
}

async function scrapeSearchResults(url, limit = 50, cookies = null) {
  const chromePath = await getChromePath();
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  if (cookies) await page.setCookie(...cookies);
  await page.goto('https://www.facebook.com', { waitUntil: 'networkidle2' });
  await page.goto(url, { waitUntil: 'networkidle2' });

  let leads = [];
  let previousCount = 0;
  let noNewCount = 0;
  const maxNoNew = 5;

  while (leads.length < limit && noNewCount < maxNoNew) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000);

    const resultContainers = await page.$$('div[role="article"]:has(a[href*="/profile.php"]), div[data-visualcompletion="ignore-dynamic"]');

    for (const container of resultContainers) {
      if (leads.length >= limit) break;

      try {
        const profileLink = await container.$('a[href*="/profile.php"], a[href*="/user/"]');
        if (!profileLink) continue;

        const profileUrl = await profileLink.evaluate(el => el.href);

        if (leads.some(lead => lead.profileUrl === profileUrl)) continue;

        // Now we just fetch name, email, and phone by scraping the actual profile
        const { name, email, phone } = await extractContactInfo(browser, profileUrl);

        leads.push({
          name,
          profileUrl,
          email,
          phone,
          timestamp: new Date().toISOString(),
          source: 'Search Result'
        });
      } catch (error) {
        console.error('Error processing search result:', error.message);
      }
    }

    if (leads.length > previousCount) {
      previousCount = leads.length;
      noNewCount = 0;
    } else {
      noNewCount++;
    }
  }

  await browser.close();
  return leads.slice(0, limit);
}

async function exportToCSV(data) {
  const downloadsPath = getDownloadsPath();
  const filename = path.join(downloadsPath, `facebook_leads_${Date.now()}.csv`);
  
  try {
    await fs.mkdir(downloadsPath, { recursive: true });
    const csvWriter = createObjectCsvWriter({
      path: filename,
      header: [
        { id: 'name', title: 'NAME' },
        { id: 'profileUrl', title: 'PROFILE_URL' },
        { id: 'email', title: 'EMAIL' },
        { id: 'phone', title: 'PHONE' },
        { id: 'source', title: 'SOURCE' },
        { id: 'timestamp', title: 'TIMESTAMP' }
      ]
    });
    
    await csvWriter.writeRecords(data);
    return { success: true, path: filename };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function exportToExcel(data) {
  const downloadsPath = getDownloadsPath();
  const filename = path.join(downloadsPath, `facebook_leads_${Date.now()}.xlsx`);
  
  try {
    await fs.mkdir(downloadsPath, { recursive: true });
    
    // Transform data for Excel
    const excelData = data.map(item => ({
      NAME: item.name,
      PROFILE_URL: item.profileUrl,
      EMAIL: item.email,
      PHONE: item.phone,
      SOURCE: item.source,
      TIMESTAMP: item.timestamp
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');
    XLSX.writeFile(workbook, filename);
    
    return { success: true, path: filename };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  scrapePostData,
  scrapeGroupMembers,
  scrapeSearchResults,
  exportToCSV,
  exportToExcel
};