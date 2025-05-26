import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

function RequirementManagement({ requirements = [], onUpdate }) {
  const { user } = useAuth();
  const [localRequirements, setLocalRequirements] = useState(requirements);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLocalRequirements(requirements);
  }, [requirements]);

  const filteredRequirements = localRequirements.filter(req => {
    const matchesSearch = req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         req.skills?.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || req.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const handleCreateRequirement = () => {
    setSelectedRequirement(null);
    setShowCreateForm(true);
  };

  const handleEditRequirement = (requirement) => {
    setSelectedRequirement(requirement);
    setShowEditForm(true);
  };

  const handleDeleteRequirement = async (requirementId) => {
    if (!window.confirm('Are you sure you want to delete this requirement?')) {
      return;
    }

    try {
      await api.delete(`/requirements/${requirementId}`);
      setLocalRequirements(prev => prev.filter(req => req._id !== requirementId));
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to delete requirement:', error);
      alert('Failed to delete requirement');
    }
  };

  const handleStatusChange = async (requirementId, newStatus) => {
    try {
      await api.put(`/requirements/${requirementId}/status`, { status: newStatus });
      setLocalRequirements(prev => 
        prev.map(req => 
          req._id === requirementId ? { ...req, status: newStatus } : req
        )
      );
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Failed to update requirement status');
    }
  };

  const handleFormSuccess = () => {
    setShowCreateForm(false);
    setShowEditForm(false);
    setSelectedRequirement(null);
    if (onUpdate) onUpdate();
  };

  return (
    <div className="requirement-management space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-900">Requirement Management</h2>
        <button
          onClick={handleCreateRequirement}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Create New Requirement
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search requirements..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="closed">Closed</option>
              <option value="filled">Filled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Priority</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setPriorityFilter('all');
              }}
              className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Requirements List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Title</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Priority</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Status</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Deadline</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Submissions</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Recruiters</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRequirements.map(requirement => (
                <RequirementRow
                  key={requirement._id}
                  requirement={requirement}
                  onEdit={handleEditRequirement}
                  onDelete={handleDeleteRequirement}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredRequirements.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No requirements found matching your criteria.</p>
          </div>
        )}
      </div>

      {/* Create/Edit Forms */}
      {showCreateForm && (
        <RequirementForm
          onClose={() => setShowCreateForm(false)}
          onSuccess={handleFormSuccess}
        />
      )}

      {showEditForm && selectedRequirement && (
        <RequirementForm
          requirement={selectedRequirement}
          onClose={() => setShowEditForm(false)}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  );
}

function RequirementRow({ requirement, onEdit, onDelete, onStatusChange }) {
  const [showDetails, setShowDetails] = useState(false);

  const getPriorityColor = (priority) => {
    const colors = {
      urgent: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800'
    };
    return colors[priority] || colors.medium;
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
      closed: 'bg-gray-100 text-gray-800',
      filled: 'bg-blue-100 text-blue-800'
    };
    return colors[status] || colors.active;
  };

  const getTimeRemaining = (deadline) => {
    const now = new Date();
    const end = new Date(deadline);
    const diff = end - now;
    
    if (diff <= 0) return { text: 'Expired', color: 'text-red-600' };
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 7) return { text: `${days} days`, color: 'text-green-600' };
    if (days > 3) return { text: `${days} days`, color: 'text-yellow-600' };
    return { text: `${days} days`, color: 'text-red-600' };
  };

  const timeRemaining = getTimeRemaining(requirement.deadline);

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="py-4 px-6">
          <div>
            <div className="font-medium text-gray-900">{requirement.title}</div>
            <div className="text-sm text-gray-500">
              {requirement.description?.substring(0, 100)}...
            </div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-blue-600 hover:text-blue-800 mt-1"
            >
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
          </div>
        </td>
        <td className="py-4 px-6">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(requirement.priority)}`}>
            {requirement.priority?.toUpperCase()}
          </span>
        </td>
        <td className="py-4 px-6">
          <select
            value={requirement.status}
            onChange={(e) => onStatusChange(requirement._id, e.target.value)}
            className={`text-xs font-medium px-2.5 py-0.5 rounded-full border-0 ${getStatusColor(requirement.status)}`}
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="closed">Closed</option>
            <option value="filled">Filled</option>
          </select>
        </td>
        <td className="py-4 px-6">
          <div>
            <div className="text-sm text-gray-900">
              {new Date(requirement.deadline).toLocaleDateString()}
            </div>
            <div className={`text-xs ${timeRemaining.color}`}>
              {timeRemaining.text}
            </div>
          </div>
        </td>
        <td className="py-4 px-6">
          <div className="text-sm text-gray-900">
            {requirement.totalSubmissions || 0} submissions
          </div>
          <div className="text-xs text-gray-500">
            {requirement.maxSubmissions ? `Max: ${requirement.maxSubmissions}` : 'No limit'}
          </div>
        </td>
        <td className="py-4 px-6">
          <div className="text-sm text-gray-900">
            {requirement.assignedRecruiters?.length || 0} assigned
          </div>
          <button className="text-xs text-blue-600 hover:text-blue-800">
            Manage
          </button>
        </td>
        <td className="py-4 px-6">
          <div className="flex space-x-2">
            <button
              onClick={() => onEdit(requirement)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(requirement._id)}
              className="text-red-600 hover:text-red-800 text-sm"
            >
              Delete
            </button>
          </div>
        </td>
      </tr>
      {showDetails && (
        <tr>
          <td colSpan="7" className="px-6 py-4 bg-gray-50">
            <RequirementDetails requirement={requirement} />
          </td>
        </tr>
      )}
    </>
  );
}

function RequirementDetails({ requirement }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Description</h4>
          <p className="text-sm text-gray-700">{requirement.description}</p>
        </div>
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Requirements</h4>
          <div className="space-y-2 text-sm text-gray-700">
            <div>
              <span className="font-medium">Experience:</span> {requirement.experience?.min || 0}-{requirement.experience?.max || 10} years
            </div>
            <div>
              <span className="font-medium">Location:</span> {requirement.location || 'Not specified'}
            </div>
            {requirement.salary && (
              <div>
                <span className="font-medium">Salary:</span> {requirement.salary.currency} {requirement.salary.min?.toLocaleString()}-{requirement.salary.max?.toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {requirement.skills && requirement.skills.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Required Skills</h4>
          <div className="flex flex-wrap gap-2">
            {requirement.skills.map((skill, index) => (
              <span
                key={index}
                className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RequirementForm({ requirement, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    title: requirement?.title || '',
    description: requirement?.description || '',
    clientName: requirement?.clientName || '',
    skills: requirement?.skills || [],
    experience: {
      min: requirement?.experience?.min || 0,
      max: requirement?.experience?.max || 10
    },
    location: requirement?.location || '',
    salary: {
      min: requirement?.salary?.min || '',
      max: requirement?.salary?.max || '',
      currency: requirement?.salary?.currency || 'USD'
    },
    deadline: requirement?.deadline ? new Date(requirement.deadline).toISOString().split('T')[0] : '',
    maxSubmissions: requirement?.maxSubmissions || 50,
    priority: requirement?.priority || 'medium'
  });
  
  const [skillInput, setSkillInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleAddSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, skillInput.trim()]
      }));
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (skillToRemove) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        deadline: new Date(formData.deadline).toISOString(),
        salary: {
          ...formData.salary,
          min: parseFloat(formData.salary.min) || 0,
          max: parseFloat(formData.salary.max) || 0
        }
      };

      if (requirement) {
        // Update existing requirement
        await api.put(`/requirements/${requirement._id}`, submitData);
      } else {
        // Create new requirement
        await api.post('/requirements', submitData);
      }

      onSuccess();
    } catch (error) {
      console.error('Failed to save requirement:', error);
      alert('Failed to save requirement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {requirement ? 'Edit Requirement' : 'Create New Requirement'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Job Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client Name *
                </label>
                <input
                  type="text"
                  name="clientName"
                  value={formData.clientName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                required
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Skills */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Required Skills
              </label>
              <div className="flex mb-2">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  placeholder="Enter a skill"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                />
                <button
                  type="button"
                  onClick={handleAddSkill}
                  className="px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.skills.map((skill, index) => (
                  <span
                    key={index}
                    className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Experience and Location */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min Experience (years)
                </label>
                <input
                  type="number"
                  name="experience.min"
                  value={formData.experience.min}
                  onChange={handleInputChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Experience (years)
                </label>
                <input
                  type="number"
                  name="experience.max"
                  value={formData.experience.max}
                  onChange={handleInputChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Salary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min Salary
                </label>
                <input
                  type="number"
                  name="salary.min"
                  value={formData.salary.min}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Salary
                </label>
                <input
                  type="number"
                  name="salary.max"
                  value={formData.salary.max}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency
                </label>
                <select
                  name="salary.currency"
                  value={formData.salary.currency}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="INR">INR</option>
                  <option value="CAD">CAD</option>
                  <option value="AUD">AUD</option>
                </select>
              </div>
            </div>

            {/* Deadline, Max Submissions, Priority */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deadline *
                </label>
                <input
                  type="date"
                  name="deadline"
                  value={formData.deadline}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Submissions
                </label>
                <input
                  type="number"
                  name="maxSubmissions"
                  value={formData.maxSubmissions}
                  onChange={handleInputChange}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            {/* Form Actions */}
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
                {loading ? 'Saving...' : (requirement ? 'Update Requirement' : 'Create Requirement')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default RequirementManagement;