// WebSocket real-time service with auto-reconnect and exponential backoff

/**
 * Creates a managed WebSocket connection.
 * @param {string} token – auth token for the connection
 * @param {(msg: object) => void} onMessage – callback for incoming messages
 * @param {(status: string) => void} onStatusChange – callback for connection status changes
 * @returns {{ close: () => void, getStatus: () => string }}
 */
export function createRealtimeConnection(token, onMessage, onStatusChange) {
  let ws = null;
  let reconnectAttempt = 0;
  let reconnectTimer = null;
  let closed = false;
  let status = 'connecting';

  const MAX_RECONNECT_DELAY = 30000; // 30s cap
  const BASE_DELAY = 1000;

  function setStatus(newStatus) {
    status = newStatus;
    onStatusChange(newStatus);
  }

  function getWsUrl() {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    // In dev, the WebSocket server is on port 3001
    const host = window.location.hostname;
    const port = 3001;
    return `${proto}://${host}:${port}/ws?token=${encodeURIComponent(token || '')}`;
  }

  function connect() {
    if (closed) return;

    try {
      ws = new WebSocket(getWsUrl());
    } catch (err) {
      console.error('[WS] Connection error:', err);
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      reconnectAttempt = 0;
      setStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        onMessage(msg);
      } catch (err) {
        console.error('[WS] Failed to parse message:', err);
      }
    };

    ws.onclose = (event) => {
      if (closed) return;
      console.warn('[WS] Connection closed:', event.code, event.reason);
      scheduleReconnect();
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
      // onclose will fire after this
    };
  }

  function scheduleReconnect() {
    if (closed) return;
    setStatus('reconnecting');
    reconnectAttempt++;
    const delay = Math.min(BASE_DELAY * Math.pow(2, reconnectAttempt - 1), MAX_RECONNECT_DELAY);
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempt})`);
    reconnectTimer = setTimeout(connect, delay);
  }

  function close() {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) {
      ws.onclose = null; // prevent reconnect on intentional close
      ws.close();
    }
    setStatus('disconnected');
  }

  function getStatus() {
    return status;
  }

  // Start initial connection
  connect();

  return { close, getStatus };
}
