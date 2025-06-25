# 📊 FII/DII Activity Scraper

This Node.js script uses Puppeteer to scrape the **FII/DII Cash Market Activity** data from [Moneycontrol](https://www.moneycontrol.com/stocks/marketstats/fii_dii_activity/index.php). The data is stored daily in a structured JSON format for future use or analysis.

---

## 🚀 Features

- Scrapes latest daily FII and DII activity
- Saves the result in JSON format
- Captures debugging HTML snapshots
- Handles dynamic content loading with retries
- Formats data for both human-readability and storage

---

## 📦 Requirements

- Node.js (v14+ recommended)
- npm or yarn

---

## 🛠️ Setup

1. **Clone the repository**

```bash
git clone https://github.com/your-username/fii-dii-activity-scraper.git
cd fii-dii-activity-scraper
```

2. **Install dependencies**

```bash
npm install puppeteer
```

3. **Run the Script**

```bash
node index.js
```

### Sample JSON Output
```json
[
  {
    "Date": "25-06-2025",
    "DII Cash": 912.34,
    "FII Cash": -1325.67
  },
  ...
]
```

### 🙌 Acknowledgments
Data sourced from Moneycontrol

