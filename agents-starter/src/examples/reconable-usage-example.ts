/**
 * Reconable Lite+ Usage Examples
 * Demonstrates how to use the stateful, memory-first multi-agent pipeline
 */

import type { SubjectRun, Evidence, Claim, SynthesisResult } from '../memory/schema';

// Example: Complete analysis workflow
export async function runCompleteAnalysis(
  apiBaseUrl: string,
  subjectName: string,
  userId: string
): Promise<{
  run: SubjectRun;
  report: {
    run: SubjectRun;
    synthesis: SynthesisResult;
    evidence: Evidence[];
    claims: Claim[];
  };
}> {
  console.log(`🔍 Starting analysis for: ${subjectName}`);

  // Step 1: Start the analysis run
  const runResponse = await fetch(`${apiBaseUrl}/api/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subject: subjectName,
      userId: userId
    })
  });

  if (!runResponse.ok) {
    throw new Error(`Failed to start analysis: ${runResponse.status}`);
  }

  const run: SubjectRun = await runResponse.json();
  console.log(`✅ Analysis started with ID: ${run.id}`);

  // Step 2: Poll for completion
  let completed = false;
  let attempts = 0;
  const maxAttempts = 30; // 5 minutes max

  while (!completed && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
    
    const statusResponse = await fetch(`${apiBaseUrl}/api/run/${run.id}/status`);
    if (!statusResponse.ok) {
      throw new Error(`Failed to check status: ${statusResponse.status}`);
    }

    const currentRun: SubjectRun = await statusResponse.json();
    console.log(`📊 Status: ${currentRun.status} (${currentRun.evidence_count} evidence, ${currentRun.claims_count} claims)`);

    if (currentRun.status === 'completed') {
      completed = true;
    } else if (currentRun.status === 'error') {
      throw new Error(`Analysis failed: ${currentRun.error_message}`);
    }

    attempts++;
  }

  if (!completed) {
    throw new Error('Analysis timed out');
  }

  // Step 3: Get the final report
  const reportResponse = await fetch(`${apiBaseUrl}/api/run/${run.id}/report`);
  if (!reportResponse.ok) {
    throw new Error(`Failed to get report: ${reportResponse.status}`);
  }

  const report = await reportResponse.json();
  console.log(`🎉 Analysis completed! Generated report with ${report.claims.length} claims`);

  return { run, report };
}

// Example: LinkedIn OAuth flow
export async function performLinkedInOAuth(apiBaseUrl: string, userId: string): Promise<string> {
  console.log(`🔐 Starting LinkedIn OAuth for user: ${userId}`);

  // Step 1: Get OAuth URL
  const oauthUrl = `${apiBaseUrl}/oauth/linkedin/start?userId=${encodeURIComponent(userId)}`;
  console.log(`📱 Please visit: ${oauthUrl}`);
  console.log('After authorization, you will be redirected back with consent confirmation.');

  return oauthUrl;
}

// Example: Check user session and consent
export async function checkUserConsent(apiBaseUrl: string, userId: string): Promise<{
  hasLinkedInConsent: boolean;
  consentSummary: {
    granted: string[];
    required: string[];
    status: 'full' | 'partial' | 'none';
  };
}> {
  const response = await fetch(`${apiBaseUrl}/api/me?userId=${encodeURIComponent(userId)}`);
  
  if (!response.ok) {
    throw new Error(`Failed to get user session: ${response.status}`);
  }

  const { session, consentSummary } = await response.json();
  
  return {
    hasLinkedInConsent: session?.consent_flags?.linkedin_profile || false,
    consentSummary
  };
}

// Example: Revoke LinkedIn access
export async function revokeLinkedInAccess(apiBaseUrl: string, userId: string): Promise<void> {
  console.log(`🚫 Revoking LinkedIn access for user: ${userId}`);

  const response = await fetch(`${apiBaseUrl}/api/revoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId })
  });

  if (!response.ok) {
    throw new Error(`Failed to revoke access: ${response.status}`);
  }

  console.log('✅ LinkedIn access revoked successfully');
}

