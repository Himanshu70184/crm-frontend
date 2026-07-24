'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { chatAPI, usersAPI, getAssetUrl } from '@/lib/api';
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

function dateKey(v) {
  const d = new Date(v);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDateLabel(v) {
  const d = new Date(v);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (dateKey(d) === dateKey(today)) return 'Today';
  if (dateKey(d) === dateKey(yesterday)) return 'Yesterday';

  const sameYear = d.getFullYear() === today.getFullYear();
  return d.toLocaleDateString([], {
    day: 'numeric',
    month: 'long',
    year: sameYear ? undefined : 'numeric',
  });
}

// Groups a flat, chronologically-sorted message list into { dateLabel, messages[] } buckets
function groupMessagesByDate(messages) {
  const groups = [];
  let currentKey = null;
  for (const m of messages) {
    const key = dateKey(m.createdAt);
    if (key !== currentKey) {
      groups.push({ dateLabel: formatDateLabel(m.createdAt), messages: [m] });
      currentKey = key;
    } else {
      groups[groups.length - 1].messages.push(m);
    }
  }
  return groups;
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const URL_REGEX = /((?:https?:\/\/|www\.)[^\s<]+[^\s<.,:;"')\]])/gi;

// Splits message text around URLs, rendering plain text as-is and URLs as
// clickable links (open in a new tab) with an adjacent copy-link button.
function linkifyMessage(text, mine, onCopyLink) {
  if (!text) return null;
  const regex = new RegExp(URL_REGEX);
  const parts = [];
  let lastIndex = 0;
  let match;
  let idx = 0;

  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    const start = match.index;
    if (start > lastIndex) {
      parts.push(<span key={`t-${idx}`}>{text.slice(lastIndex, start)}</span>);
    }
    const href = raw.startsWith('http') ? raw : `https://${raw}`;
    parts.push(
      <span key={`l-${idx}`} className="inline-flex items-center gap-1 align-middle">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`underline break-all ${mine ? 'text-white' : 'text-[var(--brand-primary)]'}`}
        >
          {raw}
        </a>
        <button
          type="button"
          title="Copy link"
          onClick={(e) => {
            e.stopPropagation();
            onCopyLink(href);
          }}
          className={`inline-flex shrink-0 ${mine ? 'text-white/80 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      </span>
    );
    lastIndex = start + raw.length;
    idx++;
  }

  if (lastIndex < text.length) {
    parts.push(<span key="t-final">{text.slice(lastIndex)}</span>);
  }
  return parts;
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
  const messagesContainerRef = useRef(null);
  const contentRef = useRef(null);
  // Mirrors `atBottom` state into a ref so async code (the 8s polling loop,
  // load callbacks) can read the latest value without stale closures, while
  // `atBottom` itself drives the floating "jump to bottom" button's visibility.
  const isNearBottomRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  // Tracks how many messages we last rendered, so when a poll or reply comes
  // back we can tell how many are new instead of guessing from array length.
  const prevMessageCountRef = useRef(0);
  const messageInputRef = useRef(null);
  const activeConversationIdRef = useRef('');
  const fileInputRef = useRef(null);

  const [pendingFiles, setPendingFiles] = useState([]); // [{ file, previewUrl, kind }]
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const [editingMessage, setEditingMessage] = useState(null); // the message object being edited, or null
  const [replyingTo, setReplyingTo] = useState(null); // the message object being replied to, or null
  const [lightbox, setLightbox] = useState(null); // { url, kind } or null
  const [savingEdit, setSavingEdit] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState('');

  const messageGroups = useMemo(() => groupMessagesByDate(messages), [messages]);

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
    const list = [...(res.data.conversations || [])].sort((a, b) => {
      const aTime = new Date(a.lastMessageAt || a.updatedAt || a.createdAt).getTime();
      const bTime = new Date(b.lastMessageAt || b.updatedAt || b.createdAt).getTime();
      return bTime - aTime; // newest activity first
    });
    setConversations(list);
    setActiveConversationId((prev) => {
      if (prev && list.some((c) => c._id === prev)) return prev;
      // list[0] is now guaranteed to be the most recently active
      // conversation, not just whatever the backend happened to return first.
      return list.length > 0 ? list[0]._id : '';
    });
  };

  // Central place to update "am I at the bottom" — keeps the ref (for async
  // reads) and the state (for rendering the button) in sync, and clears the
  // unread badge the moment the user arrives back at the bottom.
  const setNearBottom = (val) => {
    isNearBottomRef.current = val;
    setAtBottom(val);
    if (val) setUnreadCount(0);
  };

  const scrollToBottom = (behavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
    setNearBottom(true);
  };

  // Attachment images/videos finish loading asynchronously, after the
  // message list has already rendered and any scroll-to-bottom call has
  // already run. That late height change was leaving the view stranded
  // above the real bottom (looking like it "opened on an old message").
  // A ResizeObserver on the message content re-anchors to the bottom
  // whenever its height changes — but only while the user is already at
  // (or was just brought to) the bottom, so it never fights someone who's
  // deliberately scrolled up to read older messages.
  useEffect(() => {
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (isNearBottomRef.current) {
        bottomRef.current?.scrollIntoView({ behavior: 'auto' });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Belt-and-suspenders alongside the ResizeObserver above: explicitly find
  // every image/video in the current message list that hasn't finished
  // loading yet, and re-run the scroll-to-bottom the instant each one does.
  // This removes any dependency on ResizeObserver support/timing quirks —
  // it directly targets the actual cause (media loading after the initial
  // render) rather than inferring it from a layout-size change.
  useEffect(() => {
    if (!isNearBottomRef.current) return;
    const container = messagesContainerRef.current;
    if (!container) return;

    const doScroll = () => bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    doScroll();

    const mediaEls = container.querySelectorAll('img, video');
    const cleanups = [];
    mediaEls.forEach((el) => {
      const isImg = el.tagName === 'IMG';
      const alreadyLoaded = isImg ? el.complete : el.readyState >= 1;
      if (alreadyLoaded) return;
      const evt = isImg ? 'load' : 'loadedmetadata';
      const handler = () => {
        if (isNearBottomRef.current) doScroll();
      };
      el.addEventListener(evt, handler);
      cleanups.push(() => el.removeEventListener(evt, handler));
    });

    return () => cleanups.forEach((fn) => fn());
  }, [messages]);

  const loadMessages = async (conversationId, { forceScroll = false } = {}) => {
    if (!conversationId) return;
    const res = await chatAPI.getMessages(conversationId, { limit: 100 });
    // Force chronological (oldest → newest) order regardless of what the
    // API returns. Many "recent messages" endpoints return newest-first for
    // pagination purposes; if we render that raw order, the newest message
    // ends up at the TOP of the list and the oldest at the BOTTOM — so
    // "scroll to bottom" was correctly landing on the true last DOM item,
    // which was actually the oldest fetched message, not the newest.
    const newMessages = [...(res.data.messages || [])].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );
    const added = newMessages.length - prevMessageCountRef.current;
    setMessages(newMessages);
    prevMessageCountRef.current = newMessages.length;

    if (forceScroll) {
      // Opening a conversation for the first time — always land at the bottom.
      requestAnimationFrame(() => scrollToBottom('auto'));
      return;
    }
    // Never yank the user's scroll position. If they're already sitting at
    // the bottom, keep following new messages automatically. Otherwise,
    // just bump the unread badge on the floating "jump to bottom" button.
    if (added > 0) {
      if (isNearBottomRef.current) {
        requestAnimationFrame(() => scrollToBottom('smooth'));
      } else {
        setUnreadCount((c) => c + added);
      }
    }
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
    prevMessageCountRef.current = 0;
    setUnreadCount(0);
    setNearBottom(true);
    loadMessages(activeConversationId, { forceScroll: true });
  }, [activeConversationId]);

  // Scrolls to a message by id and briefly highlights it. Used both for the
  // "you were mentioned" notification deep-link (?conversation=...&message=...)
  // and for clicking a reply-preview to jump to the original message.
  const jumpToMessage = (id) => {
    if (!id) return;
    const el = document.getElementById(`msg-${id}`);
    if (!el) {
      toast.error('Original message not loaded — try scrolling up to find it');
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageId(id);
    setTimeout(() => setHighlightedMessageId((current) => (current === id ? '' : current)), 2500);
  };

  useEffect(() => {
    const targetMessageId = searchParams.get('message');
    if (!targetMessageId || messages.length === 0) return;
    if (!messages.some((m) => m._id === targetMessageId)) return;
    requestAnimationFrame(() => jumpToMessage(targetMessageId));
  }, [messages, searchParams]);

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

  const MAX_FILE_MB = 100;
  const BLOCKED_EXTENSIONS = /\.(exe|bat|cmd|msi|dll|com|scr|jar|vbs|ps1|sh)$/i;

  const fileKind = (file) => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    return 'file';
  };

  const handleFilesPicked = async (fileList) => {
    const files = Array.from(fileList || []);
    const accepted = [];
    for (const file of files) {
      if (BLOCKED_EXTENSIONS.test(file.name)) {
        toast.error(`${file.name}: this file type is not allowed`);
        continue;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`${file.name}: exceeds ${MAX_FILE_MB}MB limit`);
        continue;
      }
      // Verify the file is actually readable. Cloud-sync placeholder files
      // (OneDrive/Google Drive "Files On-Demand" — shown in Explorer with a
      // cloud icon, not yet downloaded) report correct name/size and may
      // even serve a small partial read, but fail once the browser tries to
      // read the FULL file during upload — which is what breaks the actual
      // send with ERR_FILE_NOT_FOUND. So we fully read it here, upfront,
      // where a failure is caught cleanly instead of mid-upload.
      //
      // Drag-and-drop in particular can trigger a transient failure on the
      // very first read attempt (some cloud-sync clients only start
      // hydrating the real file content once the OS actually touches it),
      // so we retry once after a short delay before concluding the file is
      // genuinely unreadable.
      try {
        await file.arrayBuffer();
      } catch (err) {
        try {
          await new Promise((r) => setTimeout(r, 500));
          await file.arrayBuffer();
        } catch (err2) {
          console.error('File read failed:', file.name, err2?.name, err2?.message);
          toast.error(`${file.name}: couldn't read this file. If it's in OneDrive/Google Drive, make sure it's downloaded (not "online-only") and try again`);
          continue;
        }
      }
      const kind = fileKind(file);
      accepted.push({
        file,
        kind,
        // Object URLs are only needed to preview/play images & videos.
        previewUrl: kind === 'file' ? null : URL.createObjectURL(file),
      });
    }
    if (accepted.length) setPendingFiles((prev) => [...prev, ...accepted]);
  };

  // Uses a counter (not a boolean) because dragenter/dragleave fire for every
  // child element too — a plain boolean would flicker off when the pointer
  // crosses from the footer onto the input or attach button inside it.
  const handleDragEnter = (e) => {
    e.preventDefault();
    if (!canCreate) return;
    if (e.dataTransfer?.types?.includes('Files')) {
      dragCounter.current += 1;
      setIsDragging(true);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (!canCreate) return;

    // dataTransfer.files is the reliable, cross-browser source of the
    // actual dropped files — same mechanism the <input type="file"> picker
    // uses under the hood. We only use dataTransfer.items separately
    // (best-effort, not supported identically everywhere) to detect
    // dragged folders and show a clearer message; it does not affect which
    // files actually get processed.
    const items = e.dataTransfer.items;
    if (items && items.length) {
      const folderNames = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry && entry.isDirectory) folderNames.push(entry.name);
      }
      if (folderNames.length) {
        toast.error(`${folderNames.join(', ')}: folders can't be attached, only individual files`);
      }
    }

    handleFilesPicked(e.dataTransfer.files);
  };

  const removePendingFile = (idx) => {
    setPendingFiles((prev) => {
      const next = [...prev];
      const [removed] = next.splice(idx, 1);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  };

  const sendMessage = async () => {
    const body = newMessage.trim();
    if ((!body && pendingFiles.length === 0) || !activeConversationId || !canCreate) return;
    setSending(true);
    setUploading(pendingFiles.length > 0);
    try {
      const mentionIds = extractMentionIds(newMessage);
      const replyToId = replyingTo?._id || null;
      let res;
      if (pendingFiles.length > 0) {
        const formData = new FormData();
        formData.append('body', body || '');
        mentionIds.forEach((id) => formData.append('mentionIds[]', id));
        if (replyToId) formData.append('replyToId', replyToId);
        pendingFiles.forEach((pf) => formData.append('files', pf.file));
        res = await chatAPI.sendMessage(activeConversationId, formData);
      } else {
        res = await chatAPI.sendMessage(activeConversationId, { body, mentionIds, replyToId });
      }
      setMessages((prev) => {
        const next = [...prev, res.data.message];
        prevMessageCountRef.current = next.length;
        return next;
      });
      setNewMessage('');
      pendingFiles.forEach((pf) => pf.previewUrl && URL.revokeObjectURL(pf.previewUrl));
      setPendingFiles([]);
      setMentionOpen(false);
      setReplyingTo(null);
      requestAnimationFrame(() => scrollToBottom('smooth'));
      await refreshConversations();
    } catch (err) {
      if (!err.response && pendingFiles.length > 0) {
        toast.error('Upload failed while reading a file — if it\'s in OneDrive/Google Drive, make sure it\'s fully downloaded (not "online-only") and try again');
      } else {
        toast.error(err.response?.data?.message || 'Failed to send');
      }
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const startEdit = (message) => {
    setEditingMessage(message);
    setReplyingTo(null);
    setNewMessage(message.body || '');
    requestAnimationFrame(() => messageInputRef.current?.focus());
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setNewMessage('');
  };

  const submitEdit = async () => {
    const body = newMessage.trim();
    if (!body || !editingMessage) return;
    setSavingEdit(true);
    try {
      const mentionIds = extractMentionIds(newMessage);
      const res = await chatAPI.updateMessage(editingMessage._id, { body, mentionIds });
      setMessages((prev) => prev.map((m) => (m._id === res.data.message._id ? res.data.message : m)));
      setEditingMessage(null);
      setNewMessage('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save edit');
    } finally {
      setSavingEdit(false);
    }
  };

  const startReply = (message) => {
    setReplyingTo(message);
    setEditingMessage(null);
    requestAnimationFrame(() => messageInputRef.current?.focus());
  };

  const cancelReply = () => setReplyingTo(null);

  const deleteMessage = async (message) => {
    if (!confirm('Delete this message? This cannot be undone.')) return;
    try {
      await chatAPI.deleteMessage(message._id);
      setMessages((prev) => prev.filter((m) => m._id !== message._id));
      if (editingMessage?._id === message._id) cancelEdit();
      if (replyingTo?._id === message._id) cancelReply();
      toast.success('Message deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete message');
    }
  };

  const copyLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy link');
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

    const isDirect = selectedUserIds.length === 1;

    // Group chats must be named explicitly — no silent "Untitled Group" fallback.
    if (!isDirect && !newChatTitle.trim()) {
      toast.error('Please enter a group name');
      return;
    }

    try {
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
            <p className="text-xs text-gray-500">
              {selectedUserIds.length === 0 && 'Select one person for a direct chat, or multiple for a group.'}
              {selectedUserIds.length === 1 && 'Direct chat — just you and this person.'}
              {selectedUserIds.length > 1 && `Group chat with ${selectedUserIds.length} people — give it a name below.`}
            </p>

            {selectedUserIds.length > 1 && (
              <input
                className="input"
                placeholder="Group name (required)"
                value={newChatTitle}
                onChange={(e) => setNewChatTitle(e.target.value)}
                autoFocus
              />
            )}

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
            <button className="btn-primary w-full" onClick={createConversation}>
              {selectedUserIds.length > 1 ? 'Create Group' : 'Start Chat'}
            </button>
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

            <div className="relative flex-1 overflow-hidden">
            <div
              ref={messagesContainerRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
                // Small threshold so "basically at the bottom" still counts,
                // without requiring pixel-perfect scroll position.
                setNearBottom(distanceFromBottom < 120);
              }}
              className="h-full overflow-y-auto p-4 bg-gradient-to-b from-white to-slate-50">
              <div ref={contentRef} className="space-y-3">
              {messages.length === 0 && (
                <p className="text-sm text-gray-400">No messages yet. Start the conversation.</p>
              )}
              {messageGroups.map((group) => (
                <div key={group.dateLabel + group.messages[0]._id}>
                  <div className="flex justify-center my-3">
                    <span className="text-[11px] font-medium text-gray-500 bg-gray-100 rounded-full px-3 py-1">
                      {group.dateLabel}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {group.messages.map((m) => {
                      const mine = m.sender?._id === user?._id;
                      const canEditThis = mine || ['super_admin', 'admin'].includes(user?.role);
                      const canDeleteThis = mine || ['super_admin', 'admin', 'manager', 'team_lead'].includes(user?.role);
                      return (
                        <div key={m._id} className={`group flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div className={`flex items-end gap-1.5 max-w-[75%] ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
                            {/* Hover actions */}
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0 mb-1">
                              <button
                                type="button"
                                title="Reply"
                                onClick={() => startReply(m)}
                                className="w-6 h-6 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-gray-700 flex items-center justify-center"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10H5a2 2 0 00-2 2v6a2 2 0 002 2h6M9 10l6-6m-6 6l6 6M9 10h9a2 2 0 012 2v6a2 2 0 01-2 2h-2" />
                                </svg>
                              </button>
                              {canEditThis && !!m.body && (
                                <button
                                  type="button"
                                  title="Edit"
                                  onClick={() => startEdit(m)}
                                  className="w-6 h-6 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-gray-700 flex items-center justify-center"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828z" />
                                  </svg>
                                </button>
                              )}
                              {canDeleteThis && (
                                <button
                                  type="button"
                                  title="Delete"
                                  onClick={() => deleteMessage(m)}
                                  className="w-6 h-6 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 flex items-center justify-center"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>

                            <div
                              id={`msg-${m._id}`}
                              className={`rounded-2xl px-3 py-2 shadow-sm transition-shadow ${mine ? 'bg-[var(--brand-primary)] text-white' : 'bg-white text-gray-800 border border-gray-200'} ${highlightedMessageId === m._id ? 'ring-2 ring-amber-400 ring-offset-2' : ''}`}
                            >
                              <div className={`text-[11px] mb-1 ${mine ? 'text-white/80' : 'text-gray-400'}`}>
                                {m.sender?.name || 'Unknown'} · {formatTime(m.createdAt)}
                                {m.editedAt && <span className="italic"> · edited</span>}
                              </div>

                              {m.replyTo && (
                                <div
                                  onClick={
                                    m.replyTo.deletedAt
                                      ? undefined
                                      : (e) => {
                                          e.stopPropagation();
                                          jumpToMessage(m.replyTo._id);
                                        }
                                  }
                                  className={`mb-1.5 rounded-lg px-2 py-1 border-l-2 text-xs transition-colors ${
                                    m.replyTo.deletedAt ? '' : 'cursor-pointer'
                                  } ${
                                    mine
                                      ? `border-white/50 bg-white/10 text-white/90 ${!m.replyTo.deletedAt ? 'hover:bg-white/20' : ''}`
                                      : `border-[var(--brand-primary)] bg-gray-50 text-gray-600 ${!m.replyTo.deletedAt ? 'hover:bg-gray-100' : ''}`
                                  }`}
                                >
                                  <div className="font-medium">{m.replyTo.deletedAt ? 'Original message' : (m.replyTo.sender?.name || 'Unknown')}</div>
                                  <div className="truncate">
                                    {m.replyTo.deletedAt
                                      ? 'This message was deleted'
                                      : (m.replyTo.body || (m.replyTo.attachments?.length ? '📎 Attachment' : ''))}
                                  </div>
                                </div>
                              )}

                              {!!m.attachments?.length && (
                                <div className="mb-1.5 space-y-1.5">
                                  {m.attachments.map((att, i) => {
                                    const name = att.originalname || att.path || 'file';
                                    const isImage = /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(name);
                                    const isVideo = /\.(mp4|webm|mov|ogg|mkv)$/i.test(name);
                                    const url = getAssetUrl(att.path);

                                    if (isVideo) {
                                      return (
                                        <div key={i} className="rounded-lg overflow-hidden border border-black/10">
                                          <video
                                            src={url}
                                            controls
                                            className="max-w-full max-h-64 cursor-pointer"
                                            onClick={() => setLightbox({ url, kind: 'video' })}
                                          />
                                          <a
                                            href={url}
                                            download={att.originalname}
                                            onClick={(e) => e.stopPropagation()}
                                            className={`flex items-center justify-center gap-1 text-[11px] py-1 ${mine ? 'text-white/90 bg-white/10' : 'text-gray-600 bg-gray-50'}`}
                                          >
                                            Download
                                          </a>
                                        </div>
                                      );
                                    }

                                    if (isImage) {
                                      return (
                                        <div key={i} className="rounded-lg overflow-hidden border border-black/10">
                                          <img
                                            src={url}
                                            alt={name}
                                            className="max-w-full max-h-64 object-cover cursor-pointer"
                                            onClick={() => setLightbox({ url, kind: 'image' })}
                                          />
                                          <a
                                            href={url}
                                            download={att.originalname}
                                            onClick={(e) => e.stopPropagation()}
                                            className={`flex items-center justify-center gap-1 text-[11px] py-1 ${mine ? 'text-white/90 bg-white/10' : 'text-gray-600 bg-gray-50'}`}
                                          >
                                            Download
                                          </a>
                                        </div>
                                      );
                                    }

                                    // Generic file (PDF, Doc, Excel, ZIP, etc.)
                                    return (
                                      <a
                                        key={i}
                                        href={url}
                                        download={att.originalname}
                                        onClick={(e) => e.stopPropagation()}
                                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${mine ? 'border-white/20 bg-white/10 hover:bg-white/15' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}
                                      >
                                        <svg className={`w-6 h-6 shrink-0 ${mine ? 'text-white/90' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <div className="min-w-0 flex-1">
                                          <div className={`text-xs font-medium truncate ${mine ? 'text-white' : 'text-gray-800'}`}>{name}</div>
                                          <div className={`text-[10px] ${mine ? 'text-white/70' : 'text-gray-400'}`}>{formatBytes(att.size)} · Download</div>
                                        </div>
                                      </a>
                                    );
                                  })}
                                </div>
                              )}
                              {!!m.body && (
                                <p className="text-sm whitespace-pre-wrap break-words">
                                  {linkifyMessage(m.body, mine, copyLink)}
                                </p>
                              )}
                              {!!m.mentions?.length && (
                                <div className={`mt-1 text-[11px] ${mine ? 'text-white/80' : 'text-indigo-600'}`}>
                                  Mentioned: {m.mentions.map((x) => x.name).join(', ')}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
              </div>
            </div>

            {!atBottom && (
              <button
                type="button"
                onClick={() => scrollToBottom('smooth')}
                className="absolute bottom-4 right-4 flex items-center gap-1.5 pl-3 pr-3.5 py-2 rounded-full bg-white border border-gray-200 shadow-lg text-gray-600 hover:bg-gray-50 transition-colors"
                title="Jump to latest messages"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                {unreadCount > 0 && (
                  <span className="text-xs font-semibold text-white bg-[var(--brand-primary)] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            )}
            </div>

            <footer
              className="relative p-3 border-t border-gray-100 flex flex-col gap-2"
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {isDragging && canCreate && (
                <div className="absolute inset-0 z-10 bg-[var(--brand-primary)]/5 border-2 border-dashed border-[var(--brand-primary)] rounded-lg flex items-center justify-center pointer-events-none">
                  <div className="flex flex-col items-center gap-1 text-[var(--brand-primary)]">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M12 12v9m0-9l-3 3m3-3l3 3" />
                    </svg>
                    <span className="text-sm font-medium">Drop files to attach</span>
                  </div>
                </div>
              )}
              {editingMessage && (
                <div className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs text-amber-800">
                  <span>Editing your message</span>
                  <button type="button" onClick={cancelEdit} className="text-amber-600 hover:text-amber-900">Cancel</button>
                </div>
              )}
              {replyingTo && !editingMessage && (
                <div className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-700">Replying to {replyingTo.sender?.name || 'Unknown'}</div>
                    <div className="text-gray-500 truncate">{replyingTo.body || (replyingTo.attachments?.length ? '📎 Attachment' : '')}</div>
                  </div>
                  <button type="button" onClick={cancelReply} className="text-gray-400 hover:text-gray-700 shrink-0">×</button>
                </div>
              )}
              {pendingFiles.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {pendingFiles.map((pf, idx) => (
                    <div key={idx} className="relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                      {pf.kind === 'video' ? (
                        <video src={pf.previewUrl} className="w-full h-full object-cover" />
                      ) : pf.kind === 'image' ? (
                        <img src={pf.previewUrl} alt={pf.file.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 p-1">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-[9px] text-gray-500 leading-tight text-center break-all line-clamp-2">{pf.file.name}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removePendingFile(idx)}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                {canCreate && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        handleFilesPicked(e.target.files);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="shrink-0 w-9 h-9 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center"
                      title="Attach a file"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 10-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    </button>
                  </>
                )}
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
                    editingMessage ? submitEdit() : sendMessage();
                  }
                  if (e.key === 'Escape' && editingMessage) {
                    cancelEdit();
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
                <button
                  className="btn-primary"
                  disabled={
                    editingMessage
                      ? savingEdit || !newMessage.trim()
                      : !canCreate || sending || (!newMessage.trim() && pendingFiles.length === 0)
                  }
                  onClick={editingMessage ? submitEdit : sendMessage}
                >
                  {editingMessage
                    ? (savingEdit ? 'Saving...' : 'Save')
                    : (uploading ? 'Uploading...' : sending ? 'Sending...' : 'Send')}
                </button>
              </div>
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

      {lightbox && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {lightbox.kind === 'video' ? (
            <video
              src={lightbox.url}
              controls
              autoPlay
              className="max-w-[92vw] max-h-[88vh] rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={lightbox.url}
              alt="attachment"
              className="max-w-[92vw] max-h-[88vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </div>
  );
}