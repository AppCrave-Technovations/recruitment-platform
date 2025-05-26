import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

const ResourceTracking = ({ submissions }) => {
 const [selectedStatus, setSelectedStatus] = useState('all');
 const [sortBy, setSortBy] = useState('date');

 const statusOptions = [
   { value: 'all', label: 'All Submissions', count: submissions.length },
   { value: 'submitted', label: 'Submitted', count: submissions.filter(s => s.currentStatus === 'submitted').length },
   { value: 'screening', label: 'Screening', count: submissions.filter(s => s.currentStatus === 'screening').length },
   { value: 'interview', label: 'Interview', count: submissions.filter(s => s.currentStatus === 'interview').length },
   { value: 'final', label: 'Final Round', count: submissions.filter(s => s.currentStatus === 'final').length },
   { value: 'selected', label: 'Selected', count: submissions.filter(s => s.currentStatus === 'selected').length },
   { value: 'rejected', label: 'Rejected', count: submissions.filter(s => s.currentStatus === 'rejected').length }
 ];

 const getStatusColor = (status) => {
   const colors = {
     submitted: 'bg-blue-100 text-blue-800',
     screening: 'bg-yellow-100 text-yellow-800',
     interview: 'bg-purple-100 text-purple-800',
     final: 'bg-orange-100 text-orange-800',
     selected: 'bg-green-100 text-green-800',
     rejected: 'bg-red-100 text-red-800'
   };
   return colors[status] || 'bg-gray-100 text-gray-800';
 };

 const getProgressPercentage = (status) => {
   const progressMap = {
     submitted: 16.67,
     screening: 33.33,
     interview: 50,
     final: 66.67,
     selected: 100,
     rejected: 0
   };
   return progressMap[status] || 0;
 };

 const filteredSubmissions = submissions.filter(submission => 
   selectedStatus === 'all' || submission.currentStatus === selectedStatus
 );

 const sortedSubmissions = [...filteredSubmissions].sort((a, b) => {
   switch (sortBy) {
     case 'date':
       return new Date(b.createdAt) - new Date(a.createdAt);
     case 'status':
       return a.currentStatus.localeCompare(b.currentStatus);
     case 'candidate':
       return a.candidateName.localeCompare(b.candidateName);
     case 'score':
       return (b.aiMatchScore?.overallScore || 0) - (a.aiMatchScore?.overallScore || 0);
     default:
       return 0;
   }
 });

 const getMatchScoreColor = (score) => {
   if (score >= 80) return 'text-green-600';
   if (score >= 60) return 'text-yellow-600';
   return 'text-red-600';
 };

 return (
   <div className="space-y-6">
     {/* Status Filter Tabs */}
     <div className="border-b border-gray-200">
       <nav className="-mb-px flex space-x-8 overflow-x-auto">
         {statusOptions.map((option) => (
           <button
             key={option.value}
             onClick={() => setSelectedStatus(option.value)}
             className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
               selectedStatus === option.value
                 ? 'border-blue-500 text-blue-600'
                 : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
             }`}
           >
             {option.label}
             <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs">
               {option.count}
             </span>
           </button>
         ))}
       </nav>
     </div>

     {/* Controls */}
     <div className="flex justify-between items-center">
       <div className="flex items-center space-x-4">
         <div className="flex items-center space-x-2">
           <label className="text-sm font-medium text-gray-700">Sort by:</label>
           <select
             value={sortBy}
             onChange={(e) => setSortBy(e.target.value)}
             className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
           >
             <option value="date">Date Submitted</option>
             <option value="status">Status</option>
             <option value="candidate">Candidate Name</option>
             <option value="score">Match Score</option>
           </select>
         </div>
       </div>
       
       <div className="text-sm text-gray-500">
         Showing {filteredSubmissions.length} of {submissions.length} submissions
       </div>
     </div>

     {/* Submissions List */}
     <div className="space-y-4">
       {sortedSubmissions.length === 0 ? (
         <div className="text-center py-8 text-gray-500">
           <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
           </svg>
           <p className="mt-2">No submissions found</p>
         </div>
       ) : (
         sortedSubmissions.map((submission) => (
           <div key={submission._id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
             <div className="flex items-start justify-between mb-4">
               <div className="flex-1">
                 <div className="flex items-center space-x-3 mb-2">
                   <h3 className="text-lg font-semibold text-gray-900">
                     {submission.candidateName}
                   </h3>
                   <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(submission.currentStatus)}`}>
                     {submission.currentStatus.replace('_', ' ').toUpperCase()}
                   </span>
                 </div>
                 
                 <div className="text-sm text-gray-600 space-y-1">
                   <p>📧 {submission.candidateEmail}</p>
                   {submission.candidatePhone && (
                     <p>📞 {submission.candidatePhone}</p>
                   )}
                   <p>📋 {submission.requirementId?.title || 'Unknown Requirement'}</p>
                   <p>🏢 {submission.requirementId?.maskedClientName || 'Unknown Client'}</p>
                 </div>
               </div>

               <div className="text-right space-y-2">
                 {submission.aiMatchScore && (
                   <div className="text-sm">
                     <span className="text-gray-500">AI Match: </span>
                     <span className={`font-semibold ${getMatchScoreColor(submission.aiMatchScore.overallScore)}`}>
                       {submission.aiMatchScore.overallScore}%
                     </span>
                   </div>
                 )}
                 
                 <div className="text-sm text-gray-500">
                   Submitted {formatDistanceToNow(new Date(submission.createdAt), { addSuffix: true })}
                 </div>
                 
                 {submission.trustPointsEarned > 0 && (
                   <div className="text-sm">
                     <span className="text-green-600 font-medium">
                       +{submission.trustPointsEarned} Trust Points
                     </span>
                   </div>
                 )}
               </div>
             </div>

             {/* Progress Bar */}
             <div className="mb-4">
               <div className="flex justify-between text-xs text-gray-600 mb-1">
                 <span>Progress</span>
                 <span>{Math.round(getProgressPercentage(submission.currentStatus))}%</span>
               </div>
               <div className="w-full bg-gray-200 rounded-full h-2">
                 <div
                   className={`h-2 rounded-full transition-all duration-300 ${
                     submission.currentStatus === 'rejected' 
                       ? 'bg-red-500' 
                       : submission.currentStatus === 'selected'
                       ? 'bg-green-500'
                       : 'bg-blue-500'
                   }`}
                   style={{ width: `${getProgressPercentage(submission.currentStatus)}%` }}
                 ></div>
               </div>
             </div>

             {/* Status History */}
             {submission.statusHistory && submission.statusHistory.length > 1 && (
               <div className="border-t pt-4">
                 <h4 className="text-sm font-medium text-gray-900 mb-2">Status History</h4>
                 <div className="space-y-2">
                   {submission.statusHistory
                     .slice()
                     .reverse()
                     .slice(0, 3)
                     .map((history, index) => (
                       <div key={index} className="flex items-center justify-between text-xs text-gray-600">
                         <div className="flex items-center space-x-2">
                           <span className={`w-2 h-2 rounded-full ${getStatusColor(history.status).replace('text-', 'bg-').replace('-800', '-500')}`}></span>
                           <span className="capitalize">{history.status.replace('_', ' ')}</span>
                           {history.notes && (
                             <span className="text-gray-500">- {history.notes}</span>
                           )}
                         </div>
                         <span>{formatDistanceToNow(new Date(history.timestamp), { addSuffix: true })}</span>
                       </div>
                     ))}
                 </div>
               </div>
             )}

             {/* Actions */}
             <div className="flex items-center justify-between pt-4 border-t">
               <div className="flex items-center space-x-4">
                 {submission.resumeUrl && (
                   
                     href={submission.resumeUrl}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                   >
                     📄 View Resume
                   </a>
                 )}
                 {submission.linkedinUrl && (
                   
                     href={submission.linkedinUrl}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                   >
                     💼 LinkedIn Profile
                   </a>
                 )}
               </div>

               {submission.notes && (
                 <div className="text-sm text-gray-500 italic max-w-xs truncate">
                   "{submission.notes}"
                 </div>
               )}
             </div>
           </div>
         ))
       )}
     </div>

     {/* Summary Stats */}
     {submissions.length > 0 && (
       <div className="bg-gray-50 rounded-lg p-4">
         <h4 className="text-sm font-medium text-gray-900 mb-3">Submission Summary</h4>
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           <div className="text-center">
             <div className="text-2xl font-bold text-blue-600">
               {submissions.length}
             </div>
             <div className="text-xs text-gray-600">Total Submissions</div>
           </div>
           <div className="text-center">
             <div className="text-2xl font-bold text-green-600">
               {submissions.filter(s => s.currentStatus === 'selected').length}
             </div>
             <div className="text-xs text-gray-600">Selected</div>
           </div>
           <div className="text-center">
             <div className="text-2xl font-bold text-purple-600">
               {submissions.filter(s => ['interview', 'final'].includes(s.currentStatus)).length}
             </div>
             <div className="text-xs text-gray-600">In Process</div>
           </div>
           <div className="text-center">
             <div className="text-2xl font-bold text-yellow-600">
               {submissions.reduce((sum, s) => sum + (s.trustPointsEarned || 0), 0)}
             </div>
             <div className="text-xs text-gray-600">Points Earned</div>
           </div>
         </div>
       </div>
     )}
   </div>
 );
};

export default ResourceTracking;