/**
 * Subject Orchestrator Durable Object for Reconable Lite+
 * Manages the state machine for evidence collection and analysis
 */

import { DurableObject } from 'cloudflare:workers';
import type { SubjectRun, Evidence, Claim, UserSession, SynthesisResult } from '../memory/schema';
import { CanonicalMemory } from '../memory/canonical';
import { VectorMemory } from '../memory/vector';
import { HarvesterAgent } from './harvester';
import { ComplianceAgent } from './compliance';
import { createExtractionPrompt } from '../prompts/extraction';
import { createSynthesisPrompt } from '../prompts/synthesis';

interface Env {
  AI: Fetcher;
  BROWSER_RENDERING: Fetcher;
  DB: D1Database;
  VECTORIZE_INDEX: VectorizeIndex;
}

export class SubjectOrchestrator extends DurableObject<Env> {
  private canonicalMemory: CanonicalMemory;
  private vectorMemory: VectorMemory;
  private harvesterAgent: HarvesterAgent;
  private complianceAgent: ComplianceAgent;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.canonicalMemory = new CanonicalMemory(env.DB);
    this.vectorMemory = new VectorMemory(env.VECTORIZE_INDEX);
    this.harvesterAgent = new HarvesterAgent(ctx, env);
    this.complianceAgent = new ComplianceAgent(ctx, env);
  }

  /**
   * Start a new subject analysis run
   */
  async startRun(subjectName: string, inputType: 'linkedin' | 'search' = 'search', maxApiCalls: number = 5): Promise<SubjectRun> {
    try {
      // Create new run
      const run = await this.canonicalMemory.createSubjectRun({
        subject_name: subjectName,
        user_id: 'web-scraping-user', // Fixed user for web scraping
        status: 'intake',
        evidence_count: 0,
        claims_count: 0
      });

      // Store input type and API limits in the run context
      await this.ctx.storage.put('inputType', inputType);
      await this.ctx.storage.put('maxApiCalls', maxApiCalls);

      // Start the state machine
      this.ctx.waitUntil(this.executeStateMachine(run.id));

      return run;

    } catch (error) {
      console.error('Failed to start run:', error);
      throw error;
    }
  }

  /**
   * Get run status
   */
  async getRunStatus(runId: string): Promise<SubjectRun | null> {
    return await this.canonicalMemory.getSubjectRun(runId);
  }

  /**
   * Get run report
   */
  async getRunReport(runId: string): Promise<{
    run: SubjectRun;
    synthesis: SynthesisResult;
    evidence: Evidence[];
    claims: Claim[];
  } | null> {
    const run = await this.canonicalMemory.getSubjectRun(runId);
    if (!run) return null;

    const evidence = await this.canonicalMemory.getEvidenceBySubject(run.subject_name);
    const claims = await this.canonicalMemory.getClaimsBySubject(run.subject_name);

    console.log(`[ORCHESTRATOR] Generating report for ${run.subject_name}: ${evidence.length} evidence, ${claims.length} claims`);

    // Web scraping assumes public data consent
    const consentFlags = {
      linkedin_profile: true, // Public web scraping
      linkedin_email: false
    };

    // Generate synthesis using raw evidence data (contains full Brightdata JSON)
    const synthesis = await this.generateSynthesis(run.subject_name, evidence, claims, consentFlags);

    return {
      run,
      synthesis,
      evidence,
      claims
    };
  }

  /**
   * Execute the state machine
   */
  private async executeStateMachine(runId: string): Promise<void> {
    try {
      let run = await this.canonicalMemory.getSubjectRun(runId);
      if (!run) return;

      // INTAKE - Record subject and consent flags
      await this.updateRunStatus(runId, 'discover');
      run = await this.canonicalMemory.getSubjectRun(runId)!;

      // DISCOVER - Find sources
      await this.updateRunStatus(runId, 'fetch');
      run = await this.canonicalMemory.getSubjectRun(runId)!;

      // FETCH - Collect evidence using web scraping
      const inputType = await this.ctx.storage.get('inputType') as 'linkedin' | 'search' || 'search';
      const maxApiCalls = await this.ctx.storage.get('maxApiCalls') as number || 5;
      const evidence = await this.harvestEvidence(run.subject_name, ['web', 'linkedin'], inputType, maxApiCalls);
      await this.canonicalMemory.updateSubjectRunStatus(runId, 'normalize', evidence.length);
      run = await this.canonicalMemory.getSubjectRun(runId)!;

      // NORMALIZE - Process evidence
      await this.updateRunStatus(runId, 'extract');
      run = await this.canonicalMemory.getSubjectRun(runId)!;

      // EXTRACT - Extract claims from evidence
      const claims = await this.extractClaimsFromEvidence(evidence);
      await this.canonicalMemory.updateSubjectRunStatus(runId, 'verify', undefined, claims.length);
      run = await this.canonicalMemory.getSubjectRun(runId)!;

      // VERIFY - Verify claims with compliance agent
      const verifiedClaims = await this.verifyClaims(claims);
      await this.updateRunStatus(runId, 'upsert');
      run = await this.canonicalMemory.getSubjectRun(runId)!;

      // UPSERT - Store in memory systems
      await this.upsertClaimsAndEvidence(verifiedClaims, evidence);
      await this.updateRunStatus(runId, 'synthesize');
      run = await this.canonicalMemory.getSubjectRun(runId)!;

      // SYNTHESIZE - Generate report
      await this.updateRunStatus(runId, 'publish');
      run = await this.canonicalMemory.getSubjectRun(runId)!;

      // PUBLISH - Mark as completed
      await this.updateRunStatus(runId, 'completed');

    } catch (error) {
      console.error('State machine execution error:', error);
      await this.canonicalMemory.updateSubjectRunStatus(
        runId, 
        'error', 
        undefined, 
        undefined, 
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Harvest evidence from various sources using web scraping
   */
  private async harvestEvidence(subjectName: string, sources: string[], inputType: 'linkedin' | 'search' = 'search', maxApiCalls: number = 5): Promise<Evidence[]> {
    return await this.harvesterAgent.harvestEvidence(subjectName, sources, inputType, maxApiCalls);
  }

  /**
   * Extract claims from evidence using AI
   */
  private async extractClaimsFromEvidence(evidence: Evidence[]): Promise<Claim[]> {
    const claims: Claim[] = [];

    for (const ev of evidence) {
      try {
        // Check if already extracted
        if (ev.extraction) {
          // Convert extraction to claims
          for (const claimData of ev.extraction.claims) {
            const claim: Claim = {
              id: `claim_${crypto.randomUUID()}`,
              subject_id: ev.subject_id,
              predicate: claimData.predicate,
              object: claimData.object,
              confidence: claimData.confidence,
              first_seen_at: new Date().toISOString(),
              last_verified_at: new Date().toISOString(),
              provenance_json: JSON.stringify({
                source: ev.source_url,
                evidence_id: ev.id,
                extracted_at: new Date().toISOString()
              }),
              policy_tags: 'extracted:ai'
            };
            claims.push(claim);
          }
          continue;
        }

        // Extract using AI
        const extractionPrompt = createExtractionPrompt({
          subject: ev.subject_id,
          evidence: ev.content_text,
          source_url: ev.source_url
        });

        const response = await this.env.AI.fetch('https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/meta/llama-3.3-70b-instruct', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content: 'You are a precise information extraction agent. Return only valid JSON matching the specified format.'
              },
              {
                role: 'user',
                content: extractionPrompt
              }
            ],
            max_tokens: 1000,
            temperature: 0.1
          })
        });

        if (!response.ok) {
          console.error(`Extraction failed for evidence ${ev.id}: ${response.status}`);
          continue;
        }

        const result = await response.json() as { result: { response: string } };
        const extraction = JSON.parse(result.result.response);

        // Update evidence with extraction
        ev.extraction = extraction;
        await this.canonicalMemory.createEvidence(ev);

        // Convert to claims
        for (const claimData of extraction.claims) {
          const claim: Claim = {
            id: `claim_${crypto.randomUUID()}`,
            subject_id: ev.subject_id,
            predicate: claimData.predicate,
            object: claimData.object,
            confidence: claimData.confidence,
            first_seen_at: new Date().toISOString(),
            last_verified_at: new Date().toISOString(),
            provenance_json: JSON.stringify({
              source: ev.source_url,
              evidence_id: ev.id,
              extracted_at: new Date().toISOString()
            }),
            policy_tags: 'extracted:ai'
          };
          claims.push(claim);
        }

      } catch (error) {
        console.error(`Failed to extract claims from evidence ${ev.id}:`, error);
      }
    }

    return claims;
  }

  /**
   * Verify claims with compliance agent
   */
  private async verifyClaims(claims: Claim[]): Promise<Claim[]> {
    const verifiedClaims: Claim[] = [];

    for (const claim of claims) {
      try {
        const verification = await this.complianceAgent.verifyClaim(claim);
        
        if (verification.approved) {
          // Update claim with policy tags
          claim.policy_tags = verification.policy_tags.join(',');
          verifiedClaims.push(claim);
        } else {
          console.log(`Claim rejected: ${verification.reason}`);
        }

      } catch (error) {
        console.error(`Failed to verify claim ${claim.id}:`, error);
      }
    }

    return verifiedClaims;
  }

  /**
   * Store claims and evidence in memory systems
   */
  private async upsertClaimsAndEvidence(claims: Claim[], evidence: Evidence[]): Promise<void> {
    console.log(`[ORCHESTRATOR] Storing ${evidence.length} evidence and ${claims.length} claims`);

    // FIRST: Store evidence in D1 canonical memory (this is critical!)
    for (const ev of evidence) {
      try {
        await this.canonicalMemory.createEvidence(ev);
        console.log(`[ORCHESTRATOR] Stored evidence ${ev.id} in D1`);
      } catch (error) {
        console.error(`[ORCHESTRATOR] Failed to store evidence ${ev.id} in D1:`, error);
      }
    }

    // Store claims in canonical memory
    for (const claim of claims) {
      try {
        await this.canonicalMemory.createClaim(claim);
        console.log(`[ORCHESTRATOR] Stored claim ${claim.id} in D1`);
      } catch (error) {
        console.error(`[ORCHESTRATOR] Failed to store claim ${claim.id} in D1:`, error);
      }
    }

    // OPTIONAL: Try to store in vector memory (if this fails, we still have D1 data)
    for (const ev of evidence) {
      try {
        const embedding = await this.vectorMemory.generateEmbedding(ev.content_text, this.env.AI);
        await this.vectorMemory.storeEvidence(ev, embedding, this.env.AI);
        console.log(`[ORCHESTRATOR] Stored evidence ${ev.id} in vector memory`);
      } catch (error) {
        console.error(`[ORCHESTRATOR] Failed to store evidence ${ev.id} in vector memory (non-critical):`, error);
        // Continue - D1 storage is what matters for synthesis
      }
    }

    // Store claims with vector embeddings (optional)
    for (const claim of claims) {
      try {
        const claimText = `${claim.predicate} ${claim.object}`;
        const embedding = await this.vectorMemory.generateEmbedding(claimText, this.env.AI);
        await this.vectorMemory.storeClaim(claim, embedding, this.env.AI);
        console.log(`[ORCHESTRATOR] Stored claim ${claim.id} in vector memory`);
      } catch (error) {
        console.error(`[ORCHESTRATOR] Failed to store claim ${claim.id} in vector memory (non-critical):`, error);
        // Continue - D1 storage is what matters
      }
    }
  }

  /**
   * Generate synthesis report using raw evidence data
   */
  private async generateSynthesis(
    subjectName: string,
    evidence: Evidence[],
    claims: Claim[],
    consentFlags: { linkedin_profile: boolean; linkedin_email: boolean }
  ): Promise<SynthesisResult> {
    try {
      console.log(`[ORCHESTRATOR] Generating synthesis for ${subjectName} with ${evidence.length} evidence items`);

      // Extract LinkedIn profile data from evidence (Brightdata JSON)
      let linkedInData: any = null;
      for (const ev of evidence) {
        if (ev.content_type === 'json' && ev.content_text) {
          try {
            const parsed = JSON.parse(ev.content_text);
            if (parsed.linkedin_id || parsed.name) {
              linkedInData = parsed;
              console.log(`[ORCHESTRATOR] Found LinkedIn data for ${parsed.name}`);
              break;
            }
          } catch (e) {
            console.error('[ORCHESTRATOR] Failed to parse evidence JSON:', e);
          }
        }
      }

      // Build a rich synthesis prompt with actual data
      let synthesisInput = `Subject: ${subjectName}\n\nEvidence Count: ${evidence.length}\n\n`;
      
      if (linkedInData) {
        synthesisInput += `LinkedIn Profile Data:\n`;
        synthesisInput += `- Name: ${linkedInData.name || 'Unknown'}\n`;
        synthesisInput += `- Location: ${linkedInData.city || ''}, ${linkedInData.country_code || ''}\n`;
        synthesisInput += `- Current Company: ${linkedInData.current_company_name || 'Unknown'}\n`;
        synthesisInput += `- About: ${linkedInData.about || 'No description'}\n`;
        synthesisInput += `- Followers: ${linkedInData.followers || 0}\n`;
        synthesisInput += `- Connections: ${linkedInData.connections || 0}\n`;
        
        if (linkedInData.experience && linkedInData.experience.length > 0) {
          synthesisInput += `\nExperience (${linkedInData.experience.length} positions):\n`;
          linkedInData.experience.slice(0, 5).forEach((exp: any, idx: number) => {
            synthesisInput += `  ${idx + 1}. ${exp.title || exp.company || 'Unknown'}\n`;
          });
        }
        
        if (linkedInData.education && linkedInData.education.length > 0) {
          synthesisInput += `\nEducation (${linkedInData.education.length} institutions):\n`;
          linkedInData.education.forEach((edu: any, idx: number) => {
            synthesisInput += `  ${idx + 1}. ${edu.title || 'Unknown'} (${edu.start_year || ''}-${edu.end_year || ''})\n`;
          });
        }

        if (linkedInData.honors_and_awards && linkedInData.honors_and_awards.length > 0) {
          synthesisInput += `\nHonors & Awards: ${linkedInData.honors_and_awards.length}\n`;
        }
      }

      if (claims.length > 0) {
        synthesisInput += `\nVerified Claims (${claims.length}):\n`;
        claims.slice(0, 10).forEach((claim, idx) => {
          synthesisInput += `  ${idx + 1}. ${claim.predicate}: ${claim.object} (confidence: ${claim.confidence})\n`;
        });
      }

      const prompt = `You are an expert LinkedIn profile analyst. Generate a comprehensive report with LinkedIn profile analysis.

${synthesisInput}

Return a JSON object with this exact structure:
{
  "summary": "2-3 sentence professional summary",
  "key_roles": ["Current Role at Company", "Previous Role", "Education"],
  "timeline": [{"date": "Year", "event": "Event description", "source": "LinkedIn Profile"}],
  "consent_badges": ["LinkedIn Profile", "Public Data"],
  "confidence_score": 0.85,
  "linkedin_profile_analysis": {
    "completeness_score": 0.75,
    "profile_strength": "Strong|Good|Moderate|Weak",
    "keyword_optimization": {
      "score": 0.80,
      "identified_keywords": ["keyword1", "keyword2"],
      "missing_keywords": ["suggestion1", "suggestion2"]
    },
    "engagement_metrics": {
      "followers": ${linkedInData?.followers || 0},
      "connections": ${linkedInData?.connections || 0},
      "traction_rating": "High|Medium|Low",
      "analysis": "Brief analysis of engagement"
    },
    "profile_sections": {
      "headline": {"present": true, "quality": "Strong|Good|Weak", "feedback": "Feedback"},
      "about": {"present": true, "quality": "Strong|Good|Weak", "feedback": "Feedback"},
      "experience": {"count": ${linkedInData?.experience?.length || 0}, "quality": "Strong|Good|Weak", "feedback": "Feedback"},
      "education": {"count": ${linkedInData?.education?.length || 0}, "quality": "Strong|Good|Weak", "feedback": "Feedback"}
    },
    "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
  }
}

Analyze the profile thoroughly and provide specific, actionable feedback.`;

      console.log('[ORCHESTRATOR] Calling Workers AI for synthesis...');

      const response = await (this.env.AI as any).run('@cf/meta/llama-3.1-70b-instruct', {
        messages: [
          {
            role: 'system',
            content: 'You are a LinkedIn profile analyst. Return only valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.3
      });

      console.log('[ORCHESTRATOR] Workers AI response:', JSON.stringify(response).substring(0, 200));

      if (!response || !response.response) {
        throw new Error('Invalid response from Workers AI');
      }

      const parsed = JSON.parse(response.response) as SynthesisResult;
      console.log('[ORCHESTRATOR] Successfully generated synthesis');
      return parsed;

    } catch (error) {
      console.error('[ORCHESTRATOR] Synthesis generation error:', error);
      console.log('[ORCHESTRATOR] Using enhanced fallback with full Brightdata analysis');
      
      // Build a COMPREHENSIVE fallback using actual Brightdata data
      const linkedInData = evidence.length > 0 ? (() => {
        try {
          return JSON.parse(evidence[0].content_text);
        } catch {
          return null;
        }
      })() : null;

      if (!linkedInData) {
        return {
          summary: `Analysis of ${subjectName} completed with ${claims.length} verified claims from ${evidence.length} sources.`,
          key_roles: ['Professional'],
          timeline: [],
          consent_badges: ['Public Data'],
          confidence_score: 0.5
        };
      }

      // Build comprehensive summary
      const name = linkedInData.name || subjectName;
      const company = linkedInData.current_company_name || 'Unknown Company';
      const location = linkedInData.city || 'Unknown location';
      const about = linkedInData.about || 'No description available';
      const followers = linkedInData.followers || 0;
      const connections = linkedInData.connections || 0;
      const experienceCount = linkedInData.experience?.length || 0;
      const educationCount = linkedInData.education?.length || 0;

      const summary = `${name} is currently ${company !== 'Unknown Company' ? `at ${company}` : 'a professional'} based in ${location}. ${about.substring(0, 200)}${about.length > 200 ? '...' : ''} With ${followers.toLocaleString()} followers and ${connections} connections on LinkedIn, ${name} demonstrates ${followers > 10000 ? 'significant' : followers > 1000 ? 'strong' : 'growing'} professional influence. The profile includes ${experienceCount} work ${experienceCount === 1 ? 'experience' : 'experiences'} and ${educationCount} educational ${educationCount === 1 ? 'credential' : 'credentials'}.`;

      // Build key roles
      const keyRoles: string[] = [];
      if (company !== 'Unknown Company') {
        keyRoles.push(`Current: ${company}`);
      }
      if (linkedInData.experience && linkedInData.experience.length > 0) {
        linkedInData.experience.slice(0, 3).forEach((exp: any) => {
          if (exp.company && exp.company !== company) {
            keyRoles.push(`${exp.title || 'Position'} at ${exp.company}`);
          }
        });
      }
      if (linkedInData.education && linkedInData.education.length > 0) {
        keyRoles.push(`Education: ${linkedInData.education[0].title || 'Degree'}`);
      }

      // Build timeline
      const timeline: any[] = [];
      if (linkedInData.experience && linkedInData.experience.length > 0) {
        linkedInData.experience.slice(0, 5).forEach((exp: any) => {
          timeline.push({
            date: exp.duration || exp.start_year || 'Recent',
            event: `${exp.title || 'Position'} at ${exp.company || 'Company'}`,
            source: 'LinkedIn Profile'
          });
        });
      }
      if (linkedInData.education && linkedInData.education.length > 0) {
        linkedInData.education.forEach((edu: any) => {
          timeline.push({
            date: `${edu.start_year || ''}-${edu.end_year || ''}`.trim() || 'Past',
            event: `${edu.title || 'Education'} at ${edu.title || 'Institution'}`,
            source: 'LinkedIn Profile'
          });
        });
      }

      // Build LinkedIn profile analysis
      const completenessScore = Math.min(
        (linkedInData.about ? 0.2 : 0) +
        (linkedInData.experience?.length > 0 ? 0.3 : 0) +
        (linkedInData.education?.length > 0 ? 0.2 : 0) +
        (linkedInData.followers > 0 ? 0.15 : 0) +
        (linkedInData.connections > 0 ? 0.15 : 0),
        1.0
      );

      const profileStrength = completenessScore > 0.8 ? 'Strong' : 
                            completenessScore > 0.6 ? 'Good' : 
                            completenessScore > 0.4 ? 'Moderate' : 'Weak';

      const tractionRating = followers > 10000 ? 'High' : followers > 1000 ? 'Medium' : 'Low';

      return {
        summary,
        key_roles: keyRoles.length > 0 ? keyRoles : ['Professional'],
        timeline: timeline.length > 0 ? timeline : [],
        consent_badges: ['LinkedIn Profile', 'Public Data', 'Web Scraping'],
        confidence_score: 0.90,
        linkedin_profile_analysis: {
          completeness_score: completenessScore,
          profile_strength: profileStrength,
          keyword_optimization: {
            score: about ? 0.75 : 0.3,
            identified_keywords: about ? about.split(' ').filter(w => w.length > 5).slice(0, 5) : [],
            missing_keywords: ['Industry-specific terms', 'Technical skills', 'Leadership qualities']
          },
          engagement_metrics: {
            followers: followers,
            connections: connections,
            traction_rating: tractionRating,
            analysis: `With ${followers.toLocaleString()} followers and ${connections} connections, this profile shows ${tractionRating.toLowerCase()} engagement. ${followers > 10000 ? 'Strong thought leadership presence.' : followers > 1000 ? 'Good professional network.' : 'Growing professional presence.'}`
          },
          profile_sections: {
            headline: {
              present: !!linkedInData.current_company_name,
              quality: linkedInData.current_company_name ? 'Good' : 'Weak',
              feedback: linkedInData.current_company_name ? `Clear current position at ${linkedInData.current_company_name}` : 'Add a compelling headline'
            },
            about: {
              present: !!linkedInData.about,
              quality: linkedInData.about && linkedInData.about.length > 100 ? 'Strong' : linkedInData.about ? 'Good' : 'Weak',
              feedback: linkedInData.about ? 'Well-written professional summary' : 'Add an about section to highlight expertise'
            },
            experience: {
              count: experienceCount,
              quality: experienceCount > 3 ? 'Strong' : experienceCount > 0 ? 'Good' : 'Weak',
              feedback: experienceCount > 3 ? 'Comprehensive work history documented' : experienceCount > 0 ? 'Good experience listed' : 'Add work experience'
            },
            education: {
              count: educationCount,
              quality: educationCount > 0 ? 'Good' : 'Weak',
              feedback: educationCount > 0 ? `${educationCount} educational ${educationCount === 1 ? 'credential' : 'credentials'} listed` : 'Add education details'
            }
          },
          recommendations: [
            experienceCount === 0 ? 'Add detailed work experience with accomplishments and metrics' : 'Expand experience descriptions with specific achievements',
            followers < 1000 ? 'Increase visibility by sharing industry insights and engaging with content' : 'Continue building thought leadership through regular content',
            !linkedInData.about || linkedInData.about.length < 100 ? 'Enhance the about section with a compelling narrative and key skills' : 'Keep profile information current and relevant',
            connections < 500 ? 'Grow your network by connecting with industry peers and colleagues' : 'Leverage your strong network for collaborations and opportunities',
            'Request recommendations from colleagues to build credibility'
          ]
        }
      };
    }
  }

  /**
   * Update run status
   */
  private async updateRunStatus(runId: string, status: SubjectRun['status']): Promise<void> {
    await this.canonicalMemory.updateSubjectRunStatus(runId, status);
  }

}
