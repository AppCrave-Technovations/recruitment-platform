const OpenAI = require('openai');

/**
 * OpenAI Configuration for SaaS Recruitment Platform
 * Handles AI-powered resume analysis, candidate matching, and profile parsing
 */

class OpenAIConfig {
  constructor() {
    this.client = null;
    this.isInitialized = false;
    this.rateLimitTracker = new Map();
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second base delay
    
    // Model configurations for different use cases
    this.models = {
      resume_analysis: {
        model: 'gpt-4-turbo-preview',
        fallback: 'gpt-3.5-turbo',
        max_tokens: 2000,
        temperature: 0.3,
        top_p: 0.9
      },
      linkedin_parsing: {
        model: 'gpt-3.5-turbo',
        fallback: 'gpt-3.5-turbo-instruct',
        max_tokens: 1500,
        temperature: 0.2,
        top_p: 0.8
      },
      skill_extraction: {
        model: 'gpt-3.5-turbo',
        fallback: 'gpt-3.5-turbo-instruct',
        max_tokens: 1000,
        temperature: 0.1,
        top_p: 0.7
      },
      match_scoring: {
        model: 'gpt-4-turbo-preview',
        fallback: 'gpt-3.5-turbo',
        max_tokens: 1500,
        temperature: 0.2,
        top_p: 0.8
      }
    };

    // Cost tracking for different models (in USD per 1K tokens)
    this.modelCosts = {
      'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.001, output: 0.002 },
      'gpt-3.5-turbo-instruct': { input: 0.0015, output: 0.002 }
    };

    this.initialize();
  }

  /**
   * Initialize OpenAI client
   */
  initialize() {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        console.warn('⚠️  OpenAI API key not provided. AI features will be disabled.');
        return;
      }

      this.client = new OpenAI({
        apiKey: apiKey,
        organization: process.env.OPENAI_ORG_ID || undefined,
        timeout: 60000, // 60 seconds timeout
        maxRetries: this.maxRetries,
        dangerouslyAllowBrowser: false
      });

      this.isInitialized = true;
      console.log('✅ OpenAI client initialized successfully');

