'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { tasksAPI } from '@/lib/api';
import toast from 'react-hot-toast';

function formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function parseHmsToMs(value) {
  const raw = value.trim();
  if (!raw) return 0;
  const parts = raw.split(':').map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n) || n < 0)) return null;
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  if (parts.length === 1) return parts[0] * 1000;
  return null;
}

export default function TaskTimer({
  taskId,
  projectId,
  onTimeLogged,
  totalLoggedHours = 0,
  compact = false,
  embedded = false,
}) {
  const [timer, setTimer] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [editing, setEditing] = useState(false);
  const [timeDraft, setTimeDraft] = useState('00:00:00');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  const loadTimer = useCallback(async () => {
    try {
      const res = await tasksAPI.getTimer(taskId);
      setTimer(res.data.timer);
      setElapsedMs(res.data.elapsedMs || 0);
    } catch {
      setTimer(null);
      setElapsedMs(0);
    }
  }, [taskId]);

  useEffect(() => {
    loadTimer();
  }, [loadTimer]);

  useEffect(() => {
    if (!timer) {
      if (!editing) setElapsedMs(0);
      return undefined;
    }
    const tick = () => {
      let ms = timer.accumulatedMs || 0;
      if (timer.status === 'running' && timer.resumedAt) {
        ms += Date.now() - new Date(timer.resumedAt).getTime();
      }
      setElapsedMs(ms);
    };
    tick();
    if (timer.status !== 'running' || editing) return undefined;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timer, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const applyElapsedMs = async (ms) => {
    const res = await tasksAPI.adjustTimer(taskId, { elapsedMs: ms });
    setTimer(res.data.timer);
    setElapsedMs(res.data.elapsedMs || ms);
    return res;
  };

  const run = async (fn, successMsg) => {
    try {
      const res = await fn();
      if (successMsg) toast.success(successMsg);
      await loadTimer();
      if (res?.data?.log) {
        onTimeLogged?.(res.data.log, res.data.task);
      }
      return res;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Timer action failed');
      throw err;
    }
  };

  const openEditor = async () => {
    if (timer?.status === 'running') {
      await run(() => tasksAPI.pauseTimer(taskId));
    }
    setTimeDraft(formatElapsed(elapsedMs));
    setEditing(true);
  };

  const commitEdit = async () => {
    const ms = parseHmsToMs(timeDraft);
    if (ms === null) {
      toast.error('Use format HH:MM:SS (e.g. 01:30:00)');
      return false;
    }
    setEditing(false);
    setSaving(true);
    try {
      await applyElapsedMs(ms);
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not set time');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleStart = () => {
    if (timer?.status === 'paused') return handleResume();
    return run(() => tasksAPI.startTimer(taskId), 'Timer started');
  };

  const handlePause = () => run(() => tasksAPI.pauseTimer(taskId));
  const handleResume = () => run(() => tasksAPI.resumeTimer(taskId), 'Timer resumed');

  const handleStop = async () => {
    const ms = editing ? parseHmsToMs(timeDraft) : elapsedMs;
    if (editing && ms === null) return toast.error('Use format HH:MM:SS');
    if (editing) setEditing(false);
    setSaving(true);
    try {
      if (!timer && ms >= 60000) {
        const res = await tasksAPI.logTime(taskId, { elapsedMs: ms });
        toast.success(`${res.data.log?.hours}h added to task`);
        await loadTimer();
        onTimeLogged?.(res.data.log, res.data.task);
        return;
      }
      await run(
        () => tasksAPI.stopTimer(taskId, { elapsedMs: ms, description: 'Time logged' }),
        'Time saved to task'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogTime = async () => {
    const ms = editing ? parseHmsToMs(timeDraft) : elapsedMs;
    if (ms === null) return toast.error('Use format HH:MM:SS');
    if (ms < 60000) return toast.error('Enter at least 00:01:00');
    setEditing(false);
    setSaving(true);
    try {
      const res = await tasksAPI.logTime(taskId, { elapsedMs: ms });
      toast.success(`${res.data.log?.hours}h added to task`);
      await loadTimer();
      onTimeLogged?.(res.data.log, res.data.task);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to log time');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => run(() => tasksAPI.cancelTimer(taskId), 'Timer discarded');

  const isActive = !!timer;
  const isRunning = timer?.status === 'running';
  const displayMs = editing ? (parseHmsToMs(timeDraft) ?? elapsedMs) : elapsedMs;
  const canSave = displayMs >= 60000;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="font-mono font-semibold text-surface-700">{formatElapsed(elapsedMs)}</span>
        {!isActive ? (
          <button type="button" onClick={handleStart} className="text-primary-600 font-medium hover:underline">
            Start
          </button>
        ) : (
          <>
            {isRunning ? (
              <button type="button" onClick={handlePause} className="text-amber-600 font-medium">
                Pause
              </button>
            ) : (
              <button type="button" onClick={handleResume} className="text-primary-600 font-medium">
                Resume
              </button>
            )}
            <button type="button" onClick={handleStop} className="text-emerald-600 font-medium">
              Save
            </button>
          </>
        )}
      </div>
    );
  }

  const timerBody = (
    <>
      {!embedded && (
        <div>
          <h3 className="font-semibold text-surface-900">Time Tracker</h3>
          <p className="text-xs text-surface-500 mt-1">
            Click the timer to type time directly. <strong>Stop & save</strong> adds it to total tracked.
          </p>
        </div>
      )}
      {embedded && (
        <p className="text-xs text-surface-500 mb-2">
          Click the timer to edit (HH:MM:SS). Pause/resume for live tracking, then <strong>Stop & save</strong>.
        </p>
      )}

      <p className="text-xs text-surface-500 text-center">
        Total on task: <strong>{Number(totalLoggedHours).toFixed(1)}h</strong>
        {isActive && (
          <span className="text-surface-400">
            {' '}
            · session {formatElapsed(elapsedMs)}
          </span>
        )}
      </p>

      <div
        className={`flex items-center justify-center rounded-2xl border transition-colors ${
          embedded ? 'py-3 bg-surface-50' : 'py-4 bg-surface-50'
        } ${editing ? 'border-primary-400 ring-2 ring-primary-100' : 'border-surface-200'}`}
      >
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            className={`font-mono font-bold text-surface-900 tracking-wider text-center bg-transparent border-0 focus:outline-none w-full max-w-[220px] ${
              embedded ? 'text-2xl' : 'text-4xl'
            }`}
            value={timeDraft}
            onChange={(e) => setTimeDraft(e.target.value)}
            onBlur={() => commitEdit()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitEdit();
              }
              if (e.key === 'Escape') {
                setEditing(false);
                setTimeDraft(formatElapsed(elapsedMs));
              }
            }}
            placeholder="00:00:00"
            aria-label="Edit time HH:MM:SS"
          />
        ) : (
          <button
            type="button"
            onClick={openEditor}
            className={`font-mono font-bold text-surface-900 tracking-wider hover:text-primary-700 cursor-text ${
              embedded ? 'text-2xl' : 'text-4xl'
            }`}
            title="Click to edit time"
          >
            {formatElapsed(elapsedMs)}
          </button>
        )}
      </div>

      {!editing && (
        <p className="text-[10px] text-center text-surface-400 -mt-1">Tap time to edit</p>
      )}

      <div className="flex flex-wrap gap-2 justify-center">
        {!isActive && (
          <>
            <button type="button" onClick={handleStart} className="btn-primary text-sm" disabled={saving}>
              ▶ Start
            </button>
            {canSave && (
              <button
                type="button"
                onClick={handleLogTime}
                className="btn-primary text-sm bg-emerald-600 hover:bg-emerald-700"
                disabled={saving}
              >
                ⏹ Log time
              </button>
            )}
          </>
        )}
        {isActive && isRunning && (
          <button type="button" onClick={handlePause} className="btn-secondary text-sm" disabled={saving}>
            ⏸ Pause
          </button>
        )}
        {isActive && !isRunning && (
          <button type="button" onClick={handleResume} className="btn-primary text-sm" disabled={saving}>
            ▶ Resume
          </button>
        )}
        {(isActive || canSave) && (
          <button
            type="button"
            onClick={handleStop}
            className="btn-primary text-sm bg-emerald-600 hover:bg-emerald-700"
            disabled={saving || !canSave}
          >
            ⏹ Stop & save
          </button>
        )}
        {isActive && (
          <button type="button" onClick={handleCancel} className="btn-ghost text-sm text-red-600" disabled={saving}>
            Cancel
          </button>
        )}
      </div>
    </>
  );

  if (embedded) {
    return <div className="space-y-3 w-[300px]">{timerBody}</div>;
  }

  return <div className="card p-5 space-y-4">{timerBody}</div>;
}
