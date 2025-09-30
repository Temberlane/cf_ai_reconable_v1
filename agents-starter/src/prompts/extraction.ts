/**
 * AI prompts for evidence extraction
 * Uses structured JSON output for consistent data extraction
 */

export interface ExtractionInput {
  subject: string;
  evidence: string;
  source_url: string;
}

export interface ExtractionOutput {
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

export const EXTRACTION_PROMPT = `You are an expert information extraction agent. Your task is to analyze evidence about a specific subject and extract structured information in JSON format.

## Instructions:
1. Extract entities (people, organizations, locations, etc.) mentioned in the evidence
2. Extract factual claims about the subject with high precision
3. Assign confidence scores (0.0 to 1.0) based on clarity and specificity
4. Use standard predicate formats (e.g., "works_at", "studied_at", "located_in", "has_title")
5. Be conservative - only extract information that is clearly stated
6. **IMPORTANT**: If the evidence is in JSON format (like LinkedIn profile data), parse it and extract ALL relevant information including name, position, company, location, education, experience, etc.

## Input Format:
{
  "subject": "Person Name",
  "evidence": "plain text evidence OR JSON structured data",
  "source_url": "source identifier"
}

## Output Format:
{
  "entities": [
    {
      "type": "person|organization|location|title|degree|skill",
      "name": "Entity Name",
      "confidence": 0.95
    }
  ],
  "claims": [
    {
      "predicate": "works_at|studied_at|located_in|has_title|graduated_from|has_skill",
      "object": "Specific Value",
      "confidence": 0.9
    }
  ]
}

## Examples:

Example 1 - Plain Text Evidence:
Input:
{
  "subject": "John Smith",
  "evidence": "John Smith is a Senior Software Engineer at Google in Mountain View, California. He graduated from Stanford University with a Master's in Computer Science in 2020.",
  "source_url": "linkedin://me"
}

Output:
{
  "entities": [
    {"type": "person", "name": "John Smith", "confidence": 1.0},
    {"type": "organization", "name": "Google", "confidence": 1.0},
    {"type": "location", "name": "Mountain View, California", "confidence": 1.0},
    {"type": "organization", "name": "Stanford University", "confidence": 1.0},
    {"type": "degree", "name": "Master's in Computer Science", "confidence": 1.0}
  ],
  "claims": [
    {"predicate": "works_at", "object": "Google", "confidence": 1.0},
    {"predicate": "has_title", "object": "Senior Software Engineer", "confidence": 1.0},
    {"predicate": "located_in", "object": "Mountain View, California", "confidence": 1.0},
    {"predicate": "graduated_from", "object": "Stanford University", "confidence": 1.0},
    {"predicate": "has_degree", "object": "Master's in Computer Science", "confidence": 1.0},
    {"predicate": "graduation_year", "object": "2020", "confidence": 1.0}
  ]
}

Example 2 - JSON Evidence (LinkedIn Profile Data):
Input:
{
  "subject": "https://www.linkedin.com/in/john-smith",
  "evidence": "{\\"name\\":\\"John Smith\\",\\"position\\":\\"Senior Software Engineer\\",\\"current_company_name\\":\\"Google\\",\\"city\\":\\"Mountain View\\",\\"country_code\\":\\"US\\",\\"about\\":\\"Passionate about building scalable systems\\",\\"experience\\":[{\\"title\\":\\"Senior Software Engineer\\",\\"company\\":\\"Google\\",\\"duration\\":\\"2020-Present\\"}],\\"education\\":[{\\"degree\\":\\"Master's in Computer Science\\",\\"institution\\":\\"Stanford University\\",\\"duration\\":\\"2018-2020\\"}],\\"followers\\":1500,\\"connections\\":800}",
  "source_url": "https://www.linkedin.com/in/john-smith"
}

Output:
{
  "entities": [
    {"type": "person", "name": "John Smith", "confidence": 1.0},
    {"type": "organization", "name": "Google", "confidence": 1.0},
    {"type": "title", "name": "Senior Software Engineer", "confidence": 1.0},
    {"type": "location", "name": "Mountain View, US", "confidence": 1.0},
    {"type": "organization", "name": "Stanford University", "confidence": 1.0},
    {"type": "degree", "name": "Master's in Computer Science", "confidence": 1.0}
  ],
  "claims": [
    {"predicate": "has_name", "object": "John Smith", "confidence": 1.0},
    {"predicate": "works_at", "object": "Google", "confidence": 1.0},
    {"predicate": "has_title", "object": "Senior Software Engineer", "confidence": 1.0},
    {"predicate": "located_in", "object": "Mountain View, US", "confidence": 1.0},
    {"predicate": "has_about", "object": "Passionate about building scalable systems", "confidence": 1.0},
    {"predicate": "graduated_from", "object": "Stanford University", "confidence": 1.0},
    {"predicate": "has_degree", "object": "Master's in Computer Science", "confidence": 1.0},
    {"predicate": "has_followers", "object": "1500", "confidence": 1.0},
    {"predicate": "has_connections", "object": "800", "confidence": 1.0}
  ]
}

## Important Notes:
- Only extract information explicitly stated in the evidence
- Use consistent predicate names from the standard set
- Confidence scores should reflect certainty (1.0 = completely certain, 0.5 = somewhat uncertain)
- If information is ambiguous or unclear, either omit it or use a lower confidence score
- Always return valid JSON format`;

export const EXTRACTION_SYSTEM_PROMPT = `You are a precise information extraction agent. Extract structured data from evidence about a subject. Return only valid JSON matching the specified format. Be conservative and accurate.`;

export function createExtractionPrompt(input: ExtractionInput): string {
  return `${EXTRACTION_PROMPT}

## Current Task:
Extract information from the following evidence about "${input.subject}":

**Evidence:**
${input.evidence}

**Source:** ${input.source_url}

Please analyze this evidence and return the extracted information in the specified JSON format.`;
}
