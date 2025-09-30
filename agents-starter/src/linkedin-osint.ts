/**
 * LinkedIn OSINT (Open Source Intelligence) tools
 * Uses Cloudflare Browser Rendering API for web scraping
 */

import puppeteer from "@cloudflare/puppeteer";

export interface LinkedInProfile {
  name: string;
  headline: string;
  location: string;
  currentCompany: string;
  profileUrl: string;
  profileImage?: string;
  about?: string;
  experience: Array<{
    title: string;
    company: string;
    duration: string;
    description?: string;
  }>;
  education: Array<{
    school: string;
    degree: string;
    duration: string;
  }>;
  skills: string[];
  connections: number;
  mutualConnections?: string[];
  recentPosts?: Array<{
    content: string;
    date: string;
    likes: number;
    comments: number;
  }>;
}

export interface LinkedInSearchResult {
  name: string;
  headline: string;
  location: string;
  profileUrl: string;
  profileImage?: string;
  mutualConnections?: number;
}

export interface LinkedInCompany {
  name: string;
  industry: string;
  size: string;
  location: string;
  website?: string;
  description: string;
  employees?: Array<{
    name: string;
    title: string;
    profileUrl: string;
  }>;
  recentPosts?: Array<{
    content: string;
    date: string;
    likes: number;
    comments: number;
  }>;
}

export class LinkedInOSINT {
  private browser: any;
  private env: any;

  constructor(env: any) {
    console.log('[LinkedInOSINT] Constructor called with env:', !!env);
    this.env = env;
  }

  async initialize() {
    console.log('[LinkedInOSINT] Initializing browser...');
    if (!this.browser) {
      console.log('[LinkedInOSINT] Launching new browser instance');
      this.browser = await puppeteer.launch(this.env.BROWSER_RENDERING);
      console.log('[LinkedInOSINT] Browser launched successfully');
    } else {
      console.log('[LinkedInOSINT] Browser already initialized, reusing existing instance');
    }
  }

