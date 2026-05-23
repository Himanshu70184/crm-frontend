'use client';

import { useState, useEffect } from 'react';
import { authAPI, settingsAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useBranding } from '@/context/BrandingContext';
import { ROLE_COLORS } from '@/lib/utils';
import PageHeader from '@/components/ui/PageHeader';
import toast from 'react-hot-toast';

const DEFAULT_BRANDING = {
  appName: 'CRM Pro',
  tagline: 'Project & task management for service teams',
  logoUrl: '',
  faviconUrl: '',
  primaryColor: '#4f46e5',
  primaryHover: '#4338ca',
  accentColor: '#8b5cf6',
  sidebarBg: '#0f172a',
  authGradientFrom: '#eef2ff',
  authGradientTo: '#e0e7ff',
};

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const { refresh: refreshBranding } = useBranding();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState('profile');
  const [settings, setSettings] = useState(null);
  const [emailStatus, setEmailStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState({ name: '', phone: '', department: '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [testEmailTo, setTestEmailTo] = useState('');

  useEffect(() => {
    setProfile({ name: user?.name || '', phone: user?.phone || '', department: user?.department || '' });
    setTestEmailTo(user?.email || '');
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      settingsAPI.get().then((res) => setSettings(res.data.settings)).catch(() => {});
      settingsAPI.emailStatus().then((res) => setEmailStatus(res.data)).catch(() => {});
    }
  }, [isAdmin]);

  const tabs = isAdmin
    ? ['profile', 'security', 'company', 'branding', 'email']
    : ['profile', 'security'];

  const saveSettings = async (payload, message = 'Settings saved') => {
    setSaving(true);
    try {
      const res = await settingsAPI.update(payload);
      setSettings(res.data.settings);
      await refreshBranding();
      toast.success(message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await authAPI.updateProfile(profile);
      updateUser(res.data.user);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) return toast.error('Passwords do not match');
    setSaving(true);
    try {
      await authAPI.changePassword({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
      toast.success('Password changed!');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    try {
      const res = await settingsAPI.testEmail({ to: testEmailTo });
      toast.success(res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Email test failed');
    }
  };

  const updateField = (path, value) => {
    setSettings((prev) => {
      const next = { ...prev };
      const keys = path.split('.');
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = { ...obj[keys[i]] };
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  };

  if (!settings && isAdmin && activeTab !== 'profile' && activeTab !== 'security') {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  const b = settings?.branding || DEFAULT_BRANDING;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader title="Settings" subtitle="Profile, branding, email, and organization" />

      <div className="flex flex-wrap gap-1 border-b border-surface-200">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              activeTab === tab ? 'border-brand-primary text-brand-primary' : 'border-transparent text-surface-500'
            }`}
            style={activeTab === tab ? { borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)' } : {}}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <div className="card p-6">
          <div className="flex items-center gap-4 mb-6">
            <div
              className="w-16 h-16 rounded-2xl text-white text-2xl flex items-center justify-center font-bold"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-semibold text-surface-900">{user?.name}</h3>
              <p className="text-sm text-surface-500">{user?.email}</p>
              <span className={`badge mt-1 ${ROLE_COLORS[user?.role]}`}>{user?.role}</span>
            </div>
          </div>
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Phone</label>
                <input className="input" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
              </div>
              <div>
                <label className="label">Department</label>
                <input className="input" value={profile.department} onChange={(e) => setProfile({ ...profile, department: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="btn-primary" disabled={saving}>Save Profile</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="card p-6">
          <h3 className="font-semibold text-surface-900 mb-4">Change Password</h3>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="label">Current Password</label>
              <input className="input" type="password" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} required />
            </div>
            <div>
              <label className="label">New Password</label>
              <input className="input" type="password" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} required minLength={6} />
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <input className="input" type="password" value={passwords.confirmPassword} onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })} required />
            </div>
            <div className="flex justify-end">
              <button type="submit" className="btn-primary" disabled={saving}>Change Password</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'company' && isAdmin && settings && (
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-surface-900">Company</h3>
          <div>
            <label className="label">Company Name</label>
            <input className="input" value={settings.companyName || ''} onChange={(e) => updateField('companyName', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Company Email</label>
              <input className="input" type="email" value={settings.companyEmail || ''} onChange={(e) => updateField('companyEmail', e.target.value)} />
            </div>
            <div>
              <label className="label">Currency</label>
              <select className="input" value={settings.currency || 'USD'} onChange={(e) => updateField('currency', e.target.value)}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="INR">INR</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="button" className="btn-primary" disabled={saving} onClick={() => saveSettings(settings)}>Save Company</button>
          </div>
        </div>
      )}

      {activeTab === 'branding' && isAdmin && settings && (
        <div className="space-y-4">
          <div className="card p-6">
            <h3 className="font-semibold text-surface-900 mb-4">Brand Identity</h3>
            <p className="text-sm text-surface-500 mb-4">Changes apply instantly across login, sidebar, and buttons.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">App Name</label>
                <input className="input" value={b.appName || ''} onChange={(e) => updateField('branding.appName', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Tagline</label>
                <input className="input" value={b.tagline || ''} onChange={(e) => updateField('branding.tagline', e.target.value)} />
              </div>
              <div>
                <label className="label">Logo URL</label>
                <input className="input" placeholder="https://..." value={b.logoUrl || ''} onChange={(e) => updateField('branding.logoUrl', e.target.value)} />
              </div>
              <div>
                <label className="label">Favicon URL</label>
                <input className="input" placeholder="https://..." value={b.faviconUrl || ''} onChange={(e) => updateField('branding.faviconUrl', e.target.value)} />
              </div>
              <div>
                <label className="label">Primary Color</label>
                <div className="flex gap-2">
                  <input type="color" className="w-12 h-10 rounded-lg border cursor-pointer" value={b.primaryColor} onChange={(e) => updateField('branding.primaryColor', e.target.value)} />
                  <input className="input flex-1" value={b.primaryColor || ''} onChange={(e) => updateField('branding.primaryColor', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Accent Color</label>
                <div className="flex gap-2">
                  <input type="color" className="w-12 h-10 rounded-lg border cursor-pointer" value={b.accentColor} onChange={(e) => updateField('branding.accentColor', e.target.value)} />
                  <input className="input flex-1" value={b.accentColor || ''} onChange={(e) => updateField('branding.accentColor', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Sidebar Background</label>
                <div className="flex gap-2">
                  <input type="color" className="w-12 h-10 rounded-lg border cursor-pointer" value={b.sidebarBg} onChange={(e) => updateField('branding.sidebarBg', e.target.value)} />
                  <input className="input flex-1" value={b.sidebarBg || ''} onChange={(e) => updateField('branding.sidebarBg', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Primary Hover</label>
                <input className="input" value={b.primaryHover || ''} onChange={(e) => updateField('branding.primaryHover', e.target.value)} />
              </div>
            </div>
          </div>

          <div
            className="card p-6 rounded-2xl text-white"
            style={{ background: `linear-gradient(135deg, var(--brand-primary), var(--brand-accent))` }}
          >
            <p className="text-sm opacity-80">Preview</p>
            <h3 className="text-xl font-bold mt-1">{b.appName}</h3>
            <p className="text-sm opacity-90 mt-1">{b.tagline}</p>
            <button type="button" className="mt-4 px-4 py-2 bg-white/20 rounded-lg text-sm font-medium">Sample Button</button>
          </div>

          <div className="flex justify-end">
            <button type="button" className="btn-primary" disabled={saving} onClick={() => saveSettings(settings, 'Branding updated')}>
              Save Branding
            </button>
          </div>
        </div>
      )}

      {activeTab === 'email' && isAdmin && settings && (
        <div className="space-y-4">
          <div className={`card p-4 text-sm ${emailStatus?.ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-900 border-amber-200'}`}>
            <strong>SMTP status:</strong> {emailStatus?.message || 'Checking…'}
            <p className="mt-1 text-xs opacity-80">Configure via .env (SMTP_*) or fields below. Gmail requires an App Password.</p>
          </div>

          <div className="card p-6 space-y-4">
            <h3 className="font-semibold text-surface-900">SMTP Configuration</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="label">SMTP Host</label>
                <input className="input" placeholder="smtp.gmail.com" value={settings.smtp?.host || ''} onChange={(e) => updateField('smtp.host', e.target.value)} />
              </div>
              <div>
                <label className="label">Port</label>
                <input className="input" type="number" value={settings.smtp?.port || 587} onChange={(e) => updateField('smtp.port', parseInt(e.target.value, 10))} />
              </div>
              <div>
                <label className="label">Username</label>
                <input className="input" value={settings.smtp?.user || ''} onChange={(e) => updateField('smtp.user', e.target.value)} />
              </div>
              <div>
                <label className="label">Password</label>
                <input className="input" type="password" placeholder="Leave blank to keep current" value={settings.smtp?.pass || ''} onChange={(e) => updateField('smtp.pass', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="label">From Address</label>
                <input className="input" placeholder='CRM <noreply@company.com>' value={settings.smtp?.from || ''} onChange={(e) => updateField('smtp.from', e.target.value)} />
              </div>
            </div>

            <h4 className="font-medium text-surface-800 pt-2">Notification toggles</h4>
            <div className="space-y-2">
              {[
                ['notifications.emailEnabled', 'Enable email notifications'],
                ['notifications.taskAssigned', 'Task assigned'],
                ['notifications.mentionAlerts', 'Mentions in comments'],
                ['notifications.deadlineReminders', 'Deadline reminders (daily 9 AM)'],
              ].map(([path, label]) => (
                <label key={path} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={path.split('.').reduce((o, k) => o?.[k], settings) !== false}
                    onChange={(e) => updateField(path, e.target.checked)}
                    className="rounded border-surface-300"
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button type="button" className="btn-primary" disabled={saving} onClick={() => saveSettings(settings, 'Email settings saved')}>
                Save Email Settings
              </button>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-surface-900 mb-3">Send Test Email</h3>
            <div className="flex gap-3">
              <input className="input flex-1" type="email" value={testEmailTo} onChange={(e) => setTestEmailTo(e.target.value)} placeholder="recipient@email.com" />
              <button type="button" className="btn-secondary whitespace-nowrap" onClick={handleTestEmail}>Send Test</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
