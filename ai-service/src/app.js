const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fileUpload = require('express-fileupload');
const winston = require('winston');
const path = require('path');
require('dotenv').config();

// Import services
const LinkedInService = require('./services/linkedin.service');
const NLPService = require('./services/nlp.service');
const PDFService = require('./services/pdf.service');
const { calculateMatchScore } = require('./utils/scoring');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5001;

// Configure Winston Logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ai-service' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  abortOnLimit: true,
  responseOnLimit: 'File size limit exceeded (10MB max)',
  createParentPath: true,
  tempFileDir: path.join(__dirname, '../temp'),
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

app.use(limiter);

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'ai-service',
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime()
  });
});

// Service status endpoint
app.get('/status', async (req, res) => {
  try {
    const services = {
      nlp: await NLPService.checkHealth(),
      openai: process.env.OPENAI_API_KEY ? 'configured' : 'not configured',
      pdf: 'available',
      linkedin: 'available'
    };

    res.json({
      status: 'OK',
      services,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Service status check failed:', error);
    res.status(500).json({
      status: 'ERROR',
      error: 'Service status check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Analyze LinkedIn profile endpoint
app.post('/api/analyze/linkedin', async (req, res) => {
  try {
    const { profileUrl, jobRequirement } = req.body;

    // Validation
    if (!profileUrl || !jobRequirement) {
      return res.status(400).json({
        error: 'Missing required fields: profileUrl and jobRequirement'
      });
    }

    logger.info('Analyzing LinkedIn profile', { profileUrl });

    // Extract LinkedIn profile data
    const profileData = await LinkedInService.extractProfile(profileUrl);
    
    if (!profileData) {
      return res.status(400).json({
        error: 'Failed to extract LinkedIn profile data. Please check the URL.'
      });
    }

    // Process job requirement
    const requirementAnalysis = await NLPService.extractKeywords(jobRequirement);
    
    // Process profile content
    const profileAnalysis = await NLPService.analyzeProfile(profileData);

    // Calculate match score
    const matchResult = calculateMatchScore(
      profileAnalysis,
      requirementAnalysis,
      profileData
    );

    const result = {
      candidate: {
        name: profileData.name,
        title: profileData.headline,
        location: profileData.location,
        summary: profileData.summary,
        experience: profileData.experience,
        education: profileData.education,
        skills: profileData.skills
      },
      analysis: {
        profileKeywords: profileAnalysis.keywords,
        requirementKeywords: requirementAnalysis.keywords,
        matchScore: matchResult.score,
        reasoning: matchResult.reasoning,
        strengths: matchResult.strengths,
        gaps: matchResult.gaps,
        recommendations: matchResult.recommendations
      },
      metadata: {
        analyzedAt: new Date().toISOString(),
        processingTime: Date.now() - req.startTime,
        source: 'linkedin'
      }
    };

    logger.info('LinkedIn analysis completed', {
      profileUrl,
      matchScore: matchResult.score,
      processingTime: result.metadata.processingTime
    });

    res.json(result);

  } catch (error) {
    logger.error('LinkedIn analysis failed:', error);
    res.status(500).json({
      error: 'Failed to analyze LinkedIn profile',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Analyze resume (PDF) endpoint
app.post('/api/analyze/resume', async (req, res) => {
  try {
    const { jobRequirement } = req.body;

    // Validation
    if (!req.files || !req.files.resume) {
      return res.status(400).json({
        error: 'No resume file uploaded'
      });
    }

    if (!jobRequirement) {
      return res.status(400).json({
        error: 'Missing required field: jobRequirement'
      });
    }

    const resumeFile = req.files.resume;

    // Validate file type
    if (!resumeFile.name.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({
        error: 'Only PDF files are supported'
      });
    }

    logger.info('Analyzing resume', { 
      fileName: resumeFile.name,
      fileSize: resumeFile.size 
    });

    // Extract text from PDF
    const resumeText = await PDFService.extractText(resumeFile.tempFilePath);
    
    if (!resumeText || resumeText.trim().length === 0) {
      return res.status(400).json({
        error: 'Could not extract text from PDF. Please ensure the file is not corrupted or password-protected.'
      });
    }

    // Process job requirement
    const requirementAnalysis = await NLPService.extractKeywords(jobRequirement);
    
    // Process resume content
    const resumeAnalysis = await NLPService.analyzeResume(resumeText);

    // Calculate match score
    const matchResult = calculateMatchScore(
      resumeAnalysis,
      requirementAnalysis,
      { rawText: resumeText }
    );

    const result = {
      candidate: {
        extractedInfo: resumeAnalysis.extractedInfo,
        skills: resumeAnalysis.skills,
        experience: resumeAnalysis.experience,
        education: resumeAnalysis.education
      },
      analysis: {
        resumeKeywords: resumeAnalysis.keywords,
        requirementKeywords: requirementAnalysis.keywords,
        matchScore: matchResult.score,
        reasoning: matchResult.reasoning,
        strengths: matchResult.strengths,
        gaps: matchResult.gaps,
        recommendations: matchResult.recommendations
      },
      metadata: {
        analyzedAt: new Date().toISOString(),
        fileName: resumeFile.name,
        fileSize: resumeFile.size,
        processingTime: Date.now() - req.startTime,
        source: 'resume'
      }
    };

    logger.info('Resume analysis completed', {
      fileName: resumeFile.name,
      matchScore: matchResult.score,
      processingTime: result.metadata.processingTime
    });

    res.json(result);

  } catch (error) {
    logger.error('Resume analysis failed:', error);
    res.status(500).json({
      error: 'Failed to analyze resume',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Batch analysis endpoint
app.post('/api/analyze/batch', async (req, res) => {
  try {
    const { candidates, jobRequirement } = req.body;

    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({
        error: 'Missing or invalid candidates array'
      });
    }

    if (!jobRequirement) {
      return res.status(400).json({
        error: 'Missing required field: jobRequirement'
      });
    }

    logger.info('Starting batch analysis', { 
      candidateCount: candidates.length 
    });

    const requirementAnalysis = await NLPService.extractKeywords(jobRequirement);
    const results = [];

    for (const candidate of candidates) {
      try {
        let profileData;
        let analysis;

        if (candidate.type === 'linkedin' && candidate.profileUrl) {
          profileData = await LinkedInService.extractProfile(candidate.profileUrl);
          analysis = await NLPService.analyzeProfile(profileData);
        } else if (candidate.type === 'resume' && candidate.resumeText) {
          analysis = await NLPService.analyzeResume(candidate.resumeText);
          profileData = { rawText: candidate.resumeText };
        } else {
          results.push({
            candidate: candidate,
            error: 'Invalid candidate data or type'
          });
          continue;
        }

        const matchResult = calculateMatchScore(
          analysis,
          requirementAnalysis,
          profileData
        );

        results.push({
          candidate: candidate,
          analysis: {
            matchScore: matchResult.score,
            reasoning: matchResult.reasoning,
            strengths: matchResult.strengths,
            gaps: matchResult.gaps
          }
        });

      } catch (error) {
        logger.error('Batch analysis failed for candidate:', error);
        results.push({
          candidate: candidate,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => !r.error).length;
    
    logger.info('Batch analysis completed', {
      total: candidates.length,
      successful: successCount,
      failed: candidates.length - successCount
    });

    res.json({
      results,
      summary: {
        total: candidates.length,
        successful: successCount,
        failed: candidates.length - successCount,
        analyzedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Batch analysis failed:', error);
    res.status(500).json({
      error: 'Failed to perform batch analysis',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Extract keywords from job requirement
app.post('/api/extract-keywords', async (req, res) => {
  try {
    const { jobRequirement } = req.body;

    if (!jobRequirement) {
      return res.status(400).json({
        error: 'Missing required field: jobRequirement'
      });
    }

    const analysis = await NLPService.extractKeywords(jobRequirement);

    res.json({
      keywords: analysis.keywords,
      entities: analysis.entities,
      skills: analysis.skills,
      requirements: analysis.requirements,
      analyzedAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Keyword extraction failed:', error);
    res.status(500).json({
      error: 'Failed to extract keywords',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`AI Service started on port ${PORT}`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });
});

module.exports = app;