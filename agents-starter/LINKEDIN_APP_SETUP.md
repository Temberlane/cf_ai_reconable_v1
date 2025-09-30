# LinkedIn App Configuration Guide

This guide walks you through setting up a LinkedIn application for Reconable Lite+ OAuth integration.

## 🔗 Step 1: Create LinkedIn App

1. **Visit LinkedIn Developer Portal**
   - Go to [https://www.linkedin.com/developers/](https://www.linkedin.com/developers/)
   - Sign in with your LinkedIn account

2. **Create New App**
   - Click "Create App" button
   - Fill in the required information:
     - **App name**: `Reconable Lite+` (or your preferred name)
     - **LinkedIn Page**: Select your company page or create a new one
     - **Privacy Policy URL**: `https://your-domain.com/privacy` (required)
     - **App logo**: Upload a logo (optional but recommended)
     - **Legal agreement**: Check the terms and conditions

3. **Submit for Review**
   - Click "Create app" to submit your application
   - LinkedIn will review and approve your app (usually within a few minutes)

## ⚙️ Step 2: Configure OAuth Settings

1. **Navigate to Auth Tab**
   - In your app dashboard, click on the "Auth" tab
   - This is where you'll configure OAuth settings

2. **Add Redirect URLs**
   - Click "Add redirect URL"
   - Add your production URL: `https://reconable-lite-plus.temberlane195.workers.dev/oauth/linkedin/callback`
   - Add your development URL: `http://localhost:8787/oauth/linkedin/callback` (for local testing)
   - Click "Update" to save

3. **Configure Scopes**
   - In the "Products" section, ensure you have access to:
     - **Sign In with LinkedIn using OpenID Connect** (for basic profile)
     - **Share on LinkedIn** (optional, for future features)
   - Request access to these products if not already available

4. **Note Your Credentials**
   - Copy your **Client ID** (you'll need this for `LINKEDIN_CLIENT_ID`)
   - Copy your **Client Secret** (you'll need this for `LINKEDIN_CLIENT_SECRET`)

## 🔐 Step 3: Configure Scopes and Permissions

### Required Scopes

Reconable Lite+ requires the following LinkedIn API scopes:

- **`r_liteprofile`**: Access to basic profile information
  - First name, last name
  - Profile picture
  - Headline
  - Industry
  - Location

- **`r_emailaddress`**: Access to email address
  - Primary email address
  - Email verification status

### Optional Scopes (for future features)

- **`w_member_social`**: Share content on behalf of the user
- **`r_organization_social`**: Access to organization information
- **`rw_organization_admin`**: Manage organization content

## 🌐 Step 4: Update Your Application

1. **Update wrangler.jsonc**
   ```jsonc
   {
     "vars": {
       "LINKEDIN_CLIENT_ID": "your-actual-client-id",
       "LINKEDIN_REDIRECT_URI": "https://reconable-lite-plus.temberlane195.workers.dev/oauth/linkedin/callback"
     }
   }
   ```

2. **Set Client Secret**
   ```bash
   wrangler secret put LINKEDIN_CLIENT_SECRET
   # Enter your client secret when prompted
   ```

3. **Deploy Your Application**
   ```bash
   wrangler deploy
   ```

## 🧪 Step 5: Test OAuth Flow

1. **Test Authorization URL**
   ```bash
   curl "https://reconable-lite-plus.temberlane195.workers.dev/oauth/linkedin/start?userId=test123"
   ```
   - This should redirect you to LinkedIn's authorization page

2. **Test Callback**
   - Complete the OAuth flow in your browser
   - You should be redirected back to your app with success confirmation

3. **Test API Endpoints**
   ```bash
   # Check user session
   curl "https://reconable-lite-plus.temberlane195.workers.dev/api/me?userId=test123"
   
   # Start analysis
   curl -X POST "https://reconable-lite-plus.temberlane195.workers.dev/api/run" \
     -H "Content-Type: application/json" \
     -d '{"subject": "Test Subject", "userId": "test123"}'
   ```

## 🔒 Step 6: Security Considerations

### App Security

1. **Keep Credentials Secure**
   - Never commit Client Secret to version control
   - Use environment variables or Wrangler secrets
   - Rotate credentials regularly

2. **Validate Redirect URLs**
   - Only use HTTPS in production
   - Validate state parameters to prevent CSRF attacks
   - Implement proper error handling

3. **Rate Limiting**
   - LinkedIn has API rate limits
   - Implement exponential backoff for retries
   - Monitor usage in LinkedIn Developer Portal

### Data Privacy

1. **Minimal Data Collection**
   - Only request necessary scopes
   - Clearly communicate data usage to users
   - Implement data retention policies

2. **User Consent**
   - Always obtain explicit consent
   - Provide clear opt-out mechanisms
   - Respect user privacy preferences

## 📊 Step 7: Monitor Usage

1. **LinkedIn Developer Portal**
   - Monitor API usage and limits
   - Check for any policy violations
   - Review user feedback and reports

2. **Application Logs**
   - Monitor OAuth success/failure rates
   - Track API response times
   - Log security events

3. **User Analytics**
   - Track consent rates
   - Monitor feature usage
   - Analyze user engagement

## 🚨 Troubleshooting

### Common Issues

1. **"Invalid redirect_uri"**
   - Ensure redirect URI exactly matches what's configured in LinkedIn app
   - Check for trailing slashes or protocol mismatches

2. **"Invalid client_id"**
   - Verify Client ID is correct in wrangler.jsonc
   - Ensure app is approved and active

3. **"Invalid client_secret"**
   - Verify Client Secret is set correctly with `wrangler secret put`
   - Check for typos or extra spaces

4. **"Insufficient scope"**
   - Ensure required scopes are requested
   - Check if user has granted necessary permissions

### Debug Steps

1. **Check Wrangler Secrets**
   ```bash
   wrangler secret list
   ```

2. **Verify Configuration**
   ```bash
   wrangler whoami
   wrangler d1 list
   wrangler vectorize list
   ```

3. **Test OAuth Manually**
   - Use browser developer tools to inspect redirects
   - Check network tab for API responses
   - Verify state parameter handling

## 📚 Additional Resources

- [LinkedIn API Documentation](https://docs.microsoft.com/en-us/linkedin/)
- [OAuth 2.0 Specification](https://tools.ietf.org/html/rfc6749)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review LinkedIn Developer Portal for app status
3. Check Cloudflare Workers logs: `wrangler tail`
4. Open an issue in the project repository

---

**Note**: This configuration is specific to Reconable Lite+. Adjust URLs and settings according to your deployment environment.
