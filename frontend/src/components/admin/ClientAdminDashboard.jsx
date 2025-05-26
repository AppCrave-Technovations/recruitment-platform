import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import RequirementManagement from './RequirementManagement';

function ClientAdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalRequirements: 0,
    activeRequirements: 0,
    pausedRequirements: 0,
    closedRequirements: 0,
    totalSubmissions: 0,
    pendingSubmissions: 0,
    selectedCandidates: 0,
    activeRecruiters: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, activityRes, requirementsRes, submissionsRes] = await Promise.all([
        api.get('/admin/client-stats'),
        api.get('/admin/recent-activity'),
        api.get('/requirements'),
        api.get('/submissions')
      ]);

      setStats(statsRes.data || stats);
      setRecentActivity(activityRes.data?.activities || []);
      setRequirements(requirementsRes.data?.requirements || []);
      setSubmissions(submissionsRes.data?.submissions || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'requirements', label: 'Requirements', icon: '📋' },
    { id: 'submissions', label: 'Submissions', icon: '👥' },
    { id: 'recruiters', label: 'Recruiters', icon: '🎯' },
    { id: 'analytics', label: 'Analytics', icon: '📈' }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="client-admin-dashboard p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user.firstName}!
        </h1>
        <p className="text-gray-600">
          Manage your recruitment requirements and track candidate progress
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-8">
        <nav className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-4 py-2 rounded-md font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab 
          stats={stats} 
          recentActivity={recentActivity}
          onRefresh={fetchDashboardData}
        />
      )}
      
      {activeTab === 'requirements' && (
        <RequirementManagement 
          requirements={requirements}
          onUpdate={fetchDashboardData}
        />
      )}
      
      {activeTab === 'submissions' && (
        <SubmissionsTab 
          submissions={submissions}
          requirements={requirements}
          onUpdate={fetchDashboardData}
        />
      )}
      
      {activeTab === 'recruiters' && (
        <RecruitersTab onUpdate={fetchDashboardData} />
      )}
      
      {activeTab === 'analytics' && (
        <AnalyticsTab 
          stats={stats} 
          requirements={requirements}
          submissions={submissions}
        />
      )}
    </div>
  );
}

