const axios = require('axios');
const cheerio = require('cheerio');
const natural = require('natural');
const compromise = require('compromise');
const logger = require('winston');

class LinkedInService {
    constructor() {
        this.baseDelay = 2000; // 2 seconds base delay
        this.maxRetries = 3;
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        ];
    }

    /**
     * Extract profile data from LinkedIn URL
     * @param {string} linkedinUrl - LinkedIn profile URL
     * @returns {Object} Extracted profile data
     */
    async extractProfile(linkedinUrl) {
        try {
            logger.info(`Starting LinkedIn profile extraction for: ${linkedinUrl}`);

            // Validate LinkedIn URL
            if (!this.isValidLinkedInUrl(linkedinUrl)) {
                throw new Error('Invalid LinkedIn URL provided');
            }

            // Add delay to avoid rate limiting
            await this.randomDelay();

            const profileData = await this.scrapeProfile(linkedinUrl);
            const processedData = await this.processProfileData(profileData);

            logger.info('LinkedIn profile extraction completed successfully');
            return processedData;

        } catch (error) {
            logger.error(`LinkedIn extraction failed: ${error.message}`);
            throw new Error(`Failed to extract LinkedIn profile: ${error.message}`);
        }
    }

    /**
     * Validate LinkedIn URL format
     * @param {string} url - URL to validate
     * @returns {boolean} True if valid LinkedIn URL
     */
    isValidLinkedInUrl(url) {
        const linkedinRegex = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w\-\_\.]+\/?$/i;
        return linkedinRegex.test(url);
    }

    /**
     * Scrape LinkedIn profile with retry mechanism
     * @param {string} url - LinkedIn profile URL
     * @returns {Object} Raw scraped data
     */
    async scrapeProfile(url, retryCount = 0) {
        try {
            const headers = {
                'User-Agent': this.userAgents[Math.floor(Math.random() * this.userAgents.length)],
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            };

            const response = await axios.get(url, {
                headers,
                timeout: 30000,
                maxRedirects: 5,
                validateStatus: (status) => status < 500
            });

            if (response.status === 429) {
                throw new Error('Rate limited by LinkedIn');
            }

            if (response.status >= 400) {
                throw new Error(`HTTP ${response.status}: Unable to access profile`);
            }

            return this.parseLinkedInHTML(response.data);

        } catch (error) {
            if (retryCount < this.maxRetries) {
                logger.warn(`Retry ${retryCount + 1} for LinkedIn scraping: ${error.message}`);
                await this.exponentialBackoff(retryCount);
                return this.scrapeProfile(url, retryCount + 1);
            }
            throw error;
        }
    }

    /**
     * Parse LinkedIn HTML content
     * @param {string} html - HTML content from LinkedIn
     * @returns {Object} Parsed profile data
     */
    parseLinkedInHTML(html) {
        const $ = cheerio.load(html);
        
        // LinkedIn often blocks scraping, so we'll extract what we can
        const profile = {
            name: this.extractName($),
            headline: this.extractHeadline($),
            location: this.extractLocation($),
            summary: this.extractSummary($),
            experience: this.extractExperience($),
            education: this.extractEducation($),
            skills: this.extractSkills($),
            connections: this.extractConnections($),
            rawText: $.text()
        };

        return profile;
    }

    /**
     * Extract name from LinkedIn profile
     * @param {Object} $ - Cheerio object
     * @returns {string} Extracted name
     */
    extractName($) {
        const selectors = [
            'h1.text-heading-xlarge',
            '.pv-text-details__left-panel h1',
            '.top-card-layout__title',
            'h1[data-test-id="profile-name"]',
            '.profile-photo-edit__preview'
        ];

        for (const selector of selectors) {
            const name = $(selector).first().text().trim();
            if (name && name.length > 0) {
                return name;
            }
        }

        // Fallback: extract from title tag
        const title = $('title').text();
        if (title) {
            const match = title.match(/^([^|]+)/);
            if (match) {
                return match[1].trim();
            }
        }

        return '';
    }

    /**
     * Extract headline from LinkedIn profile
     * @param {Object} $ - Cheerio object
     * @returns {string} Extracted headline
     */
    extractHeadline($) {
        const selectors = [
            '.text-body-medium.break-words',
            '.pv-text-details__left-panel .text-body-medium',
            '.top-card-layout__headline',
            '[data-test-id="profile-headline"]'
        ];

        for (const selector of selectors) {
            const headline = $(selector).first().text().trim();
            if (headline && headline.length > 0) {
                return headline;
            }
        }

        return '';
    }

    /**
     * Extract location from LinkedIn profile
     * @param {Object} $ - Cheerio object
     * @returns {string} Extracted location
     */
    extractLocation($) {
        const selectors = [
            '.text-body-small.inline.t-black--light.break-words',
            '.pv-text-details__left-panel .text-body-small',
            '.top-card__subline-item',
            '[data-test-id="profile-location"]'
        ];

        for (const selector of selectors) {
            const location = $(selector).first().text().trim();
            if (location && location.length > 0 && !location.includes('connection')) {
                return location;
            }
        }

        return '';
    }

    /**
     * Extract summary/about section
     * @param {Object} $ - Cheerio object
     * @returns {string} Extracted summary
     */
    extractSummary($) {
        const selectors = [
            '#about .pv-shared-text-with-see-more .full-width',
            '.pv-about__summary-text .lt-line-clamp__raw-line',
            '.summary-section .pv-about__summary-text',
            '[data-test-id="about-section"]'
        ];

        for (const selector of selectors) {
            const summary = $(selector).first().text().trim();
            if (summary && summary.length > 0) {
                return summary;
            }
        }

        return '';
    }

    /**
     * Extract experience information
     * @param {Object} $ - Cheerio object
     * @returns {Array} Array of experience objects
     */
    extractExperience($) {
        const experiences = [];
        
        const experienceSelectors = [
            '#experience ~ .pvs-list__outer-container .pvs-entity',
            '.pv-profile-section__section-info .pv-entity__summary-info',
            '[data-test-id="experience-section"] .pvs-entity'
        ];

        experienceSelectors.forEach(selector => {
            $(selector).each((i, element) => {
                const $exp = $(element);
                const title = $exp.find('.mr1.t-bold span').first().text().trim() ||
                             $exp.find('.pv-entity__summary-info h3').first().text().trim();
                const company = $exp.find('.t-14.t-normal span').first().text().trim() ||
                               $exp.find('.pv-entity__secondary-title').first().text().trim();
                const duration = $exp.find('.t-14.t-normal.t-black--light span').first().text().trim() ||
                                $exp.find('.pv-entity__dates span').first().text().trim();

                if (title && company) {
                    experiences.push({
                        title: title,
                        company: company,
                        duration: duration,
                        description: $exp.find('.pv-shared-text-with-see-more').text().trim()
                    });
                }
            });
        });

        return experiences;
    }

    /**
     * Extract education information
     * @param {Object} $ - Cheerio object
     * @returns {Array} Array of education objects
     */
    extractEducation($) {
        const education = [];
        
        const educationSelectors = [
            '#education ~ .pvs-list__outer-container .pvs-entity',
            '.pv-profile-section.education-section .pv-entity__summary-info',
            '[data-test-id="education-section"] .pvs-entity'
        ];

        educationSelectors.forEach(selector => {
            $(selector).each((i, element) => {
                const $edu = $(element);
                const school = $edu.find('.mr1.t-bold span').first().text().trim() ||
                              $edu.find('.pv-entity__school-name').first().text().trim();
                const degree = $edu.find('.t-14.t-normal span').first().text().trim() ||
                              $edu.find('.pv-entity__degree-name').first().text().trim();
                const year = $edu.find('.t-14.t-normal.t-black--light span').first().text().trim() ||
                            $edu.find('.pv-entity__dates span').first().text().trim();

                if (school) {
                    education.push({
                        school: school,
                        degree: degree,
                        year: year
                    });
                }
            });
        });

        return education;
    }

    /**
     * Extract skills information
     * @param {Object} $ - Cheerio object
     * @returns {Array} Array of skills
     */
    extractSkills($) {
        const skills = [];
        
        const skillSelectors = [
            '#skills ~ .pvs-list__outer-container .mr1.t-bold span',
            '.pv-skill-category-entity__name span',
            '[data-test-id="skills-section"] .pvs-entity .mr1.t-bold span'
        ];

        skillSelectors.forEach(selector => {
            $(selector).each((i, element) => {
                const skill = $(element).text().trim();
                if (skill && !skills.includes(skill)) {
                    skills.push(skill);
                }
            });
        });

        return skills;
    }

    /**
     * Extract connection count
     * @param {Object} $ - Cheerio object
     * @returns {string} Connection count
     */
    extractConnections($) {
        const selectors = [
            '.t-black--light.t-normal .link-without-visited-state',
            '.pv-top-card--list-bullet span',
            '[data-test-id="profile-connections"]'
        ];

        for (const selector of selectors) {
            const connectionText = $(selector).text().trim();
            if (connectionText.includes('connection')) {
                return connectionText;
            }
        }

        return '';
    }

    /**
     * Process and enrich the extracted profile data
     * @param {Object} rawData - Raw scraped data
     * @returns {Object} Processed profile data
     */
    async processProfileData(rawData) {
        const processedData = {
            ...rawData,
            extractedKeywords: this.extractKeywords(rawData),
            skillCategories: this.categorizeSkills(rawData.skills),
            experienceYears: this.calculateExperienceYears(rawData.experience),
            industries: this.identifyIndustries(rawData),
            seniority: this.determineSeniority(rawData),
            timestamp: new Date().toISOString()
        };

        return processedData;
    }

    /**
     * Extract keywords from profile text using NLP
     * @param {Object} profileData - Profile data
     * @returns {Array} Array of keywords
     */
    extractKeywords(profileData) {
        const allText = [
            profileData.name,
            profileData.headline,
            profileData.summary,
            ...profileData.experience.map(exp => `${exp.title} ${exp.company} ${exp.description}`),
            ...profileData.education.map(edu => `${edu.school} ${edu.degree}`),
            ...profileData.skills
        ].join(' ');

        // Use natural for keyword extraction
        const tokens = natural.WordTokenizer().tokenize(allText.toLowerCase());
        const filteredTokens = tokens.filter(token => 
            token.length > 2 && 
            !natural.stopwords.includes(token) &&
            /^[a-zA-Z]+$/.test(token)
        );

        // Get frequency distribution
        const frequency = {};
        filteredTokens.forEach(token => {
            frequency[token] = (frequency[token] || 0) + 1;
        });

        // Return top keywords
        return Object.entries(frequency)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 20)
            .map(([word]) => word);
    }

    /**
     * Categorize skills into technical and soft skills
     * @param {Array} skills - Array of skills
     * @returns {Object} Categorized skills
     */
    categorizeSkills(skills) {
        const technicalSkills = [];
        const softSkills = [];
        const certifications = [];

        const techKeywords = [
            'javascript', 'python', 'java', 'react', 'node', 'sql', 'aws', 'docker',
            'kubernetes', 'git', 'angular', 'vue', 'mongodb', 'postgresql', 'redis',
            'tensorflow', 'machine learning', 'data science', 'ai', 'blockchain'
        ];

        const softKeywords = [
            'leadership', 'communication', 'teamwork', 'problem solving', 'creativity',
            'adaptability', 'time management', 'critical thinking', 'collaboration'
        ];

        const certKeywords = [
            'certified', 'certification', 'aws certified', 'pmp', 'scrum master',
            'cissp', 'cisa', 'comptia', 'microsoft certified', 'google certified'
        ];

        skills.forEach(skill => {
            const lowerSkill = skill.toLowerCase();
            
            if (certKeywords.some(cert => lowerSkill.includes(cert))) {
                certifications.push(skill);
            } else if (techKeywords.some(tech => lowerSkill.includes(tech))) {
                technicalSkills.push(skill);
            } else if (softKeywords.some(soft => lowerSkill.includes(soft))) {
                softSkills.push(skill);
            } else {
                // Default to technical if uncertain
                technicalSkills.push(skill);
            }
        });

        return {
            technical: technicalSkills,
            soft: softSkills,
            certifications: certifications
        };
    }

    /**
     * Calculate total years of experience
     * @param {Array} experiences - Array of experience objects
     * @returns {number} Years of experience
     */
    calculateExperienceYears(experiences) {
        let totalMonths = 0;

        experiences.forEach(exp => {
            if (exp.duration) {
                const months = this.parseDurationToMonths(exp.duration);
                totalMonths += months;
            }
        });

        return Math.round(totalMonths / 12 * 10) / 10; // Round to 1 decimal place
    }

    /**
     * Parse duration string to months
     * @param {string} duration - Duration string like "2 yrs 3 mos"
     * @returns {number} Duration in months
     */
    parseDurationToMonths(duration) {
        let months = 0;
        
        // Match years
        const yearMatch = duration.match(/(\d+)\s*(?:yr|year)/i);
        if (yearMatch) {
            months += parseInt(yearMatch[1]) * 12;
        }

        // Match months
        const monthMatch = duration.match(/(\d+)\s*(?:mo|month)/i);
        if (monthMatch) {
            months += parseInt(monthMatch[1]);
        }

        return months || 12; // Default to 1 year if parsing fails
    }

    /**
     * Identify industries from profile data
     * @param {Object} profileData - Profile data
     * @returns {Array} Array of identified industries
     */
    identifyIndustries(profileData) {
        const industries = [];
        const industryKeywords = {
            'Technology': ['software', 'tech', 'it', 'developer', 'engineer', 'programming'],
            'Finance': ['finance', 'banking', 'investment', 'trading', 'fintech'],
            'Healthcare': ['healthcare', 'medical', 'hospital', 'pharmaceutical', 'biotech'],
            'Consulting': ['consulting', 'consultant', 'advisory', 'strategy'],
            'E-commerce': ['e-commerce', 'retail', 'marketplace', 'online'],
            'Marketing': ['marketing', 'advertising', 'brand', 'digital marketing'],
            'Education': ['education', 'teaching', 'university', 'school', 'training']
        };

        const allText = [
            profileData.headline,
            profileData.summary,
            ...profileData.experience.map(exp => `${exp.title} ${exp.company}`)
        ].join(' ').toLowerCase();

        Object.entries(industryKeywords).forEach(([industry, keywords]) => {
            if (keywords.some(keyword => allText.includes(keyword))) {
                industries.push(industry);
            }
        });

        return industries;
    }

    /**
     * Determine seniority level
     * @param {Object} profileData - Profile data
     * @returns {string} Seniority level
     */
    determineSeniority(profileData) {
        const experienceYears = this.calculateExperienceYears(profileData.experience);
        const title = (profileData.headline || '').toLowerCase();

        // Check for senior/lead titles
        if (title.includes('director') || title.includes('vp') || title.includes('head of')) {
            return 'Director+';
        }
        
        if (title.includes('senior') || title.includes('lead') || title.includes('principal')) {
            return 'Senior';
        }

        if (title.includes('manager') || title.includes('supervisor')) {
            return 'Manager';
        }

        // Fallback to experience years
        if (experienceYears >= 8) return 'Senior';
        if (experienceYears >= 4) return 'Mid-level';
        return 'Junior';
    }

    /**
     * Add random delay to avoid rate limiting
     * @returns {Promise} Promise that resolves after delay
     */
    async randomDelay() {
        const delay = this.baseDelay + Math.random() * 2000; // 2-4 seconds
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Exponential backoff for retries
     * @param {number} retryCount - Current retry count
     * @returns {Promise} Promise that resolves after delay
     */
    async exponentialBackoff(retryCount) {
        const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Fallback method for when scraping fails
     * Returns a basic profile structure for manual input
     * @param {string} linkedinUrl - LinkedIn URL
     * @returns {Object} Basic profile structure
     */
    createFallbackProfile(linkedinUrl) {
        return {
            name: '',
            headline: '',
            location: '',
            summary: '',
            experience: [],
            education: [],
            skills: [],
            connections: '',
            linkedinUrl: linkedinUrl,
            extractedKeywords: [],
            skillCategories: { technical: [], soft: [], certifications: [] },
            experienceYears: 0,
            industries: [],
            seniority: 'Unknown',
            extractionMethod: 'fallback',
            timestamp: new Date().toISOString(),
            requiresManualInput: true
        };
    }

    /**
     * Validate extracted profile data
     * @param {Object} profileData - Extracted profile data
     * @returns {Object} Validation result
     */
    validateProfileData(profileData) {
        const validation = {
            isValid: true,
            missingFields: [],
            warnings: []
        };

        // Check required fields
        const requiredFields = ['name', 'headline'];
        requiredFields.forEach(field => {
            if (!profileData[field] || profileData[field].trim() === '') {
                validation.missingFields.push(field);
                validation.isValid = false;
            }
        });

        // Check for warnings
        if (!profileData.experience || profileData.experience.length === 0) {
            validation.warnings.push('No experience information found');
        }

        if (!profileData.skills || profileData.skills.length === 0) {
            validation.warnings.push('No skills information found');
        }

        if (!profileData.summary || profileData.summary.trim() === '') {
            validation.warnings.push('No summary/about section found');
        }

        return validation;
    }
}

module.exports = LinkedInService;