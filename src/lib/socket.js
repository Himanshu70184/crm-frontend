import { io } from 'socket.io-client';
import { ASSET_BASE_URL } from '@/lib/api';

let chatSocket = null;
let activeToken = '';

function resolveSocketUrl() {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
  if (ASSET_BASE_URL) return ASSET_BASE_URL;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://127.0.0.1:5000';
}

export function getChatSocket(token) {
  if (typeof window === 'undefined') return null;

  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) return null;

  if (chatSocket && activeToken !== normalizedToken) {
    chatSocket.disconnect();
    chatSocket = null;
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
  }

  if (!chatSocket.connected) {
    chatSocket.connect();
  }

  return chatSocket;
}

export function disconnectChatSocket() {
  if (chatSocket) {
    chatSocket.disconnect();
    chatSocket = null;
  }
  activeToken = '';
}
