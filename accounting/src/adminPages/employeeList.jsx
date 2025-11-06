import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import ActionsMenu from '../components/ActionsMenu';
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

  const userInitial = user?.username?.charAt(0).toUpperCase() || 'A';
  const displayName = user?.username || 'admin';
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
                onClick={() => { setOpen(false); window.location.hash = '#/admin'; }}
                role="menuitem"
              >
                Dashboard
              </button>
              <div className="my-1 h-px bg-slate-200" />
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                onClick={() => { setOpen(false); onSignOut(); }}
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

// Format submitted date/time as 'Nov 11, 2025 9:10pm'
const formatSubmitted = (input) => {
  if (!input) return '-';
  try {
    let y, m, d, hh, mm, ss;
    if (typeof input === 'number') {
      const dt = new Date(input);
      y = dt.getFullYear(); m = dt.getMonth() + 1; d = dt.getDate();
      hh = dt.getHours(); mm = dt.getMinutes(); ss = dt.getSeconds();
    } else if (input instanceof Date) {
      const dt = input;
      y = dt.getFullYear(); m = dt.getMonth() + 1; d = dt.getDate();
      hh = dt.getHours(); mm = dt.getMinutes(); ss = dt.getSeconds();
    } else {
      const s = String(input).trim();
      const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
      if (m1) {
        y = parseInt(m1[1], 10);
        m = parseInt(m1[2], 10);
        d = parseInt(m1[3], 10);
        hh = parseInt(m1[4], 10);
        mm = parseInt(m1[5], 10);
        ss = m1[6] ? parseInt(m1[6], 10) : 0;
      } else {
        const dt = new Date(s);
        if (isNaN(dt.getTime())) return s;
        y = dt.getFullYear(); m = dt.getMonth() + 1; d = dt.getDate();
        hh = dt.getHours(); mm = dt.getMinutes(); ss = dt.getSeconds();
      }
    }
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const mon = months[Math.max(0, Math.min(11, (m|0)-1))];
    const hour12 = ((hh % 12) || 12);
    const ampm = hh < 12 ? 'am' : 'pm';
    const min = String(mm).padStart(2, '0');
    return `${mon} ${d}, ${y}`;
  } catch {
    return String(input);
  }
};

