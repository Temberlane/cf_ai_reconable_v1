/**
 * Example usage of LinkedIn OAuth integration
 * This demonstrates how to use the LinkedIn OAuth service in your application
 */

import { LinkedInOAuthService } from '../linkedin-oauth';

interface Env {
  LINKEDIN_TOKENS: KVNamespace;
  LINKEDIN_CLIENT_ID: string;
  LINKEDIN_CLIENT_SECRET: string;
  REQUEST_URL?: string;
}

/**
 * Example: Complete OAuth flow for a user
 */
export async function exampleOAuthFlow(env: Env, userId: string) {
  const oauthService = new LinkedInOAuthService({
    clientId: env.LINKEDIN_CLIENT_ID,
    clientSecret: env.LINKEDIN_CLIENT_SECRET,
    redirectUri: `${new URL(env.REQUEST_URL || 'https://your-domain.com').origin}/auth/linkedin/callback`,
    scopes: ['r_liteprofile', 'r_emailaddress', 'w_member_social']
  }, env.LINKEDIN_TOKENS);

  // 1. Check if user is already authenticated
  const isAuthenticated = await oauthService.isAuthenticated(userId);
  
  if (!isAuthenticated) {
    // 2. Generate auth URL for user to authenticate
    const authUrl = oauthService.generateAuthUrl(crypto.randomUUID());
    console.log('User needs to authenticate:', authUrl);
    return { needsAuth: true, authUrl };
  }

  // 3. User is authenticated, get their profile
  const userProfile = await oauthService.getUserProfile(userId);
  console.log('Authenticated user:', userProfile);

  // 4. Search for people
  const searchResults = await oauthService.searchPeople(userId, 'John Smith', {
    location: 'San Francisco',
    currentCompany: 'Google'
  });
  console.log('Search results:', searchResults);

  return { 
    authenticated: true, 
    user: userProfile, 
    searchResults 
  };
}

/**
 * Example: Handle OAuth callback
 */
export async function exampleOAuthCallback(env: Env, code: string, state: string) {
  const oauthService = new LinkedInOAuthService({
    clientId: env.LINKEDIN_CLIENT_ID,
    clientSecret: env.LINKEDIN_CLIENT_SECRET,
    redirectUri: `${new URL(env.REQUEST_URL || 'https://your-domain.com').origin}/auth/linkedin/callback`,
    scopes: ['r_liteprofile', 'r_emailaddress', 'w_member_social']
  }, env.LINKEDIN_TOKENS);

  try {
    // Exchange code for token
    const tokenData = await oauthService.exchangeCodeForToken(code, state);
    console.log('Token received:', tokenData);

    // Get user profile
    const userProfile = await oauthService.getUserProfile(state);
    console.log('User profile:', userProfile);

    return {
      success: true,
      user: userProfile,
      expiresIn: tokenData.expires_in
    };
  } catch (error) {
    console.error('OAuth callback error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Example: Search for LinkedIn profiles
 */
export async function exampleSearchProfiles(env: Env, userId: string, searchQuery: string) {
  const oauthService = new LinkedInOAuthService({
    clientId: env.LINKEDIN_CLIENT_ID,
    clientSecret: env.LINKEDIN_CLIENT_SECRET,
    redirectUri: `${new URL(env.REQUEST_URL || 'https://your-domain.com').origin}/auth/linkedin/callback`,
    scopes: ['r_liteprofile', 'r_emailaddress', 'w_member_social']
  }, env.LINKEDIN_TOKENS);

  // Check authentication first
  const isAuthenticated = await oauthService.isAuthenticated(userId);
  if (!isAuthenticated) {
    throw new Error('User not authenticated');
  }

  // Search for people
  const results = await oauthService.searchPeople(userId, searchQuery);
  
  return results.map((person: any) => ({
    name: `${person.firstName} ${person.lastName}`,
    headline: person.headline,
    location: person.locationName,
    profileUrl: person.publicProfileUrl,
    profileImage: person.profilePicture?.displayImage
  }));
}

/**
 * Example: Get company information
 */
export async function exampleGetCompanyInfo(env: Env, userId: string, companyId: string) {
  const oauthService = new LinkedInOAuthService({
    clientId: env.LINKEDIN_CLIENT_ID,
    clientSecret: env.LINKEDIN_CLIENT_SECRET,
    redirectUri: `${new URL(env.REQUEST_URL || 'https://your-domain.com').origin}/auth/linkedin/callback`,
    scopes: ['r_liteprofile', 'r_emailaddress', 'w_member_social']
  }, env.LINKEDIN_TOKENS);

  // Check authentication first
  const isAuthenticated = await oauthService.isAuthenticated(userId);
  if (!isAuthenticated) {
    throw new Error('User not authenticated');
  }

  // Get company information
  const companyInfo = await oauthService.getCompanyInfo(userId, companyId);
  
  return {
    name: companyInfo.name,
    industry: companyInfo.industry,
    size: companyInfo.companySize,
    website: companyInfo.websiteUrl,
    description: companyInfo.description,
    logo: companyInfo.logoUrl
  };
}

/**
 * Example: Revoke user access
 */
export async function exampleRevokeAccess(env: Env, userId: string) {
  const oauthService = new LinkedInOAuthService({
    clientId: env.LINKEDIN_CLIENT_ID,
    clientSecret: env.LINKEDIN_CLIENT_SECRET,
    redirectUri: `${new URL(env.REQUEST_URL || 'https://your-domain.com').origin}/auth/linkedin/callback`,
    scopes: ['r_liteprofile', 'r_emailaddress', 'w_member_social']
  }, env.LINKEDIN_TOKENS);

  try {
    await oauthService.revokeToken(userId);
    console.log('Access revoked for user:', userId);
    return { success: true };
  } catch (error) {
    console.error('Error revoking access:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
