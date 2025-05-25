import React, { useState } from 'react';

function RequirementsList({ requirements, onSelectRequirement, selectedRequirement }) {
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRequirements = requirements.filter(req => {
    const matchesSearch = req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         req.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesFilter = filter === 'all' || req.priority === filter;
    
    return matchesSearch && matchesFilter && req.status === 'active';
  });

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    return colors[priority] || colors.medium;
  };

  const getTimeRemaining = (deadline) => {
    const now = new Date();
    const end = new Date(deadline);
    const diff = end - now;
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  return (
    <div className="requirements-list">
      {/* Search and Filter */}
      <div className="mb-6 space-y-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Search requirements..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        
        <div className="flex space-x-2">
          {['all', 'urgent', 'high', 'medium', 'low'].map(priority => (
            <button
              key={priority}
              onClick={() => setFilter(priority)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === priority
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {priority.charAt(0).toUpperCase() + priority.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Requirements Cards */}
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {filteredRequirements.map(requirement => (
          <div
            key={requirement._id}
            onClick={() => onSelectRequirement(requirement)}
            className={`requirement-card p-4 border rounded-lg cursor-pointer transition-all ${
              selectedRequirement?._id === requirement._id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-gray-900 truncate">
                {requirement.title}
              </h3>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(requirement.priority)}`}>
                {requirement.priority.toUpperCase()}
              </span>
            </div>
            
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
              {requirement.description}
            </p>
            
            <div className="flex flex-wrap gap-1 mb-3">
              {requirement.skills.slice(0, 3).map(skill => (
                <span
                  key={skill}
                  className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs"
                >
                  {skill}
                </span>
              ))}
              {requirement.skills.length > 3 && (
                <span className="text-gray-500 text-xs">
                  +{requirement.skills.length - 3} more
                </span>
              )}
            </div>
            
            <div className="flex justify-between items-center text-sm text-gray-500">
              <div className="flex items-center space-x-4">
                <span>📍 {requirement.location}</span>
                <span>👥 {requirement.activeRecruiters} recruiters</span>
                <span>📄 {requirement.mySubmissions || 0} submitted</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-orange-600 font-medium">
                  ⏰ {getTimeRemaining(requirement.deadline)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredRequirements.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No requirements found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}

export default RequirementsList;