/**
 * Harvester Agent for Reconable Lite+
 * Collects evidence from various sources using web scraping
 */

import { Agent } from 'agents';
import { tool } from 'ai';
import { z } from 'zod/v3';
import type { Evidence } from '../memory/schema';
import { BrightdataScraper } from '../scraping/brightdata-scraper';
import { ComplianceAgent } from './compliance';

interface Env {
  AI: Fetcher;
  BRIGHTDATA_API_TOKEN: string;
  BRIGHTDATA_DATASET_ID: string;
}

export class HarvesterAgent extends Agent<Env> {
  private complianceAgent: ComplianceAgent;
  private brightdataScraper: BrightdataScraper;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.complianceAgent = new ComplianceAgent(ctx, env);
        this.brightdataScraper = new BrightdataScraper({
          apiToken: env.BRIGHTDATA_API_TOKEN,
          datasetId: env.BRIGHTDATA_DATASET_ID,
          baseUrl: 'https://api.brightdata.com',
          timeout: 30000,
          maxRetries: 3,
          retryDelay: 2000
        });
  }

  /**
   * Fetch web content using Browser Rendering
   */
  private async fetchWebContent(url: string): Promise<string> {
    try {
      const scrapingResult = await this.brightdataScraper.scrapeWebContent(url);
      
      if (!scrapingResult.success) {
        throw new Error(`Web scraping failed: ${scrapingResult.error}`);
      }

      return scrapingResult.data?.content || '';

    } catch (error) {
      console.error('Web content fetch error:', error);
      throw new Error(`Failed to fetch web content: ${error}`);
    }
  }

  /**
   * Generate content hash for deduplication
   */
  private async generateContentHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hash));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Create evidence object
   */
  private async createEvidence(
    subjectId: string,
    sourceUrl: string,
    content: string,
    contentType: 'json' | 'html' | 'text'
  ): Promise<Evidence> {
    const hash = await this.generateContentHash(content);
    
    return {
      id: `evid_${crypto.randomUUID()}`,
      subject_id: subjectId,
      source_url: sourceUrl,
      collected_at: new Date().toISOString(),
      content_text: content,
      content_type: contentType,
      hash
    };
  }

  /**
   * Web search tool
   */
  private searchWebTool = tool({
    description: "Search the web for information about a subject",
    inputSchema: z.object({
      query: z.string().describe("Search query"),
      subjectId: z.string().describe("Subject ID for evidence tracking")
    }),
    execute: async ({ query, subjectId }) => {
      try {
        // Use a search API or web scraping
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        const content = await this.fetchWebContent(searchUrl);
        
        const evidence = await this.createEvidence(
          subjectId,
          searchUrl,
          content,
          'html'
        );

        return {
          success: true,
          evidence,
          message: `Found web search results for: ${query}`
        };

      } catch (error) {
        return {
          success: false,
          error: `Web search failed: ${error}`
        };
      }
    }
  });

  /**
   * Web content fetch tool
   */
  private fetchWebTool = tool({
    description: "Fetch content from a specific URL using Brightdata API",
    inputSchema: z.object({
      url: z.string().url().describe("URL to fetch"),
      subjectId: z.string().describe("Subject ID for evidence tracking")
    }),
    execute: async ({ url, subjectId }) => {
      try {
        console.log(`[HARVESTER] Fetching web content from: ${url}`);

        // Use Brightdata scraper for web content
        const scrapingResult = await this.brightdataScraper.scrapeWebContent(url);

        if (!scrapingResult.success) {
          console.log(`[HARVESTER] Web content fetch failed: ${scrapingResult.error}`);
          return {
            success: false,
            error: `Failed to fetch web content: ${scrapingResult.error}`
          };
        }

        // Log the complete JSON output from Brightdata API
        console.log(`[HARVESTER] Brightdata Web Content API Response for ${url}:`);
        console.log(`[HARVESTER] Snapshot ID: ${scrapingResult.snapshotId}`);
        console.log(`[HARVESTER] Web Content JSON:`, JSON.stringify(scrapingResult.data, null, 2));

        const evidence = await this.createEvidence(
          subjectId,
          url,
          JSON.stringify(scrapingResult.data),
          'json'
        );

        // Extract summary information
        const webData = scrapingResult.data;
        const summary = {
          url: webData?.url || url,
          title: webData?.title || 'No title',
          content_length: webData?.content?.length || 0,
          scraped_at: webData?.scrapedAt || new Date().toISOString()
        };

        console.log(`[HARVESTER] Web Content Summary:`, JSON.stringify(summary, null, 2));

        return {
          success: true,
          evidence,
          message: `Fetched web content from: ${url} (${summary.content_length} characters)`,
          data: summary,
          rawData: scrapingResult.data // Include raw data for debugging
        };

      } catch (error) {
        console.error('Web content fetch error:', error);
        return {
          success: false,
          error: `Failed to fetch web content: ${error}`
        };
      }
    }
  });

  /**
   * LinkedIn profile scraping tool
   */
  private scrapeLinkedInProfileTool = tool({
    description: "Scrape LinkedIn profile data using Brightdata API",
    inputSchema: z.object({
      subjectId: z.string().describe("Subject ID for evidence tracking"),
      profileUrl: z.string().url().describe("LinkedIn profile URL to scrape")
    }),
    execute: async ({ subjectId, profileUrl }) => {
      try {
        console.log(`[HARVESTER] Scraping LinkedIn profile: ${profileUrl}`);

        // Scrape the LinkedIn profile using Brightdata
        const scrapingResult = await this.brightdataScraper.scrapeProfile(profileUrl);

        if (!scrapingResult.success) {
          console.log(`[HARVESTER] LinkedIn profile scraping failed: ${scrapingResult.error}`);
          return {
            success: false,
            error: `Failed to scrape LinkedIn profile: ${scrapingResult.error}`,
            source: profileUrl
          };
        }

        // Log the complete JSON output from Brightdata API
        console.log(`[HARVESTER] Brightdata API Response for ${profileUrl}:`);
        console.log(`[HARVESTER] Snapshot ID: ${scrapingResult.snapshotId}`);
        console.log(`[HARVESTER] Scraped Data JSON:`, JSON.stringify(scrapingResult.data, null, 2));

        // Create evidence from scraped data
        const evidence = await this.createEvidence(
          subjectId,
          profileUrl,
          JSON.stringify(scrapingResult.data),
          'json'
        );

        // Extract key information for summary
        const profileData = scrapingResult.data;
        const summary = {
          name: profileData?.name || 'Unknown',
          position: profileData?.position || 'Unknown',
          current_company: profileData?.current_company_name || 'Unknown',
          location: profileData?.city ? `${profileData.city}, ${profileData.country_code}` : 'Unknown',
          about: profileData?.about ? profileData.about.substring(0, 200) + '...' : 'No description',
          experience_count: profileData?.experience?.length || 0,
          education_count: profileData?.education?.length || 0,
          followers: profileData?.followers || 0,
          connections: profileData?.connections || 0,
          profile_url: profileData?.url || profileUrl,
          scraped_at: profileData?.timestamp || new Date().toISOString()
        };

        console.log(`[HARVESTER] Profile Summary:`, JSON.stringify(summary, null, 2));

        return {
          success: true,
          evidence,
          message: `LinkedIn profile scraped successfully - ${summary.name} (${summary.position} at ${summary.current_company})`,
          data: summary,
          rawData: scrapingResult.data // Include raw data for debugging
        };

      } catch (error) {
        console.error('LinkedIn profile scraping error:', error);
        return {
          success: false,
          error: `LinkedIn profile scraping failed: ${error}`
        };
      }
    }
  });

  /**
   * LinkedIn profile search tool
   */
  private searchLinkedInProfilesTool = tool({
    description: "Search for LinkedIn profiles using Brightdata API",
    inputSchema: z.object({
      subjectId: z.string().describe("Subject ID for evidence tracking"),
      searchQuery: z.string().describe("Search query (name, title, etc.)"),
      location: z.string().optional().describe("Optional location filter"),
      company: z.string().optional().describe("Optional company filter"),
      currentTitle: z.string().optional().describe("Optional current title filter")
    }),
    execute: async ({ subjectId, searchQuery, location, company, currentTitle }) => {
      try {
        console.log(`[HARVESTER] Searching LinkedIn profiles for: ${searchQuery}`);

        // Search for profiles using Brightdata
        const searchResult = await this.brightdataScraper.searchProfiles(searchQuery, {
          location,
          company,
          currentTitle
        });

        if (!searchResult.success) {
          console.log(`[HARVESTER] LinkedIn profile search failed: ${searchResult.error}`);
          return {
            success: false,
            error: `Failed to search LinkedIn profiles: ${searchResult.error}`,
            source: 'linkedin-search'
          };
        }

        // Log the complete JSON output from Brightdata API
        console.log(`[HARVESTER] Brightdata Search API Response for "${searchQuery}":`);
        console.log(`[HARVESTER] Snapshot ID: ${searchResult.snapshotId}`);
        console.log(`[HARVESTER] Search Results JSON:`, JSON.stringify(searchResult.data, null, 2));

        // Create evidence from search results
        const evidence = await this.createEvidence(
          subjectId,
          'linkedin://search',
          JSON.stringify(searchResult.data),
          'json'
        );

        // Extract summary information
        const searchData = searchResult.data;
        const results = searchData?.results || [];
        const summary = {
          query: searchQuery,
          totalResults: searchData?.totalResults || results.length,
          foundProfiles: results.map((profile: any) => ({
            name: profile.name || 'Unknown',
            position: profile.position || 'Unknown',
            current_company: profile.current_company_name || 'Unknown',
            location: profile.city ? `${profile.city}, ${profile.country_code}` : 'Unknown',
            profile_url: profile.url || 'Unknown'
          })),
          scraped_at: searchData?.scrapedAt || new Date().toISOString()
        };

        console.log(`[HARVESTER] Search Summary:`, JSON.stringify(summary, null, 2));

        return {
          success: true,
          evidence,
          message: `Found ${results.length} LinkedIn profiles for "${searchQuery}"`,
          data: summary,
          rawData: searchResult.data // Include raw data for debugging
        };

      } catch (error) {
        console.error('LinkedIn profile search error:', error);
        return {
          success: false,
          error: `LinkedIn profile search failed: ${error}`
        };
      }
    }
  });

  /**
   * LinkedIn company scraping tool
   */
  private scrapeLinkedInCompanyTool = tool({
    description: "Scrape LinkedIn company information using Brightdata API",
    inputSchema: z.object({
      subjectId: z.string().describe("Subject ID for evidence tracking"),
      companyUrl: z.string().url().describe("LinkedIn company URL to scrape")
    }),
    execute: async ({ subjectId, companyUrl }) => {
      try {
        console.log(`[HARVESTER] Scraping LinkedIn company: ${companyUrl}`);

        // Scrape the company page using Brightdata
        const scrapingResult = await this.brightdataScraper.scrapeCompany(companyUrl);

        if (!scrapingResult.success) {
          console.log(`[HARVESTER] LinkedIn company scraping failed: ${scrapingResult.error}`);
          return {
            success: false,
            error: `Failed to scrape LinkedIn company: ${scrapingResult.error}`,
            source: companyUrl
          };
        }

        // Log the complete JSON output from Brightdata API
        console.log(`[HARVESTER] Brightdata Company API Response for ${companyUrl}:`);
        console.log(`[HARVESTER] Snapshot ID: ${scrapingResult.snapshotId}`);
        console.log(`[HARVESTER] Company Data JSON:`, JSON.stringify(scrapingResult.data, null, 2));

        // Create evidence from scraped data
        const evidence = await this.createEvidence(
          subjectId,
          companyUrl,
          JSON.stringify(scrapingResult.data),
          'json'
        );

        // Extract key information for summary
        const companyData = scrapingResult.data;
        const summary = {
          name: companyData?.name || 'Unknown Company',
          description: companyData?.description || 'No description available',
          about: companyData?.about || 'No about information',
          industry: companyData?.industries?.[0] || 'Unknown',
          company_size: companyData?.company_size || 'Unknown',
          headquarters: companyData?.headquarters || 'Unknown',
          founded: companyData?.founded || 'Unknown',
          followers: companyData?.followers || 0,
          employees: companyData?.employees || 0,
          website: companyData?.url || companyUrl,
          scraped_at: companyData?.timestamp || new Date().toISOString()
        };

        console.log(`[HARVESTER] Company Summary:`, JSON.stringify(summary, null, 2));

        return {
          success: true,
          evidence,
          message: `LinkedIn company scraped successfully - ${summary.name} (${summary.industry})`,
          data: summary,
          rawData: scrapingResult.data // Include raw data for debugging
        };

      } catch (error) {
        console.error('LinkedIn company scraping error:', error);
        return {
          success: false,
          error: `LinkedIn company scraping failed: ${error}`
        };
      }
    }
  });

  /**
   * Get all available tools
   */
  getTools() {
    return {
      searchWeb: this.searchWebTool,
      fetchWeb: this.fetchWebTool,
      scrapeLinkedInProfile: this.scrapeLinkedInProfileTool,
      searchLinkedInProfiles: this.searchLinkedInProfilesTool,
      scrapeLinkedInCompany: this.scrapeLinkedInCompanyTool
    };
  }

  /**
   * Harvest evidence for a subject
   */
  async harvestEvidence(subjectName: string, sources: string[], inputType: 'linkedin' | 'search' = 'search', maxApiCalls: number = 5): Promise<Evidence[]> {
    const evidence: Evidence[] = [];
    let apiCallsUsed = 0;

    try {
      // Handle LinkedIn profile URL directly
      if (inputType === 'linkedin' && (subjectName.includes('linkedin.com/in/') || subjectName.includes('linkedin.com/company/'))) {
        try {
          console.log(`[HARVESTER] Direct LinkedIn profile scraping: ${subjectName}`);
          const profileResult = await this.scrapeLinkedInProfileTool.execute({
            subjectId: subjectName,
            profileUrl: subjectName
          });
          
          // Handle the result properly
          if (profileResult && typeof profileResult === 'object' && 'success' in profileResult) {
            if (profileResult.success && profileResult.evidence) {
              evidence.push(profileResult.evidence);
              apiCallsUsed += 1;
            }
          }
        } catch (error) {
          console.error('Direct LinkedIn profile scraping failed:', error);
        }
      } else {
        // Handle search-based approach
        // Search web for general information
        if (sources.includes('web') && apiCallsUsed < maxApiCalls) {
          try {
            const searchResult = await this.searchWebTool.execute({
              query: subjectName,
              subjectId: subjectName
            });
            
            // Handle the result properly
            if (searchResult && typeof searchResult === 'object' && 'success' in searchResult) {
              if (searchResult.success && searchResult.evidence) {
                evidence.push(searchResult.evidence);
                apiCallsUsed += 1;
              }
            }
          } catch (error) {
            console.error('Web search failed:', error);
          }
        }

        // Search LinkedIn profiles
        if (sources.includes('linkedin') && apiCallsUsed < maxApiCalls) {
          try {
            const linkedinSearchResult = await this.searchLinkedInProfilesTool.execute({
              subjectId: subjectName,
              searchQuery: subjectName
            });
            
            // Handle the result properly
            if (linkedinSearchResult && typeof linkedinSearchResult === 'object' && 'success' in linkedinSearchResult) {
              if (linkedinSearchResult.success && linkedinSearchResult.evidence) {
                evidence.push(linkedinSearchResult.evidence);
                apiCallsUsed += 1;
                
                // If we found profiles, scrape the first few (limit to remaining API calls)
                const searchData = linkedinSearchResult.data;
                if (searchData && searchData.results && searchData.results.length > 0) {
                  const remainingCalls = maxApiCalls - apiCallsUsed;
                  const profilesToScrape = searchData.results.slice(0, Math.min(remainingCalls, 5)); // Max 5 profiles
                  
                  for (const profile of profilesToScrape) {
                    if (apiCallsUsed >= maxApiCalls) break;
                    
                    try {
                      const profileResult = await this.scrapeLinkedInProfileTool.execute({
                        subjectId: subjectName,
                        profileUrl: profile.profile_url || profile.url
                      });
                      
                      // Handle the result properly
                      if (profileResult && typeof profileResult === 'object' && 'success' in profileResult) {
                        if (profileResult.success && profileResult.evidence) {
                          evidence.push(profileResult.evidence);
                          apiCallsUsed += 1;
                        }
                      }
                    } catch (error) {
                      console.error(`Failed to scrape profile ${profile.profile_url || profile.url}:`, error);
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error('LinkedIn search failed:', error);
          }
        }
      }

      console.log(`[HARVESTER] Evidence harvesting completed. API calls used: ${apiCallsUsed}/${maxApiCalls}, Evidence collected: ${evidence.length}`);
      return evidence;

    } catch (error) {
      console.error('Evidence harvesting error:', error);
      throw error;
    }
  }

}
