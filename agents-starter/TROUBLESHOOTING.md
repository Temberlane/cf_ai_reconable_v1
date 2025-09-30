# Troubleshooting Guide for Reconable Lite+

This guide helps you resolve common issues when setting up and running Reconable Lite+.

## 🚨 Common Setup Issues

### D1 Database Creation Fails

**Symptoms:**
- Script fails with "Failed to create D1 database"
- Database ID extraction fails
- "Database already exists" errors

**Solutions:**

1. **Check Wrangler Authentication**
   ```bash
   wrangler whoami
   # Should show your email address
   ```

2. **Check Account Limits**
   - Go to Cloudflare Dashboard
   - Check if you've reached D1 database limits
   - Upgrade plan if necessary

3. **Manual Database Creation**
   ```bash
   # Create database manually
   wrangler d1 create reconable-db
   
   # Note the database ID from output
   # Update wrangler.jsonc with the ID
   ```

4. **Check Existing Databases**
   ```bash
   wrangler d1 list
   # Look for existing reconable-db
   ```

5. **Try Different Database Name**
   ```bash
   wrangler d1 create reconable-db-v2
   # Update wrangler.jsonc accordingly
   ```

### Vectorize Index Creation Fails

**Symptoms:**
- "Failed to create Vectorize index"
- Vectorize not available in account
- Index creation timeout

**Solutions:**

1. **Check Vectorize Availability**
   ```bash
   wrangler vectorize list
   # Should work without errors
   ```

2. **Check Account Limits**
   - Ensure Vectorize is enabled in your account
   - Check if you've reached index limits

3. **Manual Index Creation**
   ```bash
   wrangler vectorize create reconable-embeddings --dimensions=768 --metric=cosine
   ```

4. **Try Different Index Name**
   ```bash
   wrangler vectorize create reconable-embeddings-v2 --dimensions=768 --metric=cosine
   ```

### LinkedIn OAuth Issues

**Symptoms:**
- "Invalid redirect_uri" errors
- "Invalid client_id" errors
- OAuth flow doesn't complete

**Solutions:**

1. **Check Redirect URI**
   - Must exactly match LinkedIn app configuration
   - Use HTTPS in production
   - No trailing slashes

2. **Verify Client Credentials**
   ```bash
   # Check Client ID in wrangler.jsonc
   cat wrangler.jsonc | grep LINKEDIN_CLIENT_ID
   
   # Check Client Secret
   wrangler secret list
   ```

3. **Test OAuth URL Manually**
   ```bash
   # Test the OAuth start URL
   curl "https://your-worker-url.workers.dev/oauth/linkedin/start?userId=test123"
   # Should redirect to LinkedIn
   ```

4. **Check LinkedIn App Status**
   - Ensure app is approved in LinkedIn Developer Portal
   - Check for any policy violations
   - Verify scopes are correctly configured

### Deployment Issues

**Symptoms:**
- "Deployment failed" errors
- Worker doesn't start
- 500 errors when accessing endpoints

**Solutions:**

1. **Check wrangler.jsonc Syntax**
   ```bash
   wrangler deploy --dry-run
   # Should not show errors
   ```

2. **Verify All Bindings**
   - Check D1 database ID is correct
   - Verify Vectorize index name
   - Ensure all required bindings are present

3. **Check Worker Logs**
   ```bash
   wrangler tail
   # Look for error messages
   ```

4. **Test Individual Components**
   ```bash
   # Test D1 connection
   wrangler d1 execute reconable-db --command="SELECT 1;"
   
   # Test Vectorize
   wrangler vectorize list
   ```

## 🔍 Debugging Commands

### Check System Status
```bash
# Check Wrangler version
wrangler --version

# Check authentication
wrangler whoami

# Check account info
wrangler whoami --format json
```

### Check Resources
```bash
# List D1 databases
wrangler d1 list

# List Vectorize indexes
wrangler vectorize list

# List KV namespaces
wrangler kv:namespace list

# List secrets
wrangler secret list
```

### Test Database
```bash
# Test D1 connection
wrangler d1 execute reconable-db --command="SELECT name FROM sqlite_master WHERE type='table';"

# Check schema
wrangler d1 execute reconable-db --file=./schema.sql --dry-run
```

