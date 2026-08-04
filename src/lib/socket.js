import { io } from 'socket.io-client';
import { ASSET_BASE_URL } from '@/lib/api';

let chatSocket = null;
let activeToken = '';
let activeSocketRefs = 0;

function resolveSocketUrl() {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
  if (ASSET_BASE_URL) return ASSET_BASE_URL;
  if (typeof window !== 'undefined') {
    try {
      const origin = window.location.origin;
      const url = new URL(origin);
      // If frontend dev server runs on 3000, assume backend socket runs on 5000.
      if (url.port === '3000') {
        const resolved = `${url.protocol}//${url.hostname}:5000`;
        if (process.env.NODE_ENV === 'development') console.debug('[chat socket] resolved URL', resolved);
        return resolved;
      }
      if (process.env.NODE_ENV === 'development') console.debug('[chat socket] resolved URL', origin);
      return origin;
    } catch (e) {
      return window.location.origin;
    }
  }
  return 'http://127.0.0.1:5000';
}

export function getChatSocket(token) {
  if (typeof window === 'undefined') return null;

  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) return null;

  if (chatSocket && activeToken !== normalizedToken) {
    chatSocket.disconnect();
    chatSocket = null;
    activeSocketRefs = 0;
  }

  if (!chatSocket) {
    activeToken = normalizedToken;
    chatSocket = io(resolveSocketUrl(), {
      transports: ['websocket', 'polling'],
      autoConnect: false,
      auth: {
        token: `Bearer ${normalizedToken}`,
      },
    });
    // Debug logging for socket lifecycle — helps verify connection in DevTools
    chatSocket.on('connect', () => console.log('[chat socket] connected'));
    chatSocket.on('connect_error', (err) => console.error('[chat socket] connect_error', err));
    chatSocket.on('disconnect', (reason) => console.warn('[chat socket] disconnected', reason));
    chatSocket.on('reconnect', (attempt) => console.log('[chat socket] reconnected after', attempt));
    chatSocket.on('reconnect_attempt', (attempt) => console.log('[chat socket] reconnect attempt', attempt));
  }

  activeSocketRefs += 1;

  if (!chatSocket.connected) {
    chatSocket.connect();
  }

  return chatSocket;
}

export function disconnectChatSocket() {
  activeSocketRefs = Math.max(0, activeSocketRefs - 1);
  if (chatSocket && activeSocketRefs === 0) {
    chatSocket.disconnect();
    chatSocket = null;
    activeToken = '';
  }
}
