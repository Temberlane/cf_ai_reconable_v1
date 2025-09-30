/**
 * Canonical memory management using D1 database
 * Handles CRUD operations for claims, evidence, and subject runs
 */

import type { Claim, Evidence, SubjectRun, UserSession } from './schema';

export class CanonicalMemory {
  constructor(private db: D1Database) {}

  // Claims management
  async createClaim(claim: Omit<Claim, 'id'>): Promise<Claim> {
    const id = `claim_${crypto.randomUUID()}`;
    const newClaim: Claim = {
      ...claim,
      id
    };

    await this.db.prepare(`
      INSERT INTO claims (id, subject_id, predicate, object, confidence, first_seen_at, last_verified_at, provenance_json, policy_tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      newClaim.id,
      newClaim.subject_id,
      newClaim.predicate,
      newClaim.object,
      newClaim.confidence,
      newClaim.first_seen_at,
      newClaim.last_verified_at,
      newClaim.provenance_json,
      newClaim.policy_tags
    ).run();

    return newClaim;
  }

  async getClaimsBySubject(subjectId: string): Promise<Claim[]> {
    const result = await this.db.prepare(`
      SELECT * FROM claims WHERE subject_id = ? ORDER BY last_verified_at DESC
    `).bind(subjectId).all();

    return result.results as Claim[];
  }

  async updateClaimVerification(claimId: string, verifiedAt: string): Promise<void> {
    await this.db.prepare(`
      UPDATE claims SET last_verified_at = ? WHERE id = ?
    `).bind(verifiedAt, claimId).run();
  }

  async deleteClaim(claimId: string): Promise<void> {
    await this.db.prepare(`
      DELETE FROM claims WHERE id = ?
    `).bind(claimId).run();
  }

  // Evidence management
  async createEvidence(evidence: Omit<Evidence, 'id'>): Promise<Evidence> {
    const id = `evid_${crypto.randomUUID()}`;
    const newEvidence: Evidence = {
      ...evidence,
      id
    };

    await this.db.prepare(`
      INSERT INTO evidence (id, subject_id, source_url, collected_at, content_text, content_type, hash, extraction_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      newEvidence.id,
      newEvidence.subject_id,
      newEvidence.source_url,
      newEvidence.collected_at,
      newEvidence.content_text,
      newEvidence.content_type,
      newEvidence.hash,
      newEvidence.extraction ? JSON.stringify(newEvidence.extraction) : null
    ).run();

    return newEvidence;
  }

  async getEvidenceByHash(hash: string): Promise<Evidence | null> {
    const result = await this.db.prepare(`
      SELECT * FROM evidence WHERE hash = ?
    `).bind(hash).first();

    if (!result) return null;

    return {
      ...result,
      extraction: result.extraction_json ? JSON.parse(result.extraction_json) : undefined
    } as Evidence;
  }

  async getEvidenceBySubject(subjectId: string): Promise<Evidence[]> {
    const result = await this.db.prepare(`
      SELECT * FROM evidence WHERE subject_id = ? ORDER BY collected_at DESC
    `).bind(subjectId).all();

    return result.results.map(row => ({
      ...row,
      extraction: row.extraction_json ? JSON.parse(row.extraction_json) : undefined
    })) as Evidence[];
  }

  // Subject runs management
  async createSubjectRun(run: Omit<SubjectRun, 'id' | 'created_at' | 'updated_at'>): Promise<SubjectRun> {
    const id = `run_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const newRun: SubjectRun = {
      ...run,
      id,
      created_at: now,
      updated_at: now
    };

    await this.db.prepare(`
      INSERT INTO subject_runs (id, subject_name, user_id, status, evidence_count, claims_count, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      newRun.id,
      newRun.subject_name,
      newRun.user_id,
      newRun.status,
      newRun.evidence_count,
      newRun.claims_count,
      newRun.error_message || null
    ).run();

    return newRun;
  }

  async getSubjectRun(runId: string): Promise<SubjectRun | null> {
    const result = await this.db.prepare(`
      SELECT * FROM subject_runs WHERE id = ?
    `).bind(runId).first();

    return result as SubjectRun | null;
  }

  async updateSubjectRunStatus(runId: string, status: SubjectRun['status'], evidenceCount?: number, claimsCount?: number, errorMessage?: string): Promise<void> {
    const updates = ['status = ?', 'updated_at = ?'];
    const values = [status, new Date().toISOString()];

    if (evidenceCount !== undefined) {
      updates.push('evidence_count = ?');
      values.push(evidenceCount);
    }

    if (claimsCount !== undefined) {
      updates.push('claims_count = ?');
      values.push(claimsCount);
    }

    if (errorMessage !== undefined) {
      updates.push('error_message = ?');
      values.push(errorMessage);
    }

    values.push(runId);

    await this.db.prepare(`
      UPDATE subject_runs SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();
  }

  async getUserRuns(userId: string): Promise<SubjectRun[]> {
    const result = await this.db.prepare(`
      SELECT * FROM subject_runs WHERE user_id = ? ORDER BY created_at DESC
    `).bind(userId).all();

    return result.results as SubjectRun[];
  }

  // User sessions management
  async createUserSession(session: Omit<UserSession, 'created_at' | 'updated_at'>): Promise<UserSession> {
    const now = new Date().toISOString();
    const newSession: UserSession = {
      ...session,
      created_at: now,
      updated_at: now
    };

    await this.db.prepare(`
      INSERT INTO user_sessions (user_id, linkedin_tokens_json, consent_flags_json)
      VALUES (?, ?, ?)
    `).bind(
      newSession.user_id,
      newSession.linkedin_tokens ? JSON.stringify(newSession.linkedin_tokens) : null,
      JSON.stringify(newSession.consent_flags)
    ).run();

    return newSession;
  }

  async getUserSession(userId: string): Promise<UserSession | null> {
    const result = await this.db.prepare(`
      SELECT * FROM user_sessions WHERE user_id = ?
    `).bind(userId).first();

    if (!result) return null;

    return {
      ...result,
      linkedin_tokens: result.linkedin_tokens_json ? JSON.parse(result.linkedin_tokens_json) : undefined,
      consent_flags: JSON.parse(result.consent_flags_json)
    } as UserSession;
  }

  async updateUserSession(userId: string, updates: Partial<Pick<UserSession, 'linkedin_tokens' | 'consent_flags'>>): Promise<void> {
    const setClauses = ['updated_at = ?'];
    const values = [new Date().toISOString()];

    if (updates.linkedin_tokens !== undefined) {
      setClauses.push('linkedin_tokens_json = ?');
      values.push(JSON.stringify(updates.linkedin_tokens));
    }

    if (updates.consent_flags !== undefined) {
      setClauses.push('consent_flags_json = ?');
      values.push(JSON.stringify(updates.consent_flags));
    }

    values.push(userId);

    await this.db.prepare(`
      UPDATE user_sessions SET ${setClauses.join(', ')} WHERE user_id = ?
    `).bind(...values).run();
  }
}
