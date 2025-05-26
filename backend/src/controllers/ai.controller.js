const aiService = require('../services/ai.service');
const Requirement = require('../models/Requirement');
const Submission = require('../models/Submission');
const MatchScore = require('../models/MatchScore');

class AIController {
  /**
   * Analyze candidate profile/resume against job requirement
   */
  async analyzeCandidate(req, res) {
    try {
      const { requirementId, linkedinUrl } = req.body;
      const resumeFile = req.files?.resume;

      if (!requirementId) {
        return res.status(400).json({ 
          message: 'Requirement ID is required' 
        });
      }

      if (!resumeFile && !linkedinUrl) {
        return res.status(400).json({ 
          message: 'Either resume file or LinkedIn URL is required' 
        });
      }

      // Get requirement details
      const requirement = await Requirement.findById(requirementId);
      if (!requirement) {
        return res.status(404).json({ 
          message: 'Requirement not found' 
        });
      }

      let candidateData = '';

      // Process resume file if provided
      if (resumeFile) {
        if (resumeFile.mimetype !== 'application/pdf') {
          return res.status(400).json({ 
            message: 'Only PDF files are supported for resume upload' 
          });
        }

        try {
          candidateData = await aiService.parsePDFResume(resumeFile.data);
        } catch (error) {
          console.error('PDF parsing error:', error);
          return res.status(500).json({ 
            message: 'Failed to parse PDF resume' 
          });
        }
      }

      // Process LinkedIn profile if provided
      if (linkedinUrl) {
        try {
          const linkedinData = await aiService.parseLinkedInProfile(linkedinUrl);
          candidateData += `\n\nLinkedIn Profile:\nName: ${linkedinData.name}\nHeadline: ${linkedinData.headline}\n`;
          
          if (linkedinData.experience && linkedinData.experience.length > 0) {
            candidateData += 'Experience:\n';
            linkedinData.experience.forEach(exp => {
              candidateData += `- ${exp.title} at ${exp.company} (${exp.duration})\n`;
            });
          }

          if (linkedinData.skills && linkedinData.skills.length > 0) {
            candidateData += `Skills: ${linkedinData.skills.join(', ')}\n`;
          }

          if (linkedinData.education && linkedinData.education.length > 0) {
            candidateData += 'Education:\n';
            linkedinData.education.forEach(edu => {
              candidateData += `- ${edu.degree} from ${edu.school} (${edu.year})\n`;
            });
          }
        } catch (error) {
          console.error('LinkedIn parsing error:', error);
          return res.status(500).json({ 
            message: 'Failed to parse LinkedIn profile' 
          });
        }
      }

      // Perform AI analysis
      const analysis = await aiService.analyzeResume(candidateData, requirement);

      res.json({
        success: true,
        analysis,
        message: 'Candidate analysis completed successfully'
      });

    } catch (error) {
      console.error('AI analysis error:', error);
      res.status(500).json({
        message: 'Failed to analyze candidate',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Parse resume from PDF file
   */
  async parseResume(req, res) {
    try {
      const resumeFile = req.files?.resume;

      if (!resumeFile) {
        return res.status(400).json({ 
          message: 'Resume file is required' 
        });
      }

      if (resumeFile.mimetype !== 'application/pdf') {
        return res.status(400).json({ 
          message: 'Only PDF files are supported' 
        });
      }

      const resumeText = await aiService.parsePDFResume(resumeFile.data);

      res.json({
        success: true,
        resumeText,
        message: 'Resume parsed successfully'
      });

    } catch (error) {
      console.error('Resume parsing error:', error);
      res.status(500).json({
        message: 'Failed to parse resume',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Parse LinkedIn profile from URL
   */
  async parseLinkedIn(req, res) {
    try {
      const { linkedinUrl } = req.body;

      if (!linkedinUrl) {
        return res.status(400).json({ 
          message: 'LinkedIn URL is required' 
        });
      }

      // Basic URL validation
      if (!linkedinUrl.includes('linkedin.com')) {
        return res.status(400).json({ 
          message: 'Invalid LinkedIn URL' 
        });
      }

      const profileData = await aiService.parseLinkedInProfile(linkedinUrl);

      res.json({
        success: true,
        profileData,
        message: 'LinkedIn profile parsed successfully'
      });

    } catch (error) {
      console.error('LinkedIn parsing error:', error);
      res.status(500).json({
        message: 'Failed to parse LinkedIn profile',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get match score details for a submission
   */
  async getMatchScore(req, res) {
    try {
      const { submissionId } = req.params;

      const matchScore = await MatchScore.findOne({ submissionId })
        .populate('submissionId', 'candidateName requirementId');

      if (!matchScore) {
        return res.status(404).json({ 
          message: 'Match score not found' 
        });
      }

      res.json({
        success: true,
        matchScore,
        message: 'Match score retrieved successfully'
      });

    } catch (error) {
      console.error('Get match score error:', error);
      res.status(500).json({
        message: 'Failed to retrieve match score',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Batch analyze multiple candidates for a requirement
   */
  async batchAnalyze(req, res) {
    try {
      const { requirementId, candidates } = req.body;

      if (!requirementId || !candidates || !Array.isArray(candidates)) {
        return res.status(400).json({ 
          message: 'Requirement ID and candidates array are required' 
        });
      }

      const requirement = await Requirement.findById(requirementId);
      if (!requirement) {
        return res.status(404).json({ 
          message: 'Requirement not found' 
        });
      }

      const results = [];

      for (const candidate of candidates) {
        try {
          let candidateData = candidate.resumeText || '';
          
          if (candidate.linkedinUrl) {
            const linkedinData = await aiService.parseLinkedInProfile(candidate.linkedinUrl);
            candidateData += `\n\nLinkedIn: ${linkedinData.name} - ${linkedinData.headline}`;
          }

          const analysis = await aiService.analyzeResume(candidateData, requirement);
          
          results.push({
            candidateId: candidate.id,
            candidateName: candidate.name,
            analysis,
            status: 'success'
          });
        } catch (error) {
          results.push({
            candidateId: candidate.id,
            candidateName: candidate.name,
            error: error.message,
            status: 'failed'
          });
        }
      }

      res.json({
        success: true,
        results,
        processed: results.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'failed').length,
        message: 'Batch analysis completed'
      });

    } catch (error) {
      console.error('Batch analysis error:', error);
      res.status(500).json({
        message: 'Failed to perform batch analysis',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get AI analysis statistics for admin dashboard
   */
  async getAnalysisStats(req, res) {
    try {
      const totalMatches = await MatchScore.countDocuments();
      const highScoreMatches = await MatchScore.countDocuments({ 
        overallScore: { $gte: 80 } 
      });
      const averageScore = await MatchScore.aggregate([
        {
          $group: {
            _id: null,
            avgScore: { $avg: '$overallScore' }
          }
        }
      ]);

      const recentAnalyses = await MatchScore.find()
        .populate('submissionId', 'candidateName createdAt')
        .sort({ createdAt: -1 })
        .limit(10);

      const stats = {
        totalAnalyses: totalMatches,
        highScoreMatches,
        averageScore: averageScore[0]?.avgScore || 0,
        highScorePercentage: totalMatches > 0 ? (highScoreMatches / totalMatches * 100) : 0,
        recentAnalyses
      };

      res.json({
        success: true,
        stats,
        message: 'Analysis statistics retrieved successfully'
      });

    } catch (error) {
      console.error('Get analysis stats error:', error);
      res.status(500).json({
        message: 'Failed to retrieve analysis statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Re-analyze a submission with updated criteria
   */
  async reAnalyze(req, res) {
    try {
      const { submissionId } = req.params;

      const submission = await Submission.findById(submissionId)
        .populate('requirementId');

      if (!submission) {
        return res.status(404).json({ 
          message: 'Submission not found' 
        });
      }

      // Get candidate data from existing submission
      let candidateData = `Name: ${submission.candidateName}\nEmail: ${submission.candidateEmail}`;
      
      if (submission.linkedinUrl) {
        const linkedinData = await aiService.parseLinkedInProfile(submission.linkedinUrl);
        candidateData += `\n\nLinkedIn: ${linkedinData.name} - ${linkedinData.headline}`;
      }

      // Perform new analysis
      const analysis = await aiService.analyzeResume(candidateData, submission.requirementId);

      // Update or create match score
      const matchScore = await MatchScore.findOneAndUpdate(
        { submissionId },
        {
          overallScore: analysis.overallScore,
          skillsMatch: analysis.skillsMatch,
          experienceMatch: analysis.experienceMatch,
          aiReasoning: analysis.reasoning,
          detailedAnalysis: {
            strengths: analysis.strengths,
            weaknesses: analysis.weaknesses,
            recommendations: analysis.recommendations
          }
        },
        { upsert: true, new: true }
      );

      res.json({
        success: true,
        analysis,
        matchScore,
        message: 'Re-analysis completed successfully'
      });

    } catch (error) {
      console.error('Re-analysis error:', error);
      res.status(500).json({
        message: 'Failed to re-analyze submission',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = new AIController();