const mongoose = require('mongoose');

const matchScoreSchema = new mongoose.Schema({
  submissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Submission',
    required: true
  },
  overallScore: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },
  skillsMatch: {
    score: Number,
    matchedSkills: [String],
    missingSkills: [String]
  },
  experienceMatch: {
    score: Number,
    candidateYears: Number,
    requiredYears: Number
  },
  locationMatch: {
    score: Number,
    details: String
  },
  aiReasoning: {
    type: String,
    required: true
  },
  detailedAnalysis: {
    strengths: [String],
    weaknesses: [String],
    recommendations: [String]
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('MatchScore', matchScoreSchema);