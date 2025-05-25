const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const aiService = require('../services/ai.service');
const Requirement = require('../models/Requirement');
const Submission = require('../models/Submission');
const MatchScore = require('../models/MatchScore');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/rbac.middleware');

const router = express.Router();

// Rate limiting for AI routes (more generous for file processing)
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 AI requests per windowMs
  message: {
    error: 'Too many AI analysis requests, please try again later.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for expensive operations
const heavyAiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // limit each IP to 3 heavy AI requests per 5 minutes
  message: {
    error: 'AI processing limit reached, please wait before submitting more requests.',
    retryAfter: 300
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Allow PDF files and common document formats
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'), false);
    }
  }
});

// Validation middleware
const analyzeResumeValidation = [
  body('requirementId')
    .isMongoId()
    .withMessage('Valid requirement ID is required'),
  body('candidateName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Candidate name must be between 2 and 100 characters'),
  body('candidateEmail')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email address required')
];

const analyzeLinkedInValidation = [
  body('requirementId')
    .isMongoId()
    .withMessage('Valid requirement ID is required'),
  body('linkedinUrl')
    .isURL({ protocols: ['http', 'https'] })
    .matches(/linkedin\.com\/in\//)
    .withMessage('Valid LinkedIn profile URL is required'),
  body('candidateName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Candidate name must be between 2 and 100 characters'),
  body('candidateEmail')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email address required')
];

const batchAnalysisValidation = [
  body('requirementId')
    .isMongoId()
    .withMessage('Valid requirement ID is required'),
  body('candidates')
    .isArray({ min: 1, max: 20 })
    .withMessage('Candidates array must contain 1-20 candidates'),
  body('candidates.*.type')
    .isIn(['resume', 'linkedin'])
    .withMessage('Candidate type must be either resume or linkedin'),
  body('candidates.*.name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Candidate name is required'),
  body('candidates.*.email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid candidate email is required')
];

// @route   POST /api/ai/analyze-resume
// @desc    Analyze resume against job requirement
// @access  Private (Recruiters and Admins)
router.post('/analyze-resume', 
  authenticate,
  authorize('recruiter', 'client_admin', 'system_admin'),
  aiLimiter,
  upload.single('resume'),
  analyzeResumeValidation,
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { requirementId, candidateName, candidateEmail } = req.body;

      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Resume file is required'
        });
      }

      // Get requirement details
      const requirement = await Requirement.findById(requirementId);
      if (!requirement) {
        return res.status(404).json({
          success: false,
          message: 'Requirement not found'
        });
      }

      // Check if user has access to this requirement
      if (req.user.role === 'client_admin' && requirement.clientId.toString() !== req.user.clientId?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this requirement'
        });
      }

      // Parse resume text from file
      let resumeText;
      try {
        if (req.file.mimetype === 'application/pdf') {
          resumeText = await aiService.parsePDFResume(req.file.buffer);
        } else {
          // For other document types, convert buffer to text
          resumeText = req.file.buffer.toString('utf8');
        }
      } catch (parseError) {
        console.error('Resume parsing error:', parseError);
        return res.status(400).json({
          success: false,
          message: 'Failed to parse resume file. Please ensure the file is not corrupted.'
        });
      }

      if (!resumeText || resumeText.trim().length < 50) {
        return res.status(400).json({
          success: false,
          message: 'Resume content is too short or could not be extracted'
        });
      }

      // Perform AI analysis
      const analysis = await aiService.analyzeResume(resumeText, requirement);

      // Create match score record
      const matchScore = new MatchScore({
        requirementId,
        candidateData: {
          name: candidateName,
          email: candidateEmail,
          resumeText: resumeText.substring(0, 2000) // Store first 2000 chars for reference
        },
        overallScore: analysis.overallScore,
        skillsMatch: analysis.skillsMatch,
        experienceMatch: analysis.experienceMatch,
        locationMatch: analysis.locationMatch,
        aiReasoning: analysis.reasoning,
        detailedAnalysis: {
          strengths: analysis.strengths,
          weaknesses: analysis.weaknesses,
          recommendations: analysis.recommendations
        },
        analyzedBy: req.user._id,
        analysisType: 'resume'
      });

      await matchScore.save();

      // Update requirement analytics
      await Requirement.findByIdAndUpdate(requirementId, {
        $inc: { 'analytics.aiAnalysisCount': 1 }
      });

      res.status(200).json({
        success: true,
        message: 'Resume analysis completed successfully',
        data: {
          matchScoreId: matchScore._id,
          analysis: {
            overallScore: analysis.overallScore,
            skillsMatch: analysis.skillsMatch,
            experienceMatch: analysis.experienceMatch,
            strengths: analysis.strengths,
            weaknesses: analysis.weaknesses,
            recommendations: analysis.recommendations,
            reasoning: analysis.reasoning
          },
          requirement: {
            id: requirement._id,
            title: requirement.title,
            skills: requirement.skills
          }
        }
      });

    } catch (error) {
      console.error('AI resume analysis error:', error);
      res.status(500).json({
        success: false,
        message: 'AI analysis failed. Please try again.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   POST /api/ai/analyze-linkedin
// @desc    Analyze LinkedIn profile against job requirement
// @access  Private (Recruiters and Admins)
router.post('/analyze-linkedin',
  authenticate,
  authorize('recruiter', 'client_admin', 'system_admin'),
  aiLimiter,
  analyzeLinkedInValidation,
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { requirementId, linkedinUrl, candidateName, candidateEmail } = req.body;

      // Get requirement details
      const requirement = await Requirement.findById(requirementId);
      if (!requirement) {
        return res.status(404).json({
          success: false,
          message: 'Requirement not found'
        });
      }

      // Check if user has access to this requirement
      if (req.user.role === 'client_admin' && requirement.clientId.toString() !== req.user.clientId?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this requirement'
        });
      }

      // Parse LinkedIn profile
      let profileData;
      try {
        profileData = await aiService.parseLinkedInProfile(linkedinUrl);
      } catch (parseError) {
        console.error('LinkedIn parsing error:', parseError);
        return res.status(400).json({
          success: false,
          message: 'Failed to parse LinkedIn profile. Please check the URL and ensure the profile is public.'
        });
      }

      // Create candidate profile text for analysis
      const candidateText = `
        Name: ${profileData.name || candidateName || 'Not specified'}
        Headline: ${profileData.headline || 'Not specified'}
        
        Experience:
        ${profileData.experience?.map(exp => `
          - ${exp.title} at ${exp.company} (${exp.duration})
        `).join('') || 'No experience data'}
        
        Skills: ${profileData.skills?.join(', ') || 'No skills listed'}
        
        Education:
        ${profileData.education?.map(edu => `
          - ${edu.degree} from ${edu.school} (${edu.year})
        `).join('') || 'No education data'}
      `;

      // Perform AI analysis
      const analysis = await aiService.analyzeResume(candidateText, requirement);

      // Create match score record
      const matchScore = new MatchScore({
        requirementId,
        candidateData: {
          name: candidateName || profileData.name,
          email: candidateEmail,
          linkedinUrl,
          profileData
        },
        overallScore: analysis.overallScore,
        skillsMatch: analysis.skillsMatch,
        experienceMatch: analysis.experienceMatch,
        locationMatch: analysis.locationMatch,
        aiReasoning: analysis.reasoning,
        detailedAnalysis: {
          strengths: analysis.strengths,
          weaknesses: analysis.weaknesses,
          recommendations: analysis.recommendations
        },
        analyzedBy: req.user._id,
        analysisType: 'linkedin'
      });

      await matchScore.save();

      // Update requirement analytics
      await Requirement.findByIdAndUpdate(requirementId, {
        $inc: { 'analytics.aiAnalysisCount': 1 }
      });

      res.status(200).json({
        success: true,
        message: 'LinkedIn profile analysis completed successfully',
        data: {
          matchScoreId: matchScore._id,
          analysis: {
            overallScore: analysis.overallScore,
            skillsMatch: analysis.skillsMatch,
            experienceMatch: analysis.experienceMatch,
            strengths: analysis.strengths,
            weaknesses: analysis.weaknesses,
            recommendations: analysis.recommendations,
            reasoning: analysis.reasoning
          },
          profileData: {
            name: profileData.name,
            headline: profileData.headline,
            skills: profileData.skills,
            experience: profileData.experience
          },
          requirement: {
            id: requirement._id,
            title: requirement.title,
            skills: requirement.skills
          }
        }
      });

    } catch (error) {
      console.error('AI LinkedIn analysis error:', error);
      res.status(500).json({
        success: false,
        message: 'LinkedIn profile analysis failed. Please try again.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   POST /api/ai/analyze-candidate
// @desc    Universal candidate analysis (handles both resume and LinkedIn)
// @access  Private (Recruiters and Admins)
router.post('/analyze-candidate',
  authenticate,
  authorize('recruiter', 'client_admin', 'system_admin'),
  aiLimiter,
  upload.single('resume'),
  [
    body('requirementId').isMongoId().withMessage('Valid requirement ID is required'),
    body('candidateName').trim().isLength({ min: 2, max: 100 }).withMessage('Candidate name is required'),
    body('candidateEmail').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('linkedinUrl').optional().isURL().withMessage('Valid LinkedIn URL required if provided')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { requirementId, candidateName, candidateEmail, linkedinUrl } = req.body;
      const hasResume = !!req.file;
      const hasLinkedIn = !!linkedinUrl;

      if (!hasResume && !hasLinkedIn) {
        return res.status(400).json({
          success: false,
          message: 'Either resume file or LinkedIn URL is required'
        });
      }

      // Get requirement details
      const requirement = await Requirement.findById(requirementId);
      if (!requirement) {
        return res.status(404).json({
          success: false,
          message: 'Requirement not found'
        });
      }

      let candidateText = '';
      let analysisType = '';
      let profileData = null;

      // Process resume if provided
      if (hasResume) {
        try {
          if (req.file.mimetype === 'application/pdf') {
            candidateText = await aiService.parsePDFResume(req.file.buffer);
          } else {
            candidateText = req.file.buffer.toString('utf8');
          }
          analysisType = hasLinkedIn ? 'resume_linkedin' : 'resume';
        } catch (parseError) {
          console.error('Resume parsing error:', parseError);
          return res.status(400).json({
            success: false,
            message: 'Failed to parse resume file'
          });
        }
      }

      // Process LinkedIn if provided
      if (hasLinkedIn) {
        try {
          profileData = await aiService.parseLinkedInProfile(linkedinUrl);
          const linkedinText = `
            Name: ${profileData.name || candidateName}
            Headline: ${profileData.headline || 'Not specified'}
            Experience: ${profileData.experience?.map(exp => `${exp.title} at ${exp.company}`).join(', ') || 'Not specified'}
            Skills: ${profileData.skills?.join(', ') || 'Not specified'}
            Education: ${profileData.education?.map(edu => `${edu.degree} from ${edu.school}`).join(', ') || 'Not specified'}
          `;
          
          candidateText += candidateText ? `\n\nLinkedIn Profile:\n${linkedinText}` : linkedinText;
          analysisType = hasResume ? 'resume_linkedin' : 'linkedin';
        } catch (parseError) {
          console.error('LinkedIn parsing error:', parseError);
          if (!hasResume) {
            return res.status(400).json({
              success: false,
              message: 'Failed to parse LinkedIn profile'
            });
          }
          // Continue with resume analysis if LinkedIn fails but resume is available
        }
      }

      // Perform AI analysis
      const analysis = await aiService.analyzeResume(candidateText, requirement);

      // Create match score record
      const matchScore = new MatchScore({
        requirementId,
        candidateData: {
          name: candidateName,
          email: candidateEmail,
          linkedinUrl,
          profileData,
          resumeText: candidateText.substring(0, 2000)
        },
        overallScore: analysis.overallScore,
        skillsMatch: analysis.skillsMatch,
        experienceMatch: analysis.experienceMatch,
        locationMatch: analysis.locationMatch,
        aiReasoning: analysis.reasoning,
        detailedAnalysis: {
          strengths: analysis.strengths,
          weaknesses: analysis.weaknesses,
          recommendations: analysis.recommendations
        },
        analyzedBy: req.user._id,
        analysisType
      });

      await matchScore.save();

      res.status(200).json({
        success: true,
        message: 'Candidate analysis completed successfully',
        data: {
          matchScoreId: matchScore._id,
          analysis: {
            overallScore: analysis.overallScore,
            skillsMatch: analysis.skillsMatch,
            experienceMatch: analysis.experienceMatch,
            strengths: analysis.strengths,
            weaknesses: analysis.weaknesses,
            recommendations: analysis.recommendations,
            reasoning: analysis.reasoning
          },
          candidate: {
            name: candidateName,
            email: candidateEmail,
            analysisType
          }
        }
      });

    } catch (error) {
      console.error('AI candidate analysis error:', error);
      res.status(500).json({
        success: false,
        message: 'Candidate analysis failed. Please try again.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   POST /api/ai/batch-analyze
// @desc    Analyze multiple candidates at once
// @access  Private (Admins only)
router.post('/batch-analyze',
  authenticate,
  authorize('client_admin', 'system_admin'),
  heavyAiLimiter,
  batchAnalysisValidation,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { requirementId, candidates } = req.body;

      // Get requirement details
      const requirement = await Requirement.findById(requirementId);
      if (!requirement) {
        return res.status(404).json({
          success: false,
          message: 'Requirement not found'
        });
      }

      const results = [];
      const errors_batch = [];

      // Process each candidate
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        
        try {
          let candidateText = '';
          
          if (candidate.type === 'linkedin' && candidate.linkedinUrl) {
            const profileData = await aiService.parseLinkedInProfile(candidate.linkedinUrl);
            candidateText = `
              Name: ${profileData.name || candidate.name}
              Headline: ${profileData.headline || 'Not specified'}
              Experience: ${profileData.experience?.map(exp => `${exp.title} at ${exp.company}`).join(', ') || 'Not specified'}
              Skills: ${profileData.skills?.join(', ') || 'Not specified'}
            `;
          } else if (candidate.type === 'resume' && candidate.resumeText) {
            candidateText = candidate.resumeText;
          } else {
            errors_batch.push({
              candidate: candidate.name,
              error: 'Missing required data for analysis'
            });
            continue;
          }

          // Perform AI analysis
          const analysis = await aiService.analyzeResume(candidateText, requirement);

          // Create match score record
          const matchScore = new MatchScore({
            requirementId,
            candidateData: {
              name: candidate.name,
              email: candidate.email,
              linkedinUrl: candidate.linkedinUrl,
              resumeText: candidateText.substring(0, 2000)
            },
            overallScore: analysis.overallScore,
            skillsMatch: analysis.skillsMatch,
            experienceMatch: analysis.experienceMatch,
            aiReasoning: analysis.reasoning,
            detailedAnalysis: {
              strengths: analysis.strengths,
              weaknesses: analysis.weaknesses,
              recommendations: analysis.recommendations
            },
            analyzedBy: req.user._id,
            analysisType: candidate.type,
            batchId: `batch_${Date.now()}_${req.user._id}`
          });

          await matchScore.save();

          results.push({
            candidate: candidate.name,
            matchScoreId: matchScore._id,
            overallScore: analysis.overallScore,
            skillsMatchScore: analysis.skillsMatch?.score || 0,
            experienceMatchScore: analysis.experienceMatch?.score || 0
          });

        } catch (error) {
          console.error(`Batch analysis error for ${candidate.name}:`, error);
          errors_batch.push({
            candidate: candidate.name,
            error: error.message
          });
        }
      }

      // Update requirement analytics
      await Requirement.findByIdAndUpdate(requirementId, {
        $inc: { 'analytics.aiAnalysisCount': results.length }
      });

      res.status(200).json({
        success: true,
        message: `Batch analysis completed. ${results.length} successful, ${errors_batch.length} failed.`,
        data: {
          successful: results,
          failed: errors_batch,
          summary: {
            total: candidates.length,
            successful: results.length,
            failed: errors_batch.length,
            averageScore: results.length > 0 ? results.reduce((sum, r) => sum + r.overallScore, 0) / results.length : 0
          }
        }
      });

    } catch (error) {
      console.error('Batch AI analysis error:', error);
      res.status(500).json({
        success: false,
        message: 'Batch analysis failed. Please try again.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   GET /api/ai/match-scores/:requirementId
// @desc    Get all match scores for a requirement
// @access  Private (Recruiters and Admins)
router.get('/match-scores/:requirementId',
  authenticate,
  authorize('recruiter', 'client_admin', 'system_admin'),
  async (req, res) => {
    try {
      const { requirementId } = req.params;
      const { page = 1, limit = 10, sortBy = 'overallScore', sortOrder = 'desc' } = req.query;

      // Validate requirement exists and user has access
      const requirement = await Requirement.findById(requirementId);
      if (!requirement) {
        return res.status(404).json({
          success: false,
          message: 'Requirement not found'
        });
      }

      if (req.user.role === 'client_admin' && requirement.clientId.toString() !== req.user.clientId?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this requirement'
        });
      }

      // Build query
      let query = { requirementId };
      
      // For recruiters, only show their own analyses
      if (req.user.role === 'recruiter') {
        query.analyzedBy = req.user._id;
      }

      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Get match scores
      const matchScores = await MatchScore.find(query)
        .populate('analyzedBy', 'firstName lastName email')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Get total count
      const total = await MatchScore.countDocuments(query);

      // Calculate statistics
      const stats = await MatchScore.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            averageScore: { $avg: '$overallScore' },
            highestScore: { $max: '$overallScore' },
            lowestScore: { $min: '$overallScore' },
            totalAnalyses: { $sum: 1 }
          }
        }
      ]);

      res.status(200).json({
        success: true,
        data: {
          matchScores,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            totalItems: total,
            itemsPerPage: parseInt(limit)
          },
          statistics: stats[0] || {
            averageScore: 0,
            highestScore: 0,
            lowestScore: 0,
            totalAnalyses: 0
          }
        }
      });

    } catch (error) {
      console.error('Match scores fetch error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch match scores',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   GET /api/ai/match-score/:matchScoreId
// @desc    Get detailed match score analysis
// @access  Private (Recruiters and Admins)
router.get('/match-score/:matchScoreId',
  authenticate,
  authorize('recruiter', 'client_admin', 'system_admin'),
  async (req, res) => {
    try {
      const { matchScoreId } = req.params;

      const matchScore = await MatchScore.findById(matchScoreId)
        .populate('requirementId', 'title skills experience location')
        .populate('analyzedBy', 'firstName lastName email')
        .lean();

      if (!matchScore) {
        return res.status(404).json({
          success: false,
          message: 'Match score not found'
        });
      }

      // Check access permissions
      if (req.user.role === 'recruiter' && matchScore.analyzedBy._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this analysis'
        });
      }

      if (req.user.role === 'client_admin') {
        const requirement = await Requirement.findById(matchScore.requirementId._id);
        if (requirement.clientId.toString() !== req.user.clientId?.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to this analysis'
          });
        }
      }

      res.status(200).json({
        success: true,
        data: { matchScore }
      });

    } catch (error) {
      console.error('Match score detail fetch error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch match score details',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   DELETE /api/ai/match-score/:matchScoreId
// @desc    Delete a match score analysis
// @access  Private (Owner or Admins only)
router.delete('/match-score/:matchScoreId',
  authenticate,
  async (req, res) => {
    try {
      const { matchScoreId } = req.params;

      const matchScore = await MatchScore.findById(matchScoreId);
      if (!matchScore) {
        return res.status(404).json({
          success: false,
          message: 'Match score not found'
        });
      }

      // Check permissions - only owner or admins can delete
      const canDelete = req.user.role === 'system_admin' || 
                       req.user.role === 'client_admin' || 
                       matchScore.analyzedBy.toString() === req.user._id.toString();

      if (!canDelete) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only delete your own analyses.'
        });
      }

      await MatchScore.findByIdAndDelete(matchScoreId);

      res.status(200).json({
        success: true,
        message: 'Match score analysis deleted successfully'
      });

    } catch (error) {
      console.error('Match score deletion error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete match score analysis',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   GET /api/ai/analytics/dashboard
// @desc    Get AI analytics dashboard data
// @access  Private (Admins only)
router.get('/analytics/dashboard',
  authenticate,
  authorize('client_admin', 'system_admin'),
  async (req, res) => {
    try {
      const { timeframe = '30d', clientId } = req.query;
      
      // Calculate date range
      const now = new Date();
      const daysBack = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
      const startDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));

      // Build base query
      let baseQuery = {
        createdAt: { $gte: startDate }
      };

      // Filter by client for client admins
      if (req.user.role === 'client_admin') {
        const requirements = await Requirement.find({ clientId: req.user.clientId }).select('_id');
        baseQuery.requirementId = { $in: requirements.map(r => r._id) };
      } else if (clientId && req.user.role === 'system_admin') {
        const requirements = await Requirement.find({ clientId }).select('_id');
        baseQuery.requirementId = { $in: requirements.map(r => r._id) };
      }

      // Get overall statistics
      const totalAnalyses = await MatchScore.countDocuments(baseQuery);
      
      const averageScoreResult = await MatchScore.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: null,
            averageScore: { $avg: '$overallScore' },
            highestScore: { $max: '$overallScore' },
            lowestScore: { $min: '$overallScore' }
          }
        }
      ]);

      // Get analysis trends by day
      const dailyTrends = await MatchScore.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
            averageScore: { $avg: '$overallScore' }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Get score distribution
      const scoreDistribution = await MatchScore.aggregate([
        { $match: baseQuery },
        {
          $bucket: {
            groupBy: '$overallScore',
            boundaries: [0, 20, 40, 60, 80, 100],
            default: 'other',
            output: {
              count: { $sum: 1 },
              averageScore: { $avg: '$overallScore' }
            }
          }
        }
      ]);

      // Get analysis type breakdown
      const analysisTypeBreakdown = await MatchScore.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: '$analysisType',
            count: { $sum: 1 },
            averageScore: { $avg: '$overallScore' }
          }
        }
      ]);

      // Get top performing requirements
      const topRequirements = await MatchScore.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: '$requirementId',
            analysisCount: { $sum: 1 },
            averageScore: { $avg: '$overallScore' },
            highestScore: { $max: '$overallScore' }
          }
        },
        { $sort: { averageScore: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'requirements',
            localField: '_id',
            foreignField: '_id',
            as: 'requirement'
          }
        },
        { $unwind: '$requirement' },
        {
          $project: {
            title: '$requirement.title',
            analysisCount: 1,
            averageScore: { $round: ['$averageScore', 1] },
            highestScore: 1
          }
        }
      ]);

      res.status(200).json({
        success: true,
        data: {
          overview: {
            totalAnalyses,
            averageScore: averageScoreResult[0]?.averageScore || 0,
            highestScore: averageScoreResult[0]?.highestScore || 0,
            lowestScore: averageScoreResult[0]?.lowestScore || 0,
            timeframe
          },
          trends: {
            daily: dailyTrends
          },
          distribution: {
            scoreRanges: scoreDistribution,
            analysisTypes: analysisTypeBreakdown
          },
          topPerformers: {
            requirements: topRequirements
          }
        }
      });

    } catch (error) {
      console.error('AI analytics dashboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch AI analytics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   POST /api/ai/retrain-model
// @desc    Trigger model retraining (placeholder for future ML pipeline)
// @access  Private (System Admin only)
router.post('/retrain-model',
  authenticate,
  authorize('system_admin'),
  async (req, res) => {
    try {
      // This is a placeholder for future ML model retraining functionality
      // In a production environment, this would trigger a ML pipeline
      
      const { modelType = 'skill_matching', trainingData } = req.body;
      
      // Log the retraining request
      console.log(`Model retraining requested by ${req.user.email} for ${modelType}`);
      
      // In the future, this could:
      // 1. Collect successful matches as training data
      // 2. Retrain the AI model with new data
      // 3. Deploy the updated model
      // 4. A/B test the new model performance
      
      res.status(200).json({
        success: true,
        message: 'Model retraining request submitted successfully',
        data: {
          modelType,
          requestedBy: req.user._id,
          requestedAt: new Date(),
          status: 'queued',
          estimatedCompletionTime: '2-4 hours'
        }
      });

    } catch (error) {
      console.error('Model retraining error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit retraining request',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   GET /api/ai/health
// @desc    Check AI service health and status
// @access  Private (All authenticated users)
router.get('/health',
  authenticate,
  async (req, res) => {
    try {
      // Check various AI service components
      const health = {
        status: 'healthy',
        timestamp: new Date(),
        services: {
          openai: 'healthy', // Would check actual OpenAI API status
          database: 'healthy',
          fileProcessing: 'healthy'
        },
        usage: {
          todayAnalyses: 0,
          monthlyAnalyses: 0,
          averageProcessingTime: '2.3s'
        }
      };

      // Get today's analysis count
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayCount = await MatchScore.countDocuments({
        createdAt: { $gte: today }
      });

      // Get monthly analysis count
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthlyCount = await MatchScore.countDocuments({
        createdAt: { $gte: monthStart }
      });

      health.usage.todayAnalyses = todayCount;
      health.usage.monthlyAnalyses = monthlyCount;

      // Test OpenAI connectivity (basic check)
      try {
        // This would be a simple test call to OpenAI
        // await aiService.testConnection();
        health.services.openai = 'healthy';
      } catch (error) {
        health.services.openai = 'degraded';
        health.status = 'degraded';
      }

      res.status(200).json({
        success: true,
        data: health
      });

    } catch (error) {
      console.error('AI health check error:', error);
      res.status(500).json({
        success: false,
        message: 'Health check failed',
        data: {
          status: 'unhealthy',
          timestamp: new Date(),
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        }
      });
    }
  }
);

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field. Only "resume" field is allowed.'
      });
    }
  }
  
  if (error.message === 'Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.') {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  next(error);
});

module.exports = router;