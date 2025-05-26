const User = require('../models/User');
const Submission = require('../models/Submission');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../config/jwt');

class UserController {
  /**
   * Get all users (system admin only)
   */
  async getAllUsers(req, res) {
    try {
      const { role, status, page = 1, limit = 20, search } = req.query;

      let query = {};

      // Filter by role if provided
      if (role) {
        query.role = role;
      }

      // Filter by status if provided
      if (status) {
        query.isActive = status === 'active';
      }

      // Search functionality
      if (search) {
        query.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const users = await User.find(query)
        .select('-password')
        .populate('clientId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await User.countDocuments(query);

      // Get user statistics
      const stats = await this.getUserStats();

      res.json({
        success: true,
        users,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        },
        stats,
        message: 'Users retrieved successfully'
      });

    } catch (error) {
      console.error('Get all users error:', error);
      res.status(500).json({
        message: 'Failed to retrieve users',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id)
        .select('-password')
        .populate('clientId', 'name');

      if (!user) {
        return res.status(404).json({
          message: 'User not found'
        });
      }

      // Get additional user metrics if it's a recruiter
      let userMetrics = {};
      if (user.role === 'recruiter') {
        userMetrics = await this.getRecruiterMetrics(id);
      }

      res.json({
        success: true,
        user: {
          ...user.toObject(),
          metrics: userMetrics
        },
        message: 'User retrieved successfully'
      });

    } catch (error) {
      console.error('Get user by ID error:', error);
      res.status(500).json({
        message: 'Failed to retrieve user',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Update user profile
   */
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Remove sensitive fields that shouldn't be updated via this endpoint
      delete updates.password;
      delete updates.role;
      delete updates._id;

      // Check if the user exists
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          message: 'User not found'
        });
      }

      // Check authorization - users can only update their own profile unless admin
      if (req.user.role !== 'system_admin' && req.user._id.toString() !== id) {
        return res.status(403).json({
          message: 'Access denied. You can only update your own profile.'
        });
      }

      // Update user
      const updatedUser = await User.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      ).select('-password').populate('clientId', 'name');

      res.json({
        success: true,
        user: updatedUser,
        message: 'User updated successfully'
      });

    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({
        message: 'Failed to update user',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Change user password
   */
  async changePassword(req, res) {
    try {
      const { id } = req.params;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          message: 'Current password and new password are required'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          message: 'New password must be at least 6 characters long'
        });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          message: 'User not found'
        });
      }

      // Check authorization - users can only change their own password unless admin
      if (req.user.role !== 'system_admin' && req.user._id.toString() !== id) {
        return res.status(403).json({
          message: 'Access denied. You can only change your own password.'
        });
      }

      // Verify current password (skip for admin changing other user's password)
      if (req.user._id.toString() === id) {
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
          return res.status(400).json({
            message: 'Current password is incorrect'
          });
        }
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update password
      await User.findByIdAndUpdate(id, {
        password: hashedPassword
      });

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        message: 'Failed to change password',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Activate/Deactivate user
   */
  async toggleUserStatus(req, res) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          message: 'isActive must be a boolean value'
        });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          message: 'User not found'
        });
      }

      // Prevent self-deactivation
      if (req.user._id.toString() === id && !isActive) {
        return res.status(400).json({
          message: 'You cannot deactivate your own account'
        });
      }

      const updatedUser = await User.findByIdAndUpdate(
        id,
        { isActive },
        { new: true }
      ).select('-password');

      res.json({
        success: true,
        user: updatedUser,
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`
      });

    } catch (error) {
      console.error('Toggle user status error:', error);
      res.status(500).json({
        message: 'Failed to update user status',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Delete user
   */
  async deleteUser(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          message: 'User not found'
        });
      }

      // Prevent self-deletion
      if (req.user._id.toString() === id) {
        return res.status(400).json({
          message: 'You cannot delete your own account'
        });
      }

      // Check if user has submissions (for recruiters)
      if (user.role === 'recruiter') {
        const submissionCount = await Submission.countDocuments({ recruiterId: id });
        if (submissionCount > 0) {
          return res.status(400).json({
            message: 'Cannot delete recruiter with existing submissions. Deactivate instead.'
          });
        }
      }

      await User.findByIdAndDelete(id);

      res.json({
        success: true,
        message: 'User deleted successfully'
      });

    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({
        message: 'Failed to delete user',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Update user role (system admin only)
   */
  async updateUserRole(req, res) {
    try {
      const { id } = req.params;
      const { role, clientId } = req.body;

      const validRoles = ['system_admin', 'client_admin', 'recruiter'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          message: 'Invalid role. Valid roles: ' + validRoles.join(', ')
        });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          message: 'User not found'
        });
      }

      // Prevent changing own role
      if (req.user._id.toString() === id) {
        return res.status(400).json({
          message: 'You cannot change your own role'
        });
      }

      const updateData = { role };

      // Handle client assignment for client_admin role
      if (role === 'client_admin') {
        if (!clientId) {
          return res.status(400).json({
            message: 'Client ID is required for client_admin role'
          });
        }
        updateData.clientId = clientId;
      } else {
        updateData.clientId = undefined;
      }

      const updatedUser = await User.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
      ).select('-password').populate('clientId', 'name');

      res.json({
        success: true,
        user: updatedUser,
        message: 'User role updated successfully'
      });

    } catch (error) {
      console.error('Update user role error:', error);
      res.status(500).json({
        message: 'Failed to update user role',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Update recruiter trust points (admin only)
   */
  async updateTrustPoints(req, res) {
    try {
      const { id } = req.params;
      const { trustPoints, reason } = req.body;

      if (typeof trustPoints !== 'number' || trustPoints < 0) {
        return res.status(400).json({
          message: 'Trust points must be a non-negative number'
        });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          message: 'User not found'
        });
      }

      if (user.role !== 'recruiter') {
        return res.status(400).json({
          message: 'Trust points can only be updated for recruiters'
        });
      }

      const updatedUser = await User.findByIdAndUpdate(
        id,
        { trustPoints },
        { new: true }
      ).select('-password');

      // Log the trust point adjustment (you might want to create a separate model for this)
      console.log(`Trust points updated for ${user.firstName} ${user.lastName} (${user.email}): ${trustPoints}. Reason: ${reason || 'Manual adjustment'}`);

      res.json({
        success: true,
        user: updatedUser,
        message: 'Trust points updated successfully'
      });

    } catch (error) {
      console.error('Update trust points error:', error);
      res.status(500).json({
        message: 'Failed to update trust points',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get recruiters list
   */
  async getRecruiters(req, res) {
    try {
      const { status, clientId, page = 1, limit = 20, search } = req.query;

      let query = { role: 'recruiter' };

      // Filter by status
      if (status) {
        query.isActive = status === 'active';
      }

      // Filter by client (for client admins)
      if (clientId) {
        query.clientId = clientId;
      }

      // Search functionality
      if (search) {
        query.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const recruiters = await User.find(query)
        .select('-password')
        .populate('clientId', 'name')
        .sort({ trustPoints: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await User.countDocuments(query);

      // Add submission counts and performance metrics
      const recruitersWithMetrics = await Promise.all(
        recruiters.map(async (recruiter) => {
          const submissionStats = await Submission.aggregate([
            { $match: { recruiterId: recruiter._id } },
            {
              $group: {
                _id: null,
                totalSubmissions: { $sum: 1 },
                selectedCount: {
                  $sum: { $cond: [{ $eq: ['$currentStatus', 'selected'] }, 1, 0] }
                },
                interviewCount: {
                  $sum: { $cond: [{ $eq: ['$currentStatus', 'interview'] }, 1, 0] }
                }
              }
            }
          ]);

          const stats = submissionStats[0] || {
            totalSubmissions: 0,
            selectedCount: 0,
            interviewCount: 0
          };

          return {
            ...recruiter.toObject(),
            submissionStats: {
              ...stats,
              successRate: stats.totalSubmissions > 0 
                ? Math.round((stats.selectedCount / stats.totalSubmissions) * 100) 
                : 0
            }
          };
        })
      );

      res.json({
        success: true,
        recruiters: recruitersWithMetrics,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        },
        message: 'Recruiters retrieved successfully'
      });

    } catch (error) {
      console.error('Get recruiters error:', error);
      res.status(500).json({
        message: 'Failed to retrieve recruiters',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get top performing recruiters
   */
  async getTopRecruiters(req, res) {
    try {
      const { limit = 10, period = '30' } = req.query;
      
      const dateFilter = new Date();
      dateFilter.setDate(dateFilter.getDate() - parseInt(period));

      const topRecruiters = await Submission.aggregate([
        {
          $match: {
            createdAt: { $gte: dateFilter }
          }
        },
        {
          $group: {
            _id: '$recruiterId',
            totalSubmissions: { $sum: 1 },
            selectedCount: {
              $sum: { $cond: [{ $eq: ['$currentStatus', 'selected'] }, 1, 0] }
            },
            interviewCount: {
              $sum: { $cond: [{ $eq: ['$currentStatus', 'interview'] }, 1, 0] }
            },
            totalTrustPoints: { $sum: '$trustPointsEarned' }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'recruiter'
          }
        },
        { $unwind: '$recruiter' },
        {
          $addFields: {
            successRate: {
              $multiply: [
                { $divide: ['$selectedCount', '$totalSubmissions'] },
                100
              ]
            }
          }
        },
        {
          $project: {
            name: { $concat: ['$recruiter.firstName', ' ', '$recruiter.lastName'] },
            email: '$recruiter.email',
            trustPoints: '$recruiter.trustPoints',
            totalSubmissions: 1,
            selectedCount: 1,
            interviewCount: 1,
            totalTrustPoints: 1,
            successRate: 1
          }
        },
        { $sort: { totalTrustPoints: -1, successRate: -1 } },
        { $limit: parseInt(limit) }
      ]);

      res.json({
        success: true,
        topRecruiters,
        period: `${period} days`,
        message: 'Top recruiters retrieved successfully'
      });

    } catch (error) {
      console.error('Get top recruiters error:', error);
      res.status(500).json({
        message: 'Failed to retrieve top recruiters',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Private helper methods
   */

  /**
   * Get user statistics
   */
  async getUserStats() {
    try {
      const totalUsers = await User.countDocuments();
      const activeUsers = await User.countDocuments({ isActive: true });
      
      const roleStats = await User.aggregate([
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 }
          }
        }
      ]);

      const recentUsers = await User.find()
        .select('firstName lastName email role createdAt')
        .sort({ createdAt: -1 })
        .limit(5);

      return {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        roleStats,
        recentUsers
      };
    } catch (error) {
      console.error('Get user stats error:', error);
      return {
        totalUsers: 0,
        activeUsers: 0,
        inactiveUsers: 0,
        roleStats: [],
        recentUsers: []
      };
    }
  }

  /**
   * Get recruiter performance metrics
   */
  async getRecruiterMetrics(recruiterId) {
    try {
      const metrics = await Submission.aggregate([
        { $match: { recruiterId: require('mongoose').Types.ObjectId(recruiterId) } },
        {
          $group: {
            _id: null,
            totalSubmissions: { $sum: 1 },
            screeningCount: {
              $sum: { $cond: [{ $eq: ['$currentStatus', 'screening'] }, 1, 0] }
            },
            interviewCount: {
              $sum: { $cond: [{ $eq: ['$currentStatus', 'interview'] }, 1, 0] }
            },
            finalCount: {
              $sum: { $cond: [{ $eq: ['$currentStatus', 'final'] }, 1, 0] }
            },
            selectedCount: {
              $sum: { $cond: [{ $eq: ['$currentStatus', 'selected'] }, 1, 0] }
            },
            rejectedCount: {
              $sum: { $cond: [{ $eq: ['$currentStatus', 'rejected'] }, 1, 0] }
            },
            totalTrustPoints: { $sum: '$trustPointsEarned' }
          }
        },
        {
          $addFields: {
            successRate: {
              $cond: [
                { $gt: ['$totalSubmissions', 0] },
                { $multiply: [{ $divide: ['$selectedCount', '$totalSubmissions'] }, 100] },
                0
              ]
            },
            interviewRate: {
              $cond: [
                { $gt: ['$totalSubmissions', 0] },
                { $multiply: [{ $divide: ['$interviewCount', '$totalSubmissions'] }, 100] },
                0
              ]
            }
          }
        }
      ]);

      return metrics[0] || {
        totalSubmissions: 0,
        screeningCount: 0,
        interviewCount: 0,
        finalCount: 0,
        selectedCount: 0,
        rejectedCount: 0,
        totalTrustPoints: 0,
        successRate: 0,
        interviewRate: 0
      };
    } catch (error) {
      console.error('Get recruiter metrics error:', error);
      return {};
    }
  }

  /**
   * Bulk update users
   */
  async bulkUpdateUsers(req, res) {
    try {
      const { userIds, updates } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          message: 'User IDs array is required'
        });
      }

      // Remove sensitive fields
      delete updates.password;
      delete updates._id;

      const result = await User.updateMany(
        { _id: { $in: userIds } },
        { $set: updates }
      );

      res.json({
        success: true,
        modifiedCount: result.modifiedCount,
        message: `${result.modifiedCount} users updated successfully`
      });

    } catch (error) {
      console.error('Bulk update users error:', error);
      res.status(500).json({
        message: 'Failed to bulk update users',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Export users data
   */
  async exportUsers(req, res) {
    try {
      const { role, status, format = 'csv' } = req.query;

      let query = {};
      if (role) query.role = role;
      if (status) query.isActive = status === 'active';

      const users = await User.find(query)
        .select('-password')
        .populate('clientId', 'name')
        .sort({ createdAt: -1 });

      if (format === 'csv') {
        const csvData = users.map(user => ({
          'User ID': user._id,
          'First Name': user.firstName,
          'Last Name': user.lastName,
          'Email': user.email,
          'Role': user.role,
          'Status': user.isActive ? 'Active' : 'Inactive',
          'Trust Points': user.trustPoints || 0,
          'Client': user.clientId?.name || '',
          'Phone': user.profile?.phone || '',
          'Company': user.profile?.company || '',
          'LinkedIn URL': user.profile?.linkedinUrl || '',
          'Created Date': user.createdAt?.toISOString() || '',
          'Last Updated': user.updatedAt?.toISOString() || ''
        }));

        // Convert to CSV format
        const csvHeaders = Object.keys(csvData[0] || {});
        const csvRows = csvData.map(row => 
          csvHeaders.map(header => 
            `"${(row[header] || '').toString().replace(/"/g, '""')}"`
          ).join(',')
        );
        const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
        res.send(csvContent);
      } else {
        res.json({
          success: true,
          users,
          count: users.length,
          message: 'Users exported successfully'
        });
      }

    } catch (error) {
      console.error('Export users error:', error);
      res.status(500).json({
        message: 'Failed to export users',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get user activity log
   */
  async getUserActivity(req, res) {
    try {
      const { id } = req.params;
      const { limit = 20 } = req.query;

      const user = await User.findById(id).select('firstName lastName email role');
      if (!user) {
        return res.status(404).json({
          message: 'User not found'
        });
      }

      // Get recent submissions for recruiters
      let activity = [];
      if (user.role === 'recruiter') {
        const submissions = await Submission.find({ recruiterId: id })
          .populate('requirementId', 'title clientName')
          .sort({ updatedAt: -1 })
          .limit(parseInt(limit));

        activity = submissions.map(sub => ({
          type: 'submission',
          action: `Submitted candidate: ${sub.candidateName}`,
          requirement: sub.requirementId?.title,
          client: sub.requirementId?.clientName,
          status: sub.currentStatus,
          timestamp: sub.updatedAt
        }));
      }

      res.json({
        success: true,
        user: {
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          role: user.role
        },
        activity,
        message: 'User activity retrieved successfully'
      });

    } catch (error) {
      console.error('Get user activity error:', error);
      res.status(500).json({
        message: 'Failed to retrieve user activity',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = new UserController();