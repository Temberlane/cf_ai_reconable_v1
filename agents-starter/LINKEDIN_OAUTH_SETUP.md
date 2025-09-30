# LinkedIn OAuth Integration Setup

This document explains how to set up and use the LinkedIn OAuth integration for authenticated access to LinkedIn data in your Cloudflare Workers Agents application.

## Overview

The implementation provides a complete 3-legged OAuth flow for LinkedIn authentication, allowing your AI agents to access LinkedIn data through the official LinkedIn API instead of web scraping. This approach is more reliable, compliant, and provides better data quality.

## Features

- **3-legged OAuth flow** with LinkedIn
- **Secure token storage** using Cloudflare Workers KV
- **Automatic token refresh** when tokens expire
- **Authenticated API calls** to LinkedIn's official API
- **User profile access** and search capabilities
- **Token revocation** for security
- **Integration with AI agents** for automated LinkedIn research

## Setup Instructions

### 1. Create LinkedIn App

1. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/)
2. Click "Create App"
3. Fill in the required information:
   - App name: Your app name
   - LinkedIn Page: Select your LinkedIn page
   - Privacy Policy URL: Your privacy policy URL
   - App logo: Upload your app logo
4. After creating the app, go to the "Auth" tab
5. Add redirect URLs:
   - For development: `http://localhost:8787/auth/linkedin/callback`
   - For production: `https://your-domain.com/auth/linkedin/callback`
6. Note down your **Client ID** and **Client Secret**

### 2. Configure Environment Variables

Update your `wrangler.jsonc` file with your LinkedIn app credentials:

```jsonc
{
  "vars": {
    "LINKEDIN_CLIENT_ID": "your-linkedin-client-id",
    "LINKEDIN_REDIRECT_URI": "https://your-domain.com/auth/linkedin/callback"
  }
}
```

### 3. Create KV Namespace

Create a KV namespace for storing OAuth tokens:

```bash
# Create KV namespace
wrangler kv:namespace create "LINKEDIN_TOKENS"

# Create preview namespace
wrangler kv:namespace create "LINKEDIN_TOKENS" --preview
```

Update your `wrangler.jsonc` with the actual namespace IDs:

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "LINKEDIN_TOKENS",
      "id": "your-actual-kv-namespace-id",
      "preview_id": "your-actual-preview-kv-namespace-id"
    }
  ]
}
```

### 4. Set Secrets

Set your LinkedIn client secret as a secret:

```bash
# Set the secret
wrangler secret put LINKEDIN_CLIENT_SECRET
# Enter your LinkedIn client secret when prompted
```

### 5. Deploy

Deploy your application:

```bash
wrangler deploy
```

## API Endpoints

### Authentication Flow

#### 1. Initiate Authentication
```
GET /auth/linkedin?userId=user123
```
Redirects user to LinkedIn OAuth authorization page.

#### 2. OAuth Callback
```
GET /auth/linkedin/callback?code=...&state=...
```
Handles the OAuth callback and exchanges code for access token.

#### 3. Check Authentication Status
```
GET /auth/linkedin/status?userId=user123
```
Returns authentication status and user profile if authenticated.

#### 4. Revoke Access
```
POST /auth/linkedin/revoke?userId=user123
```
Revokes LinkedIn access and removes stored tokens.

## AI Agent Tools

The implementation provides several tools for AI agents to interact with LinkedIn:

### 1. checkLinkedInAuth
Checks if a user is authenticated with LinkedIn.

**Parameters:**
- `userId`: User ID to check authentication for

**Returns:**
- Authentication status
- User profile (if authenticated)
- Auth URL (if not authenticated)

### 2. searchLinkedInProfile
Searches for LinkedIn profiles using the authenticated API.

**Parameters:**
- `userId`: User ID for authentication
- `name`: Name to search for
- `location`: Optional location filter
- `company`: Optional company filter

**Returns:**
- Search results with profile information
- Error if not authenticated

### 3. analyzeLinkedInProfile
Performs detailed analysis of a specific LinkedIn profile.

**Parameters:**
- `profileUrl`: LinkedIn profile URL to analyze
- `includeConnections`: Whether to analyze connections
- `includePosts`: Whether to analyze recent posts

### 4. researchLinkedInCompany
Researches a company's LinkedIn page.

**Parameters:**
- `companyName`: Name of the company to research
- `includeEmployees`: Whether to analyze employees
- `includeRecentPosts`: Whether to analyze recent posts

### 5. analyzeLinkedInNetwork
Analyzes the network and connections of a LinkedIn profile.

**Parameters:**
- `profileUrl`: LinkedIn profile URL to analyze
- `maxConnections`: Maximum number of connections to analyze
- `includeMutualConnections`: Whether to find mutual connections

## Usage Examples

### 1. Check Authentication Status

```javascript
// In your AI agent
const authResult = await checkLinkedInAuth({ userId: "user123" });

