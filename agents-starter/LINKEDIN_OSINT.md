# LinkedIn OSINT Tools

This document describes the LinkedIn OSINT (Open Source Intelligence) tools available in the agents-starter project. These tools enable automated LinkedIn profile research and analysis for intelligence gathering purposes.

## Overview

The LinkedIn OSINT tools provide comprehensive capabilities for:
- Searching LinkedIn profiles by name, location, and company
- Analyzing detailed profile information
- Researching company pages
- Analyzing professional networks and connections

## Available Tools

### 1. Search LinkedIn Profile
**Tool Name:** `searchLinkedInProfile`

Searches for LinkedIn profiles based on a person's name and optional filters.

**Parameters:**
- `name` (required): Full name of the person to search for
- `location` (optional): Location to narrow down search results
- `company` (optional): Company name to narrow down search results

**Example Usage:**
```typescript
// Search for a person by name only
await searchLinkedInProfile({ name: "John Smith" });

// Search with location filter
await searchLinkedInProfile({ 
  name: "John Smith", 
  location: "San Francisco, CA" 
});

// Search with company filter
await searchLinkedInProfile({ 
  name: "John Smith", 
  company: "Google" 
});
```

**Returns:**
- Array of matching profiles with basic information
- Profile URLs for further analysis
- Mutual connection counts (when available)

### 2. Analyze LinkedIn Profile
**Tool Name:** `analyzeLinkedInProfile`

Performs detailed OSINT analysis on a specific LinkedIn profile URL.

**Parameters:**
- `profileUrl` (required): The LinkedIn profile URL to analyze
- `includeConnections` (optional): Whether to analyze mutual connections
- `includePosts` (optional): Whether to analyze recent posts and activity

**Example Usage:**
```typescript
await analyzeLinkedInProfile({
  profileUrl: "https://www.linkedin.com/in/johnsmith",
  includeConnections: true,
  includePosts: true
});
```

**Returns:**
- Complete profile information including:
  - Personal details (name, headline, location)
  - Professional experience
  - Education history
  - Skills and endorsements
  - Connection count
  - About section
  - Recent activity (if requested)

### 3. Research LinkedIn Company
**Tool Name:** `researchLinkedInCompany`

Researches a company's LinkedIn page for OSINT analysis.

**Parameters:**
- `companyName` (required): Name of the company to research
- `includeEmployees` (optional): Whether to analyze employee profiles
- `includeRecentPosts` (optional): Whether to analyze recent company posts

**Example Usage:**
```typescript
await researchLinkedInCompany({
  companyName: "Acme Corporation",
  includeEmployees: true,
  includeRecentPosts: true
});
```

**Returns:**
- Company information including:
  - Industry and size
  - Location and website
  - Company description
  - Employee information (if requested)
  - Recent company posts (if requested)

### 4. Analyze LinkedIn Network
**Tool Name:** `analyzeLinkedInNetwork`

Analyzes the LinkedIn network and connections of a specific profile.

**Parameters:**
- `profileUrl` (required): The LinkedIn profile URL to analyze
- `maxConnections` (optional): Maximum number of connections to analyze (default: 50)
- `includeMutualConnections` (optional): Whether to find mutual connections

**Example Usage:**
```typescript
await analyzeLinkedInNetwork({
  profileUrl: "https://www.linkedin.com/in/johnsmith",
  maxConnections: 100,
  includeMutualConnections: true
});
```

**Returns:**
- List of connections with their basic information
- Mutual connection analysis
- Network mapping data

## Technical Implementation

### Browser Rendering API
The tools use Cloudflare's Browser Rendering API with Puppeteer for web scraping. This provides:
- Headless browser automation
- JavaScript execution in the target environment
- Anti-detection capabilities
- Reliable data extraction

### Data Extraction
The tools extract data using CSS selectors and DOM manipulation:
- Profile information from LinkedIn's structured data
- Experience and education from timeline sections
- Skills from endorsement sections
- Network information from connection lists

### Error Handling
All tools include comprehensive error handling:
- Network timeout management
- Element not found handling
- Rate limiting detection
- Graceful degradation

## Configuration

### Required Bindings
The LinkedIn OSINT tools require the following Cloudflare bindings:

```jsonc
{
  "browser": [
    {
      "binding": "BROWSER_RENDERING"
    }
  ]
}
```

### Dependencies
Required npm packages:
```json
{
  "@cloudflare/puppeteer": "^1.0.0"
}
```

## Usage Examples

### Basic Profile Search
```typescript
// Search for profiles
const searchResults = await searchLinkedInProfile({
  name: "Jane Doe",
  location: "New York, NY"
});

// Analyze the first result
if (searchResults.results.length > 0) {
  const profile = await analyzeLinkedInProfile({
    profileUrl: searchResults.results[0].profileUrl,
    includeConnections: true
  });
}
```

### Company Research
```typescript
// Research a company
const company = await researchLinkedInCompany({
  companyName: "Tech Corp",
  includeEmployees: true
});

// Analyze employee networks
for (const employee of company.employees) {
  const network = await analyzeLinkedInNetwork({
    profileUrl: employee.profileUrl,
    maxConnections: 25
  });
}
```

### Network Analysis
```typescript
// Analyze a target's network
const network = await analyzeLinkedInNetwork({
  profileUrl: "https://www.linkedin.com/in/target",
  maxConnections: 100,
  includeMutualConnections: true
});

// Find common connections
const mutualConnections = network.mutualConnections;
```

## Security Considerations

### Rate Limiting
- Tools implement delays between requests
- Respect LinkedIn's rate limits
- Use randomized user agents

### Data Privacy
- Only extract publicly available information
- Respect LinkedIn's Terms of Service
- Implement data retention policies

### Legal Compliance
- Ensure compliance with local laws
- Obtain proper authorization for OSINT activities
- Document data collection purposes

## Troubleshooting

### Common Issues

1. **Profile Not Found**
   - Verify the profile URL is correct
   - Check if the profile is public
   - Ensure the profile exists

2. **Rate Limiting**
   - Implement delays between requests
   - Use different user agents
   - Consider using multiple IP addresses

3. **Element Not Found**
   - LinkedIn may have changed their HTML structure
   - Update CSS selectors as needed
   - Implement fallback extraction methods

### Debug Mode
Enable debug logging by setting the environment variable:
```bash
DEBUG=linkedin-osint
```

## Future Enhancements

- Support for private profile analysis (with authentication)
- Advanced network visualization
- Integration with other OSINT tools
- Automated report generation
- Machine learning for pattern recognition

## Support

For issues or questions regarding the LinkedIn OSINT tools:
1. Check the troubleshooting section
2. Review the error logs
3. Verify configuration settings
4. Contact the development team

## Legal Disclaimer

These tools are for educational and authorized research purposes only. Users must:
- Comply with LinkedIn's Terms of Service
- Follow applicable laws and regulations
- Obtain proper authorization before use
- Respect privacy and data protection requirements

The developers are not responsible for misuse of these tools.
