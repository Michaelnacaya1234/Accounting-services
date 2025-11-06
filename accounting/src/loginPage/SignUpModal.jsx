import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/shadcn-ui.jsx';

export default function SignUpModal({ open, onClose }) {
  const firstInputRef = useRef(null);
  const lastActiveRef = useRef(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Manage focus and Escape key
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        onClose?.();
      }
    }

    if (open) {
      lastActiveRef.current = document.activeElement;
      const t = setTimeout(() => {
        firstInputRef.current?.focus();
      }, 120);
      window.addEventListener('keydown', onKey);
      return () => {
        clearTimeout(t);
        window.removeEventListener('keydown', onKey);
      };
    }

    // restore focus when closing
    if (!open && lastActiveRef.current && typeof lastActiveRef.current.focus === 'function') {
      lastActiveRef.current.focus();
    }
  }, [open, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const form = e.currentTarget;
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const username = form.username.value.trim();
    const password = form.password.value;
    const confirm = form.confirm.value;
    const clientIdRaw = form.client_id.value.trim();

    if (!username || !password) {
      setError('Username and password are required.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    const client_id = /^\d+$/.test(clientIdRaw) ? parseInt(clientIdRaw, 10) : null;

    try {
      setSubmitting(true);
      // Compute API base
      const origin = window.location.origin;
      const base = origin.includes(':3000') ? 'http://localhost/Accounting' : origin + '/Accounting';
      const apiUrl = `${base}/accounting/api/employees.php`;

      // Build multipart form data to include file uploads
      const fd = new FormData();
      fd.append('username', username);
      fd.append('email', email);
      fd.append('password', password);
      fd.append('role_id', String(2));
      if (client_id !== null) fd.append('client_id', String(client_id));
      fd.append('name', name);
      fd.append('business_name', form.business_name.value.trim());
      fd.append('location', form.location.value.trim());
      if (form.business_permit.files && form.business_permit.files[0]) {
        fd.append('business_permit', form.business_permit.files[0]);
      }
      // Accept DTI file (previously labeled DTR)
      if (form.dti && form.dti.files && form.dti.files[0]) {
        fd.append('dti', form.dti.files[0]);
      }

      const res = await axios.post(apiUrl, fd, { headers: { 'Content-Type': 'multipart/form-data' } });

      if (!res.data?.ok) {
        throw new Error(res.data?.message || 'Registration failed');
      }

      setSuccess('Registration submitted. You can sign in after approval.');
      form.reset();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose?.(); }}>
      <DialogContent>
        <div className="flex max-h-[85vh] flex-col p-6 sm:p-8">
          <DialogHeader className="p-0">
            <DialogTitle>Create your account</DialogTitle>
            <DialogDescription>Start using Accounting today.</DialogDescription>
          </DialogHeader>

          <form className="mt-6 space-y-4 flex-1 min-h-0 flex flex-col" action="#" method="POST" encType="multipart/form-data" onSubmit={handleSubmit}>
            <div className="flex-1 overflow-y-auto pr-1 space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>
              )}
              {success && (
                <div className="rounded-lg bg-green-50 text-green-700 px-3 py-2 text-sm">{success}</div>
              )}

              <div>
                <Label htmlFor="su_name">Full name</Label>
                <Input
                  ref={firstInputRef}
                  id="su_name"
                  name="name"
                  type="text"
                  required
                  className="mt-1"
                  placeholder="Juan Dela Cruz"
                />
              </div>

              <div>
                <Label htmlFor="su_email">Email</Label>
                <Input
                  id="su_email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="mt-1"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <Label htmlFor="su_username">Username</Label>
                <Input
                  id="su_username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  className="mt-1"
                  placeholder="yourusername"
                />
              </div>

              <div>
                <Label htmlFor="su_password">Password</Label>
                <Input
                  id="su_password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="mt-1"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <Label htmlFor="su_confirm">Confirm password</Label>
                <Input
                  id="su_confirm"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="mt-1"
                  placeholder="••••••••"
                />
              </div>

              {/* Business details */}
              <div className="pt-2 border-t border-slate-200/70">
                <h4 className="text-sm font-semibold text-slate-800">Business details</h4>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Label htmlFor="su_business_name">Business name</Label>
                    <Input id="su_business_name" name="business_name" type="text" required className="mt-1" placeholder="Unitop Trading Inc." />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="su_location">Location</Label>
                    <Input id="su_location" name="location" type="text" required className="mt-1" placeholder="City, Province, Country" />
                  </div>
                  <div>
                    <Label htmlFor="su_client_id">Client ID</Label>
                    <Input id="su_client_id" name="client_id" type="text" required className="mt-1" placeholder="e.g., 123" />
                  </div>
                  <div>
                    <Label htmlFor="su_permit">Business permit</Label>
                    <input id="su_permit" name="business_permit" type="file" accept="image/*" className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:py-2.5 file:px-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:text-slate-700 hover:file:bg-slate-50" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="su_dti">DTI</Label>
                    <input id="su_dti" name="dti" type="file" accept="image/*,.pdf" className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:py-2.5 file:px-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:text-slate-700 hover:file:bg-slate-50" />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="p-0 mt-3 pt-3 border-t border-slate-200">
              <div className="w-full">
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? 'Submitting…' : 'Create account'}
                </Button>
                <p className="text-center text-sm text-slate-600 mt-2">
                  Already have an account?{' '}
                  <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-primary hover:text-primary-dark px-1">Sign in</Button>
                </p>
              </div>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}