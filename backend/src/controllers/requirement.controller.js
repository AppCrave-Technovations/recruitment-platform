const Requirement = require('../models/Requirement');
const Submission = require('../models/Submission');

class RequirementController {
  async createRequirement(req, res) {
    try {
      const {
        title,
        description,
        clientName,
        skills,
        experience,
        location,
        salary,
        deadline,
        maxSubmissions,
        priority
      } = req.body;

      // Generate masked client name
      const maskedClientName = this.maskClientName(clientName);

      const requirement = new Requirement({
        title,
        description,
        clientId: req.user.clientId || req.user._id,
        clientName,
        maskedClientName,
        skills,
        experience,
        location,
        salary,
        deadline,
        maxSubmissions,
        priority
      });

      await requirement.save();

      res.status(201).json({
        message: 'Requirement created successfully',
        requirement
      });
    } catch (error) {
      res.status(500).json({
        message: 'Failed to create requirement',
        error: error.message
      });
    }
  }

  async getRequirements(req, res) {
    try {
      let query = {};
      
      // Role-based filtering
      if (req.user.role === 'client_admin') {
        query.clientId = req.user.clientId || req.user._id;
      }

      const requirements = await Requirement.find(query)
        .populate('assignedRecruiters', 'firstName lastName email')
        .sort({ createdAt: -1 });

      // For recruiters, mask client names and add submission counts
      if (req.user.role === 'recruiter') {
        const enrichedRequirements = await Promise.all(
          requirements.map(async (req) => {
            const submissionCount = await Submission.countDocuments({
              requirementId: req._id,
              recruiterId: req.user._id
            });

            const totalSubmissions = await Submission.countDocuments({
              requirementId: req._id
            });

            return {
              ...req.toObject(),
              clientName: req.maskedClientName,
              mySubmissions: submissionCount,
              totalSubmissions,
              activeRecruiters: req.assignedRecruiters.length
            };
          })
        );

        return res.json({ requirements: enrichedRequirements });
      }

      res.json({ requirements });
    } catch (error) {
      res.status(500).json({
        message: 'Failed to get requirements',
        error: error.message
      });
    }
  }

  async assignRecruiter(req, res) {
    try {
      const { requirementId, recruiterId } = req.body;

      const requirement = await Requirement.findById(requirementId);
      if (!requirement) {
        return res.status(404).json({ message: 'Requirement not found' });
      }

      if (!requirement.assignedRecruiters.includes(recruiterId)) {
        requirement.assignedRecruiters.push(recruiterId);
        await requirement.save();
      }

      res.json({
        message: 'Recruiter assigned successfully',
        requirement
      });
    } catch (error) {
      res.status(500).json({
        message: 'Failed to assign recruiter',
        error: error.message
      });
    }
  }

  maskClientName(clientName) {
    const words = clientName.split(' ');
    return words.map(word => {
      if (word.length <= 2) return word;
      return word.charAt(0) + '*'.repeat(word.length - 2) + word.charAt(word.length - 1);
    }).join(' ');
  }
}

module.exports = new RequirementController();