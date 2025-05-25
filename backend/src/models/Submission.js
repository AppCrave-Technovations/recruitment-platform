const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  requirementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Requirement',
    required: true
  },
  recruiterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  candidateName: {
    type: String,
    required: true
  },
  candidateEmail: {
    type: String,
    required: true
  },
  candidatePhone: String,
  resumeUrl: String,
  linkedinUrl: String,
  currentStatus: {
    type: String,
    enum: ['submitted', 'screening', 'interview', 'final', 'selected', 'rejected'],
    default: 'submitted'
  },
  statusHistory: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    notes: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  aiMatchScore: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MatchScore'
  },
  trustPointsEarned: {
    type: Number,
    default: 0
  },
  notes: String
}, {
  timestamps: true
});

module.exports = mongoose.model('Submission', submissionSchema);