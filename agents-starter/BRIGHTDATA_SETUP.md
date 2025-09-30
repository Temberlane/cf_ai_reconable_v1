# 🔑 Brightdata API Setup Guide

## Overview

Reconable Lite+ now uses **Brightdata's API scraping service** for reliable web scraping instead of the Browser Rendering API. This provides:

- ✅ **More Reliable**: Professional scraping infrastructure
- ✅ **Better Performance**: Faster and more consistent results
- ✅ **Higher Success Rate**: Less likely to be blocked
- ✅ **Scalable**: Can handle high-volume scraping

## Step-by-Step Setup

### 1. Create Brightdata Account

1. Go to [https://brightdata.com/](https://brightdata.com/)
2. Click "Start Free Trial" or "Sign Up"
3. Complete the registration process
4. Verify your email address

### 2. Create a Dataset

1. **Login to Brightdata Dashboard**
2. **Navigate to Datasets**
   - Go to "Datasets" in the left sidebar
   - Click "Create Dataset"
3. **Choose Dataset Type**
   - Select "Web Scraper" or "LinkedIn Scraper"
   - Choose "Custom" if available
4. **Configure Dataset**
   - **Name**: `linkedin-scraper` (or any name you prefer)
   - **Description**: `LinkedIn profile and company scraping for Reconable Lite+`
   - **Target Sites**: Add `linkedin.com`
5. **Save Dataset**
   - Note down the **Dataset ID** (you'll need this)

### 3. Get API Token

1. **Go to API Settings**
   - Navigate to "API" or "Settings" in the dashboard
   - Look for "API Tokens" or "Authentication"
2. **Create New Token**
   - Click "Create New Token" or "Generate Token"
   - **Name**: `reconable-lite-plus`
   - **Permissions**: Select "Dataset Access" or "Full Access"
3. **Copy Token**
   - **Important**: Copy the token immediately (you won't see it again)
   - Store it securely

### 4. Test API Connection

Test your API token with a simple curl command:

```bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
     -H "Content-Type: application/json" \
     -d '[{"url":"https://linkedin.com/in/thomas-li-softwareeng"}]' \
     "https://api.brightdata.com/datasets/v3/trigger?dataset_id=YOUR_DATASET_ID&include_errors=true"
```

Expected response:
```json
{
  "snapshot_id": "s_mg5nk82k1w1vkkg7yp"
}
```

### 5. Configure Reconable Lite+

#### Option A: Use Setup Script (Recommended)

```bash
cd agents-starter
chmod +x setup.sh
./setup.sh
```

The script will prompt you for:
- **Brightdata API Token**: Paste your token
- **Dataset ID**: Enter your dataset ID (default: `gd_l1viktl72bvl7bjuj0`)

#### Option B: Manual Configuration

1. **Set API Token as Secret**:
   ```bash
   wrangler secret put BRIGHTDATA_API_TOKEN
   # Enter your API token when prompted
   ```

2. **Update wrangler.jsonc**:
   ```jsonc
   "vars": {
     "BRIGHTDATA_DATASET_ID": "your-dataset-id-here"
   }
   ```

3. **Deploy**:
   ```bash
   wrangler deploy
   ```

## Configuration Details

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `BRIGHTDATA_API_TOKEN` | Your Brightdata API token | `bd_1234567890abcdef` |
| `BRIGHTDATA_DATASET_ID` | Your dataset ID | `gd_l1viktl72bvl7bjuj0` |

### Dataset Configuration

The dataset should be configured to scrape:
- **LinkedIn Profiles**: `https://linkedin.com/in/*`
- **LinkedIn Companies**: `https://linkedin.com/company/*`
- **LinkedIn Search**: `https://linkedin.com/search/results/people/*`

## API Usage Examples

### Scrape LinkedIn Profile

```bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
     -H "Content-Type: application/json" \
     -d '[{"url":"https://linkedin.com/in/example-profile"}]' \
     "https://api.brightdata.com/datasets/v3/trigger?dataset_id=YOUR_DATASET_ID&include_errors=true"
```

### Check Scraping Status

```bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
     "https://api.brightdata.com/datasets/v3/snapshots/SNAPSHOT_ID"
```

### Scrape Multiple URLs

```bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
     -H "Content-Type: application/json" \
     -d '[
       {"url":"https://linkedin.com/in/profile1"},
       {"url":"https://linkedin.com/in/profile2"},
       {"url":"https://linkedin.com/company/company1"}
     ]' \
     "https://api.brightdata.com/datasets/v3/trigger?dataset_id=YOUR_DATASET_ID&include_errors=true"
```

## Troubleshooting

### Common Issues

#### 1. **Invalid API Token**
```
Error: Brightdata API error: 401 - Unauthorized
```
**Solution**: Check your API token and ensure it has the correct permissions.

#### 2. **Invalid Dataset ID**
```
Error: Brightdata API error: 404 - Dataset not found
```
**Solution**: Verify your dataset ID in the Brightdata dashboard.

#### 3. **Rate Limiting**
```
Error: Brightdata API error: 429 - Too Many Requests
```
**Solution**: Wait a few minutes before making more requests.

#### 4. **Scraping Timeout**
```
Error: Timeout waiting for scraping completion
```
**Solution**: Some pages take longer to scrape. The system will retry automatically.

### Debug Commands

```bash
# Check if secrets are set
wrangler secret list

# View logs
wrangler tail

# Test API connection
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "https://api.brightdata.com/datasets/v3/datasets"
```

## Pricing

### Brightdata Pricing Tiers

- **Free Trial**: Usually includes some free credits
- **Pay-as-you-go**: Pay only for what you use
- **Monthly Plans**: Fixed monthly costs with included credits

### Cost Optimization

1. **Batch Requests**: Send multiple URLs in one request
2. **Cache Results**: Store scraped data to avoid re-scraping
3. **Filter URLs**: Only scrape relevant pages
4. **Monitor Usage**: Check your usage in the Brightdata dashboard

## Security Best Practices

1. **Secure Token Storage**: Never commit API tokens to version control
2. **Use Secrets**: Store tokens as Cloudflare secrets
3. **Rotate Tokens**: Regularly rotate your API tokens
4. **Monitor Usage**: Set up alerts for unusual usage patterns
5. **Access Control**: Limit token permissions to minimum required

## Support

### Brightdata Support
- **Documentation**: [https://docs.brightdata.com/](https://docs.brightdata.com/)
- **Support Portal**: Available in your Brightdata dashboard
- **Community**: Brightdata community forums

### Reconable Lite+ Support
- **Issues**: Check the troubleshooting section above
- **Logs**: Use `wrangler tail` to view real-time logs
- **Configuration**: Verify your `wrangler.jsonc` settings

---

**Once configured, Reconable Lite+ will automatically use Brightdata for all web scraping operations, providing reliable and professional-grade data collection! 🚀**
