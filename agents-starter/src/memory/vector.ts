/**
 * Vector memory management using Vectorize
 * Handles semantic search and similarity operations
 */

import type { Evidence, Claim } from './schema';

export class VectorMemory {
  constructor(private vectorize: Vectorize) {}

  /**
   * Generate embedding for text content using Workers AI
   */
  async generateEmbedding(text: string, ai: any): Promise<number[]> {
    try {
      console.log('[VECTOR] Generating embedding for text (length:', text.length, 'chars)');
      
      // Workers AI binding - use .run() method
      const response = await ai.run('@cf/baai/bge-base-en-v1.5', {
        text: [text.substring(0, 5000)] // Limit to 5000 chars to avoid token limits
      });

      console.log('[VECTOR] Embedding response:', JSON.stringify(response).substring(0, 200));

      // Response format: { data: [[vector values]] }
      if (!response || !response.data || !response.data[0]) {
        throw new Error('Invalid response from Workers AI');
      }

      console.log('[VECTOR] Successfully generated embedding with', response.data[0].length, 'dimensions');
      return response.data[0];
    } catch (error) {
      console.error('[VECTOR] Failed to generate embedding:', error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store evidence with vector embedding
   */
  async storeEvidence(evidence: Evidence, embedding: number[], ai: Fetcher): Promise<void> {
    const vectorId = `evidence_${evidence.id}`;
    
    await this.vectorize.upsert([{
      id: vectorId,
      values: embedding,
      metadata: {
        subject_id: evidence.subject_id,
        source_url: evidence.source_url,
        content_type: evidence.content_type,
        collected_at: evidence.collected_at,
        hash: evidence.hash
      }
    }]);
  }

  /**
   * Store claim with vector embedding
   */
  async storeClaim(claim: Claim, embedding: number[], ai: Fetcher): Promise<void> {
    const vectorId = `claim_${claim.id}`;
    
    await this.vectorize.upsert([{
      id: vectorId,
      values: embedding,
      metadata: {
        subject_id: claim.subject_id,
        predicate: claim.predicate,
        object: claim.object,
        confidence: claim.confidence,
        policy_tags: claim.policy_tags
      }
    }]);
  }

  /**
   * Search for similar evidence by content
   */
  async searchSimilarEvidence(query: string, subjectId: string, limit: number = 10, ai: Fetcher): Promise<Array<{ id: string; score: number; metadata: any }>> {
    const queryEmbedding = await this.generateEmbedding(query, ai);
    
    const results = await this.vectorize.query(queryEmbedding, {
      topK: limit,
      filter: {
        subject_id: { $eq: subjectId }
      },
      returnMetadata: true
    });

    return results.matches.map(match => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata
    }));
  }

  /**
   * Search for similar claims by predicate-object relationship
   */
  async searchSimilarClaims(query: string, subjectId: string, limit: number = 10, ai: Fetcher): Promise<Array<{ id: string; score: number; metadata: any }>> {
    const queryEmbedding = await this.generateEmbedding(query, ai);
    
    const results = await this.vectorize.query(queryEmbedding, {
      topK: limit,
      filter: {
        subject_id: { $eq: subjectId }
      },
      returnMetadata: true
    });

    return results.matches.map(match => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata
    }));
  }

  /**
   * Find duplicate evidence by content similarity
   */
  async findDuplicateEvidence(evidence: Evidence, threshold: number = 0.95, ai: Fetcher): Promise<Array<{ id: string; score: number; metadata: any }>> {
    const contentEmbedding = await this.generateEmbedding(evidence.content_text, ai);
    
    const results = await this.vectorize.query(contentEmbedding, {
      topK: 5,
      filter: {
        subject_id: { $eq: evidence.subject_id },
        content_type: { $eq: evidence.content_type }
      },
      returnMetadata: true
    });

    return results.matches
      .filter(match => match.score >= threshold && match.id !== `evidence_${evidence.id}`)
      .map(match => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata
      }));
  }

  /**
   * Find conflicting claims by semantic similarity
   */
  async findConflictingClaims(claim: Claim, threshold: number = 0.8, ai: Fetcher): Promise<Array<{ id: string; score: number; metadata: any }>> {
    const claimText = `${claim.predicate} ${claim.object}`;
    const claimEmbedding = await this.generateEmbedding(claimText, ai);
    
    const results = await this.vectorize.query(claimEmbedding, {
      topK: 10,
      filter: {
        subject_id: { $eq: claim.subject_id },
        predicate: { $eq: claim.predicate }
      },
      returnMetadata: true
    });

    return results.matches
      .filter(match => match.score >= threshold && match.id !== `claim_${claim.id}`)
      .map(match => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata
      }));
  }

  /**
   * Get semantic summary of all evidence for a subject
   */
  async getSubjectSummary(subjectId: string, ai: Fetcher): Promise<string> {
    // Get all evidence for the subject
    const evidenceQuery = `Summary of all evidence for subject ${subjectId}`;
    const evidenceResults = await this.searchSimilarEvidence(evidenceQuery, subjectId, 20, ai);
    
    // Get all claims for the subject
    const claimsQuery = `Summary of all claims for subject ${subjectId}`;
    const claimsResults = await this.searchSimilarClaims(claimsQuery, subjectId, 20, ai);
    
    // Generate summary using AI
    const summaryPrompt = `
      Based on the following evidence and claims for subject ${subjectId}, provide a comprehensive summary:
      
      Evidence:
      ${evidenceResults.map(r => `- ${r.metadata.source_url}: ${r.metadata.content_type}`).join('\n')}
      
      Claims:
      ${claimsResults.map(r => `- ${r.metadata.predicate}: ${r.metadata.object} (confidence: ${r.metadata.confidence})`).join('\n')}
      
      Provide a structured summary highlighting key facts, relationships, and confidence levels.
    `;

    const response = await ai.fetch('https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/meta/llama-3.3-70b-instruct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: summaryPrompt
          }
        ],
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to generate summary: ${response.status}`);
    }

    const result = await response.json() as { result: { response: string } };
    return result.result.response;
  }
}
