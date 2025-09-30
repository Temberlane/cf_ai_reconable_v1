/**
 * Example usage of LinkedIn OSINT tools
 * This demonstrates how to use the LinkedIn OSINT capabilities in your agent
 */

import { LinkedInOSINT } from '../linkedin-osint';

// Example environment interface
interface Env {
  BROWSER_RENDERING: Fetcher;
}

/**
 * Example: Search for a person and analyze their profile
 */
export async function searchAndAnalyzePerson(env: Env, name: string, location?: string) {
  const linkedinOSINT = new LinkedInOSINT(env);
  
  try {
    await linkedinOSINT.initialize();
    
    // Step 1: Search for the person
    console.log(`Searching for: ${name}${location ? ` in ${location}` : ''}`);
    const searchResults = await linkedinOSINT.searchProfiles(name, location);
    
    if (searchResults.length === 0) {
      console.log('No profiles found');
      return null;
    }
    
    console.log(`Found ${searchResults.length} profiles`);
    
    // Step 2: Analyze the first result
    const firstProfile = searchResults[0];
    console.log(`Analyzing profile: ${firstProfile.name}`);
    
    const profileAnalysis = await linkedinOSINT.analyzeProfile(
      firstProfile.profileUrl,
      true, // include connections
      true  // include posts
    );
    
    console.log('Profile Analysis Complete:');
    console.log(`Name: ${profileAnalysis.name}`);
    console.log(`Headline: ${profileAnalysis.headline}`);
    console.log(`Location: ${profileAnalysis.location}`);
    console.log(`Current Company: ${profileAnalysis.currentCompany}`);
    console.log(`Connections: ${profileAnalysis.connections}`);
    console.log(`Experience Entries: ${profileAnalysis.experience.length}`);
    console.log(`Education Entries: ${profileAnalysis.education.length}`);
    console.log(`Skills: ${profileAnalysis.skills.length}`);
    
    return {
      searchResults,
      profileAnalysis
    };
    
  } catch (error) {
    console.error('Error in search and analysis:', error);
    throw error;
  } finally {
    await linkedinOSINT.close();
  }
}

/**
 * Example: Research a company and its employees
 */
export async function researchCompanyAndEmployees(env: Env, companyName: string) {
  const linkedinOSINT = new LinkedInOSINT(env);
  
  try {
    await linkedinOSINT.initialize();
    
    // Step 1: Research the company
    console.log(`Researching company: ${companyName}`);
    const company = await linkedinOSINT.researchCompany(companyName, true, true);
    
    console.log('Company Research Complete:');
    console.log(`Name: ${company.name}`);
    console.log(`Industry: ${company.industry}`);
    console.log(`Size: ${company.size}`);
    console.log(`Location: ${company.location}`);
    console.log(`Website: ${company.website}`);
    
    return company;
    
  } catch (error) {
    console.error('Error in company research:', error);
    throw error;
  } finally {
    await linkedinOSINT.close();
  }
}

/**
 * Example: Analyze a professional network
 */
export async function analyzeProfessionalNetwork(env: Env, profileUrl: string) {
  const linkedinOSINT = new LinkedInOSINT(env);
  
  try {
    await linkedinOSINT.initialize();
    
    // Step 1: Analyze the profile first
    console.log(`Analyzing profile: ${profileUrl}`);
    const profile = await linkedinOSINT.analyzeProfile(profileUrl, false, false);
    
    // Step 2: Analyze their network
    console.log(`Analyzing network for: ${profile.name}`);
    const network = await linkedinOSINT.analyzeNetwork(profileUrl, 50, true);
    
    console.log('Network Analysis Complete:');
    console.log(`Profile: ${profile.name} (${profile.headline})`);
    console.log(`Total Connections Analyzed: ${network.connections.length}`);
    console.log(`Mutual Connections: ${network.mutualConnections.length}`);
    
    // Analyze connection patterns
    const locations = network.connections.map(conn => conn.location).filter(Boolean);
    const uniqueLocations = [...new Set(locations)];
    console.log(`Connection Locations: ${uniqueLocations.join(', ')}`);
    
    const companies = network.connections.map(conn => conn.headline).filter(Boolean);
    const uniqueCompanies = [...new Set(companies)];
    console.log(`Connection Companies: ${uniqueCompanies.slice(0, 5).join(', ')}...`);
    
    return {
      profile,
      network
    };
    
  } catch (error) {
    console.error('Error in network analysis:', error);
    throw error;
  } finally {
    await linkedinOSINT.close();
  }
}

