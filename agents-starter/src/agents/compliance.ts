/**
 * Compliance Agent for Reconable Lite+
 * Enforces privacy policies and data governance for web scraping
 */

import { Agent } from 'agents';
import type { Claim, VerificationResult } from '../memory/schema';
import { createVerificationPrompt, type VerificationInput } from '../prompts/verification';

interface Env {
  AI: Fetcher;
}

export class ComplianceAgent extends Agent<Env> {
  /**
   * Verify a claim against privacy policies and data governance rules
   */
  async verifyClaim(claim: Claim): Promise<VerificationResult> {
    try {
      // Check if claim contains sensitive information
      const containsSensitiveInfo = this.containsSensitiveInformation(claim);
      const isPubliclyAvailable = this.isPubliclyAvailable(claim);

      // Get existing claims for consistency checking
      const existingClaims = await this.getExistingClaims(claim.subject_id);

      // Use AI for detailed verification
      const verificationInput: VerificationInput = {
        claim,
        consentFlags: {
          linkedin_profile: true, // Web scraping assumes public data
          linkedin_email: false  // Email is typically not publicly available
        },
        existingClaims
      };

      const prompt = createVerificationPrompt(verificationInput);
      
      const response = await this.env.AI.fetch('https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/meta/llama-3.3-70b-instruct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are a compliance verification agent for web scraped data. Return only valid JSON matching the specified format.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        throw new Error(`AI verification failed: ${response.status}`);
      }

      const result = await response.json() as { result: { response: string } };
      const verificationResult = JSON.parse(result.result.response) as VerificationResult;

      // Add policy tags based on data source and sensitivity
      if (claim.provenance_json.includes('linkedin://')) {
        verificationResult.policy_tags.push('source:linkedin_scraping');
      }
      
      if (isPubliclyAvailable) {
        verificationResult.policy_tags.push('consent:public_data');
      }
      
      if (containsSensitiveInfo) {
        verificationResult.policy_tags.push('sensitive:pii');
      }

      return verificationResult;

    } catch (error) {
      console.error('Compliance verification error:', error);
      return {
        approved: false,
        policy_tags: ['error:verification_failed'],
        reason: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Check if claim contains sensitive information
   */
  private containsSensitiveInformation(claim: Claim): boolean {
    const sensitivePredicates = [
      'has_email', 'email_address', 'contact_email', 'phone_number',
      'address', 'personal_id', 'ssn', 'social_security'
    ];
    
    const sensitiveObjects = [
      'email', 'phone', 'address', 'ssn', 'social security',
      'personal', 'private', 'confidential'
    ];
    
    const predicateMatch = sensitivePredicates.includes(claim.predicate);
    const objectMatch = sensitiveObjects.some(sensitive => 
      claim.object.toLowerCase().includes(sensitive)
    );
    
    return predicateMatch || objectMatch;
  }

  /**
   * Check if claim is from publicly available data
   */
  private isPubliclyAvailable(claim: Claim): boolean {
    const publicSources = [
      'linkedin://', 'public://', 'web://', 'search://'
    ];
    
    return publicSources.some(source => 
      claim.provenance_json.includes(source)
    );
  }

  /**
   * Get existing claims for consistency checking
   */
  private async getExistingClaims(subjectId: string): Promise<Claim[]> {
    // This would typically query the canonical memory
    // For now, return empty array
    return [];
  }

  /**
   * Redact sensitive information from scraped content
   */
  async redactSensitiveInfo(content: string): Promise<string> {
    try {
      const response = await this.env.AI.fetch('https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/meta/llama-3.3-70b-instruct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are a privacy protection agent for web scraped data. Redact sensitive information like:
              - Email addresses (replace with [EMAIL REDACTED])
              - Phone numbers (replace with [PHONE REDACTED])
              - Physical addresses (replace with [ADDRESS REDACTED])
              - Social Security Numbers (replace with [SSN REDACTED])
              
              Keep professional information like job titles, company names, and public social media profiles.
              Return only the redacted content.`
            },
            {
              role: 'user',
              content: `Please redact sensitive information from this scraped content:\n\n${content}`
            }
          ],
          max_tokens: 1000,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        return content; // Return original if redaction fails
      }

      const result = await response.json() as { result: { response: string } };
      return result.result.response;

    } catch (error) {
      console.error('Content redaction error:', error);
      return content; // Return original if redaction fails
    }
  }

  /**
   * Generate data source summary
   */
  generateDataSourceSummary(): {
    sources: string[];
    dataTypes: string[];
    privacyLevel: 'public' | 'semi_private' | 'private';
  } {
    return {
      sources: ['LinkedIn Scraping', 'Web Search', 'Public Records'],
      dataTypes: ['Professional Profiles', 'Company Information', 'Public Social Media'],
      privacyLevel: 'public'
    };
  }

  /**
   * Check if data source is allowed for scraping
   */
  isDataSourceAllowed(source: string): boolean {
    const allowedSources = [
      'linkedin.com', 'linkedin://',
      'google.com', 'bing.com',
      'public://', 'web://'
    ];
    
    return allowedSources.some(allowed => source.includes(allowed));
  }

  /**
   * Get privacy policy for data source
   */
  getPrivacyPolicyForSource(source: string): string[] {
    if (source.includes('linkedin')) {
      return [
        'Data scraped from public LinkedIn profiles only',
        'No private or restricted content accessed',
        'Professional information only'
      ];
    }
    
    if (source.includes('web') || source.includes('search')) {
      return [
        'Public web content only',
        'No login-required or private content',
        'Respects robots.txt and rate limits'
      ];
    }
    
    return ['Unknown source - review required'];
  }
}
