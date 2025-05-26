const natural = require('natural');
const compromise = require('compromise');

/**
 * AI-powered scoring system for matching candidates to job requirements
 * Supports both resume text and LinkedIn profile data
 */
class CandidateScoring {
  constructor() {
    this.stemmer = natural.PorterStemmer;
    this.tokenizer = new natural.WordTokenizer();
    this.tfidf = new natural.TfIdf();
    
    // Weights for different scoring criteria
    this.weights = {
      skills: 0.30,
      experience: 0.25,
      education: 0.15,
      keywords: 0.20,
      location: 0.05,
      industry: 0.05
    };

    // Experience level mappings
    this.experienceLevels = {
      'entry': { min: 0, max: 2, keywords: ['junior', 'entry', 'associate', 'trainee', 'graduate', 'fresher'] },
      'mid': { min: 2, max: 5, keywords: ['mid', 'senior', 'specialist', 'analyst', 'consultant'] },
      'senior': { min: 5, max: 10, keywords: ['senior', 'lead', 'principal', 'manager', 'supervisor'] },
      'executive': { min: 8, max: 50, keywords: ['director', 'vp', 'ceo', 'cto', 'executive', 'head'] }
    };

    // Common skill categories for tech roles
    this.skillCategories = {
      programming: ['javascript', 'python', 'java', 'c++', 'react', 'node', 'angular', 'vue'],
      database: ['mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'sql'],
      cloud: ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform'],
      tools: ['git', 'jenkins', 'jira', 'confluence', 'slack', 'figma'],
      methodologies: ['agile', 'scrum', 'kanban', 'devops', 'ci/cd', 'tdd']
    };
  }

  /**
   * Main scoring function
   * @param {Object} candidate - Candidate data (resume or LinkedIn)
   * @param {Object} requirement - Job requirement data
   * @returns {Object} Detailed scoring result
   */
  async scoreCandidate(candidate, requirement) {
    try {
      const scores = {
        skills: this.calculateSkillsScore(candidate, requirement),
        experience: this.calculateExperienceScore(candidate, requirement),
        education: this.calculateEducationScore(candidate, requirement),
        keywords: this.calculateKeywordScore(candidate, requirement),
        location: this.calculateLocationScore(candidate, requirement),
        industry: this.calculateIndustryScore(candidate, requirement)
      };

      const overallScore = this.calculateOverallScore(scores);
      const reasoning = this.generateReasoning(scores, candidate, requirement);
      const recommendations = this.generateRecommendations(scores, candidate, requirement);

      return {
        overallScore,
        categoryScores: scores,
        reasoning,
        recommendations,
        matchLevel: this.getMatchLevel(overallScore),
        timestamp: new Date().toISOString(),
        confidence: this.calculateConfidence(scores)
      };
    } catch (error) {
      console.error('Error in scoreCandidate:', error);
      throw new Error(`Scoring failed: ${error.message}`);
    }
  }

  /**
   * Calculate skills matching score
   */
  calculateSkillsScore(candidate, requirement) {
    const candidateSkills = this.extractSkills(candidate);
    const requiredSkills = this.extractSkills(requirement);
    
    if (requiredSkills.length === 0) return { score: 50, details: 'No specific skills required' };

    let matches = 0;
    let partialMatches = 0;
    const matchedSkills = [];
    const missingSkills = [];

    for (const reqSkill of requiredSkills) {
      const match = candidateSkills.find(candSkill => 
        this.areSkillsSimilar(candSkill, reqSkill)
      );
      
      if (match) {
        matches++;
        matchedSkills.push({ required: reqSkill, found: match });
      } else {
        // Check for partial matches (e.g., React vs ReactJS)
        const partialMatch = candidateSkills.find(candSkill => 
          this.areSkillsPartiallyMatched(candSkill, reqSkill)
        );
        
        if (partialMatch) {
          partialMatches++;
          matchedSkills.push({ required: reqSkill, found: partialMatch, partial: true });
        } else {
          missingSkills.push(reqSkill);
        }
      }
    }

    const score = Math.min(100, ((matches + partialMatches * 0.7) / requiredSkills.length) * 100);

    return {
      score: Math.round(score),
      matched: matchedSkills,
      missing: missingSkills,
      details: `${matches} exact matches, ${partialMatches} partial matches out of ${requiredSkills.length} required skills`
    };
  }

  /**
   * Calculate experience matching score
   */
  calculateExperienceScore(candidate, requirement) {
    const candidateExp = this.extractExperience(candidate);
    const requiredExp = this.extractRequiredExperience(requirement);

    if (!requiredExp.years && !requiredExp.level) {
      return { score: 50, details: 'No specific experience requirements' };
    }

    let score = 50;
    const factors = [];

    // Years of experience
    if (requiredExp.years) {
      if (candidateExp.years >= requiredExp.years) {
        const bonus = Math.min(20, (candidateExp.years - requiredExp.years) * 2);
        score += bonus;
        factors.push(`+${bonus} points for ${candidateExp.years} years experience (required: ${requiredExp.years})`);
      } else {
        const penalty = Math.min(30, (requiredExp.years - candidateExp.years) * 5);
        score -= penalty;
        factors.push(`-${penalty} points for insufficient experience (${candidateExp.years} vs ${requiredExp.years} required)`);
      }
    }

    // Experience level
    if (requiredExp.level && candidateExp.level) {
      const levelScore = this.compareLevels(candidateExp.level, requiredExp.level);
      score += levelScore;
      factors.push(`${levelScore > 0 ? '+' : ''}${levelScore} points for experience level match`);
    }

    // Relevant experience
    if (candidateExp.relevant && requiredExp.domain) {
      const relevantScore = this.calculateRelevantExperience(candidateExp.relevant, requiredExp.domain);
      score += relevantScore;
      factors.push(`+${relevantScore} points for relevant domain experience`);
    }

    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      candidateYears: candidateExp.years,
      requiredYears: requiredExp.years,
      candidateLevel: candidateExp.level,
      requiredLevel: requiredExp.level,
      details: factors.join(', ')
    };
  }

