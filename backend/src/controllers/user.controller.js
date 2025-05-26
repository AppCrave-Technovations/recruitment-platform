const User = require('../models/User');
const Submission = require('../models/Submission');
const Requirement = require('../models/Requirement');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { generateToken } = require('../config/jwt');
const emailService = require('../services/email.service');
const crypto = require('crypto');

class UserController {
  /**
   * Get all users with filtering and pagination
   */
  async getAllUsers(req, res) {
    try {
      const {
        role,
        status,
        search,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Build filter query
      const filter = {};
      
      if (role) filter.role = role;
      if (status) filter.isActive = status === 'active';
      if (search) {
        filter.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }

      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const submissions = await Submission.find(filter)
        .populate('requirementId', 'title clientName status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Submission.countDocuments(filter);

      res.json({
        submissions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Get user submissions error:', error);
      res.status(500).json({ message: 'Failed to fetch user submissions', error: error.message });
    }
  }

  /**
   * Get user requirements (for recruiters)
   */
  async getUserRequirements(req, res) {
    try {
      const { id } = req.params;
      const { status = 'active' } = req.query;

      // Check permissions
      const isOwnProfile = req.user._id.toString() === id;
      const canAccess = req.user.role === 'system_admin' || 
                        req.user.role === 'client_admin' || 
                        isOwnProfile;

      if (!canAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const filter = {
        assignedRecruiters: id,
        status
      };

      const requirements = await Requirement.find(filter)
        .populate('assignedRecruiters', 'firstName lastName email')
        .sort({ createdAt: -1 });

      // Add submission counts for each requirement
      const requirementsWithStats = await Promise.all(
        requirements.map(async (req) => {
          const [totalSubmissions, userSubmissions] = await Promise.all([
            Submission.countDocuments({ requirementId: req._id }),
            Submission.countDocuments({ requirementId: req._id, recruiterId: id })
          ]);

          return {
            ...req.toObject(),
            stats: {
              totalSubmissions,
              userSubmissions
            }
          };
        })
      );

      res.json({ requirements: requirementsWithStats });
    } catch (error) {
      console.error('Get user requirements error:', error);
      res.status(500).json({ message: 'Failed to fetch user requirements', error: error.message });
    }
  }

  /**
   * Get user analytics (performance metrics)
   */
  async getUserAnalytics(req, res) {
    try {
      const { id } = req.params;
      const { timeframe = '30d' } = req.query;

      // Check permissions
      const isOwnProfile = req.user._id.toString() === id;
      const canAccess = req.user.role === 'system_admin' || 
                        req.user.role === 'client_admin' || 
                        isOwnProfile;

      if (!canAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Calculate date range
      const now = new Date();
      let startDate;
      switch (timeframe) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      if (user.role === 'recruiter') {
        // Get recruiter analytics
        const [
          totalSubmissions,
          recentSubmissions,
          successfulPlacements,
          rejectedSubmissions,
          interviewedCandidates,
          statusBreakdown,
          monthlyStats
        ] = await Promise.all([
          Submission.countDocuments({ recruiterId: id }),
          Submission.countDocuments({ 
            recruiterId: id, 
            createdAt: { $gte: startDate } 
          }),
          Submission.countDocuments({ 
            recruiterId: id, 
            currentStatus: 'selected' 
          }),
          Submission.countDocuments({ 
            recruiterId: id, 
            currentStatus: 'rejected' 
          }),
          Submission.countDocuments({ 
            recruiterId: id, 
            currentStatus: { $in: ['interview', 'final'] } 
          }),
          Submission.aggregate([
            { $match: { recruiterId: user._id } },
            { $group: { _id: '$currentStatus', count: { $sum: 1 } } }
          ]),
          this.getMonthlySubmissionStats(id, 6) // Last 6 months
        ]);

        const analytics = {
          overview: {
            totalSubmissions,
            recentSubmissions,
            successfulPlacements,
            rejectedSubmissions,
            interviewedCandidates,
            successRate: totalSubmissions > 0 ? Math.round((successfulPlacements / totalSubmissions) * 100) : 0,
            interviewRate: totalSubmissions > 0 ? Math.round((interviewedCandidates / totalSubmissions) * 100) : 0
          },
          statusBreakdown: statusBreakdown.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
          monthlyStats,
          trustPoints: {
            current: user.trustPoints,
            level: this.getTrustPointLevel(user.trustPoints)
          }
        };

        res.json({ analytics });
      } else {
        res.status(400).json({ message: 'Analytics only available for recruiters' });
      }
    } catch (error) {
      console.error('Get user analytics error:', error);
      res.status(500).json({ message: 'Failed to fetch user analytics', error: error.message });
    }
  }

  /**
   * Bulk create users
   */
  async bulkCreateUsers(req, res) {
    try {
      const { users } = req.body;

      if (!Array.isArray(users) || users.length === 0) {
        return res.status(400).json({ message: 'Users array is required' });
      }

      const results = {
        created: [],
        failed: [],
        skipped: []
      };

      for (const userData of users) {
        try {
          const { email, password, firstName, lastName, role, clientId } = userData;

          // Check if user already exists
          const existingUser = await User.findOne({ email });
          if (existingUser) {
            results.skipped.push({ email, reason: 'User already exists' });
            continue;
          }

          const user = new User({
            email,
            password,
            firstName,
            lastName,
            role,
            clientId
          });

          await user.save();

          results.created.push({
            email,
            name: `${firstName} ${lastName}`,
            role
          });

          // Send welcome email (don't wait for it)
          emailService.sendWelcomeEmail(email, firstName, password).catch(console.error);

        } catch (error) {
          results.failed.push({
            email: userData.email,
            reason: error.message
          });
        }
      }

      res.json({
        message: 'Bulk user creation completed',
        results
      });
    } catch (error) {
      console.error('Bulk create users error:', error);
      res.status(500).json({ message: 'Failed to bulk create users', error: error.message });
    }
  }

  /**
   * Invite user via email
   */
  async inviteUser(req, res) {
    try {
      const { email, role, clientId, message } = req.body;

      if (!email || !role) {
        return res.status(400).json({ message: 'Email and role are required' });
      }

      // Validate role permissions
      if (req.user.role === 'client_admin' && role !== 'recruiter') {
        return res.status(403).json({ message: 'Client admins can only invite recruiters' });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }

      // Generate invitation token
      const invitationToken = crypto.randomBytes(32).toString('hex');
      const invitationExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Store invitation (you might want to create a separate Invitation model)
      const invitationData = {
        email,
        role,
        clientId,
        token: invitationToken,
        expiresAt: invitationExpiry,
        invitedBy: req.user._id,
        message: message || `You've been invited to join our recruitment platform as a ${role}.`
      };

      // Send invitation email
      await emailService.sendInvitationEmail(email, role, invitationToken, message);

      res.json({
        message: 'Invitation sent successfully',
        invitation: {
          email,
          role,
          expiresAt: invitationExpiry
        }
      });
    } catch (error) {
      console.error('Invite user error:', error);
      res.status(500).json({ message: 'Failed to send invitation', error: error.message });
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      const user = await User.findOne({ email, isActive: true });
      if (!user) {
        // Don't reveal if user exists or not
        return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store reset token (you might want to add these fields to User model)
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = resetTokenExpiry;
      await user.save();

      // Send reset email
      await emailService.sendPasswordResetEmail(email, resetToken);

      res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    } catch (error) {
      console.error('Send password reset error:', error);
      res.status(500).json({ message: 'Failed to send password reset email', error: error.message });
    }
  }

  /**
   * Verify reset token and update password
   */
  async verifyResetToken(req, res) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token and new password are required' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
      }

      const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() },
        isActive: true
      });

      if (!user) {
        return res.status(400).json({ message: 'Invalid or expired reset token' });
      }

      // Update password and clear reset token
      user.password = newPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('Verify reset token error:', error);
      res.status(500).json({ message: 'Failed to reset password', error: error.message });
    }
  }

  /**
   * Search users
   */
  async searchUsers(req, res) {
    try {
      const { q, role, client } = req.query;

      if (!q || q.length < 2) {
        return res.status(400).json({ message: 'Search query must be at least 2 characters long' });
      }

      const filter = {
        isActive: true,
        $or: [
          { firstName: { $regex: q, $options: 'i' } },
          { lastName: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } }
        ]
      };

      if (role) filter.role = role;
      if (client) filter.clientId = client;

      // Limit results for non-system admins
      let limit = 50;
      if (req.user.role === 'client_admin') {
        filter.clientId = req.user.clientId;
        limit = 20;
      }

      const users = await User.find(filter)
        .select('firstName lastName email role trustPoints')
        .populate('clientId', 'name')
        .limit(limit)
        .sort({ firstName: 1 });

      res.json({ users });
    } catch (error) {
      console.error('Search users error:', error);
      res.status(500).json({ message: 'Failed to search users', error: error.message });
    }
  }

