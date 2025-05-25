const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/rbac.middleware');
const { upload } = require('../middleware/upload.middleware');
const submissionController = require('../controllers/submission.controller');
const { body, param, query, validationResult } = require('express-validator');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Custom validation for LinkedIn URL
const linkedinUrlValidator = (value) => {
  const linkedinRegex = /^https?:\/\/(www\.)?linkedin\.com\/(in|pub)\/[\w\-_À-ÿ%]+\/?$/;
  if (value && !linkedinRegex.test(value)) {
    throw new Error('Invalid LinkedIn URL format');
  }
  return true;
};

// Custom validation for email
const emailValidator = (value) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    throw new Error('Invalid email format');
  }
  return true;
};

// Custom validation for phone
const phoneValidator = (value) => {
  if (value) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    const cleanPhone = value.replace(/[\s\-\(\)]/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      throw new Error('Invalid phone number format');
    }
  }
  return true;
};

// Validation rules
const createSubmissionValidation = [
  body('requirementId')
    .isMongoId()
    .withMessage('Invalid requirement ID'),
  body('candidateName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Candidate name must be between 2 and 100 characters'),
  body('candidateEmail')
    .trim()
    .normalizeEmail()
    .custom(emailValidator),
  body('candidatePhone')
    .optional()
    .trim()
    .custom(phoneValidator),
  body('linkedinUrl')
    .optional()
    .trim()
    .custom(linkedinUrlValidator),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must not exceed 1000 characters'),
  body('expectedSalary')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Expected salary must be a positive number'),
  body('currentLocation')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Current location must not exceed 100 characters'),
  body('noticePeriod')
    .optional()
    .isInt({ min: 0, max: 365 })
    .withMessage('Notice period must be between 0 and 365 days'),
  body('experience')
    .optional()
    .isFloat({ min: 0, max: 50 })
    .withMessage('Experience must be between 0 and 50 years'),
  // Custom validation to ensure at least resume or LinkedIn is provided
  body().custom((value, { req }) => {
    if (!req.file && !req.body.linkedinUrl) {
      throw new Error('Either resume file or LinkedIn URL is required');
    }
    return true;
  })
];

