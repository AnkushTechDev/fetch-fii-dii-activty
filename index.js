const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// File to store data
const DATA_FILE = path.join('E:', 'nse', 'fii-dii-activity', 'fii-dii-activity.json');
const DEBUG_HTML_FILE = path.join(__dirname, 'debug_page.html');

// Function to format date for HTML table (e.g., "06-Jun-2025")
function formatDateForHTML(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

// Function to format date for JSON output (e.g., "06-06-2025")
function formatDateForJSON(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

// Function for delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to fetch and parse DII/FII data from Moneycontrol
async function fetchDIIFIIActivity() {
    let browser;
    try {
        // Launch headless browser
        browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();

        // Capture console logs from page.evaluate
        page.on('console', msg => {
            console.log('PAGE LOG:', msg.text());
        });

        // Set user agent and headers
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
        });

        // Navigate to the Moneycontrol page
        const url = 'https://www.moneycontrol.com/stocks/marketstats/fii_dii_activity/index.php';
        console.log('Navigating to:', url);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for the table with retry
        let tableFound = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                await page.waitForSelector('div.fidi_tbescrol table.mctable1 tbody', { timeout: 30000 });
                // Wait for multiple rows to ensure daily data is loaded
                await page.waitForFunction(
                    () => {
                        const tbody = document.querySelector('div.fidi_tbescrol table.mctable1 tbody');
                        return tbody && tbody.querySelectorAll('tr').length > 1;
                    },
                    { timeout: 30000 }
                );
                tableFound = true;
                break;
            } catch (e) {
                console.log(`Attempt ${attempt}: Table or rows not found. Retrying...`);
                await delay(5000);
            }
        }

        if (!tableFound) {
            console.log('Table not found with selector "div.fidi_tbescrol table.mctable1 tbody" or no daily rows after retries.');
        }

        // Add delay for dynamic content
        await delay(15000);

        // Save page HTML for debugging
        const htmlContent = await page.content();
        await fs.writeFile(DEBUG_HTML_FILE, htmlContent);
        console.log(`Page HTML saved to ${DEBUG_HTML_FILE}`);

        // Extract data
        const diiFiiData = await page.evaluate((today) => {
            const data = {
                date: today,
                dii: { buyValue: 0, sellValue: 0, netValue: 0 },
                fii: { buyValue: 0, sellValue: 0, netValue: 0 },
                timestamp: new Date().toISOString()
            };

            // Log all mctable1 tables
            const allTables = document.querySelectorAll('table.mctable1');
            console.log(`Found ${allTables.length} tables with class "mctable1"`);

            // Find the specific table
            const table = document.querySelector('div.fidi_tbescrol table.mctable1 tbody');
            if (!table) {
                console.log('Table not found with selector "div.fidi_tbescrol table.mctable1 tbody"');
                return data;
            }

            // Log raw table HTML
            console.log('Table HTML:', table.innerHTML.substring(0, 1000));

            const rows = table.querySelectorAll('tr');
            if (rows.length === 0) {
                console.log('No rows found in table');
                return data;
            }

            console.log(`Found ${rows.length} rows in table`);

            // Log all row dates
            const rowDates = Array.from(rows).map(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length < 7) return 'Insufficient cells';
                const dateSpan = cells[0].querySelector('span.mob-hide') || cells[0].querySelector('span.desk-hide');
                return (dateSpan ? dateSpan.innerText : cells[0].innerText).trim();
            });
            console.log('All row dates:', JSON.stringify(rowDates));

            // Iterate through rows
            for (const row of rows) {
                const cells = row.querySelectorAll('td');
                if (cells.length < 7) {
                    console.log('Skipping row with insufficient cells:', cells.length);
                    continue;
                }

                // Extract date, handling spans
                const dateSpan = cells[0].querySelector('span.mob-hide') || cells[0].querySelector('span.desk-hide');
                const rowDate = (dateSpan ? dateSpan.innerText : cells[0].innerText).trim();
                console.log('Row date:', JSON.stringify(rowDate));

                // Normalize date for comparison
                const cleanRowDate = rowDate.replace(/[\s\u00A0]+/g, '-').trim();
                const cleanToday = today.replace(/[\s\u00A0]+/g, '-').trim();
                console.log('Cleaned row date:', cleanRowDate, 'Cleaned today:', cleanToday);

                if (cleanRowDate === cleanToday || rowDate.includes(today.split('-').join(' '))) {
                    console.log('Found matching row for date:', rowDate);
                    console.log('Cells:', Array.from(cells).map(cell => cell.innerText.trim()));
                    data.fii.buyValue = parseFloat(cells[1].innerText.replace(/,/g, '')) || 0; // FII Gross Purchase
                    data.fii.sellValue = parseFloat(cells[2].innerText.replace(/,/g, '')) || 0; // FII Gross Sales
                    data.fii.netValue = parseFloat(cells[3].innerText.replace(/,/g, '')) || 0; // FII Net
                    data.dii.buyValue = parseFloat(cells[4].innerText.replace(/,/g, '')) || 0; // DII Gross Purchase
                    data.dii.sellValue = parseFloat(cells[5].innerText.replace(/,/g, '')) || 0; // DII Gross Sales
                    data.dii.netValue = parseFloat(cells[6].innerText.replace(/,/g, '')) || 0; // DII Net
                    break;
                }
            }

            return data;
        }, formatDateForHTML(new Date())); // Pass today's date for HTML (e.g., "06-Jun-2025")

        // Read existing data from file
        let existingData = [];
        try {
            const fileContent = await fs.readFile(DATA_FILE, 'utf8');
            existingData = JSON.parse(fileContent);
            if (!Array.isArray(existingData)) {
                console.log('Existing file is not an array, initializing as empty array');
                existingData = [];
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('Data file does not exist, will create new one');
            } else {
                console.error('Error reading existing data file:', error.message);
            }
        }

        // Create new entry in the required format
        const newEntry = {
            Date: formatDateForJSON(new Date()), // Use DD-MM-YYYY format (e.g., "06-06-2025")
            'DII Cash': diiFiiData.dii.netValue,
            'FII Cash': diiFiiData.fii.netValue
        };

        // Append new entry
        existingData.push(newEntry);

        // Save updated data to file
        await fs.writeFile(DATA_FILE, JSON.stringify(existingData, null, 2));
        console.log('DII/FII data appended to file:', newEntry);

        await browser.close();
    } catch (error) {
        console.error('Error fetching DII/FII data:', error.message);
        if (browser) await browser.close();
    }
}


// Run immediately on script start (for testing)
fetchDIIFIIActivity();