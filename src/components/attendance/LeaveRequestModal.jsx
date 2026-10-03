'use client';

import { useEffect, useMemo, useState } from 'react';
import { attendanceAPI } from '@/lib/api';

// Icons + label per leave type. Cards instead of a plain dropdown so the
// choice is visible at a glance instead of hidden behind a collapsed select.
export const LEAVE_TYPES = [
  { value: 'annual', label: 'Annual', icon: '🌴', hint: 'Planned vacation or personal time' },
  { value: 'casual', label: 'Casual', icon: '🗓️', hint: 'Short personal absence' },
  { value: 'sick', label: 'Sick', icon: '🤒', hint: 'Illness or medical appointment' },
  { value: 'half_day', label: 'Half Day', icon: '⏳', hint: 'Half of a single day (0.5)' },
  { value: 'personal', label: 'Personal', icon: '👤', hint: 'Personal work or family matter' },
  { value: 'unpaid', label: 'Unpaid', icon: '📄', hint: 'Leave without pay' },
  { value: 'other', label: 'Other', icon: '📝', hint: 'Anything else - add a reason' },
];

const REASON_MAX = 500;

// Local-timezone YYYY-MM-DD. new Date().toISOString() would shift the day for
// users east/west of UTC, which made "today" wrong near midnight.
const toInputDate = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const todayKey = () => toInputDate(new Date());