  /**
   * Impersonate user (for support purposes)
   */
  async impersonateUser(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id).select('-password');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (!user.isActive) {
        return res.status(400).json({ message: 'Cannot impersonate inactive user' });
      }

      // Generate impersonation token
      const impersonationToken = generateToken(user._id, user.role);

      // Log impersonation for audit
      console.log(`User ${req.user.email} is impersonating ${user.email}`);

      res.json({
        message: 'Impersonation token generated',
        token: impersonationToken,
        user: {
          id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Impersonate user error:', error);
      res.status(500).json({ message: 'Failed to impersonate user', error: error.message });
    }
  }

  /**
   * Get user activity log
   */
  async getUserActivityLog(req, res) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20 } = req.query;

      // Check permissions
      const isOwnProfile = req.user._id.toString() === id;
      const canAccess = req.user.role === 'system_admin' || isOwnProfile;

      if (!canAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // This would typically come from an ActivityLog model
      // For now, we'll return recent submissions as activity
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const activities = await Submission.find({ recruiterId: id })
        .populate('requirementId', 'title')
        .select('candidateName currentStatus createdAt updatedAt')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Submission.countDocuments({ recruiterId: id });

      // Transform submissions into activity log format
      const activityLog = activities.map(activity => ({
        id: activity._id,
        type: 'submission',
        action: `Submitted candidate: ${activity.candidateName}`,
        details: {
          requirement: activity.requirementId?.title,
          status: activity.currentStatus
        },
        timestamp: activity.updatedAt
      }));

      res.json({
        activities: activityLog,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Get user activity log error:', error);
      res.status(500).json({ message: 'Failed to fetch activity log', error: error.message });
    }
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (req.user._id.toString() === id) {
        return res.status(400).json({ message: 'Cannot deactivate your own account' });
      }

      const user = await User.findByIdAndUpdate(
        id,
        { 
          isActive: false,
          deactivatedAt: new Date(),
          deactivatedBy: req.user._id,
          deactivationReason: reason
        },
        { new: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        message: 'User deactivated successfully',
        user
      });
    } catch (error) {
      console.error('Deactivate user error:', error);
      res.status(500).json({ message: 'Failed to deactivate user', error: error.message });
    }
  }

