const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/rbac.middleware');
const userController = require('../controllers/user.controller');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/users
 * @desc    Get all users (system admin only) or filtered users
 * @access  Private - System Admin
 * @query   role, status, search, page, limit
 */
router.get('/', 
  authorize('system_admin'), 
  userController.getAllUsers
);

/**
 * @route   GET /api/users/profile
 * @desc    Get current user's profile
 * @access  Private - All authenticated users
 */
router.get('/profile', userController.getCurrentUserProfile);

/**
 * @route   GET /api/users/recruiters
 * @desc    Get all recruiters (for client admin and system admin)
 * @access  Private - System Admin, Client Admin
 */
router.get('/recruiters', 
  authorize('system_admin', 'client_admin'), 
  userController.getRecruiters
);

/**
 * @route   GET /api/users/client-admins
 * @desc    Get all client administrators
 * @access  Private - System Admin only
 */
router.get('/client-admins', 
  authorize('system_admin'), 
  userController.getClientAdmins
);

/**
 * @route   GET /api/users/stats
 * @desc    Get user statistics (counts by role, active users, etc.)
 * @access  Private - System Admin only
 */
router.get('/stats', 
  authorize('system_admin'), 
  userController.getUserStats
);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private - System Admin or own profile
 */
router.get('/:id', userController.getUserById);

/**
 * @route   POST /api/users
 * @desc    Create new user (system admin only)
 * @access  Private - System Admin
 * @body    { email, password, firstName, lastName, role, clientId?, profile? }
 */
router.post('/', 
  authorize('system_admin'), 
  userController.createUser
);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user by ID
 * @access  Private - System Admin or own profile (limited fields)
 */
router.put('/:id', userController.updateUser);

/**
 * @route   PUT /api/users/:id/role
 * @desc    Update user role (system admin only)
 * @access  Private - System Admin
 * @body    { role, clientId? }
 */
router.put('/:id/role', 
  authorize('system_admin'), 
  userController.updateUserRole
);

/**
 * @route   PUT /api/users/:id/status
 * @desc    Update user active status (activate/deactivate)
 * @access  Private - System Admin
 * @body    { isActive }
 */
router.put('/:id/status', 
  authorize('system_admin'), 
  userController.updateUserStatus
);

/**
 * @route   PUT /api/users/:id/trust-points
 * @desc    Update recruiter trust points (system admin only)
 * @access  Private - System Admin
 * @body    { trustPoints, reason }
 */
router.put('/:id/trust-points', 
  authorize('system_admin'), 
  userController.updateTrustPoints
);

/**
 * @route   PUT /api/users/:id/password
 * @desc    Update user password
 * @access  Private - Own profile only or System Admin
 * @body    { currentPassword?, newPassword }
 */
router.put('/:id/password', userController.updatePassword);

/**
 * @route   PUT /api/users/profile
 * @desc    Update current user's profile
 * @access  Private - All authenticated users
 * @body    { firstName?, lastName?, profile? }
 */
router.put('/profile', userController.updateProfile);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user (soft delete - deactivate)
 * @access  Private - System Admin only
 */
router.delete('/:id', 
  authorize('system_admin'), 
  userController.deleteUser
);

/**
 * @route   POST /api/users/:id/assign-client
 * @desc    Assign user to a client (for client admins and recruiters)
 * @access  Private - System Admin
 * @body    { clientId }
 */
router.post('/:id/assign-client', 
  authorize('system_admin'), 
  userController.assignUserToClient
);

/**
 * @route   GET /api/users/:id/submissions
 * @desc    Get user's submissions (for recruiters)
 * @access  Private - Own profile or System Admin
 */
router.get('/:id/submissions', userController.getUserSubmissions);

/**
 * @route   GET /api/users/:id/requirements
 * @desc    Get requirements assigned to user (for recruiters)
 * @access  Private - Own profile or System Admin, Client Admin
 */
router.get('/:id/requirements', userController.getUserRequirements);

/**
 * @route   GET /api/users/:id/analytics
 * @desc    Get user analytics (performance metrics for recruiters)
 * @access  Private - Own profile or System Admin, Client Admin
 */
router.get('/:id/analytics', userController.getUserAnalytics);

/**
 * @route   POST /api/users/bulk-create
 * @desc    Create multiple users from CSV or array
 * @access  Private - System Admin
 * @body    { users: [...] } or FormData with CSV file
 */
router.post('/bulk-create', 
  authorize('system_admin'), 
  userController.bulkCreateUsers
);

/**
 * @route   POST /api/users/invite
 * @desc    Send invitation email to new user
 * @access  Private - System Admin, Client Admin (for recruiters only)
 * @body    { email, role, clientId?, message? }
 */
router.post('/invite', 
  authorize('system_admin', 'client_admin'), 
  userController.inviteUser
);

/**
 * @route   POST /api/users/reset-password
 * @desc    Send password reset email
 * @access  Public (but rate limited)
 * @body    { email }
 */
router.post('/reset-password', userController.sendPasswordReset);

/**
 * @route   POST /api/users/verify-reset-token
 * @desc    Verify password reset token
 * @access  Public
 * @body    { token, newPassword }
 */
router.post('/verify-reset-token', userController.verifyResetToken);

/**
 * @route   GET /api/users/search
 * @desc    Search users by name, email, role
 * @access  Private - System Admin, Client Admin (limited results)
 * @query   q, role, client
 */
router.get('/search', userController.searchUsers);

/**
 * @route   POST /api/users/:id/impersonate
 * @desc    Impersonate user for support purposes
 * @access  Private - System Admin only
 */
router.post('/:id/impersonate', 
  authorize('system_admin'), 
  userController.impersonateUser
);

/**
 * @route   GET /api/users/:id/activity-log
 * @desc    Get user activity log
 * @access  Private - System Admin or own profile
 */
router.get('/:id/activity-log', userController.getUserActivityLog);

/**
 * @route   POST /api/users/:id/deactivate
 * @desc    Deactivate user account
 * @access  Private - System Admin
 * @body    { reason }
 */
router.post('/:id/deactivate', 
  authorize('system_admin'), 
  userController.deactivateUser
);

/**
 * @route   POST /api/users/:id/reactivate
 * @desc    Reactivate user account
 * @access  Private - System Admin
 */
router.post('/:id/reactivate', 
  authorize('system_admin'), 
  userController.reactivateUser
);

module.exports = router;