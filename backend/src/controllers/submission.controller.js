const Submission = require('../models/Submission');
const Requirement = require('../models/Requirement');
const User = require('../models/User');
const MatchScore = require('../models/MatchScore');
const aiService = require('../services/ai.service');
const path = require('path');
const fs = require('fs').promises;

class SubmissionController {
  /**
   * Create a new candidate submission
   */
  async createSubmission(req, res) {
    try {
      const {
        requirementId,
        candidateName,
        candidateEmail,
        candidatePhone,
        linkedinUrl,
        notes
      } = req.body;

      const recruiterId = req.user._id;
      const resumeFile = req.files?.resume;

      // Validation
      if (!requirementId || !candidateName || !candidateEmail) {
        return res.status(400).json({
          message: 'Requirement ID, candidate name, and email are required'
        });
      }

      if (!resumeFile && !linkedinUrl) {
        return res.status(400).json({
          message: 'Either resume file or LinkedIn URL is required'
        });
      }

      // Check if requirement exists and is active
      const requirement = await Requirement.findById(requirementId);
      if (!requirement) {
        return res.status(404).json({
          message: 'Requirement not found'
        });
      }

      if (requirement.status !== 'active') {
        return res.status(400).json({
          message: 'Cannot submit to inactive requirement'
        });
      }

      // Check if candidate already submitted for this requirement by this recruiter
      const existingSubmission = await Submission.findOne({
        requirementId,
        recruiterId,
        candidateEmail: candidateEmail.toLowerCase()
      });

      if (existingSubmission) {
        return res.status(409).json({
          message: 'Candidate already submitted for this requirement'
        });
      }

      let resumeUrl = null;

      // Handle resume file upload
      if (resumeFile) {
        if (resumeFile.mimetype !== 'application/pdf') {
          return res.status(400).json({
            message: 'Only PDF files are supported for resume upload'
          });
        }

        if (resumeFile.size > 10 * 1024 * 1024) { // 10MB limit
          return res.status(400).json({
            message: 'Resume file size cannot exceed 10MB'
          });
        }

        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(__dirname, '../uploads/resumes');
        try {
          await fs.access(uploadsDir);
        } catch {
          await fs.mkdir(uploadsDir, { recursive: true });
        }

        // Generate unique filename
        const timestamp = Date.now();
        const filename = `resume_${timestamp}_${resumeFile.name}`;
        const filepath = path.join(uploadsDir, filename);

        // Save file
        await fs.writeFile(filepath, resumeFile.data);
        resumeUrl = `/uploads/resumes/${filename}`;
      }

      // Create submission
      const submission = new Submission({
        requirementId,
        recruiterId,
        candidateName,
        candidateEmail: candidateEmail.toLowerCase(),
        candidatePhone,
        resumeUrl,
        linkedinUrl,
        notes,
        statusHistory: [{
          status: 'submitted',
          timestamp: new Date(),
          notes: 'Initial submission',
          updatedBy: recruiterId
        }]
      });

      await submission.save();

      // Perform AI analysis in background
      this.performAIAnalysis(submission._id, requirement, resumeFile, linkedinUrl);

      // Update recruiter's trust points
      await this.updateTrustPoints(recruiterId, 'submission');

      // Populate the submission for response
      const populatedSubmission = await Submission.findById(submission._id)
        .populate('requirementId', 'title clientName')
        .populate('recruiterId', 'firstName lastName email');

      res.status(201).json({
        success: true,
        submission: populatedSubmission,
        message: 'Candidate submitted successfully'
      });

    } catch (error) {
      console.error('Create submission error:', error);
      res.status(500).json({
        message: 'Failed to create submission',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get submissions for recruiter
   */
  async getMySubmissions(req, res) {
    try {
      const recruiterId = req.user._id;
      const { status, requirementId, page = 1, limit = 20 } = req.query;

      let query = { recruiterId };

      // Filter by status if provided
      if (status) {
        query.currentStatus = status;
      }

      // Filter by requirement if provided
      if (requirementId) {
        query.requirementId = requirementId;
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const submissions = await Submission.find(query)
        .populate('requirementId', 'title clientName maskedClientName deadline')
        .populate('aiMatchScore')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Submission.countDocuments(query);

      // Calculate trust points earned
      const trustPointsEarned = submissions.reduce((sum, sub) => sum + sub.trustPointsEarned, 0);

      res.json({
        success: true,
        submissions,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        },
        stats: {
          totalSubmissions: total,
          trustPointsEarned
        },
        message: 'Submissions retrieved successfully'
      });

    } catch (error) {
      console.error('Get my submissions error:', error);
      res.status(500).json({
        message: 'Failed to retrieve submissions',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get all submissions (admin only)
   */
  async getAllSubmissions(req, res) {
    try {
      const { status, requirementId, recruiterId, page = 1, limit = 20 } = req.query;

      let query = {};

      // Build query filters
      if (status) query.currentStatus = status;
      if (requirementId) query.requirementId = requirementId;
      if (recruiterId) query.recruiterId = recruiterId;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const submissions = await Submission.find(query)
        .populate('requirementId', 'title clientName deadline')
        .populate('recruiterId', 'firstName lastName email')
        .populate('aiMatchScore')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Submission.countDocuments(query);

      // Get submission statistics
      const stats = await this.getSubmissionStats();

      res.json({
        success: true,
        submissions,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        },
        stats,
        message: 'All submissions retrieved successfully'
      });

    } catch (error) {
      console.error('Get all submissions error:', error);
      res.status(500).json({
        message: 'Failed to retrieve submissions',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get submission details by ID
   */
  async getSubmissionById(req, res) {
    try {
      const { id } = req.params;

      const submission = await Submission.findById(id)
        .populate('requirementId')
        .populate('recruiterId', 'firstName lastName email')
        .populate('aiMatchScore')
        .populate('statusHistory.updatedBy', 'firstName lastName');

      if (!submission) {
        return res.status(404).json({
          message: 'Submission not found'
        });
      }

      // Check authorization (recruiters can only see their own submissions)
      if (req.user.role === 'recruiter' && submission.recruiterId._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message: 'Access denied. You can only view your own submissions.'
        });
      }

      res.json({
        success: true,
        submission,
        message: 'Submission retrieved successfully'
      });

    } catch (error) {
      console.error('Get submission by ID error:', error);
      res.status(500).json({
        message: 'Failed to retrieve submission',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Update submission status
   */
  async updateSubmissionStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;

      const validStatuses = ['submitted', 'screening', 'interview', 'final', 'selected', 'rejected'];
      
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          message: 'Invalid status. Valid statuses: ' + validStatuses.join(', ')
        });
      }

      const submission = await Submission.findById(id);
      if (!submission) {
        return res.status(404).json({
          message: 'Submission not found'
        });
      }

      // Update submission status
      const oldStatus = submission.currentStatus;
      submission.currentStatus = status;

      // Add to status history
      submission.statusHistory.push({
        status,
        timestamp: new Date(),
        notes: notes || `Status changed from ${oldStatus} to ${status}`,
        updatedBy: req.user._id
      });

      // Update trust points based on status progression
      await this.updateTrustPointsForStatus(submission.recruiterId, oldStatus, status);

      // Update trust points earned for this submission
      const pointsEarned = this.calculateTrustPoints(status);
      submission.trustPointsEarned = pointsEarned;

      await submission.save();

      const updatedSubmission = await Submission.findById(id)
        .populate('requirementId', 'title clientName')
        .populate('recruiterId', 'firstName lastName email')
        .populate('statusHistory.updatedBy', 'firstName lastName');

      res.json({
        success: true,
        submission: updatedSubmission,
        message: 'Submission status updated successfully'
      });

    } catch (error) {
      console.error('Update submission status error:', error);
      res.status(500).json({
        message: 'Failed to update submission status',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Delete submission
   */
  async deleteSubmission(req, res) {
    try {
      const { id } = req.params;

      const submission = await Submission.findById(id);
      if (!submission) {
        return res.status(404).json({
          message: 'Submission not found'
        });
      }

      // Check authorization (recruiters can only delete their own submissions)
      if (req.user.role === 'recruiter' && submission.recruiterId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message: 'Access denied. You can only delete your own submissions.'
        });
      }

      // Delete associated files
      if (submission.resumeUrl) {
        const filepath = path.join(__dirname, '..', submission.resumeUrl);
        try {
          await fs.unlink(filepath);
        } catch (error) {
          console.warn('Could not delete resume file:', error.message);
        }
      }

      // Delete associated match score
      await MatchScore.deleteOne({ submissionId: id });

      // Delete submission
      await Submission.findByIdAndDelete(id);

      res.json({
        success: true,
        message: 'Submission deleted successfully'
      });

    } catch (error) {
      console.error('Delete submission error:', error);
      res.status(500).json({
        message: 'Failed to delete submission',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get submissions for a specific requirement
   */
  async getSubmissionsByRequirement(req, res) {
    try {
      const { requirementId } = req.params;
      const { status, page = 1, limit = 20 } = req.query;

      let query = { requirementId };
      if (status) query.currentStatus = status;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const submissions = await Submission.find(query)
        .populate('recruiterId', 'firstName lastName email')
        .populate('aiMatchScore')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Submission.countDocuments(query);

      // Get status breakdown
      const statusBreakdown = await Submission.aggregate([
        { $match: { requirementId: require('mongoose').Types.ObjectId(requirementId) } },
        { $group: { _id: '$currentStatus', count: { $sum: 1 } } }
      ]);

      res.json({
        success: true,
        submissions,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        },
        statusBreakdown,
        message: 'Requirement submissions retrieved successfully'
      });

    } catch (error) {
      console.error('Get submissions by requirement error:', error);
      res.status(500).json({
        message: 'Failed to retrieve requirement submissions',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Bulk update submission statuses
   */
  async bulkUpdateStatus(req, res) {
    try {
      const { submissionIds, status, notes } = req.body;

      if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
        return res.status(400).json({
          message: 'Submission IDs array is required'
        });
      }

      const validStatuses = ['submitted', 'screening', 'interview', 'final', 'selected', 'rejected'];
      
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          message: 'Invalid status. Valid statuses: ' + validStatuses.join(', ')
        });
      }

      const updateResult = await Submission.updateMany(
        { _id: { $in: submissionIds } },
        {
          $set: { currentStatus: status },
          $push: {
            statusHistory: {
              status,
              timestamp: new Date(),
              notes: notes || `Bulk status update to ${status}`,
              updatedBy: req.user._id
            }
          }
        }
      );

      res.json({
        success: true,
        updatedCount: updateResult.modifiedCount,
        message: `${updateResult.modifiedCount} submissions updated successfully`
      });

    } catch (error) {
      console.error('Bulk update status error:', error);
      res.status(500).json({
        message: 'Failed to bulk update submissions',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Private helper methods
   */

  /**
   * Perform AI analysis in background
   */
  async performAIAnalysis(submissionId, requirement, resumeFile, linkedinUrl) {
    try {
      let candidateData = '';

      // Parse resume if provided
      if (resumeFile) {
        candidateData = await aiService.parsePDFResume(resumeFile.data);
      }

      // Parse LinkedIn if provided
      if (linkedinUrl) {
        const linkedinData = await aiService.parseLinkedInProfile(linkedinUrl);
        candidateData += `\n\nLinkedIn: ${linkedinData.name} - ${linkedinData.headline}`;
      }

      // Perform AI analysis
      const analysis = await aiService.analyzeResume(candidateData, requirement);

      // Save match score
      const matchScore = new MatchScore({
        submissionId,
        overallScore: analysis.overallScore,
        skillsMatch: analysis.skillsMatch,
        experienceMatch: analysis.experienceMatch,
        aiReasoning: analysis.reasoning,
        detailedAnalysis: {
          strengths: analysis.strengths,
          weaknesses: analysis.weaknesses,
          recommendations: analysis.recommendations
        }
      });

      await matchScore.save();

      // Update submission with match score reference
      await Submission.findByIdAndUpdate(submissionId, {
        aiMatchScore: matchScore._id
      });

    } catch (error) {
      console.error('AI analysis background job error:', error);
    }
  }

  /**
   * Calculate trust points based on status
   */
  calculateTrustPoints(status) {
    const pointsMap = {
      'submitted': 5,
      'screening': 10,
      'interview': 15,
      'final': 25,
      'selected': 100,
      'rejected': 0
    };
    return pointsMap[status] || 0;
  }

  /**
   * Update recruiter trust points
   */
  async updateTrustPoints(recruiterId, action) {
    const pointsMap = {
      'submission': 5,
      'interview': 15,
      'final': 25,
      'selected': 100
    };

    const points = pointsMap[action] || 0;
    if (points > 0) {
      await User.findByIdAndUpdate(recruiterId, {
        $inc: { trustPoints: points }
      });
    }
  }

  /**
   * Update trust points based on status progression
   */
  async updateTrustPointsForStatus(recruiterId, oldStatus, newStatus) {
    const statusProgression = {
      'screening': 5,
      'interview': 15,
      'final': 25,
      'selected': 100
    };

    const oldPoints = statusProgression[oldStatus] || 0;
    const newPoints = statusProgression[newStatus] || 0;
    const pointsDifference = newPoints - oldPoints;

    if (pointsDifference > 0) {
      await User.findByIdAndUpdate(recruiterId, {
        $inc: { trustPoints: pointsDifference }
      });
    }
  }

  /**
   * Get submission statistics
   */
  async getSubmissionStats() {
    try {
      const totalSubmissions = await Submission.countDocuments();
      
      const statusStats = await Submission.aggregate([
        {
          $group: {
            _id: '$currentStatus',
            count: { $sum: 1 }
          }
        }
      ]);

      const monthlySubmissions = await Submission.aggregate([
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 }
      ]);

      const topRecruiters = await Submission.aggregate([
        {
          $group: {
            _id: '$recruiterId',
            submissionCount: { $sum: 1 },
            selectedCount: {
              $sum: { $cond: [{ $eq: ['$currentStatus', 'selected'] }, 1, 0] }
            }
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
          $project: {
            name: { $concat: ['$recruiter.firstName', ' ', '$recruiter.lastName'] },
            email: '$recruiter.email',
            submissionCount: 1,
            selectedCount: 1,
            successRate: {
              $multiply: [
                { $divide: ['$selectedCount', '$submissionCount'] },
                100
              ]
            }
          }
        },
        { $sort: { submissionCount: -1 } },
        { $limit: 10 }
      ]);

      return {
        totalSubmissions,
        statusStats,
        monthlySubmissions,
        topRecruiters
      };
    } catch (error) {
      console.error('Get submission stats error:', error);
      return {
        totalSubmissions: 0,
        statusStats: [],
        monthlySubmissions: [],
        topRecruiters: []
      };
    }
  }

  /**
   * Get recruiter performance metrics
   */
  async getRecruiterMetrics(req, res) {
    try {
      const { recruiterId } = req.params;
      const { startDate, endDate } = req.query;

      let dateQuery = {};
      if (startDate && endDate) {
        dateQuery = {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        };
      }

      const query = { 
        recruiterId,
        ...dateQuery
      };

      const metrics = await Submission.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$recruiterId',
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
              $multiply: [
                { $divide: ['$selectedCount', '$totalSubmissions'] },
                100
              ]
            },
            interviewRate: {
              $multiply: [
                { $divide: ['$interviewCount', '$totalSubmissions'] },
                100
              ]
            }
          }
        }
      ]);

      const recruiterMetrics = metrics[0] || {
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

      res.json({
        success: true,
        metrics: recruiterMetrics,
        message: 'Recruiter metrics retrieved successfully'
      });

    } catch (error) {
      console.error('Get recruiter metrics error:', error);
      res.status(500).json({
        message: 'Failed to retrieve recruiter metrics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Export submissions to CSV
   */
  async exportSubmissions(req, res) {
    try {
      const { requirementId, status, recruiterId, format = 'csv' } = req.query;

      let query = {};
      if (requirementId) query.requirementId = requirementId;
      if (status) query.currentStatus = status;
      if (recruiterId) query.recruiterId = recruiterId;

      const submissions = await Submission.find(query)
        .populate('requirementId', 'title clientName')
        .populate('recruiterId', 'firstName lastName email')
        .populate('aiMatchScore', 'overallScore')
        .sort({ createdAt: -1 });

      if (format === 'csv') {
        const csvData = submissions.map(sub => ({
          'Submission ID': sub._id,
          'Candidate Name': sub.candidateName,
          'Candidate Email': sub.candidateEmail,
          'Candidate Phone': sub.candidatePhone || '',
          'Requirement': sub.requirementId?.title || '',
          'Client': sub.requirementId?.clientName || '',
          'Recruiter': `${sub.recruiterId?.firstName} ${sub.recruiterId?.lastName}`,
          'Recruiter Email': sub.recruiterId?.email || '',
          'Status': sub.currentStatus,
          'AI Match Score': sub.aiMatchScore?.overallScore || '',
          'Trust Points': sub.trustPointsEarned,
          'LinkedIn URL': sub.linkedinUrl || '',
          'Notes': sub.notes || '',
          'Submitted Date': sub.createdAt?.toISOString() || '',
          'Last Updated': sub.updatedAt?.toISOString() || ''
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
        res.setHeader('Content-Disposition', 'attachment; filename=submissions.csv');
        res.send(csvContent);
      } else {
        res.json({
          success: true,
          submissions,
          count: submissions.length,
          message: 'Submissions exported successfully'
        });
      }

    } catch (error) {
      console.error('Export submissions error:', error);
      res.status(500).json({
        message: 'Failed to export submissions',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get submission timeline/history
   */
  async getSubmissionTimeline(req, res) {
    try {
      const { id } = req.params;

      const submission = await Submission.findById(id)
        .populate('statusHistory.updatedBy', 'firstName lastName')
        .select('statusHistory candidateName');

      if (!submission) {
        return res.status(404).json({
          message: 'Submission not found'
        });
      }

      const timeline = submission.statusHistory.map(history => ({
        status: history.status,
        timestamp: history.timestamp,
        notes: history.notes,
        updatedBy: history.updatedBy ? 
          `${history.updatedBy.firstName} ${history.updatedBy.lastName}` : 
          'System'
      }));

      res.json({
        success: true,
        candidateName: submission.candidateName,
        timeline,
        message: 'Submission timeline retrieved successfully'
      });

    } catch (error) {
      console.error('Get submission timeline error:', error);
      res.status(500).json({
        message: 'Failed to retrieve submission timeline',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = new SubmissionController();