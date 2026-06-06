'use client';

import { useState, useEffect } from 'react';
import { authAPI, settingsAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useBranding } from '@/context/BrandingContext';
import { useOrganizationSettings } from '@/context/OrganizationSettingsContext';
import { ORGANIZATION_MODULES, normalizeOrganizationModules } from '@/lib/organizationModules';
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

const WEEK_DAYS = [
  ['Sunday', 0],
  ['Monday', 1],
  ['Tuesday', 2],
  ['Wednesday', 3],
  ['Thursday', 4],
  ['Friday', 5],
  ['Saturday', 6],
];

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const { refresh: refreshBranding } = useBranding();
  const { refresh: refreshOrganizationSettings } = useOrganizationSettings();
  const isAdmin = ['admin', 'super_admin'].includes(user?.role);
  const isSuperAdmin = user?.role === 'super_admin';
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
      settingsAPI.get().then((res) => setSettings({
        ...res.data.settings,
        organizationModules: normalizeOrganizationModules(res.data.settings?.organizationModules),
      })).catch(() => {});
      settingsAPI.emailStatus().then((res) => setEmailStatus(res.data)).catch(() => {});
    }
  }, [isAdmin]);

  const tabs = isAdmin
    ? ['profile', 'security', 'company', 'branding', 'attendance', 'email', ...(isSuperAdmin ? ['modules'] : []), 'roles']
    : ['profile', 'security'];

  const addShift = () => {
    const shifts = settings?.attendance?.shifts || [];
    const idx = shifts.length + 1;
    updateField('attendance.shifts', [
      ...shifts,
      {
        code: `shift_${idx}`,
        name: `Shift ${idx}`,
        startTime: '09:30',
        endTime: '18:30',
        graceMinutes: 0,
        halfDayMinutes: 240,
        isOvernight: false,
      },
    ]);
  };

  const removeShift = (index) => {
    const shifts = (settings?.attendance?.shifts || []).filter((_, i) => i !== index);
    updateField('attendance.shifts', shifts.length ? shifts : [
      {
        code: 'general',
        name: 'General Shift',
        startTime: '09:30',
        endTime: '18:30',
        graceMinutes: 0,
        halfDayMinutes: 240,
        isOvernight: false,
      },
    ]);
  };

  const updateShift = (index, key, value) => {
    const shifts = [...(settings?.attendance?.shifts || [])];
    shifts[index] = { ...shifts[index], [key]: value };
    updateField('attendance.shifts', shifts);
  };

  const addHoliday = () => {
    const holidays = settings?.attendance?.holidays || [];
    updateField('attendance.holidays', [
      ...holidays,
      { name: 'New Holiday', date: new Date().toISOString().split('T')[0], optional: false },
    ]);
  };

  const removeHoliday = (index) => {
    const holidays = (settings?.attendance?.holidays || []).filter((_, i) => i !== index);
    updateField('attendance.holidays', holidays);
  };

  const updateHoliday = (index, key, value) => {
    const holidays = [...(settings?.attendance?.holidays || [])];
    holidays[index] = { ...holidays[index], [key]: value };
    updateField('attendance.holidays', holidays);
  };

  const saveSettings = async (payload, message = 'Settings saved') => {
    setSaving(true);
    try {
      const res = await settingsAPI.update(payload);
      setSettings({
        ...res.data.settings,
        organizationModules: normalizeOrganizationModules(res.data.settings?.organizationModules),
      });
      await refreshBranding();
      await refreshOrganizationSettings();
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
        obj[keys[i]] = { ...(obj[keys[i]] || {}) };
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

      {activeTab === 'attendance' && isAdmin && settings && (
        <div className="space-y-4">
          <div className="card p-6 space-y-4">
            <h3 className="font-semibold text-surface-900">Attendance Policy</h3>
            <p className="text-sm text-surface-500">Define weekly offs, shifts, and company holiday calendar.</p>

            <div>
              <label className="label">Default Shift Code</label>
              <input
                className="input"
                value={settings.attendance?.defaultShiftCode || ''}
                onChange={(e) => updateField('attendance.defaultShiftCode', e.target.value)}
              />
            </div>

            <div>
              <p className="label">Weekly Off Days</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {WEEK_DAYS.map(([label, value]) => {
                  const selected = (settings.attendance?.weeklyOffDays || []).includes(value);
                  return (
                    <label key={label} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                          const current = new Set(settings.attendance?.weeklyOffDays || []);
                          if (e.target.checked) current.add(value);
                          else current.delete(value);
                          updateField('attendance.weeklyOffDays', Array.from(current).sort((a, b) => a - b));
                        }}
                      />
                      {label}
                    </label>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.attendance?.autoMarkEnabled !== false}
                onChange={(e) => updateField('attendance.autoMarkEnabled', e.target.checked)}
              />
              Auto-mark absent/leave/holiday for days with no clock-in
            </label>
          </div>

          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-surface-900">Shift Definitions</h3>
              <button type="button" className="btn-secondary" onClick={addShift}>Add Shift</button>
            </div>

            {(settings.attendance?.shifts || []).map((shift, index) => (
              <div key={`${shift.code || 'shift'}-${index}`} className="rounded-xl border border-surface-200 p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Code</label>
                    <input className="input" value={shift.code || ''} onChange={(e) => updateShift(index, 'code', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Name</label>
                    <input className="input" value={shift.name || ''} onChange={(e) => updateShift(index, 'name', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Start Time</label>
                    <input type="time" className="input" value={shift.startTime || '09:30'} onChange={(e) => updateShift(index, 'startTime', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">End Time</label>
                    <input type="time" className="input" value={shift.endTime || '18:30'} onChange={(e) => updateShift(index, 'endTime', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Grace Minutes</label>
                    <input type="number" className="input" value={shift.graceMinutes ?? 0} onChange={(e) => updateShift(index, 'graceMinutes', Number(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="label">Half-Day Threshold (minutes)</label>
                    <input type="number" className="input" value={shift.halfDayMinutes ?? 240} onChange={(e) => updateShift(index, 'halfDayMinutes', Number(e.target.value) || 240)} />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={Boolean(shift.isOvernight)} onChange={(e) => updateShift(index, 'isOvernight', e.target.checked)} />
                    Overnight shift
                  </label>
                  <button type="button" className="text-sm text-rose-600" onClick={() => removeShift(index)}>Remove</button>
                </div>
              </div>
            ))}
          </div>

          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-surface-900">Holiday Calendar</h3>
              <button type="button" className="btn-secondary" onClick={addHoliday}>Add Holiday</button>
            </div>

            {(settings.attendance?.holidays || []).length === 0 ? (
              <p className="text-sm text-surface-500">No holidays configured.</p>
            ) : (
              <div className="space-y-3">
                {(settings.attendance?.holidays || []).map((holiday, index) => (
                  <div key={`${holiday.name || 'holiday'}-${index}`} className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto_auto] gap-3 items-center">
                    <input className="input" value={holiday.name || ''} onChange={(e) => updateHoliday(index, 'name', e.target.value)} />
                    <input
                      type="date"
                      className="input"
                      value={holiday.date ? new Date(holiday.date).toISOString().split('T')[0] : ''}
                      onChange={(e) => updateHoliday(index, 'date', e.target.value)}
                    />
                    <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                      <input type="checkbox" checked={Boolean(holiday.optional)} onChange={(e) => updateHoliday(index, 'optional', e.target.checked)} />
                      Optional
                    </label>
                    <button type="button" className="text-sm text-rose-600" onClick={() => removeHoliday(index)}>Remove</button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <button type="button" className="btn-primary" disabled={saving} onClick={() => saveSettings(settings, 'Attendance policy saved')}>
                Save Attendance Policy
              </button>
            </div>
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

      {activeTab === 'modules' && isSuperAdmin && settings && (
        <div className="space-y-4">
          <div className="card p-6 space-y-5">
            <div>
              <h3 className="font-semibold text-surface-900">Organization Modules</h3>
              <p className="text-sm text-surface-500 mt-1">
                Choose which product areas are available to this organization. Disabled modules are hidden from navigation and blocked at the page level.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ORGANIZATION_MODULES.map((moduleDef) => {
                const enabled = settings.organizationModules?.[moduleDef.key] !== false;
                return (
                  <label
                    key={moduleDef.key}
                    className="rounded-2xl border border-surface-200 p-4 flex items-start justify-between gap-4 cursor-pointer hover:border-brand-primary/30 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-surface-900">{moduleDef.label}</p>
                      <p className="text-sm text-surface-500 mt-1">{moduleDef.description}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => updateField(`organizationModules.${moduleDef.key}`, e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-surface-300"
                    />
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                className="btn-primary"
                disabled={saving}
                onClick={() => saveSettings({ organizationModules: settings.organizationModules }, 'Organization modules updated')}
              >
                Save Modules
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'roles' && isAdmin && (
        <div className="card p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Role & Permission Management</h3>
            <p className="text-gray-500 text-sm mt-1">Create custom roles, assign fine-grained permissions per module, and control data access levels.</p>
          </div>
          <a href="/settings/roles" className="btn-primary inline-block">
            Open Roles & Permissions Manager →
          </a>
        </div>
      )}
    </div>
  );
}
