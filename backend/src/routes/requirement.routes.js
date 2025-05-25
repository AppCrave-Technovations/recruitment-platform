const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/rbac.middleware');
const requirementController = require('../controllers/requirement.controller');
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

// Validation rules
const createRequirementValidation = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 20, max: 2000 })
    .withMessage('Description must be between 20 and 2000 characters'),
  body('clientName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Client name must be between 2 and 100 characters'),
  body('skills')
    .isArray({ min: 1 })
    .withMessage('At least one skill is required'),
  body('skills.*')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each skill must be between 1 and 50 characters'),
  body('location')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Location must be between 2 and 100 characters'),
  body('deadline')
    .isISO8601()
    .withMessage('Deadline must be a valid date')
    .custom(value => {
      if (new Date(value) <= new Date()) {
        throw new Error('Deadline must be in the future');
      }
      return true;
    }),
  body('experience.min')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('Minimum experience must be between 0 and 50 years'),
  body('experience.max')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('Maximum experience must be between 0 and 50 years'),
  body('salary.min')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum salary must be a positive number'),
  body('salary.max')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum salary must be a positive number'),
  body('salary.currency')
    .optional()
    .isIn(['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD'])
    .withMessage('Currency must be one of: USD, EUR, GBP, INR, CAD, AUD'),
  body('maxSubmissions')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Max submissions must be between 1 and 1000'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent'),
  body('isEndClientHidden')
    .optional()
    .isBoolean()
    .withMessage('isEndClientHidden must be a boolean')
];

const updateRequirementValidation = [
  param('id').isMongoId().withMessage('Invalid requirement ID'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 20, max: 2000 })
    .withMessage('Description must be between 20 and 2000 characters'),
  body('skills')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one skill is required'),
  body('skills.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each skill must be between 1 and 50 characters'),
  body('status')
    .optional()
    .isIn(['active', 'paused', 'closed', 'filled'])
    .withMessage('Status must be one of: active, paused, closed, filled'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent')
];

const assignRecruiterValidation = [
  param('id').isMongoId().withMessage('Invalid requirement ID'),
  body('recruiterIds')
    .isArray({ min: 1 })
    .withMessage('At least one recruiter ID is required'),
  body('recruiterIds.*')
    .isMongoId()
    .withMessage('Each recruiter ID must be valid')
];

// Routes

/**
 * @route   GET /api/requirements
 * @desc    Get all requirements (filtered by role)
 * @access  Private (All authenticated users)
 */
