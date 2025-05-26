const pdfParse = require('pdf-parse');
const fs = require('fs').promises;
const path = require('path');
const natural = require('natural');
const compromise = require('compromise');
const logger = require('../utils/logger');
const nlpService = require('./nlp.service');
const { ValidationError, ProcessingError } = require('../utils/errors');

class PDFService {
  constructor() {
    this.supportedFormats = ['.pdf'];
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.tempDir = path.join(__dirname, '../../temp');
    
    // Ensure temp directory exists
    this.ensureTempDir();
  }

  async ensureTempDir() {
    try {
      await fs.access(this.tempDir);
    } catch (error) {
      await fs.mkdir(this.tempDir, { recursive: true });
    }
  }

  /**
   * Parse PDF file and extract structured data
   * @param {Buffer|string} input - PDF buffer or file path
   * @param {Object} options - Processing options
   * @returns {Object} Parsed resume data
   */
  async parsePDF(input, options = {}) {
    try {
      logger.info('Starting PDF parsing process');
      
      // Validate input
      const buffer = await this.validateAndPreprocess(input);
      
      // Extract raw text from PDF
      const rawText = await this.extractText(buffer);
      
      // Process and structure the text
      const structuredData = await this.processText(rawText, options);
      
      // Extract sections and analyze
      const resumeData = await this.extractResumeStructure(structuredData);
      
      logger.info('PDF parsing completed successfully');
      return resumeData;
      
    } catch (error) {
      logger.error('PDF parsing failed:', error);
      throw new ProcessingError(`PDF parsing failed: ${error.message}`);
    }
  }

  /**
   * Validate input and convert to buffer if needed
   */
  async validateAndPreprocess(input) {
    let buffer;
    
    if (typeof input === 'string') {
      // Input is file path
      const stats = await fs.stat(input);
      
      if (stats.size > this.maxFileSize) {
        throw new ValidationError('File size exceeds maximum limit (10MB)');
      }
      
      if (!this.supportedFormats.includes(path.extname(input).toLowerCase())) {
        throw new ValidationError('Unsupported file format. Only PDF files are allowed');
      }
      
      buffer = await fs.readFile(input);
    } else if (Buffer.isBuffer(input)) {
      // Input is already a buffer
      if (input.length > this.maxFileSize) {
        throw new ValidationError('File size exceeds maximum limit (10MB)');
      }
      buffer = input;
    } else {
      throw new ValidationError('Invalid input format. Expected file path or buffer');
    }
    
    // Validate PDF signature
    if (!this.isPDFBuffer(buffer)) {
      throw new ValidationError('Invalid PDF file format');
    }
    
    return buffer;
  }

  /**
   * Check if buffer is a valid PDF
   */
  isPDFBuffer(buffer) {
    const pdfSignature = buffer.slice(0, 4);
    return pdfSignature.toString() === '%PDF';
  }

  /**
   * Extract raw text from PDF buffer
   */
  async extractText(buffer) {
    try {
      const data = await pdfParse(buffer, {
        // PDF parsing options
        normalizeWhitespace: true,
        disableCombineTextItems: false
      });
      
      if (!data.text || data.text.trim().length === 0) {
        throw new ProcessingError('No text content found in PDF');
      }
      
      return {
        text: data.text,
        metadata: {
          pages: data.numpages,
          info: data.info,
          version: data.version
        }
      };
      
    } catch (error) {
      if (error instanceof ProcessingError) {
        throw error;
      }
      throw new ProcessingError(`Text extraction failed: ${error.message}`);
    }
  }

  /**
   * Process and clean the extracted text
   */
  async processText(rawData, options = {}) {
    const { text, metadata } = rawData;
    
    // Clean and normalize text
    const cleanedText = this.cleanText(text);
    
    // Split into sections
    const sections = this.identifySections(cleanedText);
    
    // Process with NLP
    const nlpData = await nlpService.processText(cleanedText, {
      extractEntities: true,
      extractKeywords: true,
      sentiment: false,
      language: options.language || 'en'
    });
    
    return {
      originalText: text,
      cleanedText,
      sections,
      nlpData,
      metadata
    };
  }

  /**
   * Clean and normalize text content
   */
  cleanText(text) {
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove special characters but keep important punctuation
      .replace(/[^\w\s\-\.,@()\[\]]/g, ' ')
      // Fix common PDF extraction issues
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      // Normalize line breaks
      .replace(/\n+/g, '\n')
      // Trim whitespace
      .trim();
  }

