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

  return (
    <>
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-surface-900">Pending Late Check-in Approvals</h3>
            <p className="text-sm text-surface-500">Review and approve or reject late check-in requests</p>
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
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reject reason dialog */}
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