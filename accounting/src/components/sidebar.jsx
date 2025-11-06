import React, { useState, useEffect } from 'react';

export default function Sidebar({ activeRoute }) {
  // Load user and role
  const [user, setUser] = useState(() => {
    const s = localStorage.getItem('user');
    return s ? JSON.parse(s) : null;
  });
  const isAdmin = user && Number(user.role_id) === 1;
  // Get current route from window location hash, default by role
  const initialHash = window.location.hash || (isAdmin ? '#/admin' : '#/client');
  const [currentRoute, setCurrentRoute] = useState(initialHash);
  
  useEffect(() => {
    const updateRoute = () => {
      const h = window.location.hash || (isAdmin ? '#/admin' : '#/client');
      setCurrentRoute(h);
    };
    updateRoute(); // Set initial route
    window.addEventListener('hashchange', updateRoute);
    return () => window.removeEventListener('hashchange', updateRoute);
  }, [isAdmin]);

  // Determine active state based on current route
  const route = currentRoute;
  const isDashboardActive = isAdmin
    ? (route === '#/admin' || route === '#/admin/')
    : (route === '#/client' || route === '#/client/');
  const isEmployeesActive = route === '#/admin/employees';

  return (
    <aside className="flex w-60 flex-col bg-blue-700 text-white">
      <div className="h-14 flex items-center gap-2 px-4 border-b border-white/10">
        <img src={process.env.PUBLIC_URL + '/logo192.png'} alt="Unitop" className="h-8 w-8 rounded" />
        <span className="text-sm font-semibold">Accounting</span>
      </div>
      <div className="px-4 py-3 text-white/90 text-sm font-semibold">{isAdmin ? 'Admin Dashboard' : 'Client Dashboard'}</div>
      <nav className="px-3 space-y-1">
        <a 
          href={isAdmin ? '#/admin' : '#/client'} 
          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition ${
            isDashboardActive 
              ? 'bg-blue-600/80 hover:bg-blue-600' 
              : 'hover:bg-blue-600/60'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M13 5v6h6" />
          </svg>
          <span>Dashboard</span>
        </a>
        {isAdmin && (
          <a 
            href="#/admin/employees" 
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition ${
              isEmployeesActive 
                ? 'bg-blue-600/80 hover:bg-blue-600' 
                : 'hover:bg-blue-600/60'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m0-6a4 4 0 118 0 4 4 0 01-8 0z" />
            </svg>
            <span>New Client Approval</span>
          </a>
        )}
      </nav>
    </aside>
  );
}
