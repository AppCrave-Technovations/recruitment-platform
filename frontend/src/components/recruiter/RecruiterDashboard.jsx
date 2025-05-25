import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import RequirementsList from './RequirementsList';
import SubmissionForm from './SubmissionForm';
import TrustPointsTracker from './TrustPointsTracker';
import ResourceTracking from './ResourceTracking';
import { api } from '../../services/api';

function RecruiterDashboard() {
  const { user } = useAuth();
  const [requirements, setRequirements] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedRequirement, setSelectedRequirement] = useState(null);
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSubmissions: 0,
    activeRequirements: 0,
    successfulPlacements: 0,
    rejectedSubmissions: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [requirementsRes, submissionsRes] = await Promise.all([
        api.get('/requirements'),
        api.get('/submissions/my-submissions')
      ]);

      setRequirements(requirementsRes.data.requirements);
      setSubmissions(submissionsRes.data.submissions);
      
      // Calculate stats
      const stats = calculateStats(requirementsRes.data.requirements, submissionsRes.data.submissions);
      setStats(stats);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (requirements, submissions) => {
    return {
      totalSubmissions: submissions.length,
      activeRequirements: requirements.filter(req => req.status === 'active').length,
      successfulPlacements: submissions.filter(sub => sub.currentStatus === 'selected').length,
      rejectedSubmissions: submissions.filter(sub => sub.currentStatus === 'rejected').length
    };
  };

  const handleSubmissionSuccess = () => {
    setShowSubmissionForm(false);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="recruiter-dashboard p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user.firstName}!
        </h1>
        <p className="text-gray-600">
          Your recruitment dashboard - track your progress and submissions
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="Active Requirements"
          value={stats.activeRequirements}
          icon="📋"
          color="bg-blue-500"
        />
        <StatsCard
          title="Total Submissions"
          value={stats.totalSubmissions}
          icon="📄"
          color="bg-green-500"
        />
        <StatsCard
          title="Successful Placements"
          value={stats.successfulPlacements}
          icon="✅"
          color="bg-purple-500"
        />
        <StatsCard
          title="Trust Points"
          value={user.trustPoints}
          icon="⭐"
          color="bg-yellow-500"
        />
      </div>

      {/* Trust Points Tracker */}
      <div className="mb-8">
        <TrustPointsTracker 
          currentPoints={user.trustPoints}
          submissions={submissions}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Requirements List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Active Requirements
            </h2>
            <button
              onClick={() => setShowSubmissionForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Submit Candidate
            </button>
          </div>
          <RequirementsList
            requirements={requirements}
            onSelectRequirement={setSelectedRequirement}
            selectedRequirement={selectedRequirement}
          />
        </div>

        {/* Resource Tracking */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Your Submissions
          </h2>
          <ResourceTracking submissions={submissions} />
        </div>
      </div>

      {/* Submission Form Modal */}
      {showSubmissionForm && (
        <SubmissionForm
          requirements={requirements}
          selectedRequirement={selectedRequirement}
          onClose={() => setShowSubmissionForm(false)}
          onSuccess={handleSubmissionSuccess}
        />
      )}
    </div>
  );
}

function StatsCard({ title, value, icon, color }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center">
        <div className={`${color} rounded-lg p-3 mr-4`}>
          <span className="text-2xl">{icon}</span>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default RecruiterDashboard;