  /**
   * Reactivate user account
   */
  async reactivateUser(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findByIdAndUpdate(
        id,
        { 
          isActive: true,
          $unset: {
            deactivatedAt: "",
            deactivatedBy: "",
            deactivationReason: ""
          }
        },
        { new: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        message: 'User reactivated successfully',
        user
      });
    } catch (error) {
      console.error('Reactivate user error:', error);
      res.status(500).json({ message: 'Failed to reactivate user', error: error.message });
    }
  }

  // Helper methods

  /**
   * Get monthly submission statistics
   */
  async getMonthlySubmissionStats(recruiterId, months = 6) {
    const pipeline = [
      {
        $match: {
          recruiterId: recruiterId,
          createdAt: {
            $gte: new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          submissions: { $sum: 1 },
          selected: {
            $sum: { $cond: [{ $eq: ['$currentStatus', 'selected'] }, 1, 0] }
          },
          interviewed: {
            $sum: { $cond: [{ $in: ['$currentStatus', ['interview', 'final']] }, 1, 0] }
          }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ];

    return await Submission.aggregate(pipeline);
  }

  /**
   * Get trust point level
   */
  getTrustPointLevel(trustPoints) {
    if (trustPoints >= 90) return { level: 'Expert', name: 'Diamond' };
    if (trustPoints >= 80) return { level: 'Advanced', name: 'Platinum' };
    if (trustPoints >= 70) return { level: 'Intermediate', name: 'Gold' };
    if (trustPoints >= 60) return { level: 'Developing', name: 'Silver' };
    return { level: 'Beginner', name: 'Bronze' };
  }
}

module.exports = new UserController();) * parseInt(limit);
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      // Get users with pagination
      const users = await User.find(filter)
        .select('-password')
        .populate('clientId', 'name')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit));

      // Get total count for pagination
      const total = await User.countDocuments(filter);

      res.json({
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Get all users error:', error);
      res.status(500).json({ message: 'Failed to fetch users', error: error.message });
    }
  }

  /**
   * Get current user's profile
   */
  async getCurrentUserProfile(req, res) {
    try {
      const user = await User.findById(req.user._id)
        .select('-password')
        .populate('clientId', 'name');

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Add additional stats for recruiters
      if (user.role === 'recruiter') {
        const submissions = await Submission.countDocuments({ recruiterId: user._id });
        const successfulPlacements = await Submission.countDocuments({
          recruiterId: user._id,
          currentStatus: 'selected'
        });

        user._doc.stats = {
          totalSubmissions: submissions,
          successfulPlacements,
          successRate: submissions > 0 ? Math.round((successfulPlacements / submissions) * 100) : 0
        };
      }

      res.json({ user });
    } catch (error) {
      console.error('Get current user profile error:', error);
      res.status(500).json({ message: 'Failed to fetch profile', error: error.message });
    }
  }

  /**
   * Get all recruiters
   */
  async getRecruiters(req, res) {
    try {
      const { clientId, status = 'active', withStats = false } = req.query;

      const filter = { role: 'recruiter' };
      if (status) filter.isActive = status === 'active';
      if (clientId) filter.clientId = clientId;

      // If user is client admin, filter by their client
      if (req.user.role === 'client_admin' && req.user.clientId) {
        filter.clientId = req.user.clientId;
      }

      let recruiters = await User.find(filter)
        .select('-password')
        .populate('clientId', 'name')
        .sort({ trustPoints: -1, createdAt: -1 });

      // Add statistics if requested
      if (withStats === 'true') {
        recruiters = await Promise.all(recruiters.map(async (recruiter) => {
          const [submissions, successful, requirements] = await Promise.all([
            Submission.countDocuments({ recruiterId: recruiter._id }),
            Submission.countDocuments({
              recruiterId: recruiter._id,
              currentStatus: 'selected'
            }),
            Requirement.countDocuments({
              assignedRecruiters: recruiter._id,
              status: 'active'
            })
          ]);

          return {
            ...recruiter.toObject(),
            stats: {
              totalSubmissions: submissions,
              successfulPlacements: successful,
              activeRequirements: requirements,
              successRate: submissions > 0 ? Math.round((successful / submissions) * 100) : 0
            }
          };
        }));
      }

      res.json({ recruiters });
    } catch (error) {
      console.error('Get recruiters error:', error);
      res.status(500).json({ message: 'Failed to fetch recruiters', error: error.message });
    }
  }

  /**
   * Get all client administrators
   */
  async getClientAdmins(req, res) {
    try {
      const clientAdmins = await User.find({ role: 'client_admin' })
        .select('-password')
        .populate('clientId', 'name')
        .sort({ createdAt: -1 });

      res.json({ clientAdmins });
    } catch (error) {
      console.error('Get client admins error:', error);
      res.status(500).json({ message: 'Failed to fetch client admins', error: error.message });
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(req, res) {
    try {
      const [
        totalUsers,
        activeUsers,
        systemAdmins,
        clientAdmins,
        recruiters,
        activeRecruiters
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isActive: true }),
        User.countDocuments({ role: 'system_admin' }),
        User.countDocuments({ role: 'client_admin' }),
        User.countDocuments({ role: 'recruiter' }),
        User.countDocuments({ role: 'recruiter', isActive: true })
      ]);

      const stats = {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        roleBreakdown: {
          systemAdmins,
          clientAdmins,
          recruiters
        },
        recruiterStats: {
          total: recruiters,
          active: activeRecruiters,
          inactive: recruiters - activeRecruiters
        }
      };

      res.json({ stats });
    } catch (error) {
      console.error('Get user stats error:', error);
      res.status(500).json({ message: 'Failed to fetch user statistics', error: error.message });
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(req, res) {
    try {
      const { id } = req.params;

      // Check if user can access this profile
      if (req.user.role !== 'system_admin' && req.user._id.toString() !== id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const user = await User.findById(id)
        .select('-password')
        .populate('clientId', 'name');

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Add role-specific data
      if (user.role === 'recruiter') {
        const [submissions, successful, requirements, recentActivity] = await Promise.all([
          Submission.countDocuments({ recruiterId: user._id }),
          Submission.countDocuments({
            recruiterId: user._id,
            currentStatus: 'selected'
          }),
          Requirement.countDocuments({
            assignedRecruiters: user._id,
            status: 'active'
          }),
          Submission.find({ recruiterId: user._id })
            .populate('requirementId', 'title')
            .sort({ updatedAt: -1 })
            .limit(5)
        ]);

        user._doc.recruiterData = {
          stats: {
            totalSubmissions: submissions,
            successfulPlacements: successful,
            activeRequirements: requirements,
            successRate: submissions > 0 ? Math.round((successful / submissions) * 100) : 0
          },
          recentActivity
        };
      }

      res.json({ user });
    } catch (error) {
      console.error('Get user by ID error:', error);
      res.status(500).json({ message: 'Failed to fetch user', error: error.message });
    }
  }

  /**
   * Create new user
   */
  async createUser(req, res) {
    try {
      const { email, password, firstName, lastName, role, clientId, profile } = req.body;

      // Validate required fields
      if (!email || !password || !firstName || !lastName || !role) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }

      // Validate role
      const validRoles = ['system_admin', 'client_admin', 'recruiter'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: 'Invalid role specified' });
      }

      // Client ID is required for client_admin role
      if (role === 'client_admin' && !clientId) {
        return res.status(400).json({ message: 'Client ID is required for client administrators' });
      }

      // Create user
      const user = new User({
        email,
        password,
        firstName,
        lastName,
        role,
        clientId: role === 'client_admin' ? clientId : undefined,
        profile: profile || {}
      });

      await user.save();

      // Remove password from response
      const userResponse = user.toObject();
      delete userResponse.password;

      // Send welcome email
      try {
        await emailService.sendWelcomeEmail(user.email, user.firstName, password);
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
        // Don't fail the request if email fails
      }

      res.status(201).json({
        message: 'User created successfully',
        user: userResponse
      });
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({ message: 'Failed to create user', error: error.message });
    }
  }

  /**
   * Update user
   */
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Check permissions
      const isOwnProfile = req.user._id.toString() === id;
      const isSystemAdmin = req.user.role === 'system_admin';

      if (!isOwnProfile && !isSystemAdmin) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Restrict what non-admin users can update
      if (!isSystemAdmin) {
        const allowedFields = ['firstName', 'lastName', 'profile'];
        const updateFields = Object.keys(updates);
        const restrictedFields = updateFields.filter(field => !allowedFields.includes(field));
        
        if (restrictedFields.length > 0) {
          return res.status(403).json({ 
            message: 'Access denied', 
            restrictedFields 
          });
        }
      }

      // Remove sensitive fields that should be updated via separate endpoints
      delete updates.password;
      delete updates.role;
      delete updates.isActive;
      delete updates.trustPoints;

      const user = await User.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      ).select('-password').populate('clientId', 'name');

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        message: 'User updated successfully',
        user
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ message: 'Failed to update user', error: error.message });
    }
  }

  /**
   * Update user role
   */
  async updateUserRole(req, res) {
    try {
      const { id } = req.params;
      const { role, clientId } = req.body;

      const validRoles = ['system_admin', 'client_admin', 'recruiter'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: 'Invalid role specified' });
      }

      const updateData = { role };
      if (role === 'client_admin' || role === 'recruiter') {
        if (!clientId) {
          return res.status(400).json({ message: 'Client ID is required for this role' });
        }
        updateData.clientId = clientId;
      } else {
        updateData.clientId = undefined;
      }

      const user = await User.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      ).select('-password').populate('clientId', 'name');

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        message: 'User role updated successfully',
        user
      });
    } catch (error) {
      console.error('Update user role error:', error);
      res.status(500).json({ message: 'Failed to update user role', error: error.message });
    }
  }

  /**
   * Update user status (activate/deactivate)
   */
  async updateUserStatus(req, res) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: 'isActive must be a boolean value' });
      }

      const user = await User.findByIdAndUpdate(
        id,
        { isActive },
        { new: true, runValidators: true }
      ).select('-password').populate('clientId', 'name');

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
        user
      });
    } catch (error) {
      console.error('Update user status error:', error);
      res.status(500).json({ message: 'Failed to update user status', error: error.message });
    }
  }

  /**
   * Update trust points (for recruiters)
   */
  async updateTrustPoints(req, res) {
    try {
      const { id } = req.params;
      const { trustPoints, reason } = req.body;

      if (typeof trustPoints !== 'number' || trustPoints < 0 || trustPoints > 100) {
        return res.status(400).json({ message: 'Trust points must be a number between 0 and 100' });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (user.role !== 'recruiter') {
        return res.status(400).json({ message: 'Trust points can only be updated for recruiters' });
      }

      user.trustPoints = trustPoints;
      await user.save();

      // Log the trust point change (you could create an audit log model)
      console.log(`Trust points updated for ${user.email}: ${user.trustPoints} -> ${trustPoints}. Reason: ${reason || 'No reason provided'}`);

      res.json({
        message: 'Trust points updated successfully',
        user: {
          id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          trustPoints: user.trustPoints
        }
      });
    } catch (error) {
      console.error('Update trust points error:', error);
      res.status(500).json({ message: 'Failed to update trust points', error: error.message });
    }
  }

  /**
   * Update password
   */
  async updatePassword(req, res) {
    try {
      const { id } = req.params;
      const { currentPassword, newPassword } = req.body;

      // Check permissions
      const isOwnProfile = req.user._id.toString() === id;
      const isSystemAdmin = req.user.role === 'system_admin';

      if (!isOwnProfile && !isSystemAdmin) {
        return res.status(403).json({ message: 'Access denied' });
      }

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters long' });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Verify current password if it's the user's own profile
      if (isOwnProfile) {
        if (!currentPassword) {
          return res.status(400).json({ message: 'Current password is required' });
        }

        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
          return res.status(400).json({ message: 'Current password is incorrect' });
        }
      }

      // Update password
      user.password = newPassword;
      await user.save();

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Update password error:', error);
      res.status(500).json({ message: 'Failed to update password', error: error.message });
    }
  }

  /**
   * Update current user's profile
   */
  async updateProfile(req, res) {
    try {
      const updates = req.body;
      
      // Only allow certain fields to be updated
      const allowedFields = ['firstName', 'lastName', 'profile'];
      const updateData = {};
      
      allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
          updateData[field] = updates[field];
        }
      });

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updateData },
        { new: true, runValidators: true }
      ).select('-password').populate('clientId', 'name');

      res.json({
        message: 'Profile updated successfully',
        user
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ message: 'Failed to update profile', error: error.message });
    }
  }

  /**
   * Delete user (soft delete)
   */
  async deleteUser(req, res) {
    try {
      const { id } = req.params;

      // Check if trying to delete self
      if (req.user._id.toString() === id) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
      }

      const user = await User.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        message: 'User deactivated successfully',
        user
      });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ message: 'Failed to delete user', error: error.message });
    }
  }

  /**
   * Assign user to client
   */
  async assignUserToClient(req, res) {
    try {
      const { id } = req.params;
      const { clientId } = req.body;

      if (!clientId) {
        return res.status(400).json({ message: 'Client ID is required' });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (!['client_admin', 'recruiter'].includes(user.role)) {
        return res.status(400).json({ message: 'Only client admins and recruiters can be assigned to clients' });
      }

      user.clientId = clientId;
      await user.save();

      const updatedUser = await User.findById(id)
        .select('-password')
        .populate('clientId', 'name');

      res.json({
        message: 'User assigned to client successfully',
        user: updatedUser
      });
    } catch (error) {
      console.error('Assign user to client error:', error);
      res.status(500).json({ message: 'Failed to assign user to client', error: error.message });
    }
  }

  /**
   * Get user submissions (for recruiters)
   */
  async getUserSubmissions(req, res) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20, status } = req.query;

      // Check permissions
      const isOwnProfile = req.user._id.toString() === id;
      const canAccess = req.user.role === 'system_admin' || 
                        req.user.role === 'client_admin' || 
                        isOwnProfile;

      if (!canAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const filter = { recruiterId: id };
      if (status) filter.currentStatus = status;

      const skip = (parseInt(page) - 1