import React, { useEffect, useState } from 'react';
import Sidebar from '../components/sidebar';


function Topbar({ user, onSignOut }) {
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef(null);

  React.useEffect(() => {
    function onDocClick(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const userInitial = user?.username?.charAt(0).toUpperCase() || 'C';
  const displayName = user?.username || 'client';
  const displayEmail = user?.email || displayName;

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-3 md:px-4">
      <div className="font-medium text-slate-700">&nbsp;</div>
      <div className="flex items-center gap-4">
        <button type="button" className="relative rounded-full p-2 ring-1 ring-yellow-400/60 text-yellow-600 hover:bg-yellow-50">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a6 6 0 00-6 6v2.586l-.707.707A1 1 0 004 13h12a1 1 0 00.707-1.707L16 10.586V8a6 6 0 00-6-6z" /><path d="M7 16a3 3 0 006 0H7z" /></svg>
        </button>
        <div className="relative" ref={menuRef}>
          <button type="button" className="flex items-center gap-3" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu">
            <div className="h-8 w-8 rounded-full bg-blue-600 text-white grid place-items-center font-semibold">{userInitial}</div>
            <div className="hidden sm:block leading-tight text-left">
              <div className="text-slate-800 font-medium text-sm">{displayName}</div>
              <div className="text-slate-500 text-xs">{displayEmail}</div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          </button>

          {open && (
            <div role="menu" className="absolute right-0 mt-2 w-44 rounded-lg border border-slate-200 bg-white shadow-lg py-1 z-10">
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => { setOpen(false); window.location.hash = '#/client'; }}
                role="menuitem"
              >
                Dashboard
              </button>
              <div className="my-1 h-px bg-slate-200" />
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                onClick={() => { setOpen(false); onSignOut && onSignOut(); }}
                role="menuitem"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1" /></svg>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function WelcomeCard({ username, now }) {
  return (
    <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 text-white p-4 md:p-5 shadow-card">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-white/20 grid place-items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A13.937 13.937 0 0112 15c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </div>
        <div>
          <h2 className="text-lg md:text-xl font-semibold">Welcome, {username}</h2>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-white/90">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 8a1 1 0 10-2 0 1 1 0 002 0zm-1-6a6 6 0 00-6 6 6 6 0 0011.184 2.468l.745.667A7 7 0 1110 4z" /></svg>
            <span>{now.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClientDashboard({ user, onSignOut }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const username = user?.username || 'client';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar activeRoute="dashboard" />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={user} onSignOut={onSignOut} />
        <main className="p-3 md:p-4">
          <WelcomeCard username={username} now={now} />
          {/* Add client-specific widgets here */}
        </main>
      </div>
    </div>
  );
}
