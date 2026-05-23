'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  tasksAPI,
  commentsAPI,
  timeLogsAPI,
  settingsAPI,
} from '@/lib/api';
import { fetchAssignableUsers } from '@/lib/assignableUsers';
import {
  formatDate,
  formatRelativeTime,
  PRIORITY_COLORS,
  getInitials,
} from '@/lib/utils';
import { DEFAULT_COLUMNS } from '@/lib/kanban';
import { useAuth } from '@/context/AuthContext';
import TaskTimer from '@/components/tasks/TaskTimer';
import toast from 'react-hot-toast';

function ActionChip({ icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
        active
          ? 'bg-primary-100 text-primary-800 ring-1 ring-primary-200'
          : 'bg-surface-100 hover:bg-surface-200 text-surface-700'
      }`}
    >
      <span className="text-base leading-none">{icon}</span>
      {label}
    </button>
  );
}

function getAssigneeId(assignee) {
  if (!assignee) return '';
  if (typeof assignee === 'string') return assignee;
  return assignee._id?.toString?.() || '';
}

function PopoverPanel({ open, onClose, title, children, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div ref={ref} className={`absolute left-0 top-full mt-2 z-30 ${className}`}>
      <div className="bg-white rounded-xl border border-surface-200 shadow-premium-lg p-4 min-w-[280px]">
        {title && <h4 className="font-semibold text-surface-900 text-sm mb-3">{title}</h4>}
        {children}
      </div>
    </div>
  );
}

function MonthCalendar({ value, onChange }) {
  const [view, setView] = useState(() => {
    const d = value ? new Date(value) : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const firstDay = new Date(view.year, view.month, 1).getDay();
  const today = new Date();
  const selected = value ? new Date(value) : null;

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthLabel = new Date(view.year, view.month).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const pick = (day) => {
    if (!day) return;
    const iso = new Date(view.year, view.month, day).toISOString().split('T')[0];
    onChange(iso);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          className="p-1 hover:bg-surface-100 rounded"
          onClick={() =>
            setView((v) =>
              v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 }
            )
          }
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-surface-800">{monthLabel}</span>
        <button
          type="button"
          className="p-1 hover:bg-surface-100 rounded"
          onClick={() =>
            setView((v) =>
              v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 }
            )
          }
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-surface-400 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <span key={`e-${i}`} />;
          const isToday =
            day === today.getDate() &&
            view.month === today.getMonth() &&
            view.year === today.getFullYear();
          const isSelected =
            selected &&
            day === selected.getDate() &&
            view.month === selected.getMonth() &&
            view.year === selected.getFullYear();
          return (
            <button
              key={`${view.year}-${view.month}-${day}`}
              type="button"
              onClick={() => pick(day)}
              className={`h-8 w-8 mx-auto rounded-lg text-sm ${
                isSelected
                  ? 'bg-primary-600 text-white font-semibold'
                  : isToday
                    ? 'bg-surface-200 text-surface-900 font-medium'
                    : 'hover:bg-surface-100 text-surface-700'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findMentionTrigger(value, cursorPosition) {
  const textBeforeCursor = value.slice(0, cursorPosition);
  const match = textBeforeCursor.match(/(^|\s)@([^\s@]*)$/);

  if (!match) return null;

  return {
    query: match[2],
    start: cursorPosition - match[2].length - 1,
    end: cursorPosition,
  };
}

function collectMentionIds(text, users) {
  const seen = new Set();
  const ids = [];

  users
    .filter((candidate) => candidate?._id && candidate.name)
    .sort((left, right) => right.name.length - left.name.length)
    .forEach((candidate) => {
      const pattern = new RegExp(
        `(^|\\s)@${escapeRegExp(candidate.name)}(?=$|[\\s.,!?;:])`
      );

      if (!pattern.test(text)) return;

      const candidateId = candidate._id.toString();
      if (seen.has(candidateId)) return;
      seen.add(candidateId);
      ids.push(candidateId);
    });

  return ids;
}

function renderCommentText(text, mentions) {
  const mentionNames = mentions
    ?.map((mention) => mention?.name)
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);

  if (!mentionNames?.length) return text;

  const parts = text.split(
    new RegExp(`(@(?:${mentionNames.map((name) => escapeRegExp(name)).join('|')}))`, 'g')
  );

  return parts.map((part, index) => {
    if (!part) return null;
    const isMention = mentionNames.some((name) => part === `@${name}`);

    if (!isMention) {
      return <span key={`${part}-${index}`}>{part}</span>;
    }

    return (
      <span
        key={`${part}-${index}`}
        className="font-medium text-primary-700 bg-primary-50 rounded px-1"
      >
        {part}
      </span>
    );
  });
}

function CombinedFeed({ taskId, comments, activities, showDetails }) {
  const items = [];

  comments.forEach((c) => {
    items.push({
      id: `c-${c._id}`,
      type: 'comment',
      at: new Date(c.createdAt),
      user: c.author,
      text: c.text,
      mentions: c.mentions || [],
      isEdited: c.isEdited,
    });
  });

  if (showDetails) {
    activities.forEach((a) => {
      items.push({
        id: `a-${a._id}`,
        type: 'activity',
        at: new Date(a.createdAt),
        user: a.user,
        action: a.action,
        metadata: a.metadata,
      });
    });
  }

  items.sort((a, b) => b.at - a.at);

  if (!items.length) {
    return <p className="text-sm text-surface-400 py-6 text-center">No comments or activity yet</p>;
  }

  return (
    <div className="space-y-0">
      {items.map((item) => (
        <div key={item.id} className="flex gap-3 py-3 border-b border-surface-100 last:border-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            {getInitials(item.user?.name || '?')}
          </div>
          <div className="min-w-0 flex-1">
            {item.type === 'comment' ? (
              <>
                <p className="text-sm text-surface-800">
                  <span className="font-semibold">{item.user?.name}</span>
                  {item.isEdited && (
                    <span className="text-surface-400 font-normal text-xs ml-1">(edited)</span>
                  )}
                </p>
                  <p className="text-sm text-surface-700 mt-1 whitespace-pre-wrap">
                    {renderCommentText(item.text, item.mentions)}
                  </p>
              </>
            ) : (
              <p className="text-sm text-surface-800">
                <span className="font-semibold">{item.user?.name || 'User'}</span>{' '}
                <span className="text-surface-600">{item.action}</span>
                {item.metadata?.changes && (
                  <span className="text-surface-500"> — {item.metadata.changes}</span>
                )}
              </p>
            )}
            <p className="text-xs text-surface-400 mt-1">{formatRelativeTime(item.at)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TaskDetailModal({
  taskId,
  open,
  onClose,
  onUpdated,
  onDeleted,
}) {
  const { user } = useAuth();
  const canManage = ['admin', 'manager'].includes(user?.role);
  const commentInputRef = useRef(null);

  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [timeLogs, setTimeLogs] = useState([]);
  const [team, setTeam] = useState([]);
  const [statusOptions, setStatusOptions] = useState(DEFAULT_COLUMNS);
  const [loading, setLoading] = useState(true);
  const [showActivityDetails, setShowActivityDetails] = useState(true);
  const [activePanel, setActivePanel] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [dueEnabled, setDueEnabled] = useState(false);
  const [dueDraft, setDueDraft] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [activityKey, setActivityKey] = useState(0);
  const [mentionState, setMentionState] = useState(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);

  const bumpActivity = () => setActivityKey((k) => k + 1);

  const mentionCandidates = team.filter(
    (member) => member?._id && member.name && member._id?.toString?.() !== user?._id?.toString?.()
  );
  const normalizedMentionQuery = mentionState?.query?.trim().toLowerCase() || '';
  const mentionSuggestions = mentionState
    ? mentionCandidates
        .filter((member) => {
          if (!normalizedMentionQuery) return true;
          return [member.name, member.email]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(normalizedMentionQuery));
        })
        .slice(0, 6)
    : [];

  const refreshFeed = useCallback(async () => {
    if (!taskId) return;
    try {
      const [cRes, aRes] = await Promise.all([
        commentsAPI.getAll({ task: taskId }),
        tasksAPI.getActivities(taskId),
      ]);
      setComments(cRes.data.comments || []);
      setActivities(aRes.data.activities || []);
    } catch {
      /* ignore */
    }
  }, [taskId]);

  const loadTask = useCallback(async () => {
    if (!taskId || !open) return;
    setLoading(true);
    try {
      const [tRes, cRes, aRes, lRes] = await Promise.all([
        tasksAPI.getOne(taskId),
        commentsAPI.getAll({ task: taskId }),
        tasksAPI.getActivities(taskId),
        timeLogsAPI.getAll({ task: taskId }),
      ]);
      const t = tRes.data.task;
      setTask(t);
      setTitleDraft(t.title);
      setDescDraft(t.description || '');
      setDueEnabled(!!t.dueDate);
      setDueDraft(t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : '');
      setComments(cRes.data.comments || []);
      setActivities(aRes.data.activities || []);
      setTimeLogs(lRes.data.logs || []);

      const pid = t.project?._id || t.project;
      if (pid) {
        fetchAssignableUsers(pid).then(setTeam).catch(() => setTeam([]));
      } else {
        fetchAssignableUsers().then(setTeam).catch(() => setTeam([]));
      }
    } catch {
      toast.error('Failed to load task');
      onClose?.();
    } finally {
      setLoading(false);
    }
  }, [taskId, open, onClose]);

  useEffect(() => {
    if (open) loadTask();
  }, [open, loadTask]);

  useEffect(() => {
    if (open && activityKey > 0) refreshFeed();
  }, [activityKey, open, refreshFeed]);

  useEffect(() => {
    settingsAPI.getKanbanColumns().then((res) => setStatusOptions(res.data.columns)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  useEffect(() => {
    setActiveMentionIndex(0);
  }, [mentionState?.query, mentionSuggestions.length]);

  const patchTask = async (data, quiet) => {
    try {
      const res = await tasksAPI.update(taskId, data);
      const updated = res.data.task;
      setTask(updated);
      onUpdated?.(updated);
      bumpActivity();
      if (!quiet) toast.success('Saved');
      return updated;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
      throw err;
    }
  };

  const assignMember = async (userId) => {
    try {
      const updated = await patchTask({ assignee: userId || null }, true);
      toast.success(userId ? `Assigned to ${updated?.assignee?.name || 'member'}` : 'Task unassigned');
      setActivePanel(null);
    } catch {
      /* patchTask shows toast */
    }
  };

  const handleStatusChange = async (status) => {
    try {
      const res = await tasksAPI.updateStatus(taskId, status);
      setTask(res.data.task);
      onUpdated?.(res.data.task);
      bumpActivity();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  const saveTitle = async () => {
    setEditingTitle(false);
    if (!titleDraft.trim() || titleDraft === task?.title) return;
    await patchTask({ title: titleDraft.trim() }, true);
  };

  const saveDescription = async () => {
    setEditingDesc(false);
    if (descDraft === (task?.description || '')) return;
    await patchTask({ description: descDraft }, true);
  };

  const saveDueDate = async () => {
    const payload = dueEnabled && dueDraft ? { dueDate: dueDraft } : { dueDate: null };
    await patchTask(payload, true);
    setActivePanel(null);
  };

  const submitComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const mentions = collectMentionIds(commentText, mentionCandidates);
      const res = await commentsAPI.create({ text: commentText, task: taskId, mentions });
      setComments((prev) => [...prev, res.data.comment]);
      setCommentText('');
      setMentionState(null);
      bumpActivity();
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const onTimeLogged = (log, updatedTask) => {
    if (log) setTimeLogs((prev) => [log, ...prev]);
    if (updatedTask) {
      setTask(updatedTask);
      onUpdated?.(updatedTask);
    } else if (log) {
      setTask((t) => ({ ...t, loggedHours: (t.loggedHours || 0) + (log.hours || 0) }));
    }
    bumpActivity();
  };

  const handleSubtaskToggle = async (idx) => {
    const updated = task.subtasks.map((s, i) =>
      i === idx ? { ...s, completed: !s.completed } : s
    );
    const res = await tasksAPI.updateSubtasks(taskId, updated);
    setTask((t) => ({ ...t, subtasks: res.data.subtasks }));
    onUpdated?.({ ...task, subtasks: res.data.subtasks });
  };

  const addSubtask = async () => {
    if (!newSubtask.trim()) return;
    const subtasks = [...(task.subtasks || []), { title: newSubtask.trim(), completed: false }];
    const res = await tasksAPI.updateSubtasks(taskId, subtasks);
    setTask((t) => ({ ...t, subtasks: res.data.subtasks }));
    setNewSubtask('');
    bumpActivity();
  };

  const addTag = async () => {
    const tag = tagInput.trim();
    if (!tag || task.tags?.includes(tag)) return;
    const tags = [...(task.tags || []), tag];
    await patchTask({ tags }, true);
    setTagInput('');
  };

  const removeTag = async (tag) => {
    const tags = (task.tags || []).filter((t) => t !== tag);
    await patchTask({ tags }, true);
  };

  const handleDelete = async () => {
    if (!confirm('Delete this task permanently?')) return;
    try {
      await tasksAPI.remove(taskId);
      toast.success('Task deleted');
      onDeleted?.(taskId);
      onClose?.();
    } catch {
      toast.error('Failed to delete task');
    }
  };

  const syncMentionState = (value, cursorPosition) => {
    const nextState = findMentionTrigger(value, cursorPosition);
    setMentionState(nextState);
    if (!nextState) {
      setActiveMentionIndex(0);
    }
  };

  const handleCommentChange = (e) => {
    const { value, selectionStart } = e.target;
    setCommentText(value);
    syncMentionState(value, selectionStart ?? value.length);
  };

  const handleCommentSelection = (e) => {
    syncMentionState(e.currentTarget.value, e.currentTarget.selectionStart ?? 0);
  };

  const applyMention = (member) => {
    if (!mentionState) return;

    const nextValue =
      commentText.slice(0, mentionState.start) +
      `@${member.name} ` +
      commentText.slice(mentionState.end);
    const nextCursor = mentionState.start + member.name.length + 2;

    setCommentText(nextValue);
    setMentionState(null);
    setActiveMentionIndex(0);

    requestAnimationFrame(() => {
      if (!commentInputRef.current) return;
      commentInputRef.current.focus();
      commentInputRef.current.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleCommentKeyDown = (e) => {
    if (!mentionSuggestions.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveMentionIndex((current) => (current + 1) % mentionSuggestions.length);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveMentionIndex((current) =>
        current === 0 ? mentionSuggestions.length - 1 : current - 1
      );
      return;
    }

    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      applyMention(mentionSuggestions[activeMentionIndex]);
      return;
    }

    if (e.key === 'Escape') {
      setMentionState(null);
    }
  };

  if (!open) return null;

  const statusLabel =
    statusOptions.find((s) => s.id === task?.status)?.label || task?.status || '—';
  const completedSubtasks = task?.subtasks?.filter((s) => s.completed).length || 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 sm:p-6 overflow-y-auto">
      <button
        type="button"
        className="fixed inset-0 bg-surface-900/50 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-surface-200 flex flex-col max-h-[92vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-200 border-t-primary-600" />
          </div>
        ) : !task ? (
          <p className="p-8 text-surface-500">Task not found.</p>
        ) : (
          <>
            {/* Header — status + actions */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-surface-200 flex-shrink-0">
              <select
                className="text-sm font-semibold rounded-lg border border-surface-200 bg-surface-50 px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-primary-200"
                value={task.status}
                onChange={(e) => handleStatusChange(e.target.value)}
              >
                {statusOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
                {!statusOptions.some((s) => s.id === task.status) && (
                  <option value={task.status}>{task.status}</option>
                )}
              </select>
              <span className="text-xs text-surface-400 truncate hidden sm:inline">
                {task.project?.name}
              </span>
              <div className="ml-auto flex items-center gap-1">
                {canManage && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="p-2 rounded-lg text-surface-400 hover:text-red-600 hover:bg-red-50"
                    title="Delete task"
                  >
                    🗑
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-lg text-surface-500 hover:bg-surface-100 text-xl leading-none"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
              {/* Left — details & actions */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 min-h-0">
                <div className="flex items-start gap-3 mb-4">
                  <span
                    className="mt-1 w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs"
                    style={{ borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)' }}
                    title={statusLabel}
                  >
                    ○
                  </span>
                  {editingTitle ? (
                    <textarea
                      className="flex-1 text-xl font-bold text-surface-900 border border-primary-300 rounded-lg p-2 focus:outline-none focus:ring-2 min-h-[3rem] resize-none"
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onBlur={saveTitle}
                      autoFocus
                      rows={2}
                    />
                  ) : (
                    <h2
                      className="flex-1 text-xl font-bold text-surface-900 cursor-text hover:bg-surface-50 rounded-lg px-1 -mx-1"
                      onClick={() => setEditingTitle(true)}
                    >
                      {task.title}
                    </h2>
                  )}
                </div>

                {/* Quick actions */}
                <div className="flex flex-wrap gap-1 mb-6 relative">
                  <div className="relative">
                    <ActionChip
                      icon="📅"
                      label={task.dueDate ? formatDate(task.dueDate) : 'Dates'}
                      active={activePanel === 'dates'}
                      onClick={() => setActivePanel(activePanel === 'dates' ? null : 'dates')}
                    />
                    <PopoverPanel open={activePanel === 'dates'} onClose={() => setActivePanel(null)} title="Dates">
                      <label className="flex items-center gap-2 text-sm mb-3">
                        <input
                          type="checkbox"
                          checked={dueEnabled}
                          onChange={(e) => setDueEnabled(e.target.checked)}
                          className="rounded text-primary-600"
                        />
                        Due date
                      </label>
                      {dueEnabled && (
                        <>
                          <MonthCalendar value={dueDraft} onChange={setDueDraft} />
                          <input
                            type="date"
                            className="input mt-3 text-sm"
                            value={dueDraft}
                            onChange={(e) => setDueDraft(e.target.value)}
                          />
                        </>
                      )}
                      <div className="flex flex-col gap-2 mt-4">
                        <button type="button" className="btn-primary text-sm w-full" onClick={saveDueDate}>
                          Save
                        </button>
                        {task.dueDate && (
                          <button
                            type="button"
                            className="btn-secondary text-sm w-full"
                            onClick={() => {
                              setDueEnabled(false);
                              setDueDraft('');
                              patchTask({ dueDate: null }, true).then(() => setActivePanel(null));
                            }}
                          >
                            Remove dates
                          </button>
                        )}
                      </div>
                    </PopoverPanel>
                  </div>

                  <div className="relative">
                    <ActionChip
                      icon="⏱"
                      label={`${task.loggedHours?.toFixed(1) || 0}h tracked`}
                      active={activePanel === 'time'}
                      onClick={() => setActivePanel(activePanel === 'time' ? null : 'time')}
                    />
                    <PopoverPanel
                      open={activePanel === 'time'}
                      onClose={() => setActivePanel(null)}
                      className="!min-w-[320px]"
                    >
                      <TaskTimer
                        taskId={taskId}
                        projectId={task.project?._id || task.project}
                        totalLoggedHours={task.loggedHours}
                        onTimeLogged={onTimeLogged}
                        embedded
                      />
                    </PopoverPanel>
                  </div>

                  <div className="relative">
                    <ActionChip
                      icon="👤"
                      label={task.assignee?.name?.split(' ')[0] || 'Members'}
                      active={activePanel === 'members'}
                      onClick={() => setActivePanel(activePanel === 'members' ? null : 'members')}
                    />
                    <PopoverPanel open={activePanel === 'members'} onClose={() => setActivePanel(null)} title="Assign member">
                      {team.length === 0 ? (
                        <p className="text-sm text-surface-500 mb-2">
                          No users found. Add users under <strong>Team</strong> in the sidebar.
                        </p>
                      ) : (
                        <ul className="space-y-1 max-h-52 overflow-y-auto">
                          <li>
                            <button
                              type="button"
                              onClick={() => assignMember(null)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-surface-100 ${
                                !getAssigneeId(task.assignee) ? 'bg-primary-50 text-primary-800 font-medium' : 'text-surface-700'
                              }`}
                            >
                              Unassigned
                            </button>
                          </li>
                          {team.map((m) => {
                            const mid = m._id?.toString?.() || m._id;
                            const selected = getAssigneeId(task.assignee) === mid;
                            return (
                              <li key={mid}>
                                <button
                                  type="button"
                                  onClick={() => assignMember(mid)}
                                  className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-surface-100 flex items-center gap-2 ${
                                    selected ? 'bg-primary-50 text-primary-800 font-medium' : 'text-surface-700'
                                  }`}
                                >
                                  <span
                                    className="w-7 h-7 rounded-full text-white text-xs flex items-center justify-center font-bold flex-shrink-0"
                                    style={{ backgroundColor: 'var(--brand-primary)' }}
                                  >
                                    {m.name?.charAt(0).toUpperCase()}
                                  </span>
                                  <span>
                                    {m.name}
                                    <span className="text-surface-400 capitalize"> · {m.role}</span>
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </PopoverPanel>
                  </div>

                  <div className="relative">
                    <ActionChip
                      icon="🏷"
                      label={task.priority}
                      active={activePanel === 'labels'}
                      onClick={() => setActivePanel(activePanel === 'labels' ? null : 'labels')}
                    />
                    <PopoverPanel open={activePanel === 'labels'} onClose={() => setActivePanel(null)} title="Labels">
                      <p className="text-xs text-surface-500 mb-2">Priority</p>
                      <div className="flex gap-2 mb-4">
                        {['low', 'medium', 'high'].map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => patchTask({ priority: p }, true)}
                            className={`badge capitalize cursor-pointer ${PRIORITY_COLORS[p]} ${
                              task.priority === p ? 'ring-2 ring-offset-1 ring-surface-400' : 'opacity-70'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-surface-500 mb-2">Tags</p>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {(task.tags || []).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 text-xs bg-surface-100 px-2 py-1 rounded-full"
                          >
                            {tag}
                            <button type="button" className="text-surface-400 hover:text-red-500" onClick={() => removeTag(tag)}>×</button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          className="input text-sm flex-1"
                          placeholder="Add tag…"
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                        />
                        <button type="button" className="btn-secondary text-sm" onClick={addTag}>Add</button>
                      </div>
                    </PopoverPanel>
                  </div>

                  <ActionChip
                    icon="☑"
                    label={
                      task.subtasks?.length
                        ? `Checklist ${completedSubtasks}/${task.subtasks.length}`
                        : 'Checklist'
                    }
                    active={activePanel === 'checklist'}
                    onClick={() => setActivePanel(activePanel === 'checklist' ? null : 'checklist')}
                  />
                </div>

                {/* Checklist inline when open */}
                {activePanel === 'checklist' && (
                  <div className="mb-6 p-4 rounded-xl border border-surface-200 bg-surface-50/50">
                    <h3 className="text-sm font-semibold text-surface-800 mb-3 flex items-center gap-2">
                      <span>☑</span> Checklist
                      {task.subtasks?.length > 0 && (
                        <span className="text-surface-400 font-normal">
                          {Math.round((completedSubtasks / task.subtasks.length) * 100)}%
                        </span>
                      )}
                    </h3>
                    {task.subtasks?.length > 0 && (
                      <div className="w-full bg-surface-200 rounded-full h-1.5 mb-3">
                        <div
                          className="h-1.5 rounded-full bg-primary-600"
                          style={{
                            width: `${(completedSubtasks / task.subtasks.length) * 100}%`,
                          }}
                        />
                      </div>
                    )}
                    <div className="space-y-1 mb-3">
                      {(task.subtasks || []).map((sub, i) => (
                        <label
                          key={i}
                          className="flex items-center gap-2 p-2 rounded-lg hover:bg-white cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={sub.completed}
                            onChange={() => handleSubtaskToggle(i)}
                            className="rounded text-primary-600"
                          />
                          <span className={`text-sm ${sub.completed ? 'line-through text-surface-400' : 'text-surface-800'}`}>
                            {sub.title}
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        className="input text-sm flex-1"
                        placeholder="Add an item…"
                        value={newSubtask}
                        onChange={(e) => setNewSubtask(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
                      />
                      <button type="button" className="btn-secondary text-sm" onClick={addSubtask}>Add</button>
                    </div>
                  </div>
                )}

                {/* Description */}
                <section className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-surface-700 flex items-center gap-2">
                      <span className="text-surface-400">≡</span> Description
                    </h3>
                    {!editingDesc && (
                      <button
                        type="button"
                        className="text-sm text-surface-500 hover:text-primary-600 font-medium"
                        onClick={() => {
                          setDescDraft(task.description || '');
                          setEditingDesc(true);
                        }}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {editingDesc ? (
                    <div>
                      <textarea
                        className="input min-h-[120px] text-sm"
                        value={descDraft}
                        onChange={(e) => setDescDraft(e.target.value)}
                        placeholder="Add a more detailed description…"
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2">
                        <button type="button" className="btn-primary text-sm" onClick={saveDescription}>Save</button>
                        <button
                          type="button"
                          className="btn-secondary text-sm"
                          onClick={() => {
                            setEditingDesc(false);
                            setDescDraft(task.description || '');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="text-sm text-surface-600 whitespace-pre-wrap rounded-lg p-3 min-h-[4rem] cursor-text hover:bg-surface-50 border border-transparent hover:border-surface-200"
                      onClick={() => {
                        setDescDraft(task.description || '');
                        setEditingDesc(true);
                      }}
                    >
                      {task.description || (
                        <span className="text-surface-400">Add a more detailed description…</span>
                      )}
                    </div>
                  )}
                </section>

                {/* Tags display */}
                {/* {(task.tags?.length > 0 || task.priority) && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className={`badge ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
                    {task.tags?.map((tag) => (
                      <span key={tag} className="text-xs bg-surface-100 text-surface-600 px-2 py-1 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )} */}

                {/* Attachments */}
                {task.attachments?.length > 0 && (
                  <section className="mb-4">
                    <h3 className="text-sm font-semibold text-surface-700 mb-2">Attachments</h3>
                    <div className="space-y-1">
                      {task.attachments.map((att, i) => (
                        <a
                          key={i}
                          href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || ''}${att.path}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 text-sm text-primary-600 hover:underline"
                        >
                          📎 {att.originalname}
                        </a>
                      ))}
                    </div>
                  </section>
                )}

                {/* Recent time entries */}
                {timeLogs.length > 0 && (
                  <section>
                    <h3 className="text-sm font-semibold text-surface-700 mb-2">Time logged</h3>
                    <ul className="text-sm text-surface-600 space-y-1">
                      {timeLogs.slice(0, 5).map((log) => (
                        <li key={log._id} className="flex justify-between">
                          <span>{log.user?.name} — {log.description || 'Session'}</span>
                          <span className="font-medium">{log.hours}h</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>

              {/* Right — comments & activity */}
              <div className="w-full lg:w-[340px] flex-shrink-0 border-t lg:border-t-0 lg:border-l border-surface-200 bg-surface-50/80 flex flex-col min-h-[280px] lg:max-h-none overflow-hidden">
                <div className="px-4 py-3 border-b border-surface-200 flex items-center justify-between flex-shrink-0">
                  <h3 className="text-sm font-semibold text-surface-800">Comments and activity</h3>
                  <button
                    type="button"
                    className="text-xs font-medium text-primary-600 hover:underline"
                    onClick={() => setShowActivityDetails((v) => !v)}
                  >
                    {showActivityDetails ? 'Hide details' : 'Show details'}
                  </button>
                </div>

                <div className="p-4 flex-shrink-0 border-b border-surface-200">
                  <form onSubmit={submitComment}>
                    <div className="relative">
                      <textarea
                        ref={commentInputRef}
                        className="input text-sm min-h-[72px] resize-none"
                        placeholder="Write a comment... Use @ to mention a teammate"
                        value={commentText}
                        onChange={handleCommentChange}
                        onClick={handleCommentSelection}
                        onKeyUp={handleCommentSelection}
                        onKeyDown={handleCommentKeyDown}
                      />
                      {mentionSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-2 rounded-xl border border-surface-200 bg-white shadow-premium-lg overflow-hidden z-20">
                          {mentionSuggestions.map((member, index) => {
                            const memberId = member._id?.toString?.() || member._id;
                            return (
                              <button
                                key={memberId}
                                type="button"
                                className={`w-full px-3 py-2 text-left flex items-center gap-3 hover:bg-surface-50 ${
                                  index === activeMentionIndex ? 'bg-primary-50 text-primary-800' : 'text-surface-700'
                                }`}
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  applyMention(member);
                                }}
                              >
                                <span
                                  className="w-8 h-8 rounded-full text-white text-xs flex items-center justify-center font-bold flex-shrink-0"
                                  style={{ backgroundColor: 'var(--brand-primary)' }}
                                >
                                  {getInitials(member.name)}
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-sm font-medium truncate">{member.name}</span>
                                  <span className="block text-xs text-surface-400 truncate">{member.email || member.role}</span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-surface-400">Type @ to mention a teammate and send them a notification.</p>
                    <button
                      type="submit"
                      disabled={submittingComment || !commentText.trim()}
                      className="btn-primary text-sm mt-2 w-full disabled:opacity-50"
                    >
                      {submittingComment ? 'Saving…' : 'Save'}
                    </button>
                  </form>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
                  <CombinedFeed
                    taskId={taskId}
                    comments={comments}
                    activities={activities}
                    showDetails={showActivityDetails}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
