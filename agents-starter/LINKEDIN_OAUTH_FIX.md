# LinkedIn OAuth Fix Guide

## 🚨 Current Issue
You're getting "LinkedIn Network Will Be Back Soon" error when trying to connect LinkedIn OAuth.

## 🔍 Root Cause
This error typically occurs when:
1. LinkedIn app is not properly configured
2. Redirect URI doesn't match exactly
3. App is not approved or has been suspended
4. Client ID/Secret are incorrect

## ✅ Step-by-Step Fix

### Step 1: Check LinkedIn App Status

1. **Go to LinkedIn Developer Portal**
   - Visit: https://www.linkedin.com/developers/
   - Sign in with your LinkedIn account

2. **Find Your App**
   - Look for an app with Client ID: `86pjzbb6hb24d5`
   - If you don't see it, you need to create a new app

### Step 2: Create/Configure LinkedIn App

1. **Create New App** (if needed)
   - Click "Create App"
   - **App Name**: `Reconable Lite+`
   - **LinkedIn Page**: Select your company page or create one
   - **Privacy Policy URL**: `https://reconable-lite-plus.temberlane195.workers.dev/privacy`
   - **App Logo**: Upload a logo (optional)
   - Click "Create app"

2. **Configure OAuth Settings**
   - Go to "Auth" tab
   - **Redirect URLs**: Add exactly this URL:
     ```
     https://reconable-lite-plus.temberlane195.workers.dev/oauth/linkedin/callback
     ```
   - **Scopes**: Ensure these are selected:
     - `r_liteprofile` (Sign In with LinkedIn using OpenID Connect)
     - `r_emailaddress` (Sign In with LinkedIn using OpenID Connect)

3. **Get App Credentials**
   - Copy the **Client ID** from the "Auth" tab
   - Copy the **Client Secret** from the "Auth" tab

### Step 3: Update Application Configuration

1. **Update wrangler.jsonc**
   ```jsonc
   "vars": {
     "LINKEDIN_CLIENT_ID": "your-actual-client-id-here",
     "LINKEDIN_REDIRECT_URI": "https://reconable-lite-plus.temberlane195.workers.dev/oauth/linkedin/callback"
   }
   ```

2. **Set Client Secret**
   ```bash
   wrangler secret put LINKEDIN_CLIENT_SECRET
   # Enter your client secret when prompted
   ```

3. **Deploy Updated Configuration**
   ```bash
   wrangler deploy
   ```

### Step 4: Test the Fix

1. **Use Debug Tool**
   - Go to: https://reconable-lite-plus.temberlane195.workers.dev/linkedin-debug.html
   - Click "Generate OAuth URL" to test
   - Click "Test OAuth Flow" to test the complete flow

2. **Test Main App**
   - Go to: https://reconable-lite-plus.temberlane195.workers.dev
   - Click "Connect LinkedIn"
   - Should redirect to LinkedIn (not show error)

## 🔧 Alternative: Use Different LinkedIn App

If the current app has issues, create a completely new one:

1. **Create New LinkedIn App**
   - Use a different name: `Reconable Lite+ v2`
   - Follow the same configuration steps above

2. **Update Configuration**
   - Update `LINKEDIN_CLIENT_ID` in wrangler.jsonc
   - Set new `LINKEDIN_CLIENT_SECRET`
   - Deploy changes

## 🧪 Debug Commands

Test the OAuth URL generation:
```bash
curl -I "https://reconable-lite-plus.temberlane195.workers.dev/oauth/linkedin/start?userId=test123"
```

Should return a 302 redirect to LinkedIn, not an error.

## 📋 Checklist

- [ ] LinkedIn app exists and is approved
- [ ] Redirect URI matches exactly (no trailing slash)
- [ ] Required scopes are enabled
- [ ] Client ID is correct in wrangler.jsonc
- [ ] Client Secret is set with `wrangler secret put`
- [ ] Application is deployed with updated config
- [ ] OAuth URL redirects to LinkedIn (not error page)

## 🆘 If Still Not Working

1. **Check LinkedIn App Status**
   - Ensure app is not suspended
   - Check for any policy violations
   - Verify app is in production mode (not development)

2. **Verify Redirect URI**
   - Must be exactly: `https://reconable-lite-plus.temberlane195.workers.dev/oauth/linkedin/callback`
   - No trailing slash
   - Must use HTTPS

3. **Check App Permissions**
   - Ensure you have admin access to the LinkedIn app
   - Check if app has been approved by LinkedIn

4. **Test with Different Browser**
   - Try incognito/private mode
   - Clear cookies and cache
   - Try different browser

## 🎯 Expected Behavior

When working correctly:
1. Click "Connect LinkedIn" → Redirects to LinkedIn
2. Authorize app on LinkedIn → Redirects back to your app
3. Shows success message with user info
4. Can then start analysis with LinkedIn data

---

**Need Help?** Use the debug tool at: https://reconable-lite-plus.temberlane195.workers.dev/linkedin-debug.html
