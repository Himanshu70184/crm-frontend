'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { attendanceAPI } from '@/lib/api';
import { getInitials, ROLE_COLORS } from '@/lib/utils';

function formatDateTime(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Pending late check-in approvals list for admin/manager/HR.
 * Mount this inside AttendancePage.jsx, gated the same way the existing
 * `elevated` flag already gates the user filter dropdown:
 *
 *   {elevated && <LateCheckInApprovals onResolved={fetchData} />}
 *
 * `onResolved` is optional — call it (e.g. AttendancePage's fetchData) after
 * an approve/reject so the main attendance log + stat cards refresh too.
 *
 * FIX: whether Approve/Reject renders is now decided PER REQUEST using the
 * `canAct` flag the backend attaches to each item in
 * GET /attendance/late-checkin/pending (see attendanceController.js —
 * canActOnLateCheckIn()). Business rule: super_admin/admin can act on any
 * request; hr/manager can act on requests from regular employees, but a
 * request from another hr or manager still needs an admin. There is no
 * longer a single global on/off switch for the whole list — a manager or hr
 * viewing this list may see Approve/Reject on some rows and a read-only
 * "Awaiting admin review" badge on others, in the same list. The backend
 * enforces this too (403 if someone without permission calls
 * approve/reject directly), so this is a UX convenience, not the security
 * boundary.
 */
export default function LateCheckInApprovals({ onResolved }) {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [actingId, setActingId] = useState(null);

  // Reject dialog state
  const [rejectTarget, setRejectTarget] = useState(null); // the request object being rejected
  const [rejectReason, setRejectReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await attendanceAPI.getPendingLateCheckIns();
      setRequests(res.data.requests || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load pending requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleApprove = async (request) => {
    setActingId(request._id);
    try {
      await attendanceAPI.approveLateCheckIn(request._id);
      toast.success(`${request.user?.name || 'User'}'s check-in approved`);
      setRequests((prev) => prev.filter((r) => r._id !== request._id));
      onResolved?.();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to approve request');
    } finally {
      setActingId(null);
    }
  };

  const openRejectDialog = (request) => {
    setRejectTarget(request);
    setRejectReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please enter a reason for rejection');
      return;
    }
    setSubmittingReject(true);
    try {
      await attendanceAPI.rejectLateCheckIn(rejectTarget._id, { reason: rejectReason.trim() });
      toast.success(`${rejectTarget.user?.name || 'User'}'s check-in rejected`);
      setRequests((prev) => prev.filter((r) => r._id !== rejectTarget._id));
      setRejectTarget(null);
      setRejectReason('');
      onResolved?.();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reject request');
    } finally {
      setSubmittingReject(false);
    }
  };

  if (loading) {
    return (
      <div className="card p-6">
        <div className="py-10 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-200 border-t-primary-600" />
        </div>
      </div>
    );
  }

  if (requests.length === 0) {
    return null; // nothing pending — don't take up space on the page
  }

  // Header subtitle now reflects a per-request reality instead of a single
  // global permission: some viewers (hr/manager) can act on part of the
  // list (regular-employee requests) but not all of it (another hr/manager's
  // request), so the copy adapts to what's actually in the list.
  const actionableCount = requests.filter((r) => r.canAct).length;
  const subtitle = actionableCount === 0
    ? 'Awaiting admin review — only admins can approve or reject these'
    : actionableCount === requests.length
      ? 'Review and approve or reject late check-in requests'
      : `You can act on ${actionableCount} of ${requests.length} — the rest need admin review`;

  return (
    <>
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-surface-900">Pending Late Check-in Approvals</h3>
            <p className="text-sm text-surface-500">{subtitle}</p>
          </div>
          <span className="badge bg-amber-100 text-amber-700">{requests.length} pending</span>
        </div>

        <div className="space-y-3">
          {requests.map((request) => (
            <div
              key={request._id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, var(--brand-primary), var(--brand-accent))` }}
                >
                  {getInitials(request.user?.name || 'A')}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-surface-900 truncate">{request.user?.name}</p>
                    <span className={`badge ${ROLE_COLORS[request.user?.role] || ROLE_COLORS.team_member}`}>
                      {request.user?.role}
                    </span>
                    <span className="badge bg-amber-100 text-amber-700">
                      {request.lateMinutes ? `${request.lateMinutes} min late` : 'Late'}
                    </span>
                  </div>
                  <p className="text-xs text-surface-600 mt-1">
                    {request.shiftName || 'Shift'} • attempted at {formatDateTime(request.requestedClockInAt)}
                  </p>
                  <p className="text-sm text-surface-800 mt-1">"{request.reason}"</p>
                </div>
              </div>

              <div className="flex gap-2 sm:flex-shrink-0">
                {request.canAct ? (
                  <>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={actingId === request._id}
                      onClick={() => openRejectDialog(request)}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={actingId === request._id}
                      onClick={() => handleApprove(request)}
                    >
                      {actingId === request._id ? 'Approving...' : 'Approve'}
                    </button>
                  </>
                ) : (
                  <span className="badge bg-surface-100 text-surface-600 self-center whitespace-nowrap">
                    Awaiting admin review
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reject reason dialog — only reachable when the request's canAct is
          true, since the Reject button itself is hidden otherwise. */}
      {rejectTarget && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => !submittingReject && setRejectTarget(null)}
        >
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="font-semibold text-surface-900">
                Reject {rejectTarget.user?.name || 'this'}'s check-in request
              </h3>
              <p className="text-sm text-surface-500 mt-1">
                This reason will be sent to the user in a notification. Their check-in will not be recorded.
              </p>
            </div>
            <div>
              <label className="label">Reason for rejection</label>
              <textarea
                className="input"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. No prior notice given, pattern of repeated lateness..."
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={submittingReject}
                onClick={() => { setRejectTarget(null); setRejectReason(''); }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={submittingReject}
                onClick={handleConfirmReject}
              >
                {submittingReject ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}