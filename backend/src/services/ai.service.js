const OpenAI = require('openai');
const axios = require('axios');
const cheerio = require('cheerio');
const pdf = require('pdf-parse');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class AIService {
  async analyzeResume(resumeText, requirementData) {
    try {
      const prompt = this.buildAnalysisPrompt(resumeText, requirementData);
      
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are an expert HR analyst specializing in candidate-job matching. Provide detailed, objective analysis with numerical scores."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3
      });

      return this.parseAIResponse(completion.choices[0].message.content);
    } catch (error) {
      console.error('AI analysis error:', error);
      throw new Error('Failed to analyze resume with AI');
    }
  }

  async parseLinkedInProfile(linkedinUrl) {
    try {
      // Note: In production, use official LinkedIn API or specialized scraping services
      // This is a simplified example
      const response = await axios.get(linkedinUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      
      return {
        name: $('h1').first().text().trim(),
        headline: $('.text-body-medium').first().text().trim(),
        experience: this.extractExperience($),
        skills: this.extractSkills($),
        education: this.extractEducation($)
      };
    } catch (error) {
      console.error('LinkedIn parsing error:', error);
      throw new Error('Failed to parse LinkedIn profile');
    }
  }

  async parsePDFResume(buffer) {
    try {
      const data = await pdf(buffer);
      return data.text;
    } catch (error) {
      console.error('PDF parsing error:', error);
      throw new Error('Failed to parse PDF resume');
    }
  }

  buildAnalysisPrompt(candidateData, requirement) {
    return `
Analyze the following candidate against the job requirement and provide a detailed matching score:

CANDIDATE PROFILE:
${candidateData}

JOB REQUIREMENT:
Title: ${requirement.title}
Description: ${requirement.description}
Required Skills: ${requirement.skills.join(', ')}
Experience: ${requirement.experience.min}-${requirement.experience.max} years
Location: ${requirement.location}

Please provide your analysis in the following JSON format:
{
  "overallScore": <number 0-100>,
  "skillsMatch": {
    "score": <number 0-100>,
    "matchedSkills": ["skill1", "skill2"],
    "missingSkills": ["skill3", "skill4"]
  },
  "experienceMatch": {
    "score": <number 0-100>,
    "candidateYears": <number>,
    "analysis": "brief explanation"
  },
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "recommendations": ["rec1", "rec2"],
  "reasoning": "Detailed explanation of the overall score and key factors"
}
`;
  }

  parseAIResponse(response) {
    try {
      // Extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No valid JSON found in AI response');
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      // Return default structure if parsing fails
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

  extractExperience($) {
    // Simplified extraction logic
    const experiences = [];
    $('.experience-section .experience-item').each((i, elem) => {
      experiences.push({
        title: $(elem).find('.title').text().trim(),
        company: $(elem).find('.company').text().trim(),
        duration: $(elem).find('.duration').text().trim()
      });
    });
    return experiences;
  }

  extractSkills($) {
    const skills = [];
    $('.skills-section .skill-item').each((i, elem) => {
      skills.push($(elem).text().trim());
    });
    return skills;
  }

  extractEducation($) {
    const education = [];
    $('.education-section .education-item').each((i, elem) => {
      education.push({
        degree: $(elem).find('.degree').text().trim(),
        school: $(elem).find('.school').text().trim(),
        year: $(elem).find('.year').text().trim()
      });
    });
    return education;
  }
}

module.exports = new AIService();