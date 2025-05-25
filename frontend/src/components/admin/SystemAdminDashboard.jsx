import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import UserManagement from './UserManagement';
import RequirementManagement from './RequirementManagement';

function SystemAdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeRecruiters: 0,
    clientAdmins: 0,
    activeRequirements: 0,
    totalSubmissions: 0,
    successfulPlacements: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, activityRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/recent-activity')
      ]);

      setStats(statsRes.data);
      setRecentActivity(activityRes.data.activities);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'users', label: 'User Management', icon: '👥' },
    { id: 'requirements', label: 'Requirements', icon: '📋' },
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
    <div className="system-admin-dashboard p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">System Administration</h1>
        <p className="text-gray-600">Manage users, requirements, and monitor platform activity</p>
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
        <OverviewTab stats={stats} recentActivity={recentActivity} />
      )}
      
      {activeTab === 'users' && (
        <UserManagement />
      )}
      
      {activeTab === 'requirements' && (
        <RequirementManagement />
      )}
      
      {activeTab === 'analytics' && (
        <AnalyticsTab stats={stats} />
      )}
    </div>
  );
}

function OverviewTab({ stats, recentActivity }) {
  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatsCard
          title="Total Users"
          value={stats.totalUsers}
          icon="👥"
          color="bg-blue-500"
          trend="+12%"
        />
        <StatsCard
          title="Active Recruiters"
          value={stats.activeRecruiters}
          icon="🎯"
          color="bg-green-500"
          trend="+8%"
        />
        <StatsCard
          title="Client Admins"
          value={stats.clientAdmins}
          icon="🏢"
          color="bg-purple-500"
          trend="+5%"
        />
        <StatsCard
          title="Active Requirements"
          value={stats.activeRequirements}
          icon="📋"
          color="bg-orange-500"
          trend="+15%"
        />
        <StatsCard
          title="Total Submissions"
          value={stats.totalSubmissions}
          icon="📄"
          color="bg-cyan-500"
          trend="+22%"
        />
        <StatsCard
          title="Successful Placements"
          value={stats.successfulPlacements}
          icon="✅"
          color="bg-emerald-500"
          trend="+18%"
        />
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {recentActivity.length > 0 ? (
            recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                <div className="mr-3">
                  <span className="text-2xl">{activity.icon}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                  <p className="text-xs text-gray-500">{activity.timestamp}</p>
                </div>
                <div className="text-sm text-gray-500">
                  {activity.user}
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
            icon="👤"
            title="Add User"
            description="Create new user account"
            onClick={() => {/* Handle add user */}}
          />
          <QuickActionButton
            icon="📋"
            title="New Requirement"
            description="Create job requirement"
            onClick={() => {/* Handle new requirement */}}
          />
          <QuickActionButton
            icon="📊"
            title="Generate Report"
            description="Export platform analytics"
            onClick={() => {/* Handle generate report */}}
          />
          <QuickActionButton
            icon="⚙️"
            title="System Settings"
            description="Configure platform"
            onClick={() => {/* Handle settings */}}
          />
        </div>
      </div>
    </div>
  );
}

function StatsCard({ title, value, icon, color, trend }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {trend && (
            <p className="text-sm text-green-600 font-medium">{trend} from last month</p>
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

function AnalyticsTab({ stats }) {
  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Platform Analytics</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Placeholder for charts */}
          <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">User Growth Chart</p>
          </div>
          <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">Submission Success Rate</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SystemAdminDashboard;