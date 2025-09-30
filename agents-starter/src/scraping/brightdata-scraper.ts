/**
 * Brightdata LinkedIn API Scraper for Reconable Lite+
 * Uses Brightdata's dedicated LinkedIn APIs for reliable data collection
 */

import type { LinkedInProfile, LinkedInEmail } from '../memory/schema';

export interface BrightdataConfig {
  apiToken: string;
  datasetId: string;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
}

export interface ScrapingResult {
  success: boolean;
  data?: any;
  error?: string;
  source: string;
  scrapedAt: string;
  snapshotId?: string;
}

export interface BrightdataResponse {
  snapshot_id: string;
  status?: string;
  error?: string;
}

export interface BrightdataSnapshot {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  data?: any;
  error?: string;
  created_at: string;
  completed_at?: string;
}

// LinkedIn Profiles API specific interfaces
export interface LinkedInProfileData {
  linkedin_id?: string;
  name?: string;
  country_code?: string;
  city?: string;
  position?: string;
  current_company?: string;
  current_company_name?: string;
  current_company_company_id?: string;
  about?: string;
  experience?: any[];
  education?: any[];
  educations_details?: any[];
  certifications?: any[];
  languages?: any[];
  recommendations_count?: number;
  recommendations?: any[];
  volunteer_experience?: any[];
  courses?: any[];
  publications?: any[];
  patents?: any[];
  projects?: any[];
  organizations?: any[];
  honors_and_awards?: any[];
  posts?: any[];
  activity?: any[];
  followers?: number;
  connections?: number;
  people_also_viewed?: any[];
  avatar?: string;
  banner_image?: string;
  url?: string;
  input_url?: string;
  linkedin_num_id?: string;
  id?: string;
  timestamp?: string;
}

export interface LinkedInSearchResult {
  query: string;
  results: LinkedInProfileData[];
  totalResults: number;
  scrapedAt: string;
}

export interface LinkedInCompanyData {
  id?: string;
  name?: string;
  about?: string;
  slogan?: string;
  description?: string;
  specialties?: string[];
  organization_type?: string;
  company_size?: string;
  industries?: string[];
  founded?: string;
  country_code?: string;
  country_codes_array?: string[];
  locations?: any[];
  formatted_locations?: any[];
  headquarters?: string;
  stock_info?: any;
  funding?: any;
  investors?: any[];
  crunchbase_url?: string;
  get_directions_url?: string;
  followers?: number;
  employees?: number;
  employees_in_linkedin?: number;
  alumni?: any[];
  alumni_information?: any[];
  affiliated?: any[];
  similar?: any[];
  logo?: string;
  image?: string;
  url?: string;
  updates?: any[];
  timestamp?: string;
}

export class BrightdataScraper {
  private config: BrightdataConfig;

  constructor(config: BrightdataConfig) {
    this.config = {
      baseUrl: 'https://api.brightdata.com',
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 2000,
      ...config
    };
  }

