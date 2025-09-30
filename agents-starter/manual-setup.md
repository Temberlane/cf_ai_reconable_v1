# Manual Setup Guide for Reconable Lite+

If the automated setup script fails, follow these manual steps to set up Reconable Lite+.

## Prerequisites

1. **Install Wrangler CLI**
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**
   ```bash
   wrangler login
   ```

3. **Verify Authentication**
   ```bash
   wrangler whoami
   ```

## Step 1: Create D1 Database

1. **Create the database**
   ```bash
   wrangler d1 create reconable-db
   ```

2. **Note the database ID** from the output (it looks like: `database_id = "abc123-def456-..."`)

3. **Update wrangler.jsonc** with the actual database ID:
   ```jsonc
   "d1_databases": [
     {
       "binding": "DB",
       "database_name": "reconable-db",
       "database_id": "your-actual-database-id-here"
     }
   ]
   ```

## Step 2: Create Vectorize Index

1. **Create the Vectorize index**
   ```bash
   wrangler vectorize create reconable-embeddings --dimensions=768 --metric=cosine
   ```

2. **Verify the index was created**
   ```bash
   wrangler vectorize list
   ```

## Step 3: Initialize Database Schema

1. **Run the schema initialization**
   ```bash
   wrangler d1 execute reconable-db --file=./schema.sql
   ```

2. **Verify tables were created**
   ```bash
   wrangler d1 execute reconable-db --command="SELECT name FROM sqlite_master WHERE type='table';"
   ```

## Step 4: Configure LinkedIn OAuth

1. **Go to LinkedIn Developer Portal**
   - Visit [https://www.linkedin.com/developers/](https://www.linkedin.com/developers/)
   - Create a new app
   - Add redirect URI: `https://reconable-lite-plus.temberlane195.workers.dev/oauth/linkedin/callback`

2. **Update wrangler.jsonc** with your LinkedIn Client ID:
   ```jsonc
   "vars": {
     "LINKEDIN_CLIENT_ID": "your-linkedin-client-id",
     "LINKEDIN_REDIRECT_URI": "https://reconable-lite-plus.temberlane195.workers.dev/oauth/linkedin/callback"
   }
   ```

3. **Set LinkedIn Client Secret**
   ```bash
   wrangler secret put LINKEDIN_CLIENT_SECRET
   # Enter your client secret when prompted
   ```

## Step 5: Deploy the Application

1. **Deploy to Cloudflare Workers**
   ```bash
   wrangler deploy
   ```

2. **Verify deployment**
   - Check the output for your Worker URL
   - Visit the URL to test the application

## Step 6: Test the Setup

1. **Test OAuth flow**
   ```bash
   curl "https://your-worker-url.workers.dev/oauth/linkedin/start?userId=test123"
   ```

2. **Test API endpoints**
   ```bash
   # Check user session
   curl "https://your-worker-url.workers.dev/api/me?userId=test123"
   
   # Start analysis
   curl -X POST "https://your-worker-url.workers.dev/api/run" \
     -H "Content-Type: application/json" \
     -d '{"subject": "Test Subject", "userId": "test123"}'
   ```

## Troubleshooting

### D1 Database Issues

1. **Check if database exists**
   ```bash
   wrangler d1 list
   ```

2. **If database creation fails**
   - Check your Cloudflare account limits
   - Ensure you have D1 enabled
   - Try a different database name

3. **If schema initialization fails**
   - Check the schema.sql file exists
   - Verify database permissions
   - Try running individual SQL commands

### Vectorize Issues

1. **Check if index exists**
   ```bash
   wrangler vectorize list
   ```

2. **If index creation fails**
   - Check your Cloudflare account limits
   - Ensure you have Vectorize enabled
   - Try a different index name

### LinkedIn OAuth Issues

1. **Check redirect URI**
   - Must exactly match what's configured in LinkedIn app
   - Must use HTTPS in production
   - No trailing slashes

2. **Check client credentials**
   - Verify Client ID in wrangler.jsonc
   - Verify Client Secret with `wrangler secret list`

3. **Check app status**
   - Ensure LinkedIn app is approved
   - Check for any policy violations

### Deployment Issues

1. **Check wrangler.jsonc syntax**
   ```bash
   wrangler deploy --dry-run
   ```

2. **Check for missing bindings**
   - Ensure all required bindings are configured
   - Check for typos in binding names

3. **Check logs**
   ```bash
   wrangler tail
   ```

## Verification Checklist

- [ ] D1 database created and schema initialized
- [ ] Vectorize index created
- [ ] LinkedIn OAuth configured
- [ ] Application deployed successfully
- [ ] OAuth flow works
- [ ] API endpoints respond correctly
- [ ] Analysis can be started

## Getting Help

If you're still having issues:

1. **Check Cloudflare Status**: [https://www.cloudflarestatus.com/](https://www.cloudflarestatus.com/)
2. **Review Wrangler Logs**: `wrangler tail`
3. **Check Worker Logs**: In Cloudflare Dashboard
4. **Verify Account Limits**: In Cloudflare Dashboard
5. **Open an Issue**: In the project repository

## Next Steps

Once setup is complete:

1. **Visit your deployed URL**
2. **Click "Connect LinkedIn"** to authorize
3. **Start analyzing subjects!**
4. **Check the README** for usage examples

---

**Note**: This manual setup process ensures you have full control over each step and can troubleshoot issues as they arise.