const addDays = (key, days) => {
  const date = new Date(`${key}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toInputDate(date);
};

const formatDay = (key) =>
  new Date(`${key}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/**
 * Shared "Request Leave" dialog used by both the Attendance page and the Leave
 * Requests module, so the two can never drift apart again.
 *
 * Improvements over the previous inline version:
 *  - leave type as clickable cards instead of a select
 *  - quick date presets
 *  - live "how many days will this cost" preview from the server (skips
 *    weekends / weekly offs / holidays exactly like the stored value)
 *  - inline validation, submit disabled until the form is valid
 *  - reason with a character counter and a type-specific placeholder
 *  - Escape / backdrop click to close, scrollable body on small screens
 */
export default function LeaveRequestModal({
  open,
  sent,
  saving,
  form,
  setForm,
  onSubmit,
  onCancel,
  onSubmitAnother,
  onDone,
  deliveredEmails = [],
  emailStatus = { failed: [], notConfigured: false },
}) {
  const [estimate, setEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);

  const isHalfDay = form.leaveType === 'half_day';
  const minDate = todayKey();

  const errors = useMemo(() => {
    const list = [];
    if (!form.startDate) list.push('Select a start date.');
    if (!form.endDate) list.push('Select an end date.');
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      list.push('End date cannot be earlier than the start date.');
    }
    if (form.startDate && form.startDate < minDate) {
      list.push('Leave cannot start in the past.');
    }
    if (isHalfDay && form.startDate && form.endDate && form.endDate !== form.startDate) {
      list.push('A half day covers a single date - the end date must match the start date.');
    }
    if (form.leaveType === 'other' && !form.reason.trim()) {
      list.push('Please add a reason when choosing "Other".');
    }
    return list;
  }, [form.startDate, form.endDate, form.leaveType, form.reason, isHalfDay, minDate]);

  const hasErrors = errors.length > 0;

  // Live cost preview. Debounced so picking dates doesn't spam the API, and
  // skipped while the form is invalid.
  useEffect(() => {
    if (!open || sent || hasErrors || !form.startDate || !form.endDate) {
      setEstimate(null);
      return;
    }

    let cancelled = false;
    setEstimating(true);
    const timer = setTimeout(async () => {
      try {
        const res = await attendanceAPI.estimateLeave({
          startDate: form.startDate,
          endDate: form.endDate,
          leaveType: form.leaveType,
        });
        if (!cancelled) setEstimate(res.data);
      } catch {
        // A failed preview must never block submitting the request.
        if (!cancelled) setEstimate(null);
      } finally {
        if (!cancelled) setEstimating(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, sent, hasErrors, form.startDate, form.endDate, form.leaveType]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && open && !saving) onCancel?.();
    };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, saving, onCancel]);

  if (!open) return null;

  const setField = (patch) => setForm((prev) => ({ ...prev, ...patch }));
// ─── Success view ────────────────────────────────────────────────────────
  if (sent) {
    const { failed = [], notConfigured = false } = emailStatus || {};
    return (
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onDone?.();
        }}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center my-8">
          <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-3xl">✅</span>
          </div>
          <h3 className="text-lg font-semibold text-surface-900">Leave Request Submitted</h3>
          <p className="text-sm text-surface-500 mt-1">
            Your request is saved and pending approval. You&apos;ll get an email as soon as it is approved or rejected.
          </p>

          {notConfigured && (
            <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-left">
              <p className="text-sm font-semibold text-amber-800">⚠️ Emails could not be sent</p>
              <p className="text-xs text-amber-700 mt-1">
                Email isn&apos;t configured on this server. Ask an admin to set it up under Admin → Settings → Email,
                or set the <code>SMTP_*</code> variables in the backend environment. Your request is saved either way.
              </p>
            </div>
          )}

          {!notConfigured && failed.length > 0 && (
            <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-left">
              <p className="text-sm font-semibold text-amber-800">⚠️ {failed.length} email(s) not delivered</p>
              <ul className="text-xs text-amber-700 mt-1 space-y-0.5">
                {failed.map((f, i) => (
                  <li key={i}>
                    {f.email} — {f.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {deliveredEmails.length > 0 && (
            <div className="mt-4 bg-surface-50 rounded-xl p-3 text-left">
              <p className="text-xs uppercase tracking-wide text-surface-400 font-medium mb-2">Emails delivered to</p>
              <div className="space-y-1.5">
                {deliveredEmails.map((email, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-surface-700">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full shrink-0" />
                    <span className="truncate">{email}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-5">
            <button type="button" className="btn-secondary" onClick={onSubmitAnother}>
              Submit Another
            </button>
            <button type="button" className="btn-primary" onClick={onDone}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  const applyPreset = (fromOffset, toOffset) => {
    const start = addDays(todayKey(), fromOffset);
    setField({ startDate: start, endDate: addDays(start, toOffset) });
  };
// ─── Form view ───────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel?.();
      }}
    >
      <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4 sm:my-8">
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-surface-200">
          <div className="w-11 h-11 rounded-xl bg-brand-primary/10 flex items-center justify-center text-xl shrink-0">
            📅
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-surface-900">Request Leave</h3>
            <p className="text-xs text-surface-500 mt-0.5">
              Submit a request - HR and Admin are emailed and can approve or reject it.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            aria-label="Close"
            className="text-surface-400 hover:text-surface-700 hover:bg-surface-100 rounded-lg p-1.5 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Leave type */}
          <div>
            <label className="label">Leave type</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {LEAVE_TYPES.map((type) => {
                const active = form.leaveType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    title={type.hint}
                    onClick={() =>
                      setField({
                        leaveType: type.value,
                        // A half day only ever covers one date.
                        endDate: type.value === 'half_day' ? form.startDate : form.endDate,
                      })
                    }
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      active
                        ? 'border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary/30'
                        : 'border-surface-200 hover:border-primary-200 hover:bg-surface-50'
                    }`}
                  >
                    <span className="text-base leading-none">{type.icon}</span>
                    <span
                      className={`text-sm font-medium truncate ${active ? 'text-brand-primary' : 'text-surface-700'}`}
                    >
                      {type.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dates */}
          <div>
            <label className="label">Dates</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="block text-xs text-surface-500 mb-1">From</span>
                <input
                  type="date"
                  className="input"
                  value={form.startDate}
                  min={minDate}
                  onChange={(e) =>
                    setField({
                      startDate: e.target.value,
                      endDate: isHalfDay ? e.target.value : form.endDate,
                    })
                  }
                />
              </div>
              <div>
                <span className="block text-xs text-surface-500 mb-1">To</span>
                <input
                  type="date"
                  className="input"
                  value={form.endDate}
                  min={form.startDate || minDate}
                  disabled={isHalfDay}
                  onChange={(e) => setField({ endDate: e.target.value })}
                />
              </div>
            </div>

            {/* Quick presets */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[
                { label: 'Today', from: 0, to: 0 },
                { label: 'Tomorrow', from: 1, to: 1 },
                { label: 'Next 3 days', from: 1, to: 2 },
                { label: 'Next week', from: 7, to: 6 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset.from, preset.to)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-surface-100 hover:bg-surface-200 text-surface-600 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
{/* Live day-count preview */}
          {(estimating || estimate) && !hasErrors && (
            <div className="rounded-xl bg-brand-primary/5 border border-brand-primary/20 p-3">
              {estimating ? (
                <p className="text-sm text-surface-500">Calculating working days…</p>
              ) : (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-brand-primary leading-none">{estimate.totalDays}</span>
                    <span className="text-sm text-surface-600">
                      {Number(estimate.totalDays) === 1 ? 'day' : 'days'} will be deducted
                    </span>
                  </div>
                  <p className="text-xs text-surface-500 mt-1">
                    {estimate.calendarDays} calendar day{estimate.calendarDays === 1 ? '' : 's'} selected
                    {estimate.excludedDays?.length > 0 &&
                      ` · ${estimate.excludedDays.length} excluded (weekend/off/holiday)`}
                  </p>
                  {estimate.excludedDays?.length > 0 && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => setShowExcluded((v) => !v)}
                        className="text-xs font-medium text-brand-primary hover:underline"
                      >
                        {showExcluded ? 'Hide' : 'Show'} excluded days
                      </button>
                      {showExcluded && (
                        <ul className="mt-1.5 space-y-0.5">
                          {estimate.excludedDays.map((d) => (
                            <li key={d.date} className="text-xs text-surface-600">
                              <span className="text-surface-400">{formatDay(d.date)}</span> · {d.label}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Reason */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label mb-0">
                Reason {form.leaveType !== 'other' && <span className="text-surface-400 font-normal">(optional)</span>}
              </label>
              <span className={`text-xs ${form.reason.length > REASON_MAX ? 'text-red-600' : 'text-surface-400'}`}>
                {form.reason.length}/{REASON_MAX}
              </span>
            </div>
            <textarea
              className="input min-h-[90px] resize-y"
              maxLength={REASON_MAX}
              placeholder={LEAVE_TYPES.find((t) => t.value === form.leaveType)?.hint || 'Add a short reason…'}
              value={form.reason}
              onChange={(e) => setField({ reason: e.target.value })}
            />
          </div>

          {/* Notification note */}
          <div className="flex items-start gap-2.5 rounded-xl bg-surface-50 border border-surface-200 p-3">
            <span className="text-base leading-none mt-0.5">📧</span>
            <p className="text-xs text-surface-600 leading-relaxed">
              On submit, an email goes to all <strong className="text-surface-800">HR, Admin and Super Admin</strong> users,
              and a confirmation to <strong className="text-surface-800">you</strong>. You&apos;ll be emailed again when the
              request is approved or rejected.
            </p>
          </div>

          {/* Validation */}
          {hasErrors && (
            <ul className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-0.5">
              {errors.map((err) => (
                <li key={err} className="text-xs text-red-700">
                  {err}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-5 border-t border-surface-200 bg-surface-50/60 rounded-b-2xl">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving || hasErrors}>
            {saving ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </form>
    </div>
  );
}