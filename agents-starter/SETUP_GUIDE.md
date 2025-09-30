# 🚀 Reconable Lite+ Setup Guide (Web Scraping Version)

## Quick Start

The **updated `setup.sh` script** is now valid and ready to use! It has been completely rewritten for the web scraping architecture.

### Prerequisites

1. **Node.js** (v18 or later)
2. **Wrangler CLI** (Cloudflare's command-line tool)
3. **Cloudflare Account** (free tier works fine)
4. **Brightdata Account** (for web scraping API)

### Installation Steps

```bash
# 1. Install Wrangler CLI globally
npm install -g wrangler

# 2. Login to Cloudflare
wrangler login

# 3. Navigate to the project directory
cd agents-starter

# 4. Run the setup script
chmod +x setup.sh
./setup.sh
```

That's it! The script will automatically:
- ✅ Create D1 database
- ✅ Create Vectorize index
- ✅ Initialize database schema
- ✅ Configure Brightdata API
- ✅ Deploy the application
- ✅ **No OAuth setup required!**

### Brightdata Setup

Before running the setup script, you'll need to:

1. **Sign up for Brightdata**: Go to [https://brightdata.com/](https://brightdata.com/)
2. **Create a Dataset**: Set up a dataset for LinkedIn scraping
3. **Get API Token**: Copy your API token from the dashboard
4. **Run Setup**: The script will prompt for your API token

## What's Different in Web Scraping Version

### ❌ **Removed (No Longer Needed)**
- LinkedIn OAuth setup
- LinkedIn API credentials
- User session management
- KV storage for tokens
- Complex consent flows

### ✅ **Added (New Features)**
- Automatic web scraping
- Browser Rendering API integration
- Public data compliance
- Simplified deployment
- Enhanced privacy controls

## Manual Setup (Alternative)

If you prefer to set up manually or the script fails:

### 1. Create D1 Database
```bash
wrangler d1 create reconable-db
# Copy the database_id from the output
```

### 2. Create Vectorize Index
```bash
wrangler vectorize create reconable-embeddings --dimensions=768 --metric=cosine
```

### 3. Initialize Database Schema
```bash
wrangler d1 execute reconable-db --file=./schema.sql
```

### 4. Update Configuration
Edit `wrangler.jsonc` and replace `your-d1-database-id` with your actual database ID.

### 5. Deploy
```bash
wrangler deploy
```

## Configuration Files

### `wrangler.jsonc` (Updated)
```jsonc
{
  "name": "reconable-lite-plus",
  "main": "src/reconable-server.ts",
  "compatibility_date": "2025-08-03",
  "ai": { "binding": "AI" },
  "browser": { "binding": "BROWSER_RENDERING" },
  "assets": { "directory": "public", "binding": "ASSETS" },
  "durable_objects": {
    "bindings": [{ "name": "SUBJECT_ORCHESTRATOR", "class_name": "SubjectOrchestrator" }]
  },
  "vectorize": [{ "binding": "VECTORIZE_INDEX", "index_name": "reconable-embeddings" }],
  "d1_databases": [{ "binding": "DB", "database_name": "reconable-db", "database_id": "YOUR_DB_ID" }]
}
```

### Required Cloudflare Resources
- **D1 Database**: For canonical facts storage
- **Vectorize Index**: For semantic memory
- **Browser Rendering**: For web scraping
- **Workers AI**: For analysis and extraction
- **Static Assets**: For the web UI

## Deployment Verification

After running `setup.sh`, verify your deployment:

```bash
# Check if the app is running
curl https://reconable-lite-plus.temberlane195.workers.dev/api/me

# Expected response:
{
  "user_id": "web-scraping-user",
  "data_sources": ["Web Scraping", "LinkedIn Public Profiles", "Search Engines"],
  "privacy_level": "public",
  "consent_summary": {
    "status": "granted",
    "granted": ["Web Scraping", "Public Data"],
    "required": []
  }
}
```

## Usage

1. **Visit the Application**
   - Go to: `https://reconable-lite-plus.temberlane195.workers.dev`

2. **Start Analysis**
   - Enter a subject name (person or company)
   - Click "Start Analysis"
   - No OAuth required!

3. **Monitor Progress**
   - Check status as the analysis runs
   - Get the final report when complete

## Troubleshooting

### Common Issues

#### 1. **Wrangler Not Found**
```bash
npm install -g wrangler
```

#### 2. **Not Logged In**
```bash
wrangler login
```

#### 3. **Database Creation Fails**
- Check your Cloudflare account limits
- Try creating manually: `wrangler d1 create reconable-db`

#### 4. **Vectorize Creation Fails**
- Ensure you have Vectorize enabled in your account
- Try creating manually: `wrangler vectorize create reconable-embeddings --dimensions=768 --metric=cosine`

#### 5. **Deployment Fails**
- Check `wrangler.jsonc` configuration
- Ensure all required bindings are present
- Check Cloudflare account status

### Debug Commands

```bash
# Check D1 databases
wrangler d1 list

# Check Vectorize indexes
wrangler vectorize list

# Check deployment status
wrangler deployments list

# View logs
wrangler tail

# Test local development
wrangler dev
```

## Development

### Local Development
```bash
# Start local development server
wrangler dev

# Test with local database
wrangler d1 execute reconable-db --local --file=./schema.sql
```

### Project Structure
```
agents-starter/
├── src/
│   ├── agents/           # Multi-agent system
│   ├── memory/           # Memory management
│   ├── scraping/         # Web scraping tools
│   ├── prompts/          # AI prompts
│   └── routes.ts         # HTTP routes
├── public/
│   └── index.html        # Web UI
├── schema.sql            # Database schema
├── wrangler.jsonc        # Cloudflare configuration
└── setup.sh             # Setup script
```

## Security & Privacy

### Data Collection
- **Public Data Only**: No private or restricted content
- **Ethical Scraping**: Respects robots.txt and rate limits
- **PII Redaction**: Automatically removes sensitive information
- **Transparent Process**: Clear about data sources

### Compliance
- **GDPR Compliant**: Only processes public data
- **Rate Limiting**: Implements appropriate delays
- **Audit Trail**: Logs all scraping activities
- **Data Retention**: Configurable storage policies

## Support

### Documentation
- `README_RECONABLE_LITE_PLUS.md` - Main documentation
- `ARCHITECTURE_REWRITE_SUMMARY.md` - Architecture details
- `TROUBLESHOOTING.md` - Common issues and solutions

### Getting Help
1. Check the troubleshooting section above
2. Review the architecture documentation
3. Check Cloudflare Workers documentation
4. Verify your account limits and permissions

---

**The web scraping version is much simpler to set up and deploy - no OAuth complexity, no API credentials, just pure web scraping power! 🚀**
