import React, { useState } from 'react';
import { api } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';

function SubmissionForm({ requirements, selectedRequirement, onClose, onSuccess }) {
  const { showNotification } = useNotification();
  const [formData, setFormData] = useState({
    requirementId: selectedRequirement?._id || '',
    candidateName: '',
    candidateEmail: '',
    candidatePhone: '',
    linkedinUrl: '',
    notes: ''
  });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type === 'application/pdf' && selectedFile.size <= 10 * 1024 * 1024) {
        setFile(selectedFile);
      } else {
        showNotification('Please select a PDF file under 10MB', 'error');
      }
    }
  };

  const analyzeCandidate = async () => {
    if (!formData.requirementId || (!file && !formData.linkedinUrl)) {
      showNotification('Please select a requirement and provide resume or LinkedIn URL', 'error');
      return;
    }

    setAnalysisLoading(true);
    try {
      const analysisData = new FormData();
      analysisData.append('requirementId', formData.requirementId);
      
      if (file) {
        analysisData.append('resume', file);
      }
      
      if (formData.linkedinUrl) {
        analysisData.append('linkedinUrl', formData.linkedinUrl);
      }

      const response = await api.post('/ai/analyze-candidate', analysisData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setAiAnalysis(response.data.analysis);
      showNotification('AI analysis completed', 'success');
    } catch (error) {
      console.error('Analysis failed:', error);
      showNotification('Failed to analyze candidate', 'error');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.requirementId || !formData.candidateName || !formData.candidateEmail) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }

    if (!file && !formData.linkedinUrl) {
      showNotification('Please provide either a resume file or LinkedIn URL', 'error');
      return;
    }

    setLoading(true);
    try {
      const submitData = new FormData();
      Object.keys(formData).forEach(key => {
        submitData.append(key, formData[key]);
      });
      
      if (file) {
        submitData.append('resume', file);
      }

      const response = await api.post('/submissions', submitData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      showNotification('Candidate submitted successfully!', 'success');
      onSuccess();
    } catch (error) {
      console.error('Submission failed:', error);
      showNotification(
        error.response?.data?.message || 'Failed to submit candidate',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Submit New Candidate</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Requirement Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Requirement *
              </label>
              <select
                name="requirementId"
                value={formData.requirementId}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Choose a requirement...</option>
                {requirements.filter(req => req.status === 'active').map(req => (
                  <option key={req._id} value={req._id}>
                    {req.title} - {req.clientName}
                  </option>
                ))}
              </select>
            </div>

            {/* Candidate Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Candidate Name *
                </label>
                <input
                  type="text"
                  name="candidateName"
                  value={formData.candidateName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="candidateEmail"
                  value={formData.candidateEmail}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="candidatePhone"
                  value={formData.candidatePhone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  name="linkedinUrl"
                  value={formData.linkedinUrl}
                  onChange={handleInputChange}
                  placeholder="https://linkedin.com/in/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Resume Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Resume (PDF)
              </label>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-sm text-gray-500 mt-1">
                Upload a PDF resume or provide LinkedIn URL above
              </p>
            </div>

            {/* AI Analysis Button */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={analyzeCandidate}
                disabled={analysisLoading || (!file && !formData.linkedinUrl) || !formData.requirementId}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {analysisLoading ? 'Analyzing...' : '🤖 AI Analysis'}
              </button>
            </div>

            {/* AI Analysis Results */}
            {aiAnalysis && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">AI Match Analysis</h3>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <span className="font-medium text-gray-700">Overall Score:</span>
                    <div className="ml-2 flex items-center">
                      <div className="bg-gray-200 rounded-full h-2 w-24 mr-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${aiAnalysis.overallScore}%` }}
                        ></div>
                      </div>
                      <span className="font-bold text-blue-600">{aiAnalysis.overallScore}%</span>
                    </div>
                  </div>
                  
                  <div>
                    <span className="font-medium text-gray-700">Matched Skills:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {aiAnalysis.skillsMatch?.matchedSkills?.map(skill => (
                        <span key={skill} className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {aiAnalysis.skillsMatch?.missingSkills?.length > 0 && (
                    <div>
                      <span className="font-medium text-gray-700">Missing Skills:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {aiAnalysis.skillsMatch.missingSkills.map(skill => (
                          <span key={skill} className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <span className="font-medium text-gray-700">AI Reasoning:</span>
                    <p className="text-sm text-gray-600 mt-1">{aiAnalysis.reasoning}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Any additional information about the candidate..."
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-3 pt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Submitting...' : 'Submit Candidate'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SubmissionForm;