if (authResult.authenticated) {
  console.log("User is authenticated:", authResult.user);
} else {
  console.log("User needs to authenticate:", authResult.authUrl);
}
```

### 2. Search for LinkedIn Profiles

```javascript
// In your AI agent
const searchResult = await searchLinkedInProfile({
  userId: "user123",
  name: "John Smith",
  location: "San Francisco",
  company: "Google"
});

console.log("Found profiles:", searchResult.results);
```

### 3. Analyze a Profile

```javascript
// In your AI agent
const analysisResult = await analyzeLinkedInProfile({
  profileUrl: "https://www.linkedin.com/in/johnsmith",
  includeConnections: true,
  includePosts: false
});

console.log("Profile analysis:", analysisResult.profile);
```

## Demo Page

A demo page is available at `/linkedin-auth.html` that demonstrates:

- Authentication flow
- Status checking
- Profile searching
- Token revocation

## Security Considerations

1. **Token Storage**: Access tokens are stored securely in Cloudflare Workers KV with automatic expiration
2. **State Parameter**: OAuth state parameter is used to prevent CSRF attacks
3. **Token Refresh**: Automatic token refresh when tokens expire
4. **Token Revocation**: Users can revoke access at any time
5. **HTTPS Only**: All OAuth flows require HTTPS in production

## LinkedIn API Permissions

The implementation requests the following LinkedIn API permissions:

- `r_liteprofile`: Read basic profile information
- `r_emailaddress`: Read email address
- `w_member_social`: Write social actions (for future features)

## Troubleshooting

### Common Issues

1. **"LinkedIn OAuth not configured"**
   - Ensure `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` are set
   - Check that the KV namespace is properly configured

2. **"Invalid redirect URI"**
   - Ensure the redirect URI in your LinkedIn app matches the one in your configuration
   - Check that the URL is exactly the same (including trailing slashes)

3. **"Token exchange failed"**
   - Verify your client secret is correct
   - Check that the authorization code hasn't expired
   - Ensure the redirect URI matches exactly

4. **"No valid LinkedIn token found"**
   - User needs to re-authenticate
   - Token may have expired and refresh failed
   - User may have revoked access

### Debug Mode

Enable debug logging by checking the browser console and Cloudflare Workers logs for detailed error messages.

## Rate Limits

LinkedIn API has rate limits:
- **Profile API**: 500 requests per day per user
- **Search API**: 100 requests per day per user
- **Company API**: 500 requests per day per user

The implementation handles rate limiting gracefully and provides appropriate error messages.

## Future Enhancements

- [ ] Support for additional LinkedIn API endpoints
- [ ] Batch operations for multiple profiles
- [ ] Caching layer for frequently accessed data
- [ ] Webhook support for real-time updates
- [ ] Advanced search filters and sorting
- [ ] Export functionality for research data

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review LinkedIn API documentation
3. Check Cloudflare Workers logs
4. Open an issue in the repository