/**
 * Example: Complete OSINT investigation workflow
 */
export async function completeOSINTInvestigation(
  env: Env, 
  targetName: string, 
  targetLocation?: string,
  targetCompany?: string
) {
  const linkedinOSINT = new LinkedInOSINT(env);
  
  try {
    await linkedinOSINT.initialize();
    
    console.log('=== Starting Complete OSINT Investigation ===');
    console.log(`Target: ${targetName}${targetLocation ? ` in ${targetLocation}` : ''}${targetCompany ? ` at ${targetCompany}` : ''}`);
    
    // Step 1: Search for the target
    const searchResults = await linkedinOSINT.searchProfiles(targetName, targetLocation, targetCompany);
    
    if (searchResults.length === 0) {
      console.log('No profiles found for the target');
      return null;
    }
    
    console.log(`Found ${searchResults.length} potential matches`);
    
    // Step 2: Analyze the most likely match
    const targetProfile = searchResults[0];
    const profileAnalysis = await linkedinOSINT.analyzeProfile(
      targetProfile.profileUrl,
      true,
      true
    );
    
    // Step 3: Research their current company
    let companyInfo = null;
    if (profileAnalysis.currentCompany) {
      try {
        companyInfo = await linkedinOSINT.researchCompany(profileAnalysis.currentCompany, true, true);
      } catch (error) {
        console.log(`Could not research company: ${profileAnalysis.currentCompany}`);
      }
    }
    
    // Step 4: Analyze their network
    const networkAnalysis = await linkedinOSINT.analyzeNetwork(
      targetProfile.profileUrl,
      100,
      true
    );
    
    // Step 5: Compile OSINT report
    const osintReport = {
      target: {
        name: profileAnalysis.name,
        headline: profileAnalysis.headline,
        location: profileAnalysis.location,
        profileUrl: profileAnalysis.profileUrl,
        currentCompany: profileAnalysis.currentCompany
      },
      profile: {
        about: profileAnalysis.about,
        experience: profileAnalysis.experience,
        education: profileAnalysis.education,
        skills: profileAnalysis.skills,
        connections: profileAnalysis.connections
      },
      company: companyInfo,
      network: {
        totalConnections: networkAnalysis.connections.length,
        mutualConnections: networkAnalysis.mutualConnections.length,
        topLocations: [...new Set(networkAnalysis.connections.map(c => c.location).filter(Boolean))],
        topCompanies: [...new Set(networkAnalysis.connections.map(c => c.headline).filter(Boolean))]
      },
      investigation: {
        timestamp: new Date().toISOString(),
        searchCriteria: {
          name: targetName,
          location: targetLocation,
          company: targetCompany
        }
      }
    };
    
    console.log('=== OSINT Investigation Complete ===');
    console.log(`Target: ${osintReport.target.name}`);
    console.log(`Current Role: ${osintReport.target.headline}`);
    console.log(`Location: ${osintReport.target.location}`);
    console.log(`Company: ${osintReport.target.currentCompany}`);
    console.log(`Connections: ${osintReport.profile.connections}`);
    console.log(`Network Analyzed: ${osintReport.network.totalConnections} connections`);
    
    return osintReport;
    
  } catch (error) {
    console.error('Error in OSINT investigation:', error);
    throw error;
  } finally {
    await linkedinOSINT.close();
  }
}

// Example usage in an agent
export async function exampleAgentUsage(env: Env) {
  try {
    // Example 1: Search and analyze a person
    const personResult = await searchAndAnalyzePerson(env, "John Smith", "San Francisco, CA");
    
    // Example 2: Research a company
    const companyResult = await researchCompanyAndEmployees(env, "Google");
    
    // Example 3: Analyze a network
    const networkResult = await analyzeProfessionalNetwork(env, "https://www.linkedin.com/in/johnsmith");
    
    // Example 4: Complete investigation
    const investigationResult = await completeOSINTInvestigation(
      env, 
      "Jane Doe", 
      "New York, NY", 
      "Microsoft"
    );
    
    return {
      personResult,
      companyResult,
      networkResult,
      investigationResult
    };
    
  } catch (error) {
    console.error('Error in example usage:', error);
    throw error;
  }
}
