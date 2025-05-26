const natural = require('natural');
const stopword = require('stopword');
const axios = require('axios');
const pdf = require('pdf-parse');
const cheerio = require('cheerio');

class NLPService {
  constructor() {
    this.stemmer = natural.PorterStemmer;
    this.tokenizer = new natural.WordTokenizer();
    this.tfidf = new natural.TfIdf();
    
    // Technical skills categories for better matching
    this.skillCategories = {
      programming: ['javascript', 'python', 'java', 'c++', 'c#', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin'],
      frontend: ['react', 'angular', 'vue', 'html', 'css', 'sass', 'less', 'bootstrap', 'tailwind'],
      backend: ['node.js', 'express', 'django', 'flask', 'spring', 'laravel', 'rails', 'fastapi'],
      database: ['mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'cassandra', 'oracle'],
      cloud: ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'jenkins'],
      mobile: ['react native', 'flutter', 'ios', 'android', 'xamarin'],
      ai_ml: ['machine learning', 'deep learning', 'tensorflow', 'pytorch', 'scikit-learn', 'pandas', 'numpy']
    };

    // Experience level keywords
    this.experienceLevels = {
      junior: ['junior', 'entry level', 'graduate', 'intern', 'fresher', '0-2 years'],
      mid: ['mid level', 'intermediate', 'experienced', '2-5 years', '3-6 years'],
      senior: ['senior', 'lead', 'principal', 'architect', '5+ years', '7+ years'],
      executive: ['manager', 'director', 'vp', 'cto', 'ceo', 'head of']
    };
  }

  /**
   * Extract and parse resume from PDF buffer
   */
  async parseResumeFromPDF(pdfBuffer) {
    try {
      const data = await pdf(pdfBuffer);
      const text = data.text;
      
      return this.extractProfileData(text, 'resume');
    } catch (error) {
      throw new Error(`Failed to parse PDF resume: ${error.message}`);
    }
  }

  /**
   * Extract LinkedIn profile data from public URL
   */
  async parseLinkedInProfile(linkedinUrl) {
    try {
      // Note: In production, you'd need proper LinkedIn API access
      // This is a simplified version for demonstration
      const response = await axios.get(linkedinUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      
      // Extract basic profile information
      const name = $('.pv-text-details__left-panel h1').text().trim();
      const headline = $('.pv-text-details__left-panel .text-body-medium').text().trim();
      const experience = $('.pvs-list__paged-list-item .display-flex').map((i, el) => $(el).text()).get();
      const skills = $('.pv-skill-category-entity__name span').map((i, el) => $(el).text()).get();
      
      const profileText = `${name} ${headline} ${experience.join(' ')} ${skills.join(' ')}`;
      
      return this.extractProfileData(profileText, 'linkedin');
    } catch (error) {
      // Fallback: In production, use LinkedIn API or specialized scraping service
      throw new Error(`Failed to parse LinkedIn profile: ${error.message}`);
    }
  }

  /**
   * Extract structured data from profile text
   */
  extractProfileData(text, source) {
    const normalizedText = text.toLowerCase();
    
    return {
      source,
      rawText: text,
      skills: this.extractSkills(normalizedText),
      experience: this.extractExperience(normalizedText),
      education: this.extractEducation(normalizedText),
      keywords: this.extractKeywords(normalizedText),
      experienceLevel: this.determineExperienceLevel(normalizedText),
      languages: this.extractLanguages(normalizedText),
      certifications: this.extractCertifications(normalizedText)
    };
  }

  /**
   * Extract technical skills from text
   */
  extractSkills(text) {
    const foundSkills = {
      programming: [],
      frontend: [],
      backend: [],
      database: [],
      cloud: [],
      mobile: [],
      ai_ml: [],
      other: []
    };

    Object.keys(this.skillCategories).forEach(category => {
      this.skillCategories[category].forEach(skill => {
        if (text.includes(skill.toLowerCase())) {
          foundSkills[category].push(skill);
        }
      });
    });

    return foundSkills;
  }

  /**
   * Extract experience information
   */
  extractExperience(text) {
    const experiencePattern = /(\d+)[\s]*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/gi;
    const matches = text.match(experiencePattern);
    
    let years = 0;
    if (matches) {
      const numbers = matches.map(match => {
        const num = match.match(/\d+/);
        return num ? parseInt(num[0]) : 0;
      });
      years = Math.max(...numbers);
    }

    return {
      years,
      companies: this.extractCompanies(text),
      roles: this.extractRoles(text)
    };
  }

  /**
   * Extract company names (simplified approach)
   */
  extractCompanies(text) {
    const companyKeywords = ['inc', 'corp', 'ltd', 'llc', 'company', 'corporation', 'technologies', 'solutions'];
    const words = this.tokenizer.tokenize(text);
    const companies = [];

    for (let i = 0; i < words.length - 1; i++) {
      if (companyKeywords.some(keyword => words[i + 1] && words[i + 1].toLowerCase().includes(keyword))) {
        companies.push(`${words[i]} ${words[i + 1]}`);
      }
    }

    return [...new Set(companies)].slice(0, 5); // Return unique companies, max 5
  }

  /**
   * Extract job roles/titles
   */
  extractRoles(text) {
    const roleKeywords = [
      'developer', 'engineer', 'programmer', 'analyst', 'manager', 'director',
      'architect', 'consultant', 'specialist', 'lead', 'senior', 'junior',
      'designer', 'tester', 'devops', 'fullstack', 'frontend', 'backend'
    ];

    const roles = [];
    roleKeywords.forEach(role => {
      if (text.includes(role)) {
        roles.push(role);
      }
    });

    return [...new Set(roles)];
  }

  /**
   * Extract education information
   */
  extractEducation(text) {
    const educationKeywords = ['bachelor', 'master', 'phd', 'degree', 'university', 'college', 'computer science', 'engineering'];
    const education = [];

    educationKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        education.push(keyword);
      }
    });

