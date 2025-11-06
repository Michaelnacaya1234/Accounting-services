import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

// items prop controls order and visibility of menu entries
// Example: items={["approve", "reject"]}
export default function ActionsMenu({ onView, onApprove, onReject, onArchive, items }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const portalMenuRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    function handleClickOutside(event) {
      const clickedInsideTrigger = triggerRef.current && triggerRef.current.contains(event.target);
      const clickedInsidePortalMenu = portalMenuRef.current && portalMenuRef.current.contains(event.target);
      const clickedInsideContainer = menuRef.current && menuRef.current.contains(event.target);
      if (!clickedInsideTrigger && !clickedInsidePortalMenu && !clickedInsideContainer) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Compute and update portal dropdown position
  const calculatePosition = () => {
    if (!triggerRef.current) return;
    const gap = 8; // 8px spacing
    const estimatedWidth = 176; // w-44 = 11rem ~ 176px
    const rect = triggerRef.current.getBoundingClientRect();

    let top = rect.bottom + gap;
    let left = Math.max(8, rect.right - estimatedWidth);

    setPosition({ top, left });

    // Measure and adjust to keep within viewport
    setTimeout(() => {
      const el = portalMenuRef.current;
      if (!el) return;
      const m = el.getBoundingClientRect();
      let newTop = top;
      let newLeft = left;

      if (m.bottom > window.innerHeight - 8) {
        newTop = Math.max(8, rect.top - m.height - gap);
      }
      if (m.right > window.innerWidth - 8) {
        newLeft = Math.max(8, window.innerWidth - m.width - 8);
      }
      if (newTop !== top || newLeft !== left) {
        setPosition({ top: newTop, left: newLeft });
      }
    }, 0);
  };

  useEffect(() => {
    if (!isOpen) return;
    calculatePosition();
    const onResize = () => calculatePosition();
    const onScroll = () => calculatePosition();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [isOpen]);

  const handleAction = (action) => {
    setIsOpen(false);
    if (action === 'view' && onView) onView();
    if (action === 'approve' && onApprove) onApprove();
    if (action === 'reject' && onReject) onReject();
    if (action === 'archive' && onArchive) onArchive();
  };

  const defaultOrder = ['view', 'approve', 'reject', 'archive'];
  const providedOrder = Array.isArray(items) && items.length ? items : defaultOrder;
  const order = providedOrder.includes('view') ? providedOrder : ['view', ...providedOrder];

  const menuItems = {
    view: (
      <button
        key="view"
        type="button"
          role="menuitem"
        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
        onClick={() => handleAction('view')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        View
      </button>
    ),
    approve: (
      <button
        key="approve"
        type="button"
        role="menuitem"
        className="w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-green-50 flex items-center gap-2"
        onClick={() => handleAction('approve')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Approve
      </button>
    ),
    reject: (
      <button
        key="reject"
        type="button"
        role="menuitem"
        className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
        onClick={() => handleAction('reject')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Reject
      </button>
    ),
    archive: (
      <button
        key="archive"
        type="button"
        role="menuitem"
        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
        onClick={() => handleAction('archive')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
        Archive
      </button>
    ),
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        aria-label="Row actions"
        ref={triggerRef}
        className="p-1.5 rounded-full text-slate-600 hover:bg-slate-100 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span aria-hidden="true" className="text-base leading-none select-none">•••</span>
      </button>

      {isOpen && createPortal(
        <div
          ref={portalMenuRef}
          role="menu"
          className="fixed z-[1000] w-44 rounded-lg border border-slate-200 bg-white shadow-lg py-1"
          style={{ top: position.top, left: position.left }}
        >
          {order
            .filter((key) => key in menuItems)
            .map((key) => menuItems[key])}
        </div>,
        document.body
      )}
    </div>
  );
}
