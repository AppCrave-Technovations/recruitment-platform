import React from 'react';

function TrustPointsTracker({ currentPoints, submissions }) {
  const pointsForNextLevel = [100, 250, 500, 1000, 2000, 5000];
  
  const getCurrentLevel = () => {
    for (let i = 0; i < pointsForNextLevel.length; i++) {
      if (currentPoints < pointsForNextLevel[i]) {
        return {
          level: i + 1,
          current: currentPoints,
          required: pointsForNextLevel[i],
          previous: i > 0 ? pointsForNextLevel[i - 1] : 0
        };
      }
    }
    return {
      level: pointsForNextLevel.length + 1,
      current: currentPoints,
      required: currentPoints,
      previous: pointsForNextLevel[pointsForNextLevel.length - 1]
    };
  };

  const levelInfo = getCurrentLevel();
  const progress = levelInfo.level > pointsForNextLevel.length 
    ? 100 
    : ((currentPoints - levelInfo.previous) / (levelInfo.required - levelInfo.previous)) * 100;

  const getBadgeLevel = () => {
    if (currentPoints >= 5000) return { name: 'Diamond Elite', color: 'bg-blue-600', icon: '💎' };
    if (currentPoints >= 2000) return { name: 'Platinum Pro', color: 'bg-purple-600', icon: '🏆' };
    if (currentPoints >= 1000) return { name: 'Gold Expert', color: 'bg-yellow-500', icon: '🥇' };
    if (currentPoints >= 500) return { name: 'Silver Star', color: 'bg-gray-400', icon: '⭐' };
    if (currentPoints >= 250) return { name: 'Bronze Achiever', color: 'bg-orange-600', icon: '🏅' };
    if (currentPoints >= 100) return { name: 'Rising Talent', color: 'bg-green-500', icon: '🌟' };
    return { name: 'Newcomer', color: 'bg-gray-500', icon: '🌱' };
  };

  const badge = getBadgeLevel();

  const getRecentEarnings = () => {
    const recent = submissions
      .filter(sub => sub.trustPointsEarned > 0)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 5);
    
    return recent;
  };

  const recentEarnings = getRecentEarnings();

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Trust Points & Rewards</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Status */}
        <div>
          <div className="flex items-center mb-4">
            <div className={`${badge.color} rounded-full w-12 h-12 flex items-center justify-center mr-4`}>
              <span className="text-xl">{badge.icon}</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{badge.name}</h3>
              <p className="text-gray-600">{currentPoints} Trust Points</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Level {levelInfo.level}</span>
              <span>
                {levelInfo.level <= pointsForNextLevel.length 
                  ? `${levelInfo.required - currentPoints} points to next level`
                  : 'Max level reached!'
                }
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className={`${badge.color} h-3 rounded-full transition-all duration-300`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Point Breakdown */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Submissions:</span>
              <span className="font-medium">+{submissions.length * 5} pts</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Interviews:</span>
              <span className="font-medium">
                +{submissions.filter(s => ['interview', 'final', 'selected'].includes(s.currentStatus)).length * 15} pts
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Placements:</span>
              <span className="font-medium text-green-600">
                +{submissions.filter(s => s.currentStatus === 'selected').length * 100} pts
              </span>
            </div>
          </div>
        </div>

        {/* Recent Activity & Rewards */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Recent Earnings</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {recentEarnings.length > 0 ? (
              recentEarnings.map(submission => (
                <div key={submission._id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{submission.candidateName}</p>
                    <p className="text-xs text-gray-600">Status: {submission.currentStatus}</p>
                  </div>
                  <span className="text-green-600 font-medium">+{submission.trustPointsEarned}</span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No recent earnings</p>
            )}
          </div>

          {/* Upcoming Rewards */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <h5 className="font-medium text-blue-900 mb-2">🎁 Upcoming Rewards</h5>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• 100 pts: Premium badge unlock</li>
              <li>• 250 pts: Priority requirement access</li>
              <li>• 500 pts: Bonus payout eligibility</li>
              <li>• 1000 pts: VIP recruiter status</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TrustPointsTracker;