    return education;
  }

  /**
   * Extract important keywords using TF-IDF
   */
  extractKeywords(text) {
    // Clean and tokenize text
    const tokens = this.tokenizer.tokenize(text);
    const cleanTokens = stopword.removeStopwords(tokens)
      .filter(token => token.length > 2)
      .map(token => this.stemmer.stem(token.toLowerCase()));

    // Add to TF-IDF
    this.tfidf.addDocument(cleanTokens);

    // Get top keywords
    const keywords = [];
    this.tfidf.listTerms(0).slice(0, 20).forEach(item => {
      keywords.push({
        term: item.term,
        score: item.tfidf
      });
    });

    return keywords;
  }

  /**
   * Determine experience level
   */
  determineExperienceLevel(text) {
    let maxScore = 0;
    let level = 'mid';

    Object.keys(this.experienceLevels).forEach(levelKey => {
      let score = 0;
      this.experienceLevels[levelKey].forEach(keyword => {
        if (text.includes(keyword)) {
          score += 1;
        }
      });

      if (score > maxScore) {
        maxScore = score;
        level = levelKey;
      }
    });

    return level;
  }

  /**
   * Extract programming languages
   */
  extractLanguages(text) {
    const languages = ['english', 'spanish', 'french', 'german', 'mandarin', 'hindi', 'arabic'];
    const found = [];

    languages.forEach(lang => {
      if (text.includes(lang)) {
        found.push(lang);
      }
    });

    return found;
  }

  /**
   * Extract certifications
   */
  extractCertifications(text) {
    const certKeywords = [
      'certified', 'certification', 'aws certified', 'microsoft certified',
      'google cloud', 'oracle certified', 'cisco', 'pmp', 'scrum master'
    ];
    const certifications = [];

    certKeywords.forEach(cert => {
      if (text.includes(cert)) {
        certifications.push(cert);
      }
    });

    return certifications;
  }

  /**
   * Calculate match score between candidate profile and job requirement
   */
  calculateMatchScore(candidateProfile, jobRequirement) {
    const scores = {
      skillsMatch: 0,
      experienceMatch: 0,
      educationMatch: 0,
      keywordMatch: 0,
      overall: 0
    };

    const reasoning = [];

    // Parse job requirement
    const reqData = this.extractProfileData(jobRequirement.description, 'requirement');

    // 1. Skills matching (40% weight)
    const skillsScore = this.compareSkills(candidateProfile.skills, reqData.skills);
    scores.skillsMatch = skillsScore.score;
    reasoning.push(...skillsScore.reasoning);

    // 2. Experience matching (30% weight)
    const expScore = this.compareExperience(candidateProfile.experience, reqData.experience);
    scores.experienceMatch = expScore.score;
    reasoning.push(...expScore.reasoning);

    // 3. Education matching (15% weight)
    const eduScore = this.compareEducation(candidateProfile.education, reqData.education);
    scores.educationMatch = eduScore.score;
    reasoning.push(...eduScore.reasoning);

    // 4. Keywords matching (15% weight)
    const keywordScore = this.compareKeywords(candidateProfile.keywords, reqData.keywords);
    scores.keywordMatch = keywordScore.score;
    reasoning.push(...keywordScore.reasoning);

    // Calculate overall weighted score
    scores.overall = Math.round(
      (scores.skillsMatch * 0.4) +
      (scores.experienceMatch * 0.3) +
      (scores.educationMatch * 0.15) +
      (scores.keywordMatch * 0.15)
    );

    return {
      scores,
      reasoning,
      recommendation: this.getRecommendation(scores.overall),
      matchLevel: this.getMatchLevel(scores.overall)
    };
  }

  /**
   * Compare skills between candidate and requirement
   */
  compareSkills(candidateSkills, requiredSkills) {
    let totalRequired = 0;
    let matched = 0;
    const reasoning = [];

    Object.keys(requiredSkills).forEach(category => {
      if (requiredSkills[category].length > 0) {
        totalRequired += requiredSkills[category].length;
        
        const categoryMatches = requiredSkills[category].filter(skill =>
          candidateSkills[category] && candidateSkills[category].includes(skill)
        );
        
        matched += categoryMatches.length;
        
        if (categoryMatches.length > 0) {
          reasoning.push(`✓ Matches ${categoryMatches.length}/${requiredSkills[category].length} ${category} skills: ${categoryMatches.join(', ')}`);
        } else if (requiredSkills[category].length > 0) {
          reasoning.push(`✗ Missing ${category} skills: ${requiredSkills[category].join(', ')}`);
        }
      }
    });

    const score = totalRequired > 0 ? Math.round((matched / totalRequired) * 100) : 50;
    
    return { score, reasoning };
  }

  /**
   * Compare experience levels
   */
  compareExperience(candidateExp, requiredExp) {
    const reasoning = [];
    let score = 50; // Base score

    // Compare years of experience
    if (requiredExp.years > 0) {
      if (candidateExp.years >= requiredExp.years) {
        score += 30;
        reasoning.push(`✓ Experience: ${candidateExp.years} years (required: ${requiredExp.years}+)`);
      } else {
        score -= 20;
        reasoning.push(`✗ Experience: ${candidateExp.years} years (required: ${requiredExp.years}+)`);
      }
    }

    // Compare roles
    const roleMatches = candidateExp.roles.filter(role =>
      requiredExp.roles.some(reqRole => role.includes(reqRole) || reqRole.includes(role))
    );

    if (roleMatches.length > 0) {
      score += 20;
      reasoning.push(`✓ Relevant roles: ${roleMatches.join(', ')}`);
    }

    return { score: Math.min(100, Math.max(0, score)), reasoning };
  }

  /**
   * Compare education backgrounds
   */
  compareEducation(candidateEdu, requiredEdu) {
    const reasoning = [];
    let score = 70; // Base score (education often not mandatory)

    const eduMatches = candidateEdu.filter(edu =>
      requiredEdu.some(reqEdu => edu.includes(reqEdu) || reqEdu.includes(edu))
    );

    if (eduMatches.length > 0) {
      score += 30;
      reasoning.push(`✓ Education match: ${eduMatches.join(', ')}`);
    } else if (requiredEdu.length > 0) {
      reasoning.push(`? Education: No direct match found`);
    }

    return { score: Math.min(100, score), reasoning };
  }

  /**
   * Compare keywords using cosine similarity
   */
  compareKeywords(candidateKeywords, requiredKeywords) {
    const reasoning = [];
    
    if (candidateKeywords.length === 0 || requiredKeywords.length === 0) {
      return { score: 50, reasoning: ['? Keywords: Insufficient data for comparison'] };
    }

    // Extract terms
    const candidateTerms = candidateKeywords.map(k => k.term);
    const requiredTerms = requiredKeywords.map(k => k.term);

    // Find common keywords
    const commonKeywords = candidateTerms.filter(term => requiredTerms.includes(term));
    const score = Math.round((commonKeywords.length / Math.max(requiredTerms.length, 1)) * 100);

    if (commonKeywords.length > 0) {
      reasoning.push(`✓ Common keywords (${commonKeywords.length}): ${commonKeywords.slice(0, 5).join(', ')}`);
    } else {
      reasoning.push('✗ No common keywords found');
    }

    return { score, reasoning };
  }

  /**
   * Get recommendation based on overall score
   */
  getRecommendation(score) {
    if (score >= 80) return 'Highly Recommended - Excellent match';
    if (score >= 70) return 'Recommended - Good match with minor gaps';
    if (score >= 60) return 'Consider - Moderate match, review carefully';
    if (score >= 40) return 'Weak Match - Significant skill gaps';
    return 'Not Recommended - Poor match';
  }

  /**
   * Get match level classification
   */
  getMatchLevel(score) {
    if (score >= 80) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 60) return 'moderate';
    if (score >= 40) return 'weak';
    return 'poor';
  }

  /**
   * Batch process multiple candidates against a requirement
   */
  async batchAnalyze(candidates, jobRequirement) {
    const results = [];

    for (const candidate of candidates) {
      try {
        let profile;
        
        if (candidate.type === 'pdf') {
          profile = await this.parseResumeFromPDF(candidate.data);
        } else if (candidate.type === 'linkedin') {
          profile = await this.parseLinkedInProfile(candidate.url);
        }

        const matchResult = this.calculateMatchScore(profile, jobRequirement);
        
        results.push({
          candidateId: candidate.id,
          profile,
          matchResult,
          processedAt: new Date()
        });
      } catch (error) {
        results.push({
          candidateId: candidate.id,
          error: error.message,
          processedAt: new Date()
        });
      }
    }

    // Sort by match score
    return results.sort((a, b) => {
      const scoreA = a.matchResult ? a.matchResult.scores.overall : 0;
      const scoreB = b.matchResult ? b.matchResult.scores.overall : 0;
      return scoreB - scoreA;
    });
  }

  /**
   * Generate detailed analysis report
   */
  generateAnalysisReport(matchResult, candidateProfile, jobRequirement) {
    return {
      summary: {
        overallScore: matchResult.scores.overall,
        matchLevel: matchResult.matchLevel,
        recommendation: matchResult.recommendation
      },
      breakdown: {
        skills: {
          score: matchResult.scores.skillsMatch,
          weight: '40%',
          impact: 'High'
        },
        experience: {
          score: matchResult.scores.experienceMatch,
          weight: '30%',
          impact: 'High'
        },
        education: {
          score: matchResult.scores.educationMatch,
          weight: '15%',
          impact: 'Medium'
        },
        keywords: {
          score: matchResult.scores.keywordMatch,
          weight: '15%',
          impact: 'Medium'
        }
      },
      strengths: matchResult.reasoning.filter(r => r.startsWith('✓')),
      gaps: matchResult.reasoning.filter(r => r.startsWith('✗')),
      considerations: matchResult.reasoning.filter(r => r.startsWith('?')),
      candidateHighlights: {
        topSkills: this.getTopSkills(candidateProfile.skills),
        experienceLevel: candidateProfile.experienceLevel,
        yearsOfExperience: candidateProfile.experience.years,
        education: candidateProfile.education.slice(0, 3)
      },
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Get top skills from candidate profile
   */
  getTopSkills(skills) {
    const allSkills = [];
    Object.keys(skills).forEach(category => {
      if (category !== 'other') {
        allSkills.push(...skills[category].map(skill => ({ skill, category })));
      }
    });
    return allSkills.slice(0, 10);
  }
}

module.exports = NLPService;