export default function EmployeeList({ user, onSignOut }) {
  const [employees, setEmployees] = useState([]);
  const isAdmin = Number(user?.role_id) === 1;
  useEffect(() => { if (!isAdmin) { window.location.hash = '#/client'; } }, [isAdmin]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [viewEmployee, setViewEmployee] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role_id: 1,
    client_id: null
  });

  // Fetch employees
  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError('');
      const origin = window.location.origin;
      const base = origin.includes(':3000') ? 'http://localhost/Accounting' : origin + (window.location.pathname.includes('/Accounting/') ? '/Accounting' : '');
      const apiUrl = `${base}/accounting/api/employees.php`;
      console.log('Fetching employees from:', apiUrl);
      const res = await axios.get(apiUrl);
      if (res.data.ok) {
        const rows = res.data.employees || [];
        const sanitized = rows.filter((e) => {
          const uname = String(e.Username || e.username || '').toLowerCase();
          const name = String(e.Name || e.name || '').toLowerCase();
          return uname !== 'admin' && name !== 'admin';
        });
        setEmployees(sanitized);
      } else {
        setError(res.data.message || 'Failed to fetch employees');
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchEmployees();
  }, [isAdmin]);

  // Reset to first page when search changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'role_id' ? parseInt(value) : value
    }));
  };

  // Handle form submit (create/update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      const origin = window.location.origin;
      const base = origin.includes(':3000') ? 'http://localhost/Accounting' : origin + (window.location.pathname.includes('/Accounting/') ? '/Accounting' : '');
      const apiUrl = `${base}/accounting/api/employees.php`;
      
      if (editingEmployee) {
        // Update employee
        const res = await axios.put(apiUrl, {
          user_id: editingEmployee.User_id,
          ...formData
        });
        if (res.data.ok) {
          setShowModal(false);
          resetForm();
          fetchEmployees();
        } else {
          setError(res.data.message || 'Failed to update employee');
        }
      } else {
        // Create new employee
        const res = await axios.post(apiUrl, formData);
        if (res.data.ok) {
          setShowModal(false);
          resetForm();
          fetchEmployees();
        } else {
          setError(res.data.message || 'Failed to create employee');
        }
      }
    } catch (err) {
      console.error('Error submitting form:', err);
      setError(err.response?.data?.message || err.message || 'Operation failed');
    }
  };

  // Handle delete
  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this employee?')) {
      return;
    }
    try {
      setError('');
      const origin = window.location.origin;
      const base = origin.includes(':3000') ? 'http://localhost/Accounting' : origin + (window.location.pathname.includes('/Accounting/') ? '/Accounting' : '');
      const apiUrl = `${base}/accounting/api/employees.php`;
      const res = await axios.delete(apiUrl, {
        data: { user_id: userId }
      });
      if (res.data.ok) {
        fetchEmployees();
      } else {
        setError(res.data.message || 'Failed to delete employee');
      }
    } catch (err) {
      console.error('Error deleting employee:', err);
      setError(err.response?.data?.message || err.message || 'Failed to delete employee');
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      role_id: 1,
      client_id: null
    });
    setEditingEmployee(null);
  };

  // Open modal for editing
  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      username: employee.Username || '',
      email: employee.Email || '',
      password: '',
      role_id: employee.Role_id || 1,
      client_id: employee.Client_id || null
    });
    setShowModal(true);
  };

  // Open modal for adding
  const handleAdd = () => {
    resetForm();
    setShowModal(true);
  };

  // Actions handlers
  const handleView = (employee) => {
    setViewEmployee(employee);
  };

  const handleApprove = async (employee) => {
    const { isConfirmed } = await Swal.fire({
      title: 'Approve client?',
      text: `Are you sure you want to approve ${employee.Name || employee.Username || 'this client'}? An approval email will be sent to their email address.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Approve',
      cancelButtonText: 'Cancel'
    });
    if (!isConfirmed) {
      return;
    }
    try {
      setError('');
      const origin = window.location.origin;
      const base = origin.includes(':3000') ? 'http://localhost/Accounting' : origin + (window.location.pathname.includes('/Accounting/') ? '/Accounting' : '');
      const apiUrl = `${base}/accounting/api/approve-client.php`;
      console.log('Approving client - API URL:', apiUrl);
      console.log('Approving client - User ID:', employee.User_id);
      
      const res = await axios.post(apiUrl, {
        user_id: employee.User_id
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Approve response:', res.data);
      
      if (res.data.ok) {
        await Swal.fire({
          title: 'Approved',
          text: res.data.message || 'Client approved successfully!',
          icon: 'success'
        });
        fetchEmployees(); // Refresh the list
      } else {
        setError(res.data.message || 'Failed to approve client');
      }
    } catch (err) {
      console.error('Approve error:', err);
      console.error('Error response:', err.response);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to approve client';
      setError(errorMessage);
      await Swal.fire({
        title: 'Error',
        text: errorMessage,
        icon: 'error'
      });
    }
  };

  const handleReject = async (employee) => {
    try {
      console.log('Reject client', employee);
      // TODO: call API to update client status to rejected
    } catch (e) {
      console.error('Reject error', e);
    }
  };

  const handleArchive = async (employee) => {
    try {
      console.log('Archive client', employee);
      // TODO: call API to archive client/user
    } catch (e) {
      console.error('Archive error', e);
    }
  };

  if (!isAdmin) { return null; }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar activeRoute="employees" />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={user} onSignOut={onSignOut} />
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-3 md:px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-slate-900">New Client Approval</h1>
            <p className="mt-0.5 text-xs text-slate-600">Manage your employees and their accounts</p>
          </div>
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Employee
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-3 md:p-4">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-slate-500 text-sm">Loading employees...</div>
          </div>
        ) : employees.filter(e => String(e.Username || e.username || e.Name || e.name || '').toLowerCase() !== 'admin').length === 0 ? (
          <div className="text-center py-12">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m0-6a4 4 0 118 0 4 4 0 01-8 0z" />
            </svg>
            <p className="mt-4 text-sm text-slate-600">No employees found. Add your first employee!</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th colSpan="8" className="px-3 py-2">
                    <div className="relative max-w-xs">
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 110-15 7.5 7.5 0 010 15z" />
                        </svg>
                      </span>
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search clients..."
                        className="w-full rounded-lg border border-slate-300 pl-10 pr-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </th>
                </tr>
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">#</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Business</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Name</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Owner Name</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Email</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Submitted</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {(() => {
                  const filteredEmployees = employees
                    .filter(e => String(e.Username || e.username || e.Name || e.name || '').toLowerCase() !== 'admin')
                    .filter(e => {
                      if (!search.trim()) return true;
                      const searchTerm = search.toLowerCase();
                      return (
                        (e.Business_name || e.Business || '').toLowerCase().includes(searchTerm) ||
                        (e.Name || e.Username || '').toLowerCase().includes(searchTerm) ||
                        (e.Owner_name || e.Owner || '').toLowerCase().includes(searchTerm) ||
                        (e.Email || '').toLowerCase().includes(searchTerm) ||
                        (e.Status || '').toLowerCase().includes(searchTerm) ||
                        (e.Submitted || e.Created_at || e.CreatedAt || '').toLowerCase().includes(searchTerm)
                      );
                    });
                  
                  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));
                  const currentPage = Math.min(page, totalPages);
                  const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * pageSize, currentPage * pageSize);
                  
                  return paginatedEmployees.map((employee, idx) => (
                  <tr key={employee.User_id} className="hover:bg-slate-50">
                    <td className="px-2 py-2 text-xs text-slate-600">{(currentPage - 1) * pageSize + idx + 1}</td>
                    <td className="px-3 py-2 text-xs text-slate-900">{employee.Business_name || employee.Business || '-'}</td>
                    <td className="px-3 py-2 text-xs font-medium text-slate-900">{employee.Name || employee.Username || '-'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{employee.Owner_name || employee.Owner || '-'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{employee.Email || '-'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{employee.Status || '-'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{formatSubmitted(employee.Submitted || employee.Created_at || employee.CreatedAt)}</td>
                    <td className="px-3 py-2 text-right text-xs font-medium">
                      <ActionsMenu
                        onView={() => handleView(employee)}
                        onApprove={() => handleApprove(employee)}
                        onReject={() => handleReject(employee)}
                        onArchive={() => handleArchive(employee)}
                        items={employee.Status === 'Active' ? ['view', 'archive'] : ['view', 'approve', 'reject', 'archive']}
                      />
                    </td>
                  </tr>
                  ));
                })()}
              </tbody>
              <tfoot className="bg-white">
                <tr>
                  <td colSpan="8" className="px-3 py-2">
                    {(() => {
                      const filteredEmployees = employees
                        .filter(e => String(e.Username || e.username || e.Name || e.name || '').toLowerCase() !== 'admin')
                        .filter(e => {
                          if (!search.trim()) return true;
                          const searchTerm = search.toLowerCase();
                          return (
                            (e.Business_name || e.Business || '').toLowerCase().includes(searchTerm) ||
                            (e.Name || e.Username || '').toLowerCase().includes(searchTerm) ||
                            (e.Owner_name || e.Owner || '').toLowerCase().includes(searchTerm) ||
                            (e.Email || '').toLowerCase().includes(searchTerm) ||
                            (e.Status || '').toLowerCase().includes(searchTerm) ||
                            (e.Submitted || e.Created_at || e.CreatedAt || '').toLowerCase().includes(searchTerm)
                          );
                        });
                      
                      const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));
                      const currentPage = Math.min(page, totalPages);
                      
                      return (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-1.5 py-1 rounded border border-slate-300 text-slate-700 text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                          >
                            Prev
                          </button>
                          <div className="text-xs text-slate-600">Page {currentPage} of {totalPages}</div>
                          <button
                            type="button"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-1.5 py-1 rounded border border-slate-300 text-slate-700 text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                          >
                            Next
                          </button>
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Modal for Add/Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => { setShowModal(false); resetForm(); }} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                {editingEmployee ? 'Edit Employee' : 'Add Employee'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Password {editingEmployee && '(leave blank to keep current)'}
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required={!editingEmployee}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role ID</label>
                  <input
                    type="number"
                    name="role_id"
                    value={formData.role_id}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); resetForm(); }}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                  >
                    {editingEmployee ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal for View */}
      {viewEmployee && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setViewEmployee(null)}
            />
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-start justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Submitted Client Documents</h2>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-slate-100 text-slate-600"
                  aria-label="Close"
                  onClick={() => setViewEmployee(null)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {(() => {
                const files = [
                  viewEmployee?.Business_permit || viewEmployee?.business_permit,
                  viewEmployee?.DTI || viewEmployee?.dti,
                  viewEmployee?.SPA || viewEmployee?.spa
                ].filter(Boolean);
                
                if (!files.length) {
                  return (
                    <div className="mt-5 text-sm text-slate-600 text-center py-8">
                      No documents uploaded
                    </div>
                  );
                }
                
                const origin = window.location.origin;
                const base = origin.includes(':3000') ? 'http://localhost/Accounting' : origin + (window.location.pathname.includes('/Accounting/') ? '/Accounting' : '');
                const toUrl = (f) => {
                  const s = String(f || '');
                  if (s.startsWith('http://') || s.startsWith('https://')) return s;
                  if (s.startsWith('/')) return origin + s;
                  return `${base}/accounting/uploads/${s}`;
                };
                
                return (
                  <div className="mt-5">
                    <div className="text-sm font-medium text-slate-800 mb-3">Attachments</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {files.map((f, idx) => {
                        const url = toUrl(f);
                        const label = idx === 0 ? 'Business Permit' : idx === 1 ? 'DTI' : 'SPA';
                        return (
                          <div key={idx} className="block">
                            <div className="text-xs font-medium text-slate-700 mb-1">{label}</div>
                            <div className="w-full h-40 rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
                              <img 
                                src={url} 
                                alt={label} 
                                className="w-full h-full object-cover cursor-zoom-in hover:opacity-90 transition" 
                                onClick={() => setPreviewUrl(url)} 
                                onError={(e) => { 
                                  e.currentTarget.style.display = 'none';
                                }} 
                              />
                            </div>
                            <div className="mt-1 text-xs text-slate-500 break-all">{f}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div className="mt-6 text-right">
                <button
                  type="button"
                  onClick={() => setViewEmployee(null)}
                  className="inline-flex items-center px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center px-4" onClick={() => setPreviewUrl(null)}>
          <div className="relative max-w-5xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="absolute -top-3 -right-3 bg-white text-slate-700 rounded-full p-1 shadow hover:bg-slate-50"
              aria-label="Close preview"
              onClick={() => setPreviewUrl(null)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img src={previewUrl} alt="Preview" className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl" />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