### Test API Endpoints
```bash
# Test health check
curl "https://your-worker-url.workers.dev/"

# Test OAuth start
curl "https://your-worker-url.workers.dev/oauth/linkedin/start?userId=test123"

# Test API endpoints
curl "https://your-worker-url.workers.dev/api/me?userId=test123"
```

## 🛠️ Manual Recovery Steps

### If Setup Script Completely Fails

1. **Stop and Reset**
   ```bash
   # Cancel any running setup
   # Clean up partial resources if needed
   ```

2. **Follow Manual Setup**
   - Use `manual-setup.md` guide
   - Complete each step individually
   - Verify each step before proceeding

3. **Test Each Component**
   - Test D1 database creation
   - Test Vectorize index creation
   - Test LinkedIn OAuth setup
   - Test deployment

### If Database Schema Fails

1. **Check Schema File**
   ```bash
   # Verify schema.sql exists and is valid
   cat schema.sql
   ```

2. **Run Schema Manually**
   ```bash
   # Run individual table creation
   wrangler d1 execute reconable-db --command="CREATE TABLE IF NOT EXISTS claims (id TEXT PRIMARY KEY, subject_id TEXT NOT NULL, predicate TEXT NOT NULL, object TEXT NOT NULL, confidence REAL NOT NULL, first_seen_at TEXT NOT NULL, last_verified_at TEXT NOT NULL, provenance_json TEXT NOT NULL, policy_tags TEXT NOT NULL);"
   ```

3. **Verify Tables Created**
   ```bash
   wrangler d1 execute reconable-db --command="SELECT name FROM sqlite_master WHERE type='table';"
   ```

### If LinkedIn OAuth Fails

1. **Check LinkedIn App Configuration**
   - Verify redirect URI matches exactly
   - Check scopes are correct
   - Ensure app is approved

2. **Test OAuth Flow Step by Step**
   ```bash
   # Step 1: Get OAuth URL
   curl "https://your-worker-url.workers.dev/oauth/linkedin/start?userId=test123"
   
   # Step 2: Complete OAuth in browser
   # Step 3: Check callback handling
   ```

3. **Check Worker Logs**
   ```bash
   wrangler tail
   # Look for OAuth-related errors
   ```

## 📊 Performance Issues

### Slow Database Queries

1. **Check Database Size**
   ```bash
   wrangler d1 execute reconable-db --command="SELECT COUNT(*) FROM claims;"
   ```

2. **Add Indexes**
   ```sql
   CREATE INDEX IF NOT EXISTS idx_claims_subject ON claims(subject_id);
   CREATE INDEX IF NOT EXISTS idx_claims_predicate ON claims(predicate);
   ```

### Memory Issues

1. **Check Worker Memory Usage**
   - Monitor in Cloudflare Dashboard
   - Look for memory limit warnings

2. **Optimize Queries**
   - Use LIMIT clauses
   - Implement pagination
   - Cache frequently accessed data

## 🆘 Getting Help

### Before Asking for Help

1. **Check This Guide** - Most issues are covered here
2. **Check Logs** - Use `wrangler tail` to see errors
3. **Test Components** - Verify each part works individually
4. **Check Cloudflare Status** - [https://www.cloudflarestatus.com/](https://www.cloudflarestatus.com/)

### When Reporting Issues

Include the following information:

1. **Error Messages** - Exact error text
2. **Steps to Reproduce** - What you did before the error
3. **Environment** - OS, Node version, Wrangler version
4. **Logs** - Output from `wrangler tail`
5. **Configuration** - Relevant parts of wrangler.jsonc

### Useful Commands for Debugging

```bash
# Get detailed error information
wrangler deploy --verbose

# Check worker status
wrangler tail --format=pretty

# Test specific functionality
wrangler d1 execute reconable-db --command="SELECT * FROM claims LIMIT 5;"

# Check Vectorize status
wrangler vectorize list --format=json
```

## ✅ Success Indicators

You'll know everything is working when:

- [ ] `wrangler deploy` completes without errors
- [ ] Worker URL loads without 500 errors
- [ ] OAuth flow redirects to LinkedIn
- [ ] LinkedIn callback completes successfully
- [ ] API endpoints return valid JSON
- [ ] Analysis can be started and completed
- [ ] Reports are generated successfully

---

**Remember**: Most issues are configuration-related and can be resolved by carefully following the setup steps and checking each component individually.