  async close() {
    console.log('[LinkedInOSINT] Closing browser...');
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('[LinkedInOSINT] Browser closed successfully');
    } else {
      console.log('[LinkedInOSINT] No browser instance to close');
    }
  }

  /**
   * Search for LinkedIn profiles by name and optional filters
   */
  async searchProfiles(
    name: string, 
    location?: string, 
    company?: string
  ): Promise<LinkedInSearchResult[]> {
    console.log('[LinkedInOSINT] searchProfiles called with:', { name, location, company });
    await this.initialize();
    const page = await this.browser.newPage();
    console.log('[LinkedInOSINT] New page created for search');

    try {
      // Set user agent to avoid detection
      console.log('[LinkedInOSINT] Setting user agent...');
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Build search URL
      const searchParams = new URLSearchParams();
      searchParams.set('keywords', name);
      if (location) searchParams.set('geoUrn', `["${location}"]`);
      if (company) searchParams.set('currentCompany', `["${company}"]`);
      
      const searchUrl = `https://www.linkedin.com/search/results/people/?${searchParams.toString()}`;
      console.log('[LinkedInOSINT] Navigating to search URL:', searchUrl);
      
      await page.goto(searchUrl, { waitUntil: 'networkidle2' });
      console.log('[LinkedInOSINT] Page loaded, waiting for search results...');
      
      // Wait for search results to load
      console.log('[LinkedInOSINT] Waiting for search results container...');
      await page.waitForSelector('.search-results-container', { timeout: 10000 });
      console.log('[LinkedInOSINT] Search results container found, extracting profiles...');
      
      // Extract profile information
      const profiles = await page.evaluate(() => {
        const results: LinkedInSearchResult[] = [];
        const profileCards = document.querySelectorAll('.search-results-container .entity-result');
        
        profileCards.forEach((card) => {
          try {
            const nameElement = card.querySelector('.entity-result__title-text a');
            const headlineElement = card.querySelector('.entity-result__primary-subtitle');
            const locationElement = card.querySelector('.entity-result__secondary-subtitle');
            const imageElement = card.querySelector('.presence-entity__image img');
            const mutualElement = card.querySelector('.entity-result__insights .entity-result__insights--item');
            
            if (nameElement) {
              const profileUrl = nameElement.getAttribute('href') || '';
              const name = nameElement.textContent?.trim() || '';
              const headline = headlineElement?.textContent?.trim() || '';
              const location = locationElement?.textContent?.trim() || '';
              const profileImage = imageElement?.getAttribute('src') || '';
              const mutualConnections = mutualElement?.textContent?.match(/\d+/)?.[0];
              
              results.push({
                name,
                headline,
                location,
                profileUrl: profileUrl.startsWith('http') ? profileUrl : `https://www.linkedin.com${profileUrl}`,
                profileImage,
                mutualConnections: mutualConnections ? parseInt(mutualConnections) : undefined
              });
            }
          } catch (error) {
            console.error('Error parsing profile card:', error);
          }
        });
        
        return results;
      });
      
      console.log('[LinkedInOSINT] Extracted profiles:', profiles.length);
      const limitedProfiles = profiles.slice(0, 10); // Limit to first 10 results
      console.log('[LinkedInOSINT] Returning limited profiles:', limitedProfiles.length);
      return limitedProfiles;
      
    } catch (error) {
      console.error('[LinkedInOSINT] Error searching LinkedIn profiles:', error);
      throw new Error(`Failed to search LinkedIn profiles: ${error}`);
    } finally {
      console.log('[LinkedInOSINT] Closing search page...');
      await page.close();
    }
  }

  /**
   * Analyze a specific LinkedIn profile for OSINT
   */
  async analyzeProfile(
    profileUrl: string, 
    includeConnections: boolean = false,
    includePosts: boolean = false
  ): Promise<LinkedInProfile> {
    console.log('[LinkedInOSINT] analyzeProfile called with:', { profileUrl, includeConnections, includePosts });
    await this.initialize();
    const page = await this.browser.newPage();
    console.log('[LinkedInOSINT] New page created for profile analysis');

    try {
      console.log('[LinkedInOSINT] Setting user agent for profile analysis...');
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      console.log('[LinkedInOSINT] Navigating to profile URL:', profileUrl);
      await page.goto(profileUrl, { waitUntil: 'networkidle2' });
      console.log('[LinkedInOSINT] Profile page loaded, waiting for content...');
      
      // Wait for profile to load
      console.log('[LinkedInOSINT] Waiting for profile content to load...');
      await page.waitForSelector('.pv-text-details__left-panel', { timeout: 10000 });
      console.log('[LinkedInOSINT] Profile content loaded, extracting data...');
      
      const profile = await page.evaluate((includeConnections, includePosts) => {
        const getTextContent = (selector: string) => {
          const element = document.querySelector(selector);
          return element?.textContent?.trim() || '';
        };
        
        const getImageSrc = (selector: string) => {
          const element = document.querySelector(selector);
          return element?.getAttribute('src') || '';
        };
        
        // Basic profile information
        const name = getTextContent('h1.text-heading-xlarge');
        const headline = getTextContent('.text-body-medium.break-words');
        const location = getTextContent('.text-body-small.inline.t-black--light.break-words');
        const profileImage = getImageSrc('.pv-top-card-profile-picture__image');
        
        // About section
        const about = getTextContent('#about ~ .pv-shared-text-with-see-more .inline-show-more-text');
        
        // Experience
        const experience: Array<{title: string; company: string; duration: string; description?: string}> = [];
        const experienceItems = document.querySelectorAll('#experience ~ .pvs-list__container .pvs-entity');
        experienceItems.forEach((item) => {
          const title = getTextContent('.mr1.t-bold span[aria-hidden="true"]');
          const company = getTextContent('.t-14.t-normal span[aria-hidden="true"]');
          const duration = getTextContent('.t-14.t-normal.t-black--light span[aria-hidden="true"]');
          const description = getTextContent('.t-14.t-normal.t-black span[aria-hidden="true"]');
          
          if (title && company) {
            experience.push({ title, company, duration, description });
          }
        });
        
        // Education
        const education: Array<{school: string; degree: string; duration: string}> = [];
        const educationItems = document.querySelectorAll('#education ~ .pvs-list__container .pvs-entity');
        educationItems.forEach((item) => {
          const school = getTextContent('.mr1.t-bold span[aria-hidden="true"]');
          const degree = getTextContent('.t-14.t-normal span[aria-hidden="true"]');
          const duration = getTextContent('.t-14.t-normal.t-black--light span[aria-hidden="true"]');
          
          if (school) {
            education.push({ school, degree, duration });
          }
        });
        
        // Skills
        const skills: string[] = [];
        const skillItems = document.querySelectorAll('#skills ~ .pvs-list__container .pvs-entity .mr1.t-bold span[aria-hidden="true"]');
        skillItems.forEach((item) => {
          const skill = item.textContent?.trim();
          if (skill) skills.push(skill);
        });
        
        // Connections count
        const connectionsText = getTextContent('.t-bold span[aria-hidden="true"]');
        const connections = parseInt(connectionsText.replace(/\D/g, '')) || 0;
        
        // Current company (from headline or experience)
        const currentCompany = experience.length > 0 ? experience[0].company : '';
        
        return {
          name,
          headline,
          location,
          currentCompany,
          profileUrl: window.location.href,
          profileImage,
          about,
          experience,
          education,
          skills,
          connections
        };
      }, includeConnections, includePosts);
      
      console.log('[LinkedInOSINT] Profile data extracted successfully:', {
        name: profile.name,
        headline: profile.headline,
        experienceCount: profile.experience.length,
        educationCount: profile.education.length,
        skillsCount: profile.skills.length,
        connections: profile.connections
      });
      
      return profile;
      
    } catch (error) {
      console.error('[LinkedInOSINT] Error analyzing LinkedIn profile:', error);
      throw new Error(`Failed to analyze LinkedIn profile: ${error}`);
    } finally {
      console.log('[LinkedInOSINT] Closing profile analysis page...');
      await page.close();
    }
  }

  /**
   * Research a LinkedIn company page
   */
  async researchCompany(
    companyName: string,
    includeEmployees: boolean = false,
    includeRecentPosts: boolean = false
  ): Promise<LinkedInCompany> {
    console.log('[LinkedInOSINT] researchCompany called with:', { companyName, includeEmployees, includeRecentPosts });
    await this.initialize();
    const page = await this.browser.newPage();
    console.log('[LinkedInOSINT] New page created for company research');

    try {
      console.log('[LinkedInOSINT] Setting user agent for company research...');
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Search for company
      const searchUrl = `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(companyName)}`;
      console.log('[LinkedInOSINT] Navigating to company search URL:', searchUrl);
      await page.goto(searchUrl, { waitUntil: 'networkidle2' });
      console.log('[LinkedInOSINT] Company search page loaded, waiting for results...');
      
      // Click on first company result
      console.log('[LinkedInOSINT] Waiting for company search results...');
      await page.waitForSelector('.search-results-container .entity-result', { timeout: 10000 });
      const firstCompany = await page.$('.search-results-container .entity-result .entity-result__title-text a');
      
      if (!firstCompany) {
        console.log('[LinkedInOSINT] No company found in search results');
        throw new Error('Company not found');
      }
      
      console.log('[LinkedInOSINT] Clicking on first company result...');
      await firstCompany.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
      console.log('[LinkedInOSINT] Company page loaded, extracting data...');
      
      const company = await page.evaluate((includeEmployees, includeRecentPosts) => {
        const getTextContent = (selector: string) => {
          const element = document.querySelector(selector);
          return element?.textContent?.trim() || '';
        };
        
        const name = getTextContent('.org-top-card-summary__title');
        const industry = getTextContent('.org-top-card-summary-info-list__info-item');
        const size = getTextContent('.org-top-card-summary-info-list__info-item:last-child');
        const location = getTextContent('.org-top-card-summary-info-list__info-item:nth-child(2)');
        const website = getTextContent('.org-top-card-summary-info-list__info-item a');
        const description = getTextContent('.break-words.white-space-pre-wrap');
        
        return {
          name,
          industry,
          size,
          location,
          website,
          description
        };
      }, includeEmployees, includeRecentPosts);
      
      console.log('[LinkedInOSINT] Company data extracted successfully:', {
        name: company.name,
        industry: company.industry,
        size: company.size,
        location: company.location
      });
      
      return company;
      
    } catch (error) {
      console.error('[LinkedInOSINT] Error researching LinkedIn company:', error);
      throw new Error(`Failed to research LinkedIn company: ${error}`);
    } finally {
      console.log('[LinkedInOSINT] Closing company research page...');
      await page.close();
    }
  }

  /**
   * Analyze LinkedIn network connections
   */
  async analyzeNetwork(
    profileUrl: string,
    maxConnections: number = 50,
    includeMutualConnections: boolean = true
  ): Promise<{ connections: LinkedInSearchResult[]; mutualConnections: string[] }> {
    console.log('[LinkedInOSINT] analyzeNetwork called with:', { profileUrl, maxConnections, includeMutualConnections });
    await this.initialize();
    const page = await this.browser.newPage();
    console.log('[LinkedInOSINT] New page created for network analysis');

    try {
      console.log('[LinkedInOSINT] Setting user agent for network analysis...');
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Navigate to connections page
      const connectionsUrl = profileUrl.replace('/in/', '/mynetwork/network/') + '/';
      console.log('[LinkedInOSINT] Navigating to connections URL:', connectionsUrl);
      await page.goto(connectionsUrl, { waitUntil: 'networkidle2' });
      console.log('[LinkedInOSINT] Connections page loaded, extracting network data...');
      
      // Extract connections
      const connections = await page.evaluate((maxConnections) => {
        const results: LinkedInSearchResult[] = [];
        const connectionItems = document.querySelectorAll('.mn-connection-card');
        
        connectionItems.forEach((item, index) => {
          if (index >= maxConnections) return;
          
          const nameElement = item.querySelector('.mn-connection-card__name a');
          const titleElement = item.querySelector('.mn-connection-card__occupation');
          const locationElement = item.querySelector('.mn-connection-card__location');
          const imageElement = item.querySelector('.mn-connection-card__picture img');
          
          if (nameElement) {
            const name = nameElement.textContent?.trim() || '';
            const profileUrl = nameElement.getAttribute('href') || '';
            const title = titleElement?.textContent?.trim() || '';
            const location = locationElement?.textContent?.trim() || '';
            const profileImage = imageElement?.getAttribute('src') || '';
            
            results.push({
              name,
              headline: title,
              location,
              profileUrl: profileUrl.startsWith('http') ? profileUrl : `https://www.linkedin.com${profileUrl}`,
              profileImage
            });
          }
        });
        
        return results;
      }, maxConnections);
      
      console.log('[LinkedInOSINT] Network data extracted successfully:', {
        connectionsFound: connections.length,
        maxConnections
      });
      
      return {
        connections,
        mutualConnections: [] // This would require additional analysis
      };
      
    } catch (error) {
      console.error('[LinkedInOSINT] Error analyzing LinkedIn network:', error);
      throw new Error(`Failed to analyze LinkedIn network: ${error}`);
    } finally {
      console.log('[LinkedInOSINT] Closing network analysis page...');
      await page.close();
    }
  }
}