  /**
   * Calculate education matching score
   */
  calculateEducationScore(candidate, requirement) {
    const candidateEdu = this.extractEducation(candidate);
    const requiredEdu = this.extractRequiredEducation(requirement);

    if (!requiredEdu.degree && !requiredEdu.field) {
      return { score: 50, details: 'No specific education requirements' };
    }

    let score = 0;
    const factors = [];

    // Degree level matching
    if (requiredEdu.degree) {
      const degreeScore = this.compareDegrees(candidateEdu.degree, requiredEdu.degree);
      score += degreeScore;
      factors.push(`${degreeScore} points for degree level`);
    }

    // Field of study matching
    if (requiredEdu.field && candidateEdu.field) {
      const fieldScore = this.compareFields(candidateEdu.field, requiredEdu.field);
      score += fieldScore;
      factors.push(`${fieldScore} points for field of study`);
    }

    // Certifications bonus
    if (candidateEdu.certifications && candidateEdu.certifications.length > 0) {
      const certScore = Math.min(20, candidateEdu.certifications.length * 5);
      score += certScore;
      factors.push(`+${certScore} points for certifications`);
    }

    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      candidateDegree: candidateEdu.degree,
      requiredDegree: requiredEdu.degree,
      candidateField: candidateEdu.field,
      requiredField: requiredEdu.field,
      details: factors.join(', ')
    };
  }

  /**
   * Calculate keyword matching score using TF-IDF
   */
  calculateKeywordScore(candidate, requirement) {
    const candidateText = this.extractText(candidate);
    const requirementText = this.extractText(requirement);

    // Add documents to TF-IDF
    this.tfidf.addDocument(candidateText);
    this.tfidf.addDocument(requirementText);

    // Extract important terms from requirement
    const importantTerms = this.extractImportantTerms(requirementText);
    
    let totalScore = 0;
    const matchedTerms = [];
    const missingTerms = [];

    for (const term of importantTerms) {
      const candidateScore = this.tfidf.tfidf(term, 0);
      const requirementScore = this.tfidf.tfidf(term, 1);
      
      if (candidateScore > 0) {
        const termScore = Math.min(candidateScore / requirementScore, 1) * 100;
        totalScore += termScore;
        matchedTerms.push({ term, score: Math.round(termScore) });
      } else {
        missingTerms.push(term);
      }
    }

    const avgScore = importantTerms.length > 0 ? totalScore / importantTerms.length : 0;

    return {
      score: Math.round(avgScore),
      matchedTerms,
      missingTerms,
      details: `Matched ${matchedTerms.length} out of ${importantTerms.length} key terms`
    };
  }

  /**
   * Calculate location matching score
   */
  calculateLocationScore(candidate, requirement) {
    const candidateLocation = this.extractLocation(candidate);
    const requiredLocation = this.extractRequiredLocation(requirement);

    if (!requiredLocation || requiredLocation.remote) {
      return { score: 100, details: 'Remote work available or no location restriction' };
    }

    if (!candidateLocation) {
      return { score: 30, details: 'Candidate location not specified' };
    }

    const distance = this.calculateLocationDistance(candidateLocation, requiredLocation);
    
    let score = 100;
    if (distance > 50) score = 20;
    else if (distance > 25) score = 60;
    else if (distance > 10) score = 80;

    return {
      score,
      candidateLocation,
      requiredLocation,
      estimatedDistance: distance,
      details: `${distance}km from required location`
    };
  }

  /**
   * Calculate industry experience score
   */
  calculateIndustryScore(candidate, requirement) {
    const candidateIndustries = this.extractIndustries(candidate);
    const requiredIndustry = this.extractRequiredIndustry(requirement);

    if (!requiredIndustry) {
      return { score: 50, details: 'No specific industry requirement' };
    }

    const match = candidateIndustries.find(industry => 
      this.areIndustriesSimilar(industry, requiredIndustry)
    );

    if (match) {
      return { 
        score: 100, 
        matchedIndustry: match,
        details: `Experience in ${match} industry` 
      };
    }

    // Check for related industries
    const relatedScore = this.findRelatedIndustryScore(candidateIndustries, requiredIndustry);
    
    return {
      score: relatedScore,
      candidateIndustries,
      requiredIndustry,
      details: relatedScore > 30 ? 'Some related industry experience' : 'No relevant industry experience'
    };
  }

  /**
   * Calculate overall weighted score
   */
  calculateOverallScore(scores) {
    let totalScore = 0;
    
    for (const [category, weight] of Object.entries(this.weights)) {
      totalScore += scores[category].score * weight;
    }
    
    return Math.round(totalScore);
  }

  /**
   * Generate detailed reasoning for the score
   */
  generateReasoning(scores, candidate, requirement) {
    const reasoning = [];
    
    // Strengths
    const strengths = [];
    if (scores.skills.score >= 80) strengths.push('Strong skill match');
    if (scores.experience.score >= 80) strengths.push('Excellent experience level');
    if (scores.education.score >= 80) strengths.push('Strong educational background');
    if (scores.keywords.score >= 80) strengths.push('High keyword relevance');
    
    if (strengths.length > 0) {
      reasoning.push(`Strengths: ${strengths.join(', ')}`);
    }

    // Areas of concern
    const concerns = [];
    if (scores.skills.score < 50) concerns.push('Limited skill overlap');
    if (scores.experience.score < 50) concerns.push('Experience gap');
    if (scores.education.score < 50) concerns.push('Educational requirements not met');
    if (scores.location.score < 50) concerns.push('Location mismatch');
    
    if (concerns.length > 0) {
      reasoning.push(`Areas of concern: ${concerns.join(', ')}`);
    }

    // Key missing elements
    const missing = [];
    if (scores.skills.missing && scores.skills.missing.length > 0) {
      missing.push(`Missing key skills: ${scores.skills.missing.slice(0, 3).join(', ')}`);
    }
    
    if (missing.length > 0) {
      reasoning.push(missing.join(', '));
    }

    return reasoning.join(' | ');
  }

  /**
   * Generate recommendations for improvement
   */
  generateRecommendations(scores, candidate, requirement) {
    const recommendations = [];

    if (scores.skills.score < 70 && scores.skills.missing.length > 0) {
      recommendations.push({
        category: 'Skills',
        priority: 'High',
        suggestion: `Consider candidates with experience in: ${scores.skills.missing.slice(0, 3).join(', ')}`
      });
    }

    if (scores.experience.score < 60) {
      recommendations.push({
        category: 'Experience',
        priority: 'Medium',
        suggestion: 'Consider if experience requirements can be flexible or if training is available'
      });
    }

    if (scores.location.score < 50) {
      recommendations.push({
        category: 'Location',
        priority: 'Low',
        suggestion: 'Consider remote work options or relocation assistance'
      });
    }

    return recommendations;
  }

  /**
   * Determine match level based on overall score
   */
  getMatchLevel(score) {
    if (score >= 85) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 55) return 'Fair';
    if (score >= 40) return 'Poor';
    return 'Very Poor';
  }

  /**
   * Calculate confidence in the scoring
   */
  calculateConfidence(scores) {
    const dataAvailability = Object.values(scores).reduce((acc, score) => {
      return acc + (score.details !== 'No data available' ? 1 : 0);
    }, 0);
    
    return Math.round((dataAvailability / Object.keys(scores).length) * 100);
  }

  // Helper methods for text processing and extraction

  extractSkills(data) {
    const text = this.extractText(data).toLowerCase();
    const skills = new Set();
    
    // Extract from all skill categories
    Object.values(this.skillCategories).flat().forEach(skill => {
      if (text.includes(skill.toLowerCase())) {
        skills.add(skill);
      }
    });

    // Use NLP to find additional skills
    const doc = compromise(text);
    const entities = doc.match('#Technology').out('array');
    entities.forEach(entity => skills.add(entity.toLowerCase()));

    return Array.from(skills);
  }

  extractExperience(data) {
    const text = this.extractText(data);
    
    // Extract years of experience using regex
    const yearMatches = text.match(/(\d+)[\s\+]*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/gi);
    let years = 0;
    
    if (yearMatches) {
      years = Math.max(...yearMatches.map(match => parseInt(match.match(/\d+/)[0])));
    }

    // Determine experience level
    let level = 'entry';
    for (const [levelName, config] of Object.entries(this.experienceLevels)) {
      if (years >= config.min && years <= config.max) {
        level = levelName;
        break;
      }
      // Also check for level keywords
      if (config.keywords.some(keyword => text.toLowerCase().includes(keyword))) {
        level = levelName;
      }
    }

    return { years, level, relevant: this.extractRelevantExperience(text) };
  }

  extractEducation(data) {
    const text = this.extractText(data).toLowerCase();
    
    const degrees = {
      'phd': ['phd', 'ph.d', 'doctorate', 'doctoral'],
      'masters': ['masters', 'master', 'msc', 'm.sc', 'mba', 'm.b.a', 'ma', 'm.a'],
      'bachelors': ['bachelors', 'bachelor', 'bsc', 'b.sc', 'ba', 'b.a', 'be', 'b.e', 'btech', 'b.tech'],
      'associates': ['associates', 'associate', 'aa', 'as'],
      'diploma': ['diploma', 'certificate']
    };

    let degree = null;
    for (const [degreeType, keywords] of Object.entries(degrees)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        degree = degreeType;
        break;
      }
    }

    // Extract field of study
    const fields = ['computer science', 'engineering', 'business', 'marketing', 'finance', 'design'];
    const field = fields.find(f => text.includes(f)) || null;

    // Extract certifications (simple approach)
    const certifications = [];
    const certKeywords = ['certified', 'certification', 'aws', 'azure', 'google', 'microsoft', 'oracle'];
    certKeywords.forEach(cert => {
      if (text.includes(cert)) certifications.push(cert);
    });

    return { degree, field, certifications };
  }

  extractText(data) {
    if (typeof data === 'string') return data;
    if (data.text) return data.text;
    if (data.description) return data.description;
    if (data.summary) return data.summary;
    if (data.content) return data.content;
    
    // For LinkedIn data
    if (data.headline) return `${data.headline} ${data.summary || ''}`;
    
    // Concatenate various fields
    const fields = ['title', 'description', 'requirements', 'responsibilities', 'qualifications'];
    return fields.map(field => data[field] || '').join(' ');
  }

  extractImportantTerms(text) {
    const doc = compromise(text);
    const terms = new Set();
    
    // Extract nouns and proper nouns
    doc.nouns().out('array').forEach(noun => {
      if (noun.length > 2) terms.add(noun.toLowerCase());
    });
    
    // Extract technology terms
    doc.match('#Technology').out('array').forEach(tech => {
      terms.add(tech.toLowerCase());
    });

    return Array.from(terms).slice(0, 20); // Limit to top 20 terms
  }

  extractLocation(data) {
    if (data.location) return data.location;
    if (data.address) return data.address;
    
    const text = this.extractText(data);
    // Simple location extraction - in real implementation, use geocoding API
    const locationPattern = /(?:located in|based in|from)\s+([a-z\s,]+)/gi;
    const match = text.match(locationPattern);
    return match ? match[0].replace(/(?:located in|based in|from)\s+/gi, '').trim() : null;
  }

  extractIndustries(data) {
    const industries = [];
    const text = this.extractText(data).toLowerCase();
    
    const industryKeywords = {
      'technology': ['software', 'tech', 'it', 'computer', 'digital'],
      'finance': ['bank', 'financial', 'investment', 'trading'],
      'healthcare': ['healthcare', 'medical', 'pharmaceutical', 'hospital'],
      'education': ['education', 'teaching', 'academic', 'university'],
      'retail': ['retail', 'ecommerce', 'shopping', 'consumer']
    };

    for (const [industry, keywords] of Object.entries(industryKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        industries.push(industry);
      }
    }

    return industries;
  }

  // Helper methods for comparison and similarity

  areSkillsSimilar(skill1, skill2) {
    const s1 = skill1.toLowerCase().replace(/[^a-z0-9]/g, '');
    const s2 = skill2.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    return s1 === s2 || 
           s1.includes(s2) || 
           s2.includes(s1) ||
           natural.JaroWinklerDistance(s1, s2) > 0.85;
  }

  areSkillsPartiallyMatched(skill1, skill2) {
    const s1 = skill1.toLowerCase();
    const s2 = skill2.toLowerCase();
    
    return natural.JaroWinklerDistance(s1, s2) > 0.7;
  }

  compareLevels(candidateLevel, requiredLevel) {
    const levels = ['entry', 'mid', 'senior', 'executive'];
    const candIndex = levels.indexOf(candidateLevel);
    const reqIndex = levels.indexOf(requiredLevel);
    
    if (candIndex === reqIndex) return 20;
    if (candIndex > reqIndex) return 10; // Overqualified
    if (candIndex === reqIndex - 1) return 5; // Close match
    return -10; // Underqualified
  }

  compareDegrees(candidateDegree, requiredDegree) {
    const degreeHierarchy = ['diploma', 'associates', 'bachelors', 'masters', 'phd'];
    const candIndex = degreeHierarchy.indexOf(candidateDegree);
    const reqIndex = degreeHierarchy.indexOf(requiredDegree);
    
    if (candIndex >= reqIndex) return 50;
    if (candIndex === reqIndex - 1) return 30;
    return 10;
  }

  compareFields(candidateField, requiredField) {
    if (candidateField === requiredField) return 50;
    
    // Check for related fields
    const relatedFields = {
      'computer science': ['engineering', 'mathematics', 'physics'],
      'business': ['marketing', 'finance', 'economics'],
      'design': ['art', 'architecture', 'media']
    };
    
    const related = relatedFields[requiredField] || [];
    if (related.includes(candidateField)) return 30;
    
    return 10;
  }

  calculateLocationDistance(location1, location2) {
    // Simplified distance calculation - in production use geocoding APIs
    if (location1.toLowerCase().includes(location2.toLowerCase()) || 
        location2.toLowerCase().includes(location1.toLowerCase())) {
      return 0;
    }
    return Math.floor(Math.random() * 100); // Mock distance
  }

  areIndustriesSimilar(industry1, industry2) {
    return industry1.toLowerCase() === industry2.toLowerCase();
  }

  findRelatedIndustryScore(candidateIndustries, requiredIndustry) {
    const relatedIndustries = {
      'technology': ['finance', 'healthcare', 'education'],
      'finance': ['technology', 'insurance', 'real estate'],
      'healthcare': ['technology', 'pharmaceuticals', 'biotechnology']
    };
    
    const related = relatedIndustries[requiredIndustry] || [];
    const hasRelated = candidateIndustries.some(ind => related.includes(ind));
    
    return hasRelated ? 40 : 20;
  }

  extractRequiredExperience(requirement) {
    const text = this.extractText(requirement);
    
    // Extract required years
    const yearMatches = text.match(/(\d+)[\s\+]*(?:years?|yrs?)/gi);
    const years = yearMatches ? Math.max(...yearMatches.map(m => parseInt(m.match(/\d+/)[0]))) : null;
    
    // Extract required level
    let level = null;
    for (const [levelName, config] of Object.entries(this.experienceLevels)) {
      if (config.keywords.some(keyword => text.toLowerCase().includes(keyword))) {
        level = levelName;
        break;
      }
    }
    
    return { years, level, domain: this.extractDomain(text) };
  }

  extractRequiredEducation(requirement) {
    const text = this.extractText(requirement);
    // Similar to extractEducation but focused on requirements
    return this.extractEducation({ text });
  }

  extractRequiredLocation(requirement) {
    return this.extractLocation(requirement);
  }

  extractRequiredIndustry(requirement) {
    const industries = this.extractIndustries(requirement);
    return industries.length > 0 ? industries[0] : null;
  }

  extractRelevantExperience(text) {
    // Extract domain-specific experience
    const domains = ['web development', 'mobile development', 'data science', 'machine learning', 'devops'];
    return domains.filter(domain => text.toLowerCase().includes(domain));
  }

  extractDomain(text) {
    const domains = ['web', 'mobile', 'data', 'ml', 'devops', 'security'];
    return domains.find(domain => text.toLowerCase().includes(domain));
  }

  calculateRelevantExperience(candidateRelevant, requiredDomain) {
    if (candidateRelevant.includes(requiredDomain)) return 20;
    return 0;
  }
}

// Export singleton instance
module.exports = new CandidateScoring();