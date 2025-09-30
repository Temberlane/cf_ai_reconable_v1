/**
 * LinkedIn Web Scraper for Reconable Lite+
 * Uses Browser Rendering API to scrape LinkedIn profiles and data
 */

import type { LinkedInProfile, LinkedInEmail } from '../memory/schema';

export interface ScrapingConfig {
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  userAgent: string;
}

export interface ScrapingResult {
  success: boolean;
  data?: any;
  error?: string;
  source: string;
  scrapedAt: string;
}

export class LinkedInScraper {
  private config: ScrapingConfig;

  constructor(private browserRendering: Fetcher, config: Partial<ScrapingConfig> = {}) {
    this.config = {
      maxRetries: 3,
      retryDelay: 2000,
      timeout: 30000,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...config
    };
  }

  /**
   * Scrape LinkedIn profile by URL
   */
  async scrapeProfile(profileUrl: string): Promise<ScrapingResult> {
    try {
      console.log(`[SCRAPER] Scraping LinkedIn profile: ${profileUrl}`);

      const result = await this.browserRendering.fetch('https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cloudflare/puppeteer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: profileUrl,
          waitUntil: 'networkidle2',
          viewport: { width: 1920, height: 1080 },
          userAgent: this.config.userAgent,
          extraHTTPHeaders: {
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
          },
          actions: [
            {
              type: 'waitForSelector',
              selector: 'body',
              timeout: 10000
            },
            {
              type: 'evaluate',
              expression: `
                // Extract profile data from LinkedIn page
                const extractProfileData = () => {
                  const data = {
                    name: '',
                    headline: '',
                    location: '',
                    about: '',
                    experience: [],
                    education: [],
                    skills: [],
                    connections: '',
                    profileImage: '',
                    profileUrl: window.location.href,
                    scrapedAt: new Date().toISOString()
                  };

                  // Extract name
                  const nameElement = document.querySelector('h1.text-heading-xlarge, h1.break-words, .pv-text-details__left-panel h1');
                  if (nameElement) {
                    data.name = nameElement.textContent?.trim() || '';
                  }

                  // Extract headline
                  const headlineElement = document.querySelector('.text-body-medium.break-words, .pv-text-details__left-panel .text-body-medium');
                  if (headlineElement) {
                    data.headline = headlineElement.textContent?.trim() || '';
                  }

                  // Extract location
                  const locationElement = document.querySelector('.text-body-small.inline.t-black--light.break-words, .pv-text-details__left-panel .text-body-small');
                  if (locationElement) {
                    data.location = locationElement.textContent?.trim() || '';
                  }

                  // Extract about section
                  const aboutElement = document.querySelector('#about, .pv-about__summary-text, .core-section-container__content .break-words');
                  if (aboutElement) {
                    data.about = aboutElement.textContent?.trim() || '';
                  }

                  // Extract experience
                  const experienceSection = document.querySelector('#experience, .experience-section');
                  if (experienceSection) {
                    const experienceItems = experienceSection.querySelectorAll('.pvs-list__item, .experience-item');
                    experienceItems.forEach(item => {
                      const titleElement = item.querySelector('.mr1.t-bold span[aria-hidden="true"], .experience-item__title');
                      const companyElement = item.querySelector('.t-14.t-normal span[aria-hidden="true"], .experience-item__company');
                      const durationElement = item.querySelector('.t-14.t-normal.t-black--light span[aria-hidden="true"], .experience-item__duration');
                      
                      if (titleElement || companyElement) {
                        data.experience.push({
                          title: titleElement?.textContent?.trim() || '',
                          company: companyElement?.textContent?.trim() || '',
                          duration: durationElement?.textContent?.trim() || '',
                          description: ''
                        });
                      }
                    });
                  }

                  // Extract education
                  const educationSection = document.querySelector('#education, .education-section');
                  if (educationSection) {
                    const educationItems = educationSection.querySelectorAll('.pvs-list__item, .education-item');
                    educationItems.forEach(item => {
                      const schoolElement = item.querySelector('.mr1.t-bold span[aria-hidden="true"], .education-item__school');
                      const degreeElement = item.querySelector('.t-14.t-normal span[aria-hidden="true"], .education-item__degree');
                      const durationElement = item.querySelector('.t-14.t-normal.t-black--light span[aria-hidden="true"], .education-item__duration');
                      
                      if (schoolElement) {
                        data.education.push({
                          school: schoolElement.textContent?.trim() || '',
                          degree: degreeElement?.textContent?.trim() || '',
                          duration: durationElement?.textContent?.trim() || ''
                        });
                      }
                    });
                  }

                  // Extract skills
                  const skillsSection = document.querySelector('#skills, .skills-section');
                  if (skillsSection) {
                    const skillItems = skillsSection.querySelectorAll('.pvs-list__item, .skill-item');
                    skillItems.forEach(item => {
                      const skillElement = item.querySelector('.mr1.t-bold span[aria-hidden="true"], .skill-item__name');
                      if (skillElement) {
                        data.skills.push(skillElement.textContent?.trim() || '');
                      }
                    });
                  }

                  // Extract connections count
                  const connectionsElement = document.querySelector('.pv-top-card--list-bullet .t-bold span[aria-hidden="true"], .connections-count');
                  if (connectionsElement) {
                    data.connections = connectionsElement.textContent?.trim() || '';
                  }

                  // Extract profile image
                  const imageElement = document.querySelector('.pv-top-card__photo img, .profile-photo img');
                  if (imageElement) {
                    data.profileImage = imageElement.src || '';
                  }

                  return data;
                };

                return extractProfileData();
              `
            }
          ]
        })
      });

      if (!result.ok) {
        throw new Error(`Browser rendering failed: ${result.status}`);
      }

      const scrapingResult = await result.json();
      const profileData = scrapingResult.result?.data || scrapingResult.data;

      return {
        success: true,
        data: profileData,
        source: profileUrl,
        scrapedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error(`[SCRAPER] Error scraping profile ${profileUrl}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: profileUrl,
        scrapedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Search for LinkedIn profiles by name and criteria
   */
  async searchProfiles(searchQuery: string, filters: {
    location?: string;
    company?: string;
    currentTitle?: string;
    industry?: string;
  } = {}): Promise<ScrapingResult> {
    try {
      console.log(`[SCRAPER] Searching LinkedIn profiles for: ${searchQuery}`);

      // Build LinkedIn search URL
      const searchUrl = this.buildSearchUrl(searchQuery, filters);
      
      const result = await this.browserRendering.fetch('https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cloudflare/puppeteer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: searchUrl,
          waitUntil: 'networkidle2',
          viewport: { width: 1920, height: 1080 },
          userAgent: this.config.userAgent,
          extraHTTPHeaders: {
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
          },
          actions: [
            {
              type: 'waitForSelector',
              selector: 'body',
              timeout: 10000
            },
            {
              type: 'evaluate',
              expression: `
                // Extract search results from LinkedIn search page
                const extractSearchResults = () => {
                  const results = [];
                  
                  // Look for profile cards in search results
                  const profileCards = document.querySelectorAll('.entity-result, .search-result, .reusable-search__result-container');
                  
                  profileCards.forEach(card => {
                    const nameElement = card.querySelector('.entity-result__title-text a, .search-result__title a, .reusable-search__result-title a');
                    const headlineElement = card.querySelector('.entity-result__primary-subtitle, .search-result__snippets, .reusable-search__result-subtitle');
                    const locationElement = card.querySelector('.entity-result__secondary-subtitle, .search-result__location, .reusable-search__result-subtitle');
                    const profileLink = nameElement?.href;
                    const profileImage = card.querySelector('.entity-result__image img, .search-result__image img')?.src;
                    
                    if (nameElement && profileLink) {
                      results.push({
                        name: nameElement.textContent?.trim() || '',
                        headline: headlineElement?.textContent?.trim() || '',
                        location: locationElement?.textContent?.trim() || '',
                        profileUrl: profileLink,
                        profileImage: profileImage || '',
                        relevanceScore: Math.random() // LinkedIn doesn't show explicit scores
                      });
                    }
                  });
                  
                  return {
                    query: '${searchQuery}',
                    results: results,
                    totalResults: results.length,
                    scrapedAt: new Date().toISOString()
                  };
                };

                return extractSearchResults();
              `
            }
          ]
        })
      });

      if (!result.ok) {
        throw new Error(`Browser rendering failed: ${result.status}`);
      }

      const scrapingResult = await result.json();
      const searchData = scrapingResult.result?.data || scrapingResult.data;

      return {
        success: true,
        data: searchData,
        source: searchUrl,
        scrapedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error(`[SCRAPER] Error searching profiles:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'linkedin-search',
        scrapedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Scrape company information
   */
  async scrapeCompany(companyUrl: string): Promise<ScrapingResult> {
    try {
      console.log(`[SCRAPER] Scraping LinkedIn company: ${companyUrl}`);

      const result = await this.browserRendering.fetch('https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cloudflare/puppeteer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: companyUrl,
          waitUntil: 'networkidle2',
          viewport: { width: 1920, height: 1080 },
          userAgent: this.config.userAgent,
          actions: [
            {
              type: 'waitForSelector',
              selector: 'body',
              timeout: 10000
            },
            {
              type: 'evaluate',
              expression: `
                // Extract company data from LinkedIn company page
                const extractCompanyData = () => {
                  const data = {
                    name: '',
                    description: '',
                    industry: '',
                    companySize: '',
                    headquarters: '',
                    website: '',
                    founded: '',
                    employees: [],
                    recentPosts: [],
                    scrapedAt: new Date().toISOString()
                  };

                  // Extract company name
                  const nameElement = document.querySelector('h1.org-top-card-summary__title, .company-name');
                  if (nameElement) {
                    data.name = nameElement.textContent?.trim() || '';
                  }

                  // Extract description
                  const descElement = document.querySelector('.org-top-card-summary__info-item, .company-description');
                  if (descElement) {
                    data.description = descElement.textContent?.trim() || '';
                  }

                  // Extract industry
                  const industryElement = document.querySelector('.org-top-card-summary__info-item--industry, .company-industry');
                  if (industryElement) {
                    data.industry = industryElement.textContent?.trim() || '';
                  }

                  // Extract company size
                  const sizeElement = document.querySelector('.org-top-card-summary__info-item--company-size, .company-size');
                  if (sizeElement) {
                    data.companySize = sizeElement.textContent?.trim() || '';
                  }

                  // Extract headquarters
                  const hqElement = document.querySelector('.org-top-card-summary__info-item--headquarters, .company-headquarters');
                  if (hqElement) {
                    data.headquarters = hqElement.textContent?.trim() || '';
                  }

                  // Extract website
                  const websiteElement = document.querySelector('.org-top-card-summary__info-item--website a, .company-website a');
                  if (websiteElement) {
                    data.website = websiteElement.href || '';
                  }

                  return data;
                };

                return extractCompanyData();
              `
            }
          ]
        })
      });

      if (!result.ok) {
        throw new Error(`Browser rendering failed: ${result.status}`);
      }

      const scrapingResult = await result.json();
      const companyData = scrapingResult.result?.data || scrapingResult.data;

      return {
        success: true,
        data: companyData,
        source: companyUrl,
        scrapedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error(`[SCRAPER] Error scraping company ${companyUrl}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: companyUrl,
        scrapedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Build LinkedIn search URL with filters
   */
  private buildSearchUrl(query: string, filters: {
    location?: string;
    company?: string;
    currentTitle?: string;
    industry?: string;
  }): string {
    const baseUrl = 'https://www.linkedin.com/search/results/people/';
    const params = new URLSearchParams();
    
    // Add search query
    params.set('keywords', query);
    
    // Add filters
    if (filters.location) {
      params.set('geoUrn', `["${filters.location}"]`);
    }
    
    if (filters.company) {
      params.set('currentCompany', `["${filters.company}"]`);
    }
    
    if (filters.currentTitle) {
      params.set('title', `["${filters.currentTitle}"]`);
    }
    
    if (filters.industry) {
      params.set('industry', `["${filters.industry}"]`);
    }
    
    // Add other useful parameters
    params.set('origin', 'GLOBAL_SEARCH_HEADER');
    params.set('page', '1');
    
    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Scrape general web content
   */
  async scrapeWebContent(url: string): Promise<ScrapingResult> {
    try {
      console.log(`[SCRAPER] Scraping web content: ${url}`);

      const result = await this.browserRendering.fetch('https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cloudflare/puppeteer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url,
          waitUntil: 'networkidle2',
          viewport: { width: 1920, height: 1080 },
          userAgent: this.config.userAgent,
          actions: [
            {
              type: 'waitForSelector',
              selector: 'body',
              timeout: 10000
            },
            {
              type: 'evaluate',
              expression: `
                // Extract general web content
                const extractWebContent = () => {
                  return {
                    title: document.title,
                    url: window.location.href,
                    content: document.body.textContent || '',
                    html: document.documentElement.outerHTML,
                    links: Array.from(document.querySelectorAll('a[href]')).map(a => ({
                      text: a.textContent?.trim(),
                      href: a.href
                    })).filter(link => link.text && link.href),
                    images: Array.from(document.querySelectorAll('img[src]')).map(img => ({
                      src: img.src,
                      alt: img.alt
                    })),
                    scrapedAt: new Date().toISOString()
                  };
                };

                return extractWebContent();
              `
            }
          ]
        })
      });

      if (!result.ok) {
        throw new Error(`Browser rendering failed: ${result.status}`);
      }

      const scrapingResult = await result.json();
      const webData = scrapingResult.result?.data || scrapingResult.data;

      return {
        success: true,
        data: webData,
        source: url,
        scrapedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error(`[SCRAPER] Error scraping web content ${url}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: url,
        scrapedAt: new Date().toISOString()
      };
    }
  }
}
