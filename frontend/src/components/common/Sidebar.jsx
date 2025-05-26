import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Sidebar = ({ isOpen, onClose }) => {
 const { user, logout } = useAuth();

 const getNavigationItems = () => {
   const baseItems = [
     {
       name: 'Dashboard',
       href: '/dashboard',
       icon: (
         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6a2 2 0 01-2 2H10a2 2 0 01-2-2V5z" />
         </svg>
       )
     }
   ];

   if (user?.role === 'system_admin') {
     return [
       ...baseItems,
       {
         name: 'User Management',
         href: '/users',
         icon: (
           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
           </svg>
         )
       },
       {
         name: 'Requirements',
         href: '/requirements',
         icon: (
           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
           </svg>
         )
       },
       {
         name: 'Analytics',
         href: '/analytics',
         icon: (
           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
           </svg>
         )
       }
     ];
   }

   if (user?.role === 'client_admin') {
     return [
       ...baseItems,
       {
         name: 'Requirements',
         href: '/requirements',
         icon: (
           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
           </svg>
         )
       },
       {
         name: 'Recruiters',
         href: '/recruiters',
         icon: (
           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
           </svg>
         )
       },
       {
         name: 'Submissions',
         href: '/submissions',
         icon: (
           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
           </svg>
         )
       }
     ];
   }

   if (user?.role === 'recruiter') {
     return [
       ...baseItems,
       {
         name: 'Requirements',
         href: '/requirements',
         icon: (
           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2z" />
           </svg>
         )
       },
       {
         name: 'My Submissions',
         href: '/my-submissions',
         icon: (
           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
           </svg>
         )
       },
       {
         name: 'Trust Points',
         href: '/trust-points',
         icon: (
           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
           </svg>
         )
       }
     ];
   }

   return baseItems;
 };

 const handleLogout = () => {
   logout();
   onClose?.();
 };

 return (
   <>
     {/* Mobile backdrop */}
     {isOpen && (
       <div
         className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
         onClick={onClose}
       />
     )}

     {/* Sidebar */}
     <div
       className={`fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
         isOpen ? 'translate-x-0' : '-translate-x-full'
       }`}
     >
       <div className="flex flex-col h-full">
         {/* Logo */}
         <div className="flex items-center h-16 px-6 bg-blue-600">
           <div className="flex items-center">
             <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center mr-3">
               <span className="text-blue-600 font-bold text-lg">R</span>
             </div>
             <span className="text-white font-semibold text-lg">RecruitPro</span>
           </div>
         </div>

         {/* User info */}
         <div className="p-6 border-b border-gray-200">
           <div className="flex items-center">
             <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
               <span className="text-gray-600 font-medium">
                 {user?.firstName?.[0]}{user?.lastName?.[0]}
               </span>
             </div>
             <div className="ml-3">
               <p className="text-sm font-medium text-gray-900">
                 {user?.firstName} {user?.lastName}
               </p>
               <p className="text-xs text-gray-500 capitalize">
                 {user?.role?.replace('_', ' ')}
               </p>
               {user?.role === 'recruiter' && (
                 <p className="text-xs text-blue-600 font-medium">
                   {user?.trustPoints || 0} Trust Points
                 </p>
               )}
             </div>
           </div>
         </div>

         {/* Navigation */}
         <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
           {getNavigationItems().map((item) => (
             <NavLink
               key={item.name}
               to={item.href}
               onClick={onClose}
               className={({ isActive }) =>
                 `flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                   isActive
                     ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-700'
                     : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                 }`
               }
             >
               {item.icon}
               <span className="ml-3">{item.name}</span>
             </NavLink>
           ))}
         </nav>

         {/* Settings and Logout */}
         <div className="p-4 border-t border-gray-200">
           <NavLink
             to="/profile"
             onClick={onClose}
             className="flex items-center px-4 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-100 hover:text-gray-900 mb-2"
           >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
             </svg>
             <span className="ml-3">Profile</span>
           </NavLink>

           <button
             onClick={handleLogout}
             className="flex items-center w-full px-4 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-100 hover:text-gray-900"
           >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
             </svg>
             <span className="ml-3">Logout</span>
           </button>
         </div>
       </div>
     </div>
   </>
 );
};

export default Sidebar;