function OverviewTab({ stats, recentActivity, onRefresh }) {
  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Requirements"
          value={stats.totalRequirements}
          icon="📋"
          color="bg-blue-500"
          change="+5 this month"
        />
        <StatsCard
          title="Active Requirements"
          value={stats.activeRequirements}
          icon="✅"
          color="bg-green-500"
          change={`${stats.activeRequirements}/${stats.totalRequirements} active`}
        />
        <StatsCard
          title="Total Submissions"
          value={stats.totalSubmissions}
          icon="👥"
          color="bg-purple-500"
          change="+12 this week"
        />
        <StatsCard
          title="Selected Candidates"
          value={stats.selectedCandidates}
          icon="🎯"
          color="bg-orange-500"
          change={`${Math.round((stats.selectedCandidates / Math.max(stats.totalSubmissions, 1)) * 100)}% success rate`}
        />
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
          <button
            onClick={onRefresh}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Refresh
          </button>
        </div>
        <div className="space-y-4">
          {recentActivity.length > 0 ? (
            recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                <div className="mr-3">
                  <span className="text-2xl">{activity.icon || '📝'}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {activity.message || `Activity ${index + 1}`}
                  </p>
                  <p className="text-xs text-gray-500">
                    {activity.timestamp || new Date().toLocaleDateString()}
                  </p>
                </div>
                <div className="text-sm text-gray-500">
                  {activity.user || 'System'}
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500">No recent activity</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickActionButton
            icon="➕"
            title="New Requirement"
            description="Create new job posting"
            onClick={() => {/* Handle new requirement */}}
          />
          <QuickActionButton
            icon="👥"
            title="Assign Recruiters"
            description="Manage recruiter assignments"
            onClick={() => {/* Handle assign recruiters */}}
          />
          <QuickActionButton
            icon="📊"
            title="View Reports"
            description="Generate analytics reports"
            onClick={() => {/* Handle view reports */}}
          />
          <QuickActionButton
            icon="⚙️"
            title="Settings"
            description="Configure preferences"
            onClick={() => {/* Handle settings */}}
          />
        </div>
      </div>
    </div>
  );
}

function SubmissionsTab({ submissions, requirements, onUpdate }) {
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedRequirement, setSelectedRequirement] = useState('all');

  const filteredSubmissions = submissions.filter(submission => {
    const statusMatch = selectedStatus === 'all' || submission.currentStatus === selectedStatus;
    const requirementMatch = selectedRequirement === 'all' || submission.requirementId === selectedRequirement;
    return statusMatch && requirementMatch;
  });

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'screening', label: 'Screening' },
    { value: 'interview', label: 'Interview' },
    { value: 'final', label: 'Final' },
    { value: 'selected', label: 'Selected' },
    { value: 'rejected', label: 'Rejected' }
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Requirement</label>
            <select
              value={selectedRequirement}
              onChange={(e) => setSelectedRequirement(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">All Requirements</option>
              {requirements.map(req => (
                <option key={req._id} value={req._id}>
                  {req.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Submissions List */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Candidate Submissions ({filteredSubmissions.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Candidate</th>
                <th className="text-left py-3 px-4">Requirement</th>
                <th className="text-left py-3 px-4">Recruiter</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Submitted</th>
                <th className="text-left py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubmissions.map(submission => (
                <tr key={submission._id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div>
                      <div className="font-medium text-gray-900">
                        {submission.candidateName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {submission.candidateEmail}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm text-gray-900">
                      {submission.requirementId?.title || 'N/A'}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm text-gray-900">
                      {submission.recruiterId?.firstName} {submission.recruiterId?.lastName}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={submission.currentStatus} />
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm text-gray-500">
                      {new Date(submission.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex space-x-2">
                      <button className="text-blue-600 hover:text-blue-800 text-sm">
                        View
                      </button>
                      <button className="text-green-600 hover:text-green-800 text-sm">
                        Update
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RecruitersTab({ onUpdate }) {
  const [recruiters, setRecruiters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecruiters();
  }, []);

  const fetchRecruiters = async () => {
    try {
      const response = await api.get('/users/recruiters');
      setRecruiters(response.data?.recruiters || []);
    } catch (error) {
      console.error('Failed to fetch recruiters:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading recruiters...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Active Recruiters ({recruiters.length})
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recruiters.map(recruiter => (
          <div key={recruiter._id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                {recruiter.firstName?.charAt(0)}{recruiter.lastName?.charAt(0)}
              </div>
              <div className="ml-3">
                <div className="font-medium text-gray-900">
                  {recruiter.firstName} {recruiter.lastName}
                </div>
                <div className="text-sm text-gray-500">{recruiter.email}</div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Trust Points:</span>
                <span className="font-medium">{recruiter.trustPoints || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Submissions:</span>
                <span className="font-medium">
                  {recruiter.submissionStats?.totalSubmissions || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Success Rate:</span>
                <span className="font-medium">
                  {recruiter.submissionStats?.successRate || 0}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsTab({ stats, requirements, submissions }) {
  const getSubmissionsByStatus = () => {
    const statusCounts = {
      submitted: 0,
      screening: 0,
      interview: 0,
      final: 0,
      selected: 0,
      rejected: 0
    };

    submissions.forEach(submission => {
      if (statusCounts.hasOwnProperty(submission.currentStatus)) {
        statusCounts[submission.currentStatus]++;
      }
    });

    return Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      percentage: Math.round((count / Math.max(submissions.length, 1)) * 100)
    }));
  };

  const statusData = getSubmissionsByStatus();

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Submission Funnel */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Submission Funnel</h3>
          <div className="space-y-3">
            {statusData.map(({ status, count, percentage }) => (
              <div key={status} className="flex items-center">
                <div className="w-20 text-sm text-gray-600 capitalize">
                  {status}:
                </div>
                <div className="flex-1 mx-3">
                  <div className="bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-blue-500 h-4 rounded-full"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
                <div className="w-16 text-sm font-medium text-right">
                  {count} ({percentage}%)
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Requirements Status */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Requirements Overview</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Requirements</span>
              <span className="font-medium">{requirements.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Active</span>
              <span className="font-medium text-green-600">
                {requirements.filter(r => r.status === 'active').length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Paused</span>
              <span className="font-medium text-yellow-600">
                {requirements.filter(r => r.status === 'paused').length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Closed</span>
              <span className="font-medium text-gray-600">
                {requirements.filter(r => r.status === 'closed').length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsCard({ title, value, icon, color, change }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {change && (
            <p className="text-sm text-gray-500 mt-1">{change}</p>
          )}
        </div>
        <div className={`${color} rounded-lg p-3`}>
          <span className="text-2xl text-white">{icon}</span>
        </div>
      </div>
    </div>
  );
}

function QuickActionButton({ icon, title, description, onClick }) {
  return (
    <button
      onClick={onClick}
      className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all text-left"
    >
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-medium text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </button>
  );
}

function StatusBadge({ status }) {
  const statusConfig = {
    submitted: { color: 'bg-blue-100 text-blue-800', label: 'Submitted' },
    screening: { color: 'bg-yellow-100 text-yellow-800', label: 'Screening' },
    interview: { color: 'bg-purple-100 text-purple-800', label: 'Interview' },
    final: { color: 'bg-orange-100 text-orange-800', label: 'Final Round' },
    selected: { color: 'bg-green-100 text-green-800', label: 'Selected' },
    rejected: { color: 'bg-red-100 text-red-800', label: 'Rejected' }
  };

  const config = statusConfig[status] || statusConfig.submitted;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

export default ClientAdminDashboard;