  /**
   * Scrape LinkedIn profile using Brightdata LinkedIn Profiles API
   */
  async scrapeProfile(profileUrl: string): Promise<ScrapingResult> {
    try {
      console.log(`[BRIGHTDATA] Scraping LinkedIn profile: ${profileUrl}`);

      // Use LinkedIn Profiles API - Collect by URL
      const response = await fetch(`${this.config.baseUrl}/datasets/v3/trigger?dataset_id=${this.config.datasetId}&include_errors=true`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{ url: profileUrl }])
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Brightdata LinkedIn API error: ${response.status} - ${errorText}`);
      }

      const triggerData: BrightdataResponse = await response.json();
      
      console.log('[BRIGHTDATA] Profile trigger response:', JSON.stringify(triggerData));
      
      if (triggerData.error) {
        throw new Error(`Brightdata LinkedIn API error: ${triggerData.error}`);
      }

      if (!triggerData.snapshot_id) {
        console.error('[BRIGHTDATA] No snapshot_id in profile response:', JSON.stringify(triggerData));
        throw new Error('No snapshot ID returned from Brightdata');
      }
      
      console.log('[BRIGHTDATA] Profile snapshot ID:', triggerData.snapshot_id);
      console.log('[BRIGHTDATA] Will check at:', `${this.config.baseUrl}/datasets/v3/snapshots/${triggerData.snapshot_id}`);

      // Wait for completion and get results
      const snapshotData = await this.waitForCompletion(triggerData.snapshot_id);
      
      if (!snapshotData.success) {
        return {
          success: false,
          error: `LinkedIn profile scraping failed: ${snapshotData.error}`,
          source: profileUrl,
          scrapedAt: new Date().toISOString()
        };
      }

      // Process the structured LinkedIn profile data
      const processedData = this.processLinkedInProfileData(snapshotData.data, profileUrl);

      return {
        success: true,
        data: processedData,
        source: profileUrl,
        scrapedAt: new Date().toISOString(),
        snapshotId: triggerData.snapshot_id
      };

    } catch (error) {
      console.error(`[BRIGHTDATA] Error scraping LinkedIn profile ${profileUrl}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: profileUrl,
        scrapedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Search for LinkedIn profiles using Brightdata LinkedIn Profiles API - Discover by Name
   */
  async searchProfiles(searchQuery: string, filters: {
    location?: string;
    company?: string;
    currentTitle?: string;
    industry?: string;
  } = {}): Promise<ScrapingResult> {
    try {
      console.log(`[BRIGHTDATA] Searching LinkedIn profiles for: ${searchQuery}`);

      // Parse search query to extract first and last name
      const nameParts = searchQuery.trim().split(' ');
      if (nameParts.length < 2) {
        throw new Error('Search query must contain at least first and last name');
      }

      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');

      // Use LinkedIn Profiles API - Discover by Name
      const response = await fetch(`${this.config.baseUrl}/datasets/v3/trigger?dataset_id=${this.config.datasetId}&include_errors=true`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{ 
          first_name: firstName, 
          last_name: lastName 
        }])
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Brightdata LinkedIn API error: ${response.status} - ${errorText}`);
      }

      const triggerData: BrightdataResponse = await response.json();
      
      if (triggerData.error) {
        throw new Error(`Brightdata LinkedIn API error: ${triggerData.error}`);
      }

      if (!triggerData.snapshot_id) {
        throw new Error('No snapshot ID returned from Brightdata');
      }

      // Wait for completion and get results
      const snapshotData = await this.waitForCompletion(triggerData.snapshot_id);
      
      if (!snapshotData.success) {
        return {
          success: false,
          error: `LinkedIn profile search failed: ${snapshotData.error}`,
          source: 'linkedin-search',
          scrapedAt: new Date().toISOString()
        };
      }

      // Process search results
      const processedData = this.processLinkedInSearchResults(snapshotData.data, searchQuery);

      return {
        success: true,
        data: processedData,
        source: 'linkedin-search',
        scrapedAt: new Date().toISOString(),
        snapshotId: triggerData.snapshot_id
      };

    } catch (error) {
      console.error(`[BRIGHTDATA] Error searching LinkedIn profiles:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'linkedin-search',
        scrapedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Scrape company information using Brightdata LinkedIn Companies API
   */
  async scrapeCompany(companyUrl: string): Promise<ScrapingResult> {
    try {
      console.log(`[BRIGHTDATA] Scraping LinkedIn company: ${companyUrl}`);

      // Use LinkedIn Companies API - Collect by URL
      // Note: This would need a different dataset ID for companies API
      // For now, we'll use the same dataset but with company URL
      const response = await fetch(`${this.config.baseUrl}/datasets/v3/trigger?dataset_id=${this.config.datasetId}&include_errors=true`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{ url: companyUrl }])
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Brightdata LinkedIn API error: ${response.status} - ${errorText}`);
      }

      const triggerData: BrightdataResponse = await response.json();
      
      if (triggerData.error) {
        throw new Error(`Brightdata LinkedIn API error: ${triggerData.error}`);
      }

      if (!triggerData.snapshot_id) {
        throw new Error('No snapshot ID returned from Brightdata');
      }

      // Wait for completion and get results
      const snapshotData = await this.waitForCompletion(triggerData.snapshot_id);
      
      if (!snapshotData.success) {
        return {
          success: false,
          error: `LinkedIn company scraping failed: ${snapshotData.error}`,
          source: companyUrl,
          scrapedAt: new Date().toISOString()
        };
      }

      // Process company data
      const processedData = this.processLinkedInCompanyData(snapshotData.data, companyUrl);

      return {
        success: true,
        data: processedData,
        source: companyUrl,
        scrapedAt: new Date().toISOString(),
        snapshotId: triggerData.snapshot_id
      };

    } catch (error) {
      console.error(`[BRIGHTDATA] Error scraping LinkedIn company ${companyUrl}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: companyUrl,
        scrapedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Scrape general web content using Brightdata
   */
  async scrapeWebContent(url: string): Promise<ScrapingResult> {
    try {
      console.log(`[BRIGHTDATA] Scraping web content: ${url}`);

      // Trigger scraping job
      const triggerResponse = await this.triggerScraping([url]);
      
      if (!triggerResponse.success || !triggerResponse.snapshotId) {
        return {
          success: false,
          error: `Failed to trigger web scraping: ${triggerResponse.error}`,
          source: url,
          scrapedAt: new Date().toISOString()
        };
      }

      // Wait for completion and get results
      const snapshotData = await this.waitForCompletion(triggerResponse.snapshotId);
      
      if (!snapshotData.success) {
        return {
          success: false,
          error: `Web scraping failed: ${snapshotData.error}`,
          source: url,
          scrapedAt: new Date().toISOString()
        };
      }

      // Process web content
      const processedData = this.processWebContent(snapshotData.data, url);

      return {
        success: true,
        data: processedData,
        source: url,
        scrapedAt: new Date().toISOString(),
        snapshotId: triggerResponse.snapshotId
      };

    } catch (error) {
      console.error(`[BRIGHTDATA] Error scraping web content ${url}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: url,
        scrapedAt: new Date().toISOString()
      };
    }
  }


  /**
   * Wait for scraping completion and get results
   */
  private async waitForCompletion(snapshotId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    const maxWaitTime = 900000; // 15 minutes (900 seconds)
    const initialCheckDelay = 15000; // Wait 15 seconds before first check
    const checkInterval = 30000; // 30 seconds between subsequent checks
    const startTime = Date.now();
    
    console.log(`[BRIGHTDATA] Starting to poll snapshot ${snapshotId}`);
    console.log(`[BRIGHTDATA] Will wait ${initialCheckDelay/1000}s before first check, then check every ${checkInterval/1000}s for up to ${maxWaitTime/1000}s`);
    
    // Wait before first check (Brightdata typically needs 15-30 seconds)
    console.log(`[BRIGHTDATA] Waiting ${initialCheckDelay/1000}s before first check...`);
    await new Promise(resolve => setTimeout(resolve, initialCheckDelay));

    let attemptCount = 0;
    while (Date.now() - startTime < maxWaitTime) {
      try {
        attemptCount++;
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        const checkUrl = `${this.config.baseUrl}/datasets/v3/snapshot/${snapshotId}`;
        console.log(`[BRIGHTDATA] Checking snapshot status (attempt ${attemptCount}, elapsed: ${elapsedSeconds}s) at:`, checkUrl);
        
        const response = await fetch(checkUrl, {
          headers: {
            'Authorization': `Bearer ${this.config.apiToken}`
          }
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error('[BRIGHTDATA] Snapshot check failed:', response.status, errorBody);
          throw new Error(`Failed to check snapshot status: ${response.status}`);
        }

        const snapshot: any = await response.json();

        console.log('[BRIGHTDATA] Raw snapshot response keys:', Object.keys(snapshot));
        console.log('[BRIGHTDATA] Raw snapshot response (first 500 chars):', JSON.stringify(snapshot).substring(0, 500));
        
        // Check if response has a status field
        if (snapshot.status) {
          console.log('[BRIGHTDATA] Snapshot status:', snapshot.status, 'for snapshot ID:', snapshotId);
          
          if (snapshot.status === 'completed') {
            console.log('[BRIGHTDATA] Scraping completed successfully');
            console.log('[BRIGHTDATA] Snapshot data structure:', JSON.stringify({
              hasData: !!snapshot.data,
              dataType: typeof snapshot.data,
              isArray: Array.isArray(snapshot.data),
              dataLength: Array.isArray(snapshot.data) ? snapshot.data.length : 'N/A',
              dataKeys: snapshot.data && typeof snapshot.data === 'object' ? Object.keys(snapshot.data).slice(0, 10) : []
            }));
            
            return {
              success: true,
              data: snapshot.data
            };
          } else if (snapshot.status === 'failed') {
            console.error('[BRIGHTDATA] Scraping failed:', snapshot.error);
            return {
              success: false,
              error: snapshot.error || 'Scraping failed'
            };
          } else if (snapshot.status === 'running' || snapshot.status === 'pending') {
            console.log('[BRIGHTDATA] Still processing, status:', snapshot.status);
          } else {
            console.warn('[BRIGHTDATA] Unknown status:', snapshot.status);
          }
        } else {
          // Response might be the data directly (no status wrapper)
          console.log('[BRIGHTDATA] No status field, assuming data is ready');
          console.log('[BRIGHTDATA] Direct data response type:', typeof snapshot);
          console.log('[BRIGHTDATA] Direct data is array:', Array.isArray(snapshot));
          
          // If the response is an array or has data fields, treat it as completed data
          if (Array.isArray(snapshot) || (typeof snapshot === 'object' && Object.keys(snapshot).length > 0)) {
            console.log('[BRIGHTDATA] Treating response as completed data');
            return {
              success: true,
              data: snapshot
            };
          }
        }

        // Still processing, wait and try again
        console.log(`[BRIGHTDATA] Waiting ${checkInterval/1000}s before next check...`);
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        console.log(`[BRIGHTDATA] Wait completed, will check again`);

      } catch (error) {
        console.error('[BRIGHTDATA] Error checking snapshot status:', error);
        console.log(`[BRIGHTDATA] Waiting ${checkInterval/1000}s before retry after error...`);
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
    }

    console.error(`[BRIGHTDATA] Timeout after ${maxWaitTime/1000}s waiting for snapshot ${snapshotId}`);
    return {
      success: false,
      error: 'Timeout waiting for scraping completion'
    };
  }

  /**
   * Process LinkedIn profile data from Brightdata LinkedIn Profiles API
   */
  private processLinkedInProfileData(data: any, profileUrl: string): LinkedInProfileData {
    // Brightdata returns structured JSON data, not HTML
    // The data should already be in the correct format from the API
    
    console.log('[BRIGHTDATA] Processing profile data structure:', JSON.stringify({ 
      isArray: Array.isArray(data), 
      dataType: typeof data,
      dataKeys: data ? Object.keys(data).slice(0, 10) : [],
      hasData: !!data,
      arrayLength: Array.isArray(data) ? data.length : 'N/A'
    }));

    let profileData: any = null;

    // Handle different response formats from Brightdata
    if (Array.isArray(data) && data.length > 0) {
      profileData = data[0];
      console.log('[BRIGHTDATA] Using first item from array');
    } else if (data && typeof data === 'object' && !Array.isArray(data)) {
      // Data might be a single object, not wrapped in an array
      profileData = data;
      console.log('[BRIGHTDATA] Using data as single object');
    }

    if (profileData) {
      console.log('[BRIGHTDATA] Profile data fields found:', Object.keys(profileData).slice(0, 20));
      
      return {
        linkedin_id: profileData.linkedin_id,
        name: profileData.name,
        country_code: profileData.country_code,
        city: profileData.city,
        position: profileData.position,
        current_company: profileData.current_company,
        current_company_name: profileData.current_company_name,
        current_company_company_id: profileData.current_company_company_id,
        about: profileData.about,
        experience: profileData.experience || [],
        education: profileData.education || [],
        educations_details: profileData.educations_details || [],
        certifications: profileData.certifications || [],
        languages: profileData.languages || [],
        recommendations_count: profileData.recommendations_count,
        recommendations: profileData.recommendations || [],
        volunteer_experience: profileData.volunteer_experience || [],
        courses: profileData.courses || [],
        publications: profileData.publications || [],
        patents: profileData.patents || [],
        projects: profileData.projects || [],
        organizations: profileData.organizations || [],
        honors_and_awards: profileData.honors_and_awards || [],
        posts: profileData.posts || [],
        activity: profileData.activity || [],
        followers: profileData.followers,
        connections: profileData.connections,
        people_also_viewed: profileData.people_also_viewed || [],
        avatar: profileData.avatar,
        banner_image: profileData.banner_image,
        url: profileData.url || profileUrl,
        input_url: profileData.input_url || profileUrl,
        linkedin_num_id: profileData.linkedin_num_id,
        id: profileData.id,
        timestamp: profileData.timestamp || new Date().toISOString()
      };
    }

    // Fallback if data structure is unexpected
    console.warn('[BRIGHTDATA] Could not extract profile data, using fallback');
    return {
      name: 'Unknown',
      url: profileUrl,
      input_url: profileUrl,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Process LinkedIn search results from Brightdata LinkedIn Profiles API
   */
  private processLinkedInSearchResults(data: any, searchQuery: string): LinkedInSearchResult {
    // Brightdata returns structured JSON data for search results
    const results: LinkedInProfileData[] = [];
    
    if (Array.isArray(data)) {
      for (const item of data) {
        results.push({
          linkedin_id: item.linkedin_id,
          name: item.name,
          country_code: item.country_code,
          city: item.city,
          position: item.position,
          current_company: item.current_company,
          current_company_name: item.current_company_name,
          current_company_company_id: item.current_company_company_id,
          about: item.about,
          experience: item.experience || [],
          education: item.education || [],
          educations_details: item.educations_details || [],
          certifications: item.certifications || [],
          languages: item.languages || [],
          recommendations_count: item.recommendations_count,
          recommendations: item.recommendations || [],
          volunteer_experience: item.volunteer_experience || [],
          courses: item.courses || [],
          publications: item.publications || [],
          patents: item.patents || [],
          projects: item.projects || [],
          organizations: item.organizations || [],
          honors_and_awards: item.honors_and_awards || [],
          posts: item.posts || [],
          activity: item.activity || [],
          followers: item.followers,
          connections: item.connections,
          people_also_viewed: item.people_also_viewed || [],
          avatar: item.avatar,
          banner_image: item.banner_image,
          url: item.url,
          input_url: item.input_url,
          linkedin_num_id: item.linkedin_num_id,
          id: item.id,
          timestamp: item.timestamp || new Date().toISOString()
        });
      }
    }
    
    return {
      query: searchQuery,
      results: results,
      totalResults: results.length,
      scrapedAt: new Date().toISOString()
    };
  }

  /**
   * Process LinkedIn company data from Brightdata LinkedIn Companies API
   */
  private processLinkedInCompanyData(data: any, companyUrl: string): LinkedInCompanyData {
    // Brightdata returns structured JSON data for companies
    if (Array.isArray(data) && data.length > 0) {
      const companyData = data[0];
      return {
        id: companyData.id,
        name: companyData.name,
        about: companyData.about,
        slogan: companyData.slogan,
        description: companyData.description,
        specialties: companyData.specialties || [],
        organization_type: companyData.organization_type,
        company_size: companyData.company_size,
        industries: companyData.industries || [],
        founded: companyData.founded,
        country_code: companyData.country_code,
        country_codes_array: companyData.country_codes_array || [],
        locations: companyData.locations || [],
        formatted_locations: companyData.formatted_locations || [],
        headquarters: companyData.headquarters,
        stock_info: companyData.stock_info,
        funding: companyData.funding,
        investors: companyData.investors || [],
        crunchbase_url: companyData.crunchbase_url,
        get_directions_url: companyData.get_directions_url,
        followers: companyData.followers,
        employees: companyData.employees,
        employees_in_linkedin: companyData.employees_in_linkedin,
        alumni: companyData.alumni || [],
        alumni_information: companyData.alumni_information || [],
        affiliated: companyData.affiliated || [],
        similar: companyData.similar || [],
        logo: companyData.logo,
        image: companyData.image,
        url: companyData.url || companyUrl,
        updates: companyData.updates || [],
        timestamp: companyData.timestamp || new Date().toISOString()
      };
    }

    // Fallback if data structure is unexpected
    return {
      name: 'Unknown Company',
      url: companyUrl,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Process general web content (fallback for non-LinkedIn URLs)
   */
  private processWebContent(data: any, url: string): any {
    // For general web content, we'll return the raw data
    // This is a fallback method for non-LinkedIn URLs
    return {
      url: url,
      content: JSON.stringify(data),
      scrapedAt: new Date().toISOString(),
      source: 'brightdata'
    };
  }
}