  /**
   * Identify different sections in the resume
   */
  identifySections(text) {
    const sections = {};
    const lines = text.split('\n').filter(line => line.trim());
    
    // Common section headers
    const sectionPatterns = {
      contact: /^(contact|personal|details|information)/i,
      summary: /^(summary|profile|objective|about)/i,
      experience: /^(experience|work|employment|career)/i,
      education: /^(education|qualification|academic)/i,
      skills: /^(skills|competencies|expertise|technical)/i,
      projects: /^(projects|portfolio|achievements)/i,
      certifications: /^(certifications|certificates|licenses)/i,
      languages: /^(languages|linguistic)/i
    };
    
    let currentSection = 'other';
    let currentContent = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.length === 0) continue;
      
      // Check if line is a section header
      let foundSection = null;
      for (const [sectionName, pattern] of Object.entries(sectionPatterns)) {
        if (pattern.test(trimmedLine)) {
          foundSection = sectionName;
          break;
        }
      }
      
      if (foundSection) {
        // Save previous section
        if (currentContent.length > 0) {
          sections[currentSection] = currentContent.join('\n');
        }
        
        // Start new section
        currentSection = foundSection;
        currentContent = [];
      } else {
        currentContent.push(trimmedLine);
      }
    }
    
    // Save last section
    if (currentContent.length > 0) {
      sections[currentSection] = currentContent.join('\n');
    }
    
    return sections;
  }

  /**
   * Extract structured resume data
   */
  async extractResumeStructure(processedData) {
    const { sections, nlpData, metadata } = processedData;
    
    const resumeData = {
      metadata: {
        source: 'pdf',
        extractedAt: new Date().toISOString(),
        ...metadata
      },
      sections,
      analysis: {}
    };
    
    // Extract contact information
    resumeData.contactInfo = this.extractContactInfo(sections.contact || sections.other || '');
    
    // Extract work experience
    resumeData.experience = this.extractWorkExperience(sections.experience || '');
    
    // Extract education
    resumeData.education = this.extractEducation(sections.education || '');
    
    // Extract skills
    resumeData.skills = this.extractSkills(sections.skills || '', nlpData.keywords);
    
    // Extract projects
    resumeData.projects = this.extractProjects(sections.projects || '');
    
    // Extract certifications
    resumeData.certifications = this.extractCertifications(sections.certifications || '');
    
    // Calculate analysis scores
    resumeData.analysis = await this.calculateAnalysis(resumeData, nlpData);
    
    return resumeData;
  }

  /**
   * Extract contact information using NLP and regex
   */
  extractContactInfo(text) {
    const contactInfo = {};
    
    // Email extraction
    const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
    const emails = text.match(emailRegex);
    if (emails && emails.length > 0) {
      contactInfo.email = emails[0];
    }
    
    // Phone extraction
    const phoneRegex = /(\+?\d{1,4}[\s\-]?)?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}/g;
    const phones = text.match(phoneRegex);
    if (phones && phones.length > 0) {
      contactInfo.phone = phones[0];
    }
    
    // LinkedIn URL extraction
    const linkedinRegex = /linkedin\.com\/in\/[\w\-]+/g;
    const linkedin = text.match(linkedinRegex);
    if (linkedin && linkedin.length > 0) {
      contactInfo.linkedin = 'https://' + linkedin[0];
    }
    
    // GitHub URL extraction
    const githubRegex = /github\.com\/[\w\-]+/g;
    const github = text.match(githubRegex);
    if (github && github.length > 0) {
      contactInfo.github = 'https://' + github[0];
    }
    
    // Name extraction (first few words before contact info)
    const lines = text.split('\n');
    const firstLine = lines[0]?.trim();
    if (firstLine && firstLine.length < 50 && !emailRegex.test(firstLine)) {
      contactInfo.name = firstLine;
    }
    
    return contactInfo;
  }

  /**
   * Extract work experience
   */
  extractWorkExperience(text) {
    const experiences = [];
    const lines = text.split('\n').filter(line => line.trim());
    
    let currentExp = null;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check for company/position patterns
      if (this.isJobTitle(trimmedLine)) {
        if (currentExp) {
          experiences.push(currentExp);
        }
        
        currentExp = {
          title: trimmedLine,
          company: '',
          duration: '',
          description: [],
          technologies: []
        };
      } else if (currentExp) {
        // Look for company name (usually follows job title)
        if (!currentExp.company && this.isCompanyName(trimmedLine)) {
          currentExp.company = trimmedLine;
        }
        // Look for duration
        else if (!currentExp.duration && this.isDuration(trimmedLine)) {
          currentExp.duration = trimmedLine;
        }
        // Add to description
        else if (trimmedLine.length > 10) {
          currentExp.description.push(trimmedLine);
          
          // Extract technologies mentioned
          const techs = this.extractTechnologies(trimmedLine);
          currentExp.technologies.push(...techs);
        }
      }
    }
    
    if (currentExp) {
      experiences.push(currentExp);
    }
    
    return experiences;
  }

  /**
   * Extract education information
   */
  extractEducation(text) {
    const education = [];
    const lines = text.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (this.isDegree(trimmedLine)) {
        const eduItem = {
          degree: trimmedLine,
          institution: '',
          year: '',
          gpa: ''
        };
        
        // Look for institution and year in the same line or next lines
        const degreeMatch = trimmedLine.match(/(.+?)\s+(?:at|from|,)\s+(.+?)(?:\s+(\d{4}|\d{4}-\d{4}))?/i);
        if (degreeMatch) {
          eduItem.degree = degreeMatch[1].trim();
          eduItem.institution = degreeMatch[2].trim();
          if (degreeMatch[3]) {
            eduItem.year = degreeMatch[3];
          }
        }
        
        education.push(eduItem);
      }
    }
    
    return education;
  }

  /**
   * Extract skills
   */
  extractSkills(text, keywords = []) {
    const skills = new Set();
    
    // Common technology skills
    const techSkills = [
      'JavaScript', 'Python', 'Java', 'C++', 'C#', 'Ruby', 'PHP', 'Go', 'Rust',
      'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask',
      'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Elasticsearch',
      'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Jenkins',
      'Git', 'Linux', 'Unix', 'Agile', 'Scrum'
    ];
    
    // Extract from text
    for (const skill of techSkills) {
      if (text.toLowerCase().includes(skill.toLowerCase())) {
        skills.add(skill);
      }
    }
    
    // Extract from NLP keywords
    for (const keyword of keywords) {
      if (keyword.text && keyword.text.length > 2) {
        skills.add(keyword.text);
      }
    }
    
    // Split comma-separated skills
    const skillLines = text.split(/[,\n]/).map(s => s.trim());
    for (const skillLine of skillLines) {
      if (skillLine.length > 2 && skillLine.length < 30) {
        skills.add(skillLine);
      }
    }
    
    return Array.from(skills);
  }

  /**
   * Extract projects
   */
  extractProjects(text) {
    const projects = [];
    const sections = text.split(/\n\s*\n/);
    
    for (const section of sections) {
      const lines = section.split('\n').filter(line => line.trim());
      if (lines.length > 0) {
        const project = {
          name: lines[0].trim(),
          description: lines.slice(1).join(' ').trim(),
          technologies: this.extractTechnologies(section)
        };
        projects.push(project);
      }
    }
    
    return projects;
  }

  /**
   * Extract certifications
   */
  extractCertifications(text) {
    const certifications = [];
    const lines = text.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.length > 5) {
        const cert = {
          name: trimmedLine,
          issuer: '',
          year: ''
        };
        
        // Try to extract issuer and year
        const match = trimmedLine.match(/(.+?)\s+(?:by|from|,)\s+(.+?)(?:\s+(\d{4}))?/i);
        if (match) {
          cert.name = match[1].trim();
          cert.issuer = match[2].trim();
          if (match[3]) {
            cert.year = match[3];
          }
        }
        
        certifications.push(cert);
      }
    }
    
    return certifications;
  }

  /**
   * Helper methods for pattern matching
   */
  isJobTitle(text) {
    const jobTitlePatterns = [
      /engineer/i, /developer/i, /manager/i, /analyst/i, /architect/i,
      /consultant/i, /specialist/i, /lead/i, /senior/i, /junior/i
    ];
    return jobTitlePatterns.some(pattern => pattern.test(text));
  }

  isCompanyName(text) {
    return text.length > 2 && text.length < 50 && 
           !/\d{4}/.test(text) && // Not a year
           !/@/.test(text); // Not an email
  }

  isDuration(text) {
    return /\d{4}|\d+\s+(years?|months?|yrs?|mos?)/.test(text);
  }

  isDegree(text) {
    const degreePatterns = [
      /bachelor/i, /master/i, /phd/i, /doctorate/i, /diploma/i,
      /b\.?s\.?/i, /m\.?s\.?/i, /b\.?a\.?/i, /m\.?a\.?/i
    ];
    return degreePatterns.some(pattern => pattern.test(text));
  }

  extractTechnologies(text) {
    const technologies = [];
    const techPatterns = [
      /\b(JavaScript|Python|Java|C\+\+|C#|Ruby|PHP|Go|Rust)\b/gi,
      /\b(React|Angular|Vue|Node\.js|Express|Django|Flask)\b/gi,
      /\b(MongoDB|PostgreSQL|MySQL|Redis|Elasticsearch)\b/gi,
      /\b(AWS|Azure|GCP|Docker|Kubernetes|Jenkins)\b/gi
    ];
    
    for (const pattern of techPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        technologies.push(...matches);
      }
    }
    
    return [...new Set(technologies)];
  }

  /**
   * Calculate analysis scores and insights
   */
  async calculateAnalysis(resumeData, nlpData) {
    const analysis = {
      completeness: 0,
      experienceLevel: 'Entry',
      technicalDepth: 0,
      insights: [],
      keywords: nlpData.keywords || [],
      readabilityScore: 0
    };
    
    // Calculate completeness score
    let completenessFactors = 0;
    if (resumeData.contactInfo.email) completenessFactors++;
    if (resumeData.contactInfo.phone) completenessFactors++;
    if (resumeData.experience.length > 0) completenessFactors++;
    if (resumeData.education.length > 0) completenessFactors++;
    if (resumeData.skills.length > 0) completenessFactors++;
    
    analysis.completeness = (completenessFactors / 5) * 100;
    
    // Determine experience level
    const totalExperience = resumeData.experience.length;
    if (totalExperience >= 5) {
      analysis.experienceLevel = 'Senior';
    } else if (totalExperience >= 2) {
      analysis.experienceLevel = 'Mid-level';
    }
    
    // Calculate technical depth
    analysis.technicalDepth = Math.min(resumeData.skills.length * 5, 100);
    
    // Generate insights
    if (analysis.completeness < 60) {
      analysis.insights.push('Resume could benefit from more complete contact information');
    }
    
    if (resumeData.skills.length < 5) {
      analysis.insights.push('Consider adding more technical skills');
    }
    
    if (resumeData.experience.length === 0) {
      analysis.insights.push('No work experience found - consider adding internships or projects');
    }
    
    return analysis;
  }

  /**
   * Match resume against job requirements
   */
  async matchWithRequirement(resumeData, jobRequirement) {
    try {
      const matchResult = await nlpService.calculateMatch(
        resumeData,
        jobRequirement,
        { includeReasons: true }
      );
      
      return {
        overallScore: matchResult.score,
        skillsMatch: matchResult.skillsMatch,
        experienceMatch: matchResult.experienceMatch,
        educationMatch: matchResult.educationMatch,
        reasons: matchResult.reasons,
        recommendations: matchResult.recommendations
      };
      
    } catch (error) {
      logger.error('Resume matching failed:', error);
      throw new ProcessingError(`Resume matching failed: ${error.message}`);
    }
  }

  /**
   * Save processed resume data
   */
  async saveProcessedResume(resumeData, filePath) {
    try {
      const outputPath = path.join(this.tempDir, `processed_${Date.now()}.json`);
      await fs.writeFile(outputPath, JSON.stringify(resumeData, null, 2));
      
      logger.info(`Processed resume saved to: ${outputPath}`);
      return outputPath;
      
    } catch (error) {
      logger.error('Failed to save processed resume:', error);
      throw new ProcessingError(`Failed to save processed resume: ${error.message}`);
    }
  }

  /**
   * Cleanup temporary files
   */
  async cleanup(filePaths) {
    for (const filePath of filePaths) {
      try {
        await fs.unlink(filePath);
        logger.info(`Cleaned up temporary file: ${filePath}`);
      } catch (error) {
        logger.warn(`Failed to cleanup file ${filePath}:`, error.message);
      }
    }
  }
}

// Export singleton instance
module.exports = new PDFService();