router.get('/',
  authenticate,
  [
    query('status')
      .optional()
      .isIn(['active', 'paused', 'closed', 'filled', 'all'])
      .withMessage('Status must be one of: active, paused, closed, filled, all'),
    query('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('Priority must be one of: low, medium, high, urgent'),
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
    handleValidationErrors
  ],
  requirementController.getRequirements
);

/**
 * @route   GET /api/requirements/:id
 * @desc    Get requirement by ID
 * @access  Private (All authenticated users)
 */
router.get('/:id',
  authenticate,
  [
    param('id').isMongoId().withMessage('Invalid requirement ID'),
    handleValidationErrors
  ],
  requirementController.getRequirementById
);

/**
 * @route   POST /api/requirements
 * @desc    Create new requirement
 * @access  Private (System Admin, Client Admin)
 */
router.post('/',
  authenticate,
  authorize('system_admin', 'client_admin'),
  createRequirementValidation,
  handleValidationErrors,
  requirementController.createRequirement
);

/**
 * @route   PUT /api/requirements/:id
 * @desc    Update requirement
 * @access  Private (System Admin, Client Admin)
 */
router.put('/:id',
  authenticate,
  authorize('system_admin', 'client_admin'),
  updateRequirementValidation,
  handleValidationErrors,
  requirementController.updateRequirement
);

/**
 * @route   DELETE /api/requirements/:id
 * @desc    Delete requirement (soft delete)
 * @access  Private (System Admin, Client Admin)
 */
router.delete('/:id',
  authenticate,
  authorize('system_admin', 'client_admin'),
  [
    param('id').isMongoId().withMessage('Invalid requirement ID'),
    handleValidationErrors
  ],
  requirementController.deleteRequirement
);

/**
 * @route   POST /api/requirements/:id/assign-recruiters
 * @desc    Assign recruiters to requirement
 * @access  Private (System Admin, Client Admin)
 */
router.post('/:id/assign-recruiters',
  authenticate,
  authorize('system_admin', 'client_admin'),
  assignRecruiterValidation,
  handleValidationErrors,
  requirementController.assignRecruiters
);

/**
 * @route   DELETE /api/requirements/:id/recruiters/:recruiterId
 * @desc    Remove recruiter from requirement
 * @access  Private (System Admin, Client Admin)
 */
router.delete('/:id/recruiters/:recruiterId',
  authenticate,
  authorize('system_admin', 'client_admin'),
  [
    param('id').isMongoId().withMessage('Invalid requirement ID'),
    param('recruiterId').isMongoId().withMessage('Invalid recruiter ID'),
    handleValidationErrors
  ],
  requirementController.removeRecruiter
);

/**
 * @route   GET /api/requirements/:id/recruiters
 * @desc    Get all recruiters assigned to requirement
 * @access  Private (System Admin, Client Admin)
 */
router.get('/:id/recruiters',
  authenticate,
  authorize('system_admin', 'client_admin'),
  [
    param('id').isMongoId().withMessage('Invalid requirement ID'),
    handleValidationErrors
  ],
  requirementController.getAssignedRecruiters
);

/**
 * @route   GET /api/requirements/:id/submissions
 * @desc    Get all submissions for requirement
 * @access  Private (System Admin, Client Admin)
 */
router.get('/:id/submissions',
  authenticate,
  authorize('system_admin', 'client_admin'),
  [
    param('id').isMongoId().withMessage('Invalid requirement ID'),
    query('status')
      .optional()
      .isIn(['submitted', 'screening', 'interview', 'final', 'selected', 'rejected'])
      .withMessage('Status must be valid submission status'),
    query('recruiterId')
      .optional()
      .isMongoId()
      .withMessage('Recruiter ID must be valid'),
    handleValidationErrors
  ],
  requirementController.getRequirementSubmissions
);

/**
 * @route   GET /api/requirements/:id/analytics
 * @desc    Get requirement analytics and statistics
 * @access  Private (System Admin, Client Admin)
 */
router.get('/:id/analytics',
  authenticate,
  authorize('system_admin', 'client_admin'),
  [
    param('id').isMongoId().withMessage('Invalid requirement ID'),
    handleValidationErrors
  ],
  requirementController.getRequirementAnalytics
);

/**
 * @route   PUT /api/requirements/:id/status
 * @desc    Update requirement status
 * @access  Private (System Admin, Client Admin)
 */
router.put('/:id/status',
  authenticate,
  authorize('system_admin', 'client_admin'),
  [
    param('id').isMongoId().withMessage('Invalid requirement ID'),
    body('status')
      .isIn(['active', 'paused', 'closed', 'filled'])
      .withMessage('Status must be one of: active, paused, closed, filled'),
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Reason must be less than 500 characters'),
    handleValidationErrors
  ],
  requirementController.updateRequirementStatus
);

/**
 * @route   POST /api/requirements/:id/clone
 * @desc    Clone an existing requirement
 * @access  Private (System Admin, Client Admin)
 */
router.post('/:id/clone',
  authenticate,
  authorize('system_admin', 'client_admin'),
  [
    param('id').isMongoId().withMessage('Invalid requirement ID'),
    body('title')
      .optional()
      .trim()
      .isLength({ min: 5, max: 200 })
      .withMessage('Title must be between 5 and 200 characters'),
    body('deadline')
      .optional()
      .isISO8601()
      .withMessage('Deadline must be a valid date'),
    handleValidationErrors
  ],
  requirementController.cloneRequirement
);

/**
 * @route   GET /api/requirements/:id/match-candidates
 * @desc    Get potential candidate matches for requirement using AI
 * @access  Private (System Admin, Client Admin)
 */
router.get('/:id/match-candidates',
  authenticate,
  authorize('system_admin', 'client_admin'),
  [
    param('id').isMongoId().withMessage('Invalid requirement ID'),
    query('minScore')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('Minimum score must be between 0 and 100'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
    handleValidationErrors
  ],
  requirementController.getMatchedCandidates
);

/**
 * @route   POST /api/requirements/:id/extend-deadline
 * @desc    Extend requirement deadline
 * @access  Private (System Admin, Client Admin)
 */
router.post('/:id/extend-deadline',
  authenticate,
  authorize('system_admin', 'client_admin'),
  [
    param('id').isMongoId().withMessage('Invalid requirement ID'),
    body('newDeadline')
      .isISO8601()
      .withMessage('New deadline must be a valid date')
      .custom((value, { req }) => {
        if (new Date(value) <= new Date()) {
          throw new Error('New deadline must be in the future');
        }
        return true;
      }),
    body('reason')
      .trim()
      .isLength({ min: 10, max: 500 })
      .withMessage('Reason must be between 10 and 500 characters'),
    handleValidationErrors
  ],
  requirementController.extendDeadline
);

/**
 * @route   GET /api/requirements/stats/dashboard
 * @desc    Get requirements dashboard statistics
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
    handleValidationErrors
  ],
  requirementController.getDashboardStats
);

/**
 * @route   GET /api/requirements/my-assignments
 * @desc    Get requirements assigned to the current recruiter
 * @access  Private (Recruiter only)
 */
router.get('/my-assignments',
  authenticate,
  authorize('recruiter'),
  [
    query('status')
      .optional()
      .isIn(['active', 'paused', 'closed', 'filled', 'all'])
      .withMessage('Status must be one of: active, paused, closed, filled, all'),
    query('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('Priority must be one of: low, medium, high, urgent'),
    query('deadline')
      .optional()
      .isIn(['today', 'week', 'month'])
      .withMessage('Deadline filter must be one of: today, week, month'),
    handleValidationErrors
  ],
  requirementController.getRecruiterAssignments
);

/**
 * @route   GET /api/requirements/:id/competition
 * @desc    Get competition info for requirement (for recruiters)
 * @access  Private (Recruiter only)
 */
router.get('/:id/competition',
  authenticate,
  authorize('recruiter'),
  [
    param('id').isMongoId().withMessage('Invalid requirement ID'),
    handleValidationErrors
  ],
  requirementController.getRequirementCompetition
);

/**
 * @route   POST /api/requirements/:id/bookmark
 * @desc    Bookmark/unbookmark requirement (for recruiters)
 * @access  Private (Recruiter only)
 */
router.post('/:id/bookmark',
  authenticate,
  authorize('recruiter'),
  [
    param('id').isMongoId().withMessage('Invalid requirement ID'),
    handleValidationErrors
  ],
  requirementController.toggleBookmark
);

/**
 * @route   GET /api/requirements/bookmarked
 * @desc    Get bookmarked requirements for current recruiter
 * @access  Private (Recruiter only)
 */
router.get('/bookmarked',
  authenticate,
  authorize('recruiter'),
  requirementController.getBookmarkedRequirements
);

module.exports = router;