const updateStatusValidation = [
  param('id').isMongoId().withMessage('Invalid submission ID'),
  body('status')
    .isIn(['submitted', 'screening', 'interview', 'final', 'selected', 'rejected'])
    .withMessage('Status must be one of: submitted, screening, interview, final, selected, rejected'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must not exceed 500 characters'),
  body('rejectionReason')
    .if(body('status').equals('rejected'))
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Rejection reason is required and must be between 10 and 500 characters'),
  body('interviewDate')
    .if(body('status').equals('interview'))
    .optional()
    .isISO8601()
    .withMessage('Interview date must be a valid date'),
  body('salary')
    .if(body('status').equals('selected'))
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Salary must be a positive number')
];

const bulkUpdateValidation = [
  body('submissionIds')
    .isArray({ min: 1 })
    .withMessage('At least one submission ID is required'),
  body('submissionIds.*')
    .isMongoId()
    .withMessage('Each submission ID must be valid'),
  body('status')
    .isIn(['screening', 'interview', 'final', 'selected', 'rejected'])
    .withMessage('Status must be one of: screening, interview, final, selected, rejected'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must not exceed 500 characters')
];

// Routes

/**
 * @route   GET /api/submissions
 * @desc    Get all submissions (filtered by role and permissions)
 * @access  Private (All authenticated users)
 */
router.get('/',
  authenticate,
  [
    query('requirementId')
      .optional()
      .isMongoId()
      .withMessage('Requirement ID must be valid'),
    query('status')
      .optional()
      .isIn(['submitted', 'screening', 'interview', 'final', 'selected', 'rejected', 'all'])
      .withMessage('Status must be valid submission status'),
    query('recruiterId')
      .optional()
      .isMongoId()
      .withMessage('Recruiter ID must be valid'),
    query('dateFrom')
      .optional()
      .isISO8601()
      .withMessage('Date from must be a valid date'),
    query('dateTo')
      .optional()
      .isISO8601()
      .withMessage('Date to must be a valid date'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('search')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Search term must be less than 100 characters'),
    query('sortBy')
      .optional()
      .isIn(['createdAt', 'candidateName', 'status', 'aiMatchScore'])
      .withMessage('Sort by must be one of: createdAt, candidateName, status, aiMatchScore'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be asc or desc'),
    handleValidationErrors
  ],
  submissionController.getSubmissions
);

/**
 * @route   GET /api/submissions/my-submissions
 * @desc    Get current recruiter's submissions
 * @access  Private (Recruiter only)
 */
router.get('/my-submissions',
  authenticate,
  authorize('recruiter'),
  [
    query('status')
      .optional()
      .isIn(['submitted', 'screening', 'interview', 'final', 'selected', 'rejected', 'all'])
      .withMessage('Status must be valid submission status'),
    query('requirementId')
      .optional()
      .isMongoId()
      .withMessage('Requirement ID must be valid'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    handleValidationErrors
  ],
  submissionController.getRecruiterSubmissions
);

/**
 * @route   GET /api/submissions/:id
 * @desc    Get submission by ID
 * @access  Private (All authenticated users with proper permissions)
 */
router.get('/:id',
  authenticate,
  [
    param('id').isMongoId().withMessage('Invalid submission ID'),
    handleValidationErrors
  ],
  submissionController.getSubmissionById
);

/**
 * @route   POST /api/submissions
 * @desc    Create new candidate submission
 * @access  Private (Recruiter only)
 */
router.post('/',
  authenticate,
  authorize('recruiter'),
  upload.single('resume'), // Handle file upload
  createSubmissionValidation,
  handleValidationErrors,
  submissionController.createSubmission
);

/**
 * @route   PUT /api/submissions/:id/status
 * @desc    Update submission status
 * @access  Private (System Admin, Client Admin)
 */
router.put('/:id/status',
  authenticate,
  authorize('system_admin', 'client_admin'),
  updateStatusValidation,
  handleValidationErrors,
  submissionController.updateSubmissionStatus
);

/**
 * @route   PUT /api/submissions/bulk-status
 * @desc    Bulk update submission statuses
 * @access  Private (System Admin, Client Admin)
 */
router.put('/bulk-status',
  authenticate,
  authorize('system_admin', 'client_admin'),
  bulkUpdateValidation,
  handleValidationErrors,
  submissionController.bulkUpdateStatus
);

/**
 * @route   DELETE /api/submissions/:id
 * @desc    Delete submission (soft delete)
 * @access  Private (System Admin, Recruiter - own submissions only)
 */
router.delete('/:id',
  authenticate,
  [
    param('id').isMongoId().withMessage('Invalid submission ID'),
    handleValidationErrors
  ],
  submissionController.deleteSubmission
);

/**
 * @route   GET /api/submissions/:id/ai-analysis
 * @desc    Get AI analysis for submission
 * @access  Private (All authenticated users with proper permissions)
 */
router.get('/:id/ai-analysis',
  authenticate,
  [
    param('id').isMongoId().withMessage('Invalid submission ID'),
    handleValidationErrors
  ],
  submissionController.getAIAnalysis
);

/**
 * @route   POST /api/submissions/:id/reanalyze
 * @desc    Trigger AI re-analysis for submission
 * @access  Private (System Admin, Client Admin)
 */
router.post('/:id/reanalyze',
  authenticate,
  authorize('system_admin', 'client_admin'),
  [
    param('id').isMongoId().withMessage('Invalid submission ID'),
    handleValidationErrors
  ],
  submissionController.reanalyzeSubmission
);

/**
 * @route   GET /api/submissions/:id/history
 * @desc    Get submission status history
 * @access  Private (All authenticated users with proper permissions)
 */
router.get('/:id/history',
  authenticate,
  [
    param('id').isMongoId().withMessage('Invalid submission ID'),
    handleValidationErrors
  ],
  submissionController.getSubmissionHistory
);

/**
 * @route   POST /api/submissions/:id/notes
 * @desc    Add note to submission
 * @access  Private (System Admin, Client Admin)
 */
router.post('/:id/notes',
  authenticate,
  authorize('system_admin', 'client_admin'),
  [
    param('id').isMongoId().withMessage('Invalid submission ID'),
    body('note')
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Note must be between 1 and 1000 characters'),
    body('isInternal')
      .optional()
      .isBoolean()
      .withMessage('isInternal must be a boolean'),
    handleValidationErrors
  ],
  submissionController.addSubmissionNote
);

/**
 * @route   GET /api/submissions/:id/resume
 * @desc    Download/view candidate resume
 * @access  Private (All authenticated users with proper permissions)
 */
router.get('/:id/resume',
  authenticate,
  [
    param('id').isMongoId().withMessage('Invalid submission ID'),
    handleValidationErrors
  ],
  submissionController.getResume
);

/**
 * @route   POST /api/submissions/:id/schedule-interview
 * @desc    Schedule interview for candidate
 * @access  Private (System Admin, Client Admin)
 */
router.post('/:id/schedule-interview',
  authenticate,
  authorize('system_admin', 'client_admin'),
  [
    param('id').isMongoId().withMessage('Invalid submission ID'),
    body('interviewDate')
      .isISO8601()
      .withMessage('Interview date must be a valid date')
      .custom(value => {
        if (new Date(value) <= new Date()) {
          throw new Error('Interview date must be in the future');
        }
        return true;
      }),
    body('interviewType')
      .isIn(['phone', 'video', 'in-person', 'technical', 'hr'])
      .withMessage('Interview type must be one of: phone, video, in-person, technical, hr'),
    body('interviewer')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Interviewer name must be between 2 and 100 characters'),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Notes must not exceed 500 characters'),
    handleValidationErrors
  ],
  submissionController.scheduleInterview
);

/**
 * @route   GET /api/submissions/stats/dashboard
 * @desc    Get submission dashboard statistics
 * @access  Private (System Admin, Client Admin)
 */
router.get('/stats/dashboard',
  authenticate,
  authorize('system_admin', 'client_admin'),
  [
    query('period')
      .optional()
      .isIn(['week', 'month', 'quarter', 'year'])
      .withMessage('Period must be one of: week, month, quarter, year'),
    query('requirementId')
      .optional()
      .isMongoId()
      .withMessage('Requirement ID must be valid'),
    query('recruiterId')
      .optional()
      .isMongoId()
      .withMessage('Recruiter ID must be valid'),
    handleValidationErrors
  ],
  submissionController.getDashboardStats
);

/**
 * @route   GET /api/submissions/stats/funnel
 * @desc    Get submission funnel statistics
 * @access  Private (System Admin, Client Admin)
 */
router.get('/stats/funnel',
  authenticate,
  authorize('system_admin', 'client_admin'),
  [
    query('requirementId')
      .optional()
      .isMongoId()
      .withMessage('Requirement ID must be valid'),
    query('dateFrom')
      .optional()
      .isISO8601()
      .withMessage('Date from must be a valid date'),
    query('dateTo')
      .optional()
      .isISO8601()
      .withMessage('Date to must be a valid date'),
    handleValidationErrors
  ],
  submissionController.getFunnelStats
);

/**
 * @route   GET /api/submissions/my-performance
 * @desc    Get current recruiter's performance metrics
 * @access  Private (Recruiter only)
 */
router.get('/my-performance',
  authenticate,
  authorize('recruiter'),
  [
    query('period')
      .optional()
      .isIn(['week', 'month', 'quarter', 'year'])
      .withMessage('Period must be one of: week, month, quarter, year'),
    handleValidationErrors
  ],
  submissionController.getRecruiterPerformance
);

/**
 * @route   POST /api/submissions/:id/withdraw
 * @desc    Withdraw submission (by recruiter)
 * @access  Private (Recruiter - own submissions only)
 */
router.post('/:id/withdraw',
  authenticate,
  authorize('recruiter'),
  [
    param('id').isMongoId().withMessage('Invalid submission ID'),
    body('reason')
      .trim()
      .isLength({ min: 10, max: 500 })
      .withMessage('Withdrawal reason must be between 10 and 500 characters'),
    handleValidationErrors
  ],
  submissionController.withdrawSubmission
);

/**
 * @route   POST /api/submissions/:id/duplicate-check
 * @desc    Check for duplicate submissions
 * @access  Private (System Admin, Client Admin)
 */
router.post('/:id/duplicate-check',
  authenticate,
  authorize('system_admin', 'client_admin'),
  [
    param('id').isMongoId().withMessage('Invalid submission ID'),
    handleValidationErrors
  ],
  submissionController.checkDuplicates
);

/**
 * @route   GET /api/submissions/export
 * @desc    Export submissions to CSV/Excel
 * @access  Private (System Admin, Client Admin)
 */
router.get('/export',
  authenticate,
  authorize('system_admin', 'client_admin'),
  [
    query('format')
      .optional()
      .isIn(['csv', 'excel'])
      .withMessage('Format must be csv or excel'),
    query('requirementId')
      .optional()
      .isMongoId()
      .withMessage('Requirement ID must be valid'),
    query('status')
      .optional()
      .isIn(['submitted', 'screening', 'interview', 'final', 'selected', 'rejected'])
      .withMessage('Status must be valid submission status'),
    query('dateFrom')
      .optional()
      .isISO8601()
      .withMessage('Date from must be a valid date'),
    query('dateTo')
      .optional()
      .isISO8601()
      .withMessage('Date to must be a valid date'),
    handleValidationErrors
  ],
  submissionController.exportSubmissions
);

/**
 * @route   POST /api/submissions/bulk-import
 * @desc    Bulk import submissions from CSV/Excel
 * @access  Private (System Admin only)
 */
router.post('/bulk-import',
  authenticate,
  authorize('system_admin'),
  upload.single('importFile'),
  [
    body('requirementId')
      .isMongoId()
      .withMessage('Requirement ID is required and must be valid'),
    body('skipDuplicates')
      .optional()
      .isBoolean()
      .withMessage('skipDuplicates must be a boolean'),
    handleValidationErrors
  ],
  submissionController.bulkImportSubmissions
);

/**
 * @route   GET /api/submissions/:id/similar
 * @desc    Find similar candidates using AI
 * @access  Private (System Admin, Client Admin)
 */
router.get('/:id/similar',
  authenticate,
  authorize('system_admin', 'client_admin'),
  [
    param('id').isMongoId().withMessage('Invalid submission ID'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('Limit must be between 1 and 20'),
    query('minSimilarity')
      .optional()
      .isFloat({ min: 0, max: 1 })
      .withMessage('Minimum similarity must be between 0 and 1'),
    handleValidationErrors
  ],
  submissionController.findSimilarCandidates
);

/**
 * @route   POST /api/submissions/:id/feedback
 * @desc    Add feedback for submission
 * @access  Private (System Admin, Client Admin)
 */
router.post('/:id/feedback',
  authenticate,
  authorize('system_admin', 'client_admin'),
  [
    param('id').isMongoId().withMessage('Invalid submission ID'),
    body('rating')
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),
    body('feedback')
      .trim()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Feedback must be between 10 and 1000 characters'),
    body('category')
      .isIn(['technical', 'communication', 'cultural_fit', 'experience', 'overall'])
      .withMessage('Category must be one of: technical, communication, cultural_fit, experience, overall'),
    handleValidationErrors
  ],
  submissionController.addFeedback
);

module.exports = router;