      // Test the connection
      this.testConnection();

    } catch (error) {
      console.error('❌ Failed to initialize OpenAI client:', error.message);
      this.isInitialized = false;
    }
  }

  /**
   * Test OpenAI connection
   */
  async testConnection() {
    if (!this.isInitialized) return false;

    try {
      await this.client.models.list();
      console.log('✅ OpenAI connection test successful');
      return true;
    } catch (error) {
      console.error('❌ OpenAI connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Check if OpenAI is available and initialized
   */
  isAvailable() {
    return this.isInitialized && this.client !== null;
  }

  /**
   * Get client instance
   */
  getClient() {
    if (!this.isAvailable()) {
      throw new Error('OpenAI client is not available. Check your API key configuration.');
    }
    return this.client;
  }

  /**
   * Analyze resume text against job requirements
   */
  async analyzeResume(resumeText, jobRequirement, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('OpenAI service is not available');
    }

    const config = this.models.resume_analysis;
    const prompt = this.buildResumeAnalysisPrompt(resumeText, jobRequirement);

    try {
      const response = await this.makeRequest({
        model: config.model,
        messages: [
          {
            role: "system",
            content: "You are an expert HR analyst specializing in candidate-job matching. Provide detailed, objective analysis with numerical scores and clear reasoning."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: config.max_tokens,
        temperature: config.temperature,
        top_p: config.top_p,
        response_format: { type: "json_object" }
      }, 'resume_analysis');

      return this.parseAnalysisResponse(response.choices[0].message.content);

    } catch (error) {
      console.error('Resume analysis error:', error);
      
      // Try with fallback model
      if (config.fallback && error.code !== 'insufficient_quota') {
        console.log('Retrying with fallback model:', config.fallback);
        return this.analyzeResume(resumeText, jobRequirement, { ...options, model: config.fallback });
      }
      
      throw new Error(`Resume analysis failed: ${error.message}`);
    }
  }

  /**
   * Extract skills from resume or job description
   */
  async extractSkills(text, context = 'resume') {
    if (!this.isAvailable()) {
      throw new Error('OpenAI service is not available');
    }

    const config = this.models.skill_extraction;
    const prompt = this.buildSkillExtractionPrompt(text, context);

    try {
      const response = await this.makeRequest({
        model: config.model,
        messages: [
          {
            role: "system",
            content: "You are a skill extraction specialist. Extract and categorize technical and soft skills from the provided text."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: config.max_tokens,
        temperature: config.temperature,
        top_p: config.top_p,
        response_format: { type: "json_object" }
      }, 'skill_extraction');

      return JSON.parse(response.choices[0].message.content);

    } catch (error) {
      console.error('Skill extraction error:', error);
      throw new Error(`Skill extraction failed: ${error.message}`);
    }
  }

  /**
   * Generate candidate match score
   */
  async generateMatchScore(candidateProfile, jobRequirement, weights = {}) {
    if (!this.isAvailable()) {
      throw new Error('OpenAI service is not available');
    }

    const config = this.models.match_scoring;
    const prompt = this.buildMatchScoringPrompt(candidateProfile, jobRequirement, weights);

    try {
      const response = await this.makeRequest({
        model: config.model,
        messages: [
          {
            role: "system",
            content: "You are a precision candidate matching system. Calculate detailed compatibility scores between candidates and job requirements."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: config.max_tokens,
        temperature: config.temperature,
        top_p: config.top_p,
        response_format: { type: "json_object" }
      }, 'match_scoring');

      return JSON.parse(response.choices[0].message.content);

    } catch (error) {
      console.error('Match scoring error:', error);
      throw new Error(`Match scoring failed: ${error.message}`);
    }
  }

  /**
   * Parse LinkedIn profile content
   */
  async parseLinkedInContent(profileText) {
    if (!this.isAvailable()) {
      throw new Error('OpenAI service is not available');
    }

    const config = this.models.linkedin_parsing;
    const prompt = this.buildLinkedInParsingPrompt(profileText);

    try {
      const response = await this.makeRequest({
        model: config.model,
        messages: [
          {
            role: "system",
            content: "You are a LinkedIn profile parser. Extract structured information from LinkedIn profile content."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: config.max_tokens,
        temperature: config.temperature,
        top_p: config.top_p,
        response_format: { type: "json_object" }
      }, 'linkedin_parsing');

      return JSON.parse(response.choices[0].message.content);

    } catch (error) {
      console.error('LinkedIn parsing error:', error);
      throw new Error(`LinkedIn parsing failed: ${error.message}`);
    }
  }

  /**
   * Make API request with error handling and retry logic
   */
  async makeRequest(params, requestType = 'general') {
    const startTime = Date.now();
    let attempt = 0;

    while (attempt < this.maxRetries) {
      try {
        // Check rate limits
        await this.checkRateLimit(requestType);

        const response = await this.client.chat.completions.create(params);
        
        // Track usage and costs
        this.trackUsage(response, requestType, Date.now() - startTime);
        
        return response;

      } catch (error) {
        attempt++;
        
        if (this.shouldRetry(error) && attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`⏳ Retrying OpenAI request (attempt ${attempt + 1}/${this.maxRetries}) in ${delay}ms...`);
          await this.delay(delay);
          continue;
        }

        // Handle specific error types
        if (error.code === 'rate_limit_exceeded') {
          throw new Error('OpenAI rate limit exceeded. Please try again later.');
        } else if (error.code === 'insufficient_quota') {
          throw new Error('OpenAI quota exceeded. Please check your billing.');
        } else if (error.code === 'invalid_api_key') {
          throw new Error('Invalid OpenAI API key.');
        }

        throw error;
      }
    }
  }

  /**
   * Check if error should trigger a retry
   */
  shouldRetry(error) {
    const retryableCodes = [
      'timeout',
      'rate_limit_exceeded',
      'server_error',
      'service_unavailable'
    ];
    
    return retryableCodes.includes(error.code) || 
           error.status >= 500 || 
           error.message.includes('timeout');
  }

  /**
   * Simple rate limiting check
   */
  async checkRateLimit(requestType) {
    const now = Date.now();
    const key = `${requestType}_${Math.floor(now / 60000)}`; // Per minute tracking
    
    const current = this.rateLimitTracker.get(key) || 0;
    const limit = this.getRateLimit(requestType);
    
    if (current >= limit) {
      const waitTime = 60000 - (now % 60000);
      console.log(`⏳ Rate limit reached for ${requestType}. Waiting ${waitTime}ms...`);
      await this.delay(waitTime);
    }
    
    this.rateLimitTracker.set(key, current + 1);
    
    // Clean old entries
    for (const [trackerKey] of this.rateLimitTracker) {
      if (parseInt(trackerKey.split('_').pop()) < Math.floor(now / 60000) - 5) {
        this.rateLimitTracker.delete(trackerKey);
      }
    }
  }

  /**
   * Get rate limit for request type
   */
  getRateLimit(requestType) {
    const limits = {
      resume_analysis: 20,  // per minute
      linkedin_parsing: 30,
      skill_extraction: 40,
      match_scoring: 15,
      general: 50
    };
    
    return limits[requestType] || limits.general;
  }

  /**
   * Track API usage and costs
   */
  trackUsage(response, requestType, duration) {
    const { usage } = response;
    const model = response.model;
    
    if (usage && this.modelCosts[model]) {
      const costs = this.modelCosts[model];
      const totalCost = (usage.prompt_tokens / 1000 * costs.input) + 
                       (usage.completion_tokens / 1000 * costs.output);
      
      console.log(`📊 OpenAI Usage - ${requestType}: ${usage.total_tokens} tokens, $${totalCost.toFixed(4)}, ${duration}ms`);
      
      // Here you could save to database for billing/monitoring
      this.saveUsageStats({
        requestType,
        model,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        cost: totalCost,
        duration,
        timestamp: new Date()
      });
    }
  }

  /**
   * Save usage statistics (implement based on your needs)
   */
  async saveUsageStats(stats) {
    // TODO: Save to database for monitoring and billing
    // Example: await UsageStats.create(stats);
  }

  /**
   * Build resume analysis prompt
   */
  buildResumeAnalysisPrompt(resumeText, jobRequirement) {
    return `
Analyze the following candidate's resume against the job requirement and provide a detailed matching score.

CANDIDATE RESUME:
${resumeText}

JOB REQUIREMENT:
Title: ${jobRequirement.title}
Description: ${jobRequirement.description}
Required Skills: ${jobRequirement.skills?.join(', ') || 'Not specified'}
Experience Level: ${jobRequirement.experience?.min || 0}-${jobRequirement.experience?.max || 10} years
Location: ${jobRequirement.location || 'Not specified'}
Education: ${jobRequirement.education || 'Not specified'}

Please provide your analysis in the following JSON format:
{
  "overallScore": <number 0-100>,
  "skillsMatch": {
    "score": <number 0-100>,
    "matchedSkills": ["skill1", "skill2"],
    "missingSkills": ["skill3", "skill4"],
    "additionalSkills": ["skill5", "skill6"]
  },
  "experienceMatch": {
    "score": <number 0-100>,
    "candidateYears": <number>,
    "requiredYears": <number>,
    "relevantExperience": ["experience1", "experience2"],
    "analysis": "Brief analysis of experience match"
  },
  "educationMatch": {
    "score": <number 0-100>,
    "analysis": "Brief analysis of education match"
  },
  "locationMatch": {
    "score": <number 0-100>,
    "candidateLocation": "location",
    "isRemoteWorkSuitable": <boolean>
  },
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2"],
  "recommendations": ["recommendation1", "recommendation2"],
  "reasoning": "Detailed explanation of the overall score and key factors",
  "riskFactors": ["risk1", "risk2"],
  "potentialQuestions": ["question1", "question2"]
}
`;
  }

  /**
   * Build skill extraction prompt
   */
  buildSkillExtractionPrompt(text, context) {
    return `
Extract and categorize skills from the following ${context}:

TEXT:
${text}

Please provide the extracted skills in the following JSON format:
{
  "technicalSkills": {
    "programming": ["skill1", "skill2"],
    "frameworks": ["framework1", "framework2"],
    "tools": ["tool1", "tool2"],
    "databases": ["db1", "db2"],
    "cloud": ["platform1", "platform2"],
    "other": ["other1", "other2"]
  },
  "softSkills": ["skill1", "skill2", "skill3"],
  "certifications": ["cert1", "cert2"],
  "languages": ["language1", "language2"],
  "industries": ["industry1", "industry2"],
  "confidenceScore": <number 0-100>
}
`;
  }

  /**
   * Build match scoring prompt
   */
  buildMatchScoringPrompt(candidateProfile, jobRequirement, weights) {
    return `
Calculate a detailed compatibility score between the candidate and job requirement.

CANDIDATE PROFILE:
${JSON.stringify(candidateProfile, null, 2)}

JOB REQUIREMENT:
${JSON.stringify(jobRequirement, null, 2)}

SCORING WEIGHTS:
${JSON.stringify({ skills: 40, experience: 30, education: 15, location: 10, cultural: 5, ...weights }, null, 2)}

Provide detailed scoring in this JSON format:
{
  "overallScore": <number 0-100>,
  "componentScores": {
    "skills": <number 0-100>,
    "experience": <number 0-100>,
    "education": <number 0-100>,
    "location": <number 0-100>,
    "cultural": <number 0-100>
  },
  "weightedScore": <number 0-100>,
  "matchStrength": "excellent|good|fair|poor",
  "keyMatchPoints": ["point1", "point2"],
  "keyGaps": ["gap1", "gap2"],
  "recommendation": "hire|interview|consider|reject",
  "reasoning": "Detailed explanation"
}
`;
  }

  /**
   * Build LinkedIn parsing prompt
   */
  buildLinkedInParsingPrompt(profileText) {
    return `
Parse the following LinkedIn profile content and extract structured information:

LINKEDIN PROFILE:
${profileText}

Please extract information in this JSON format:
{
  "name": "Full Name",
  "headline": "Professional Headline",
  "location": "City, Country",
  "summary": "Professional summary",
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "duration": "Start Date - End Date",
      "description": "Job description",
      "skills": ["skill1", "skill2"]
    }
  ],
  "education": [
    {
      "degree": "Degree",
      "school": "Institution",
      "year": "Year",
      "field": "Field of Study"
    }
  ],
  "skills": ["skill1", "skill2", "skill3"],
  "certifications": ["cert1", "cert2"],
  "languages": ["language1", "language2"]
}
`;
  }

  /**
   * Parse analysis response with error handling
   */
  parseAnalysisResponse(response) {
    try {
      const parsed = JSON.parse(response);
      
      // Validate required fields
      if (typeof parsed.overallScore !== 'number' || 
          parsed.overallScore < 0 || 
          parsed.overallScore > 100) {
        throw new Error('Invalid overall score');
      }
      
      return parsed;
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      
      // Return fallback response
      return {
        overallScore: 50,
        skillsMatch: { score: 50, matchedSkills: [], missingSkills: [] },
        experienceMatch: { score: 50, candidateYears: 0, analysis: "Unable to analyze" },
        strengths: [],
        weaknesses: [],
        recommendations: ["Manual review recommended"],
        reasoning: "AI analysis failed, manual review required"
      };
    }
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get usage statistics
   */
  getUsageStats() {
    return {
      isAvailable: this.isAvailable(),
      rateLimitStatus: Object.fromEntries(this.rateLimitTracker),
      modelConfigs: this.models,
      modelCosts: this.modelCosts
    };
  }
}

// Create and export singleton instance
const openAIConfig = new OpenAIConfig();

module.exports = {
  client: () => openAIConfig.getClient(),
  isAvailable: () => openAIConfig.isAvailable(),
  analyzeResume: (resumeText, jobRequirement, options) => 
    openAIConfig.analyzeResume(resumeText, jobRequirement, options),
  extractSkills: (text, context) => 
    openAIConfig.extractSkills(text, context),
  generateMatchScore: (candidateProfile, jobRequirement, weights) => 
    openAIConfig.generateMatchScore(candidateProfile, jobRequirement, weights),
  parseLinkedInContent: (profileText) => 
    openAIConfig.parseLinkedInContent(profileText),
  testConnection: () => openAIConfig.testConnection(),
  getUsageStats: () => openAIConfig.getUsageStats()
};