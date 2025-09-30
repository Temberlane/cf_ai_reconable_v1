/**
 * Data schemas for Reconable Lite+ memory system
 * Defines types for Evidence, Claims, and other core data structures
 */

export interface Evidence {
  id: string;
  subject_id: string;
  source_url: string;
  collected_at: string;
  content_text: string;
  content_type: 'json' | 'html' | 'text';
  hash: string;
  extraction?: {
    entities: Array<{
      type: string;
      name: string;
      confidence?: number;
    }>;
    claims: Array<{
      predicate: string;
      object: string;
      confidence: number;
    }>;
  };
}

export interface Claim {
  id: string;
  subject_id: string;
  predicate: string;
  object: string;
  confidence: number;
  first_seen_at: string;
  last_verified_at: string;
  provenance_json: string;
  policy_tags: string;
}


export interface SubjectRun {
  id: string;
  subject_name: string;
  user_id: string;
  status: 'intake' | 'discover' | 'fetch' | 'normalize' | 'extract' | 'verify' | 'upsert' | 'synthesize' | 'publish' | 'error' | 'completed';
  evidence_count: number;
  claims_count: number;
  created_at: string;
  updated_at: string;
  error_message?: string;
}

export interface ExtractionResult {
  entities: Array<{
    type: string;
    name: string;
    confidence?: number;
  }>;
  claims: Array<{
    predicate: string;
    object: string;
    confidence: number;
  }>;
}

export interface VerificationResult {
  approved: boolean;
  redacted_content?: string;
  policy_tags: string[];
  reason?: string;
}

export interface SynthesisResult {
  summary: string;
  key_roles: string[];
  timeline: Array<{
    date: string;
    event: string;
    source: string;
  }>;
  consent_badges: string[];
  confidence_score: number;
}

