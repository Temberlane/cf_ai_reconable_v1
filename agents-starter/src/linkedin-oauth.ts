/**
 * LinkedIn OAuth 2.0 Service for 3-legged OAuth flow
 * Handles authorization, token exchange, and API calls with proper authentication
 */

export interface LinkedInOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

export interface LinkedInUserProfile {
  id: string;
  firstName: {
    localized: { [key: string]: string };
    preferredLocale: { country: string; language: string };
  };
  lastName: {
    localized: { [key: string]: string };
    preferredLocale: { country: string; language: string };
  };
  profilePicture?: {
    displayImage: string;
  };
  vanityName?: string;
}

export interface LinkedInProfileData {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  profilePicture?: string;
  vanityName?: string;
  profileUrl: string;
}

export class LinkedInOAuthService {
  private config: LinkedInOAuthConfig;
  private kv: KVNamespace;

  constructor(config: LinkedInOAuthConfig, kv: KVNamespace) {
    this.config = config;
    this.kv = kv;
  }

  /**
   * Generate the LinkedIn OAuth authorization URL
   */
  generateAuthUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      state,
      scope: this.config.scopes.join(' ')
    });

    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, state: string): Promise<LinkedInTokenResponse> {
    const tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';
    
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: body.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    const tokenData = await response.json() as LinkedInTokenResponse;
    
    // Store token securely in KV with expiration
    const expiresAt = Date.now() + (tokenData.expires_in * 1000);
    await this.kv.put(`linkedin_token_${state}`, JSON.stringify({
      ...tokenData,
      expires_at: expiresAt
    }), {
      expirationTtl: tokenData.expires_in
    });

    return tokenData;
  }

  /**
   * Get stored access token for a user
   */
  async getStoredToken(userId: string): Promise<LinkedInTokenResponse | null> {
    const tokenData = await this.kv.get(`linkedin_token_${userId}`, 'json');
    if (!tokenData) return null;

    // Check if token is expired
    if (Date.now() > tokenData.expires_at) {
      // Try to refresh if refresh token is available
      if (tokenData.refresh_token) {
        return await this.refreshToken(tokenData.refresh_token, userId);
      }
      return null;
    }

    return tokenData;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string, userId: string): Promise<LinkedInTokenResponse | null> {
    const tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';
    
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: body.toString()
    });

    if (!response.ok) {
      console.error('Token refresh failed:', response.status, await response.text());
      return null;
    }

    const tokenData = await response.json() as LinkedInTokenResponse;
    
    // Store new token
    const expiresAt = Date.now() + (tokenData.expires_in * 1000);
    await this.kv.put(`linkedin_token_${userId}`, JSON.stringify({
      ...tokenData,
      expires_at: expiresAt
    }), {
      expirationTtl: tokenData.expires_in
    });

    return tokenData;
  }

  /**
   * Make authenticated API call to LinkedIn
   */
  async makeAuthenticatedRequest(
    endpoint: string, 
    userId: string, 
    options: RequestInit = {}
  ): Promise<Response> {
    const token = await this.getStoredToken(userId);
    if (!token) {
      throw new Error('No valid LinkedIn token found. Please re-authenticate.');
    }

    const url = endpoint.startsWith('http') ? endpoint : `https://api.linkedin.com/v2${endpoint}`;
    
    return fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
        'Accept': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        ...options.headers
      }
    });
  }

  /**
   * Get user's LinkedIn profile
   */
  async getUserProfile(userId: string): Promise<LinkedInProfileData> {
    const response = await this.makeAuthenticatedRequest(
      '/people/~:(id,firstName,lastName,profilePicture(displayImage~:playableStreams),vanityName)',
      userId
    );

    if (!response.ok) {
      throw new Error(`Failed to get user profile: ${response.status} ${await response.text()}`);
    }

    const profile = await response.json() as LinkedInUserProfile;
    
    return {
      id: profile.id,
      firstName: profile.firstName.localized[Object.keys(profile.firstName.localized)[0]] || '',
      lastName: profile.lastName.localized[Object.keys(profile.lastName.localized)[0]] || '',
      fullName: `${profile.firstName.localized[Object.keys(profile.firstName.localized)[0]] || ''} ${profile.lastName.localized[Object.keys(profile.lastName.localized)[0]] || ''}`.trim(),
      profilePicture: profile.profilePicture?.displayImage,
      vanityName: profile.vanityName,
      profileUrl: profile.vanityName ? `https://www.linkedin.com/in/${profile.vanityName}` : `https://www.linkedin.com/in/${profile.id}`
    };
  }

  /**
   * Search for people on LinkedIn (requires specific permissions)
   */
  async searchPeople(userId: string, query: string, filters?: {
    location?: string;
    currentCompany?: string;
    industry?: string;
  }): Promise<any[]> {
    // Note: LinkedIn's people search API is limited and requires special permissions
    // This is a simplified implementation that would need to be adapted based on available permissions
    
    const searchParams = new URLSearchParams({
      q: 'people',
      keywords: query
    });

    if (filters?.location) {
      searchParams.append('location', filters.location);
    }
    if (filters?.currentCompany) {
      searchParams.append('currentCompany', filters.currentCompany);
    }

    const response = await this.makeAuthenticatedRequest(
      `/peopleSearch?${searchParams.toString()}`,
      userId
    );

    if (!response.ok) {
      throw new Error(`People search failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    return data.elements || [];
  }

  /**
   * Get company information
   */
  async getCompanyInfo(userId: string, companyId: string): Promise<any> {
    const response = await this.makeAuthenticatedRequest(
      `/companies/${companyId}:(id,name,industry,companySize,websiteUrl,description,logoUrl)`,
      userId
    );

    if (!response.ok) {
      throw new Error(`Company info failed: ${response.status} ${await response.text()}`);
    }

    return await response.json();
  }

  /**
   * Revoke access token
   */
  async revokeToken(userId: string): Promise<void> {
    const token = await this.getStoredToken(userId);
    if (!token) return;

    const revokeUrl = 'https://www.linkedin.com/oauth/v2/revoke';
    
    const body = new URLSearchParams({
      token: token.access_token,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret
    });

    await fetch(revokeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    // Remove token from storage
    await this.kv.delete(`linkedin_token_${userId}`);
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(userId: string): Promise<boolean> {
    const token = await this.getStoredToken(userId);
    return token !== null;
  }
}
