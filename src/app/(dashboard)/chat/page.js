'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { chatAPI, usersAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import usePermission from '@/hooks/usePermission';
import toast from 'react-hot-toast';

function initials(name = '') {
  return String(name)
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatTime(v) {
  if (!v) return '';
  return new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const { can: canRead } = usePermission('chat', 'read');
  const { can: canCreate } = usePermission('chat', 'create');

  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [people, setPeople] = useState([]);
  const [showComposer, setShowComposer] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [search, setSearch] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionAnchor, setMentionAnchor] = useState(-1);
  const [mentionCursor, setMentionCursor] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);

  const bottomRef = useRef(null);
  const messageInputRef = useRef(null);
  const activeConversationIdRef = useRef('');

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c._id === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const title = (c.title || '').toLowerCase();
      const names = (c.participants || []).map((p) => (p.name || '').toLowerCase()).join(' ');
      return title.includes(q) || names.includes(q);
    });
  }, [conversations, search]);

  const refreshConversations = async () => {
    const res = await chatAPI.getConversations();
    const list = res.data.conversations || [];
    setConversations(list);
    setActiveConversationId((prev) => {
      if (prev && list.some((c) => c._id === prev)) return prev;
      return list.length > 0 ? list[0]._id : '';
    });
  };

  const loadMessages = async (conversationId) => {
    if (!conversationId) return;
    const res = await chatAPI.getMessages(conversationId, { limit: 100 });
    setMessages(res.data.messages || []);
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  useEffect(() => {
    if (!canRead) return;
    let mounted = true;
    const init = async () => {
      setLoading(true);
      try {
        await refreshConversations();
        if (canCreate) {
          const users = await usersAPI.getAll({ limit: 200 });
          if (mounted) setPeople((users.data.users || []).filter((u) => u._id !== user?._id && u.isActive));
        }
      } catch {
        toast.error('Failed to load chat data');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    init();

    // Lightweight polling to keep chat updated without websocket setup.
    const timer = setInterval(async () => {
      try {
        await refreshConversations();
        if (activeConversationIdRef.current) await loadMessages(activeConversationIdRef.current);
      } catch (_) {
        // silent polling failure
      }
    }, 8000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [canRead, canCreate, user?._id]);

  useEffect(() => {
    const requested = searchParams.get('conversation');
    if (!requested || !conversations.length) return;
    if (conversations.some((c) => c._id === requested)) {
      setActiveConversationId(requested);
    }
  }, [searchParams, conversations]);

  useEffect(() => {
    if (!activeConversationId) return;
    loadMessages(activeConversationId);
  }, [activeConversationId]);

  const activeParticipants = useMemo(() => {
    return (activeConversation?.participants || []).filter((p) => p && p._id !== user?._id);
  }, [activeConversation, user?._id]);

  const mentionCandidates = useMemo(() => {
    if (!mentionQuery && !mentionOpen) return [];
    const q = mentionQuery.toLowerCase();
    return activeParticipants
      .map((p) => ({
        ...p,
        handle: String(p.name || '').trim().toLowerCase().replace(/\s+/g, '.'),
      }))
      .filter((p) => !q || p.name?.toLowerCase().includes(q) || p.handle.includes(q))
      .slice(0, 8);
  }, [activeParticipants, mentionQuery, mentionOpen]);

  const extractMentionIds = (text) => {
    const handleMap = new Map(
      activeParticipants.map((p) => [String(p.name || '').trim().toLowerCase().replace(/\s+/g, '.'), p._id])
    );
    const ids = new Set();
    const matches = String(text).matchAll(/@([a-z0-9._-]+)/gi);
    for (const m of matches) {
      const handle = String(m[1] || '').toLowerCase();
      const id = handleMap.get(handle);
      if (id) ids.add(id);
    }
    return Array.from(ids);
  };

  const refreshMentionState = (text, cursorPos) => {
    const left = String(text || '').slice(0, cursorPos);
    const atPos = left.lastIndexOf('@');
    if (atPos < 0) {
      setMentionOpen(false);
      setMentionQuery('');
      setMentionAnchor(-1);
      return;
    }
    const before = atPos === 0 ? ' ' : left[atPos - 1];
    if (!/\s/.test(before)) {
      setMentionOpen(false);
      return;
    }
    const token = left.slice(atPos + 1);
    if (/\s/.test(token)) {
      setMentionOpen(false);
      return;
    }
    setMentionOpen(true);
    setMentionQuery(token);
    setMentionAnchor(atPos);
    setMentionCursor(cursorPos);
    setMentionIndex(0);
  };

  const insertMention = (candidate) => {
    const handle = String(candidate.handle || '').trim();
    if (!handle || mentionAnchor < 0) return;
    const before = newMessage.slice(0, mentionAnchor);
    const after = newMessage.slice(mentionCursor);
    const next = `${before}@${handle} ${after}`;
    setNewMessage(next);
    setMentionOpen(false);
    requestAnimationFrame(() => {
      const pos = before.length + handle.length + 2;
      messageInputRef.current?.focus();
      messageInputRef.current?.setSelectionRange(pos, pos);
    });
  };

  const sendMessage = async () => {
    const body = newMessage.trim();
    if (!body || !activeConversationId || !canCreate) return;
    setSending(true);
    try {
      const mentionIds = extractMentionIds(newMessage);
      const res = await chatAPI.sendMessage(activeConversationId, { body, mentionIds });
      setMessages((prev) => [...prev, res.data.message]);
      setNewMessage('');
      setMentionOpen(false);
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
      await refreshConversations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const leaveActiveConversation = async () => {
    if (!activeConversationId) return;
    if (!confirm('Leave this chat conversation?')) return;
    try {
      await chatAPI.leaveConversation(activeConversationId);
      toast.success('You left the conversation');
      setShowMembers(false);
      setMessages([]);
      await refreshConversations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to leave conversation');
    }
  };

  const createConversation = async () => {
    if (!canCreate) return;
    if (selectedUserIds.length === 0) {
      toast.error('Select at least one participant');
      return;
    }
    try {
      const isDirect = selectedUserIds.length === 1;
      const res = await chatAPI.createConversation({
        title: isDirect ? '' : newChatTitle.trim(),
        participantIds: selectedUserIds,
        type: isDirect ? 'direct' : 'group',
      });
      const c = res.data.conversation;
      setShowComposer(false);
      setNewChatTitle('');
      setSelectedUserIds([]);
      await refreshConversations();
      setActiveConversationId(c._id);
      toast.success(res.data.reused ? 'Opened existing direct chat' : 'Conversation created');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create conversation');
    }
  };

  if (!canRead) {
    return (
      <div className="card p-8 text-center">
        <h2 className="text-lg font-semibold text-gray-900">No Chat Access</h2>
        <p className="text-sm text-gray-500 mt-1">Your role does not have permission to view chat conversations.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-[var(--brand-primary)]" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
      <aside className="card flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-bold text-gray-900">Team Chat</h1>
            {canCreate && (
              <button className="btn-primary text-xs py-1.5" onClick={() => setShowComposer((v) => !v)}>
                {showComposer ? 'Close' : 'New Chat'}
              </button>
            )}
          </div>
          <input
            className="input mt-3"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {showComposer && canCreate && (
          <div className="p-3 border-b border-gray-100 space-y-3 bg-gray-50">
            <input
              className="input"
              placeholder="Group title (optional for direct chat)"
              value={newChatTitle}
              onChange={(e) => setNewChatTitle(e.target.value)}
            />
            <div className="max-h-40 overflow-auto space-y-1">
              {people.map((p) => {
                const checked = selectedUserIds.includes(p._id);
                return (
                  <label key={p._id} className="flex items-center gap-2 text-sm text-gray-700 px-2 py-1 rounded hover:bg-white">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUserIds((prev) => [...prev, p._id]);
                        } else {
                          setSelectedUserIds((prev) => prev.filter((id) => id !== p._id));
                        }
                      }}
                    />
                    <span>{p.name}</span>
                    <span className="text-xs text-gray-400">{p.role}</span>
                  </label>
                );
              })}
            </div>
            <button className="btn-primary w-full" onClick={createConversation}>Create Conversation</button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 && (
            <p className="text-sm text-gray-400 p-4">No conversations found</p>
          )}
          {filteredConversations.map((c) => {
            const active = c._id === activeConversationId;
            const others = (c.participants || []).filter((p) => p._id !== user?._id);
            const title = c.type === 'group' ? (c.title || 'Untitled Group') : (others[0]?.name || 'Direct Chat');
            return (
              <button
                key={c._id}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors ${active ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                onClick={() => setActiveConversationId(c._id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-sm text-gray-900 truncate">{title}</div>
                  <span className="text-[11px] text-gray-400">{formatTime(c.lastMessageAt || c.updatedAt)}</span>
                </div>
                <div className="text-xs text-gray-500 truncate mt-0.5">
                  {others.map((p) => p.name).join(', ') || 'Only you'}
                </div>
                <div className="text-[11px] text-gray-400 mt-1">{(c.participants || []).length} member(s)</div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="card flex flex-col overflow-hidden">
        {!activeConversation ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">Select a conversation</div>
        ) : (
          <>
            <header className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[var(--brand-primary)] text-white flex items-center justify-center text-xs font-bold">
                {initials(activeConversation.type === 'group' ? activeConversation.title : activeConversation.participants?.find((p) => p._id !== user?._id)?.name || 'C')}
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-gray-900">
                  {activeConversation.type === 'group'
                    ? (activeConversation.title || 'Untitled Group')
                    : (activeConversation.participants?.find((p) => p._id !== user?._id)?.name || 'Direct Chat')}
                </h2>
                <p className="text-xs text-gray-400">
                  {(activeConversation.participants || []).length} member(s)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-secondary text-xs py-1.5"
                  onClick={() => setShowMembers(true)}
                >
                  Members
                </button>
                <button
                  type="button"
                  className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition"
                  onClick={leaveActiveConversation}
                >
                  Leave Chat
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-white to-slate-50">
              {messages.length === 0 && (
                <p className="text-sm text-gray-400">No messages yet. Start the conversation.</p>
              )}
              {messages.map((m) => {
                const mine = m.sender?._id === user?._id;
                return (
                  <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 shadow-sm ${mine ? 'bg-[var(--brand-primary)] text-white' : 'bg-white text-gray-800 border border-gray-200'}`}>
                      <div className={`text-[11px] mb-1 ${mine ? 'text-white/80' : 'text-gray-400'}`}>
                        {m.sender?.name || 'Unknown'} · {formatTime(m.createdAt)}
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                      {!!m.mentions?.length && (
                        <div className={`mt-1 text-[11px] ${mine ? 'text-white/80' : 'text-indigo-600'}`}>
                          Mentioned: {m.mentions.map((x) => x.name).join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <footer className="p-3 border-t border-gray-100 flex items-center gap-2">
              <div className="relative flex-1">
              <input
                ref={messageInputRef}
                className="input"
                placeholder={canCreate ? 'Type a message... Use @name to mention' : 'You do not have send permission'}
                value={newMessage}
                disabled={!canCreate}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  refreshMentionState(e.target.value, e.target.selectionStart ?? e.target.value.length);
                }}
                onClick={(e) => {
                  refreshMentionState(newMessage, e.currentTarget.selectionStart ?? newMessage.length);
                }}
                onKeyDown={(e) => {
                  if (mentionOpen && mentionCandidates.length > 0) {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setMentionIndex((i) => (i + 1) % mentionCandidates.length);
                      return;
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setMentionIndex((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length);
                      return;
                    }
                    if (e.key === 'Tab' || e.key === 'Enter') {
                      e.preventDefault();
                      insertMention(mentionCandidates[mentionIndex] || mentionCandidates[0]);
                      return;
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setMentionOpen(false);
                      return;
                    }
                  }
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              {mentionOpen && mentionCandidates.length > 0 && canCreate && (
                <div className="absolute left-0 right-0 bottom-12 bg-white border border-gray-200 rounded-xl shadow-lg p-1 z-20 max-h-56 overflow-auto">
                  {mentionCandidates.map((candidate, idx) => (
                    <button
                      key={candidate._id}
                      type="button"
                      onClick={() => insertMention(candidate)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${idx === mentionIndex ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}`}
                    >
                      <div className="font-medium">{candidate.name}</div>
                      <div className="text-xs text-gray-400">@{candidate.handle}</div>
                    </button>
                  ))}
                </div>
              )}
              </div>
              <button className="btn-primary" disabled={!canCreate || sending || !newMessage.trim()} onClick={sendMessage}>
                {sending ? 'Sending...' : 'Send'}
              </button>
            </footer>
          </>
        )}
      </section>

      {showMembers && activeConversation && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Conversation Members</h3>
                <p className="text-xs text-gray-400">{(activeConversation.participants || []).length} member(s)</p>
              </div>
              <button type="button" className="text-gray-400 hover:text-gray-700" onClick={() => setShowMembers(false)}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-[420px] overflow-auto p-3 space-y-2">
              {(activeConversation.participants || []).map((member) => (
                <div key={member._id} className="px-3 py-2 rounded-xl border border-gray-100 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--brand-primary)] text-white flex items-center justify-center text-xs font-semibold">
                    {initials(member.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">{member.name}</div>
                    <div className="text-xs text-gray-400 truncate">{member.email}</div>
                  </div>
                  <span className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-600 capitalize">{member.role?.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