// Example: Analyze multiple subjects
export async function analyzeMultipleSubjects(
  apiBaseUrl: string,
  subjects: string[],
  userId: string
): Promise<Array<{ subject: string; report: any }>> {
  console.log(`🔍 Analyzing ${subjects.length} subjects...`);

  const results = [];

  for (const subject of subjects) {
    try {
      console.log(`\n📋 Analyzing: ${subject}`);
      const { report } = await runCompleteAnalysis(apiBaseUrl, subject, userId);
      
      results.push({
        subject,
        report: {
          summary: report.synthesis.summary,
          keyRoles: report.synthesis.key_roles,
          confidenceScore: report.synthesis.confidence_score,
          evidenceCount: report.evidence.length,
          claimsCount: report.claims.length
        }
      });

      console.log(`✅ Completed: ${subject}`);
    } catch (error) {
      console.error(`❌ Failed to analyze ${subject}:`, error);
      results.push({
        subject,
        report: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }

  return results;
}

// Example: Monitor analysis progress
export async function monitorAnalysisProgress(
  apiBaseUrl: string,
  runId: string,
  onUpdate: (run: SubjectRun) => void
): Promise<SubjectRun> {
  console.log(`👀 Monitoring analysis progress: ${runId}`);

  let completed = false;
  let attempts = 0;
  const maxAttempts = 30;

  while (!completed && attempts < maxAttempts) {
    const response = await fetch(`${apiBaseUrl}/api/run/${runId}/status`);
    
    if (!response.ok) {
      throw new Error(`Failed to check status: ${response.status}`);
    }

    const run: SubjectRun = await response.json();
    onUpdate(run);

    if (run.status === 'completed') {
      completed = true;
      return run;
    } else if (run.status === 'error') {
      throw new Error(`Analysis failed: ${run.error_message}`);
    }

    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    attempts++;
  }

  throw new Error('Analysis monitoring timed out');
}

// Example: Batch analysis with progress tracking
export async function batchAnalysisWithProgress(
  apiBaseUrl: string,
  subjects: string[],
  userId: string,
  onProgress: (completed: number, total: number, current: string) => void
): Promise<Array<{ subject: string; success: boolean; result?: any; error?: string }>> {
  const results = [];
  let completed = 0;

  for (const subject of subjects) {
    onProgress(completed, subjects.length, subject);
    
    try {
      const { report } = await runCompleteAnalysis(apiBaseUrl, subject, userId);
      results.push({
        subject,
        success: true,
        result: {
          summary: report.synthesis.summary,
          confidenceScore: report.synthesis.confidence_score,
          evidenceCount: report.evidence.length,
          claimsCount: report.claims.length
        }
      });
    } catch (error) {
      results.push({
        subject,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    completed++;
  }

  onProgress(completed, subjects.length, 'Complete');
  return results;
}

// Example: Custom analysis with specific sources
export async function customAnalysis(
  apiBaseUrl: string,
  subjectName: string,
  userId: string,
  options: {
    includeLinkedIn?: boolean;
    includeWebSearch?: boolean;
    customSources?: string[];
  } = {}
): Promise<any> {
  console.log(`🎯 Custom analysis for: ${subjectName}`);
  console.log(`Options:`, options);

  // This would require extending the API to accept custom options
  // For now, we'll use the standard analysis
  return await runCompleteAnalysis(apiBaseUrl, subjectName, userId);
}

// Example: Export analysis results
export function exportAnalysisResults(
  results: Array<{ subject: string; report: any }>,
  format: 'json' | 'csv' | 'html' = 'json'
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(results, null, 2);
    
    case 'csv':
      const headers = ['Subject', 'Summary', 'Key Roles', 'Confidence Score', 'Evidence Count', 'Claims Count'];
      const rows = results.map(r => [
        r.subject,
        r.report.summary || '',
        (r.report.keyRoles || []).join('; '),
        r.report.confidenceScore || 0,
        r.report.evidenceCount || 0,
        r.report.claimsCount || 0
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    
    case 'html':
      return `
        <!DOCTYPE html>
        <html>
        <head><title>Reconable Lite+ Analysis Results</title></head>
        <body>
          <h1>Analysis Results</h1>
          ${results.map(r => `
            <div style="border: 1px solid #ccc; margin: 10px; padding: 15px;">
              <h2>${r.subject}</h2>
              <p><strong>Summary:</strong> ${r.report.summary || 'N/A'}</p>
              <p><strong>Key Roles:</strong> ${(r.report.keyRoles || []).join(', ') || 'N/A'}</p>
              <p><strong>Confidence:</strong> ${r.report.confidenceScore || 0}</p>
              <p><strong>Evidence:</strong> ${r.report.evidenceCount || 0} sources</p>
              <p><strong>Claims:</strong> ${r.report.claimsCount || 0} verified facts</p>
            </div>
          `).join('')}
        </body>
        </html>
      `;
    
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

// Example: Integration with external systems
export class ReconableClient {
  constructor(private apiBaseUrl: string) {}

  async analyzeSubject(subject: string, userId: string): Promise<any> {
    return await runCompleteAnalysis(this.apiBaseUrl, subject, userId);
  }

  async getLinkedInAuthUrl(userId: string): Promise<string> {
    return await performLinkedInOAuth(this.apiBaseUrl, userId);
  }

  async checkConsent(userId: string): Promise<any> {
    return await checkUserConsent(this.apiBaseUrl, userId);
  }

  async revokeAccess(userId: string): Promise<void> {
    return await revokeLinkedInAccess(this.apiBaseUrl, userId);
  }

  async batchAnalyze(subjects: string[], userId: string): Promise<any[]> {
    return await analyzeMultipleSubjects(this.apiBaseUrl, subjects, userId);
  }
}

// Example usage
export async function exampleUsage() {
  const apiBaseUrl = 'https://reconable-lite-plus.temberlane195.workers.dev';
  const userId = 'user123';
  const subject = 'John Smith';

  try {
    // Check if user has LinkedIn consent
    const consent = await checkUserConsent(apiBaseUrl, userId);
    console.log('Consent status:', consent);

    if (!consent.hasLinkedInConsent) {
      console.log('LinkedIn consent required. Please authorize first.');
      const authUrl = await performLinkedInOAuth(apiBaseUrl, userId);
      console.log('Visit:', authUrl);
      return;
    }

    // Run analysis
    const { run, report } = await runCompleteAnalysis(apiBaseUrl, subject, userId);
    
    console.log('Analysis completed!');
    console.log('Summary:', report.synthesis.summary);
    console.log('Key Roles:', report.synthesis.key_roles);
    console.log('Confidence Score:', report.synthesis.confidence_score);

  } catch (error) {
    console.error('Analysis failed:', error);
  }
}
