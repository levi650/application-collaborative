import { useEffect, useRef, useState, useCallback } from 'react';
import { createRealtimeConnection } from '../services/realtime.js';
import { getGrades } from '../services/api.js';
import { useAuth } from '../auth/AuthProvider.jsx';

/**
 * useRealtimeGrades – subscribes to WebSocket grade events for a given student.
 * Returns { grades, connectionStatus, toasts } and auto-refetches on reconnect.
 * Cleans up on unmount.
 */
export default function useRealtimeGrades(studentId) {
  const { token } = useAuth();
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [toasts, setToasts] = useState([]);
  const connectionRef = useRef(null);
  const prevStatusRef = useRef('connecting');
  const mountedRef = useRef(true);

  // Remove toasts after 5s
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      if (mountedRef.current) setToasts(t => t.slice(1));
    }, 5000);
    return () => clearTimeout(timer);
  }, [toasts]);

  // Fetch grades from REST
  const fetchGrades = useCallback(async () => {
    if (!token) return;
    const controller = new AbortController();
    try {
      setLoading(true);
      const data = await getGrades(studentId, controller.signal);
      if (mountedRef.current) {
        setGrades(data);
        setError(null);
      }
    } catch (err) {
      if (err.name !== 'AbortError' && mountedRef.current) {
        setError(err.message);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    return controller;
  }, [token, studentId]);

  // Initial fetch
  useEffect(() => {
    const ctrl = fetchGrades();
    return () => { ctrl?.then?.(c => c?.abort()); };
  }, [fetchGrades]);

  // WebSocket connection
  useEffect(() => {
    if (!token) return;

    function handleMessage(msg) {
      if (!mountedRef.current) return;

      if (msg.type === 'grade:updated') {
        const updated = msg.payload;
        setGrades(prev => prev.map(g =>
          g.id === updated.id ? { ...g, ...updated } : g
        ));
        // Show toast notification
        const time = new Date(updated.lastUpdatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        setToasts(prev => [...prev, {
          id: Date.now(),
          message: `Modifié par ${updated.lastAuthor} à ${time} – ${updated.subject}: ${updated.value}/20`,
          type: 'info',
        }]);
      }

      if (msg.type === 'grade:created') {
        const created = msg.payload;
        if (!studentId || created.studentId === studentId) {
          setGrades(prev => {
            if (prev.some(g => g.id === created.id)) return prev;
            return [...prev, created];
          });
        }
      }

      if (msg.type === 'grade:deleted') {
        setGrades(prev => prev.filter(g => g.id !== msg.payload.id));
      }

      if (msg.type === 'data:reset') {
        fetchGrades();
      }
    }

    function handleStatusChange(newStatus) {
      if (!mountedRef.current) return;
      // Refetch when reconnecting → connected
      if (newStatus === 'connected' && prevStatusRef.current === 'reconnecting') {
        fetchGrades();
      }
      prevStatusRef.current = newStatus;
      setConnectionStatus(newStatus);
    }

    const conn = createRealtimeConnection(token, handleMessage, handleStatusChange);
    connectionRef.current = conn;

    return () => {
      conn.close();
      connectionRef.current = null;
    };
  }, [token, studentId, fetchGrades]);

  // Cleanup mounted ref
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  return { grades, setGrades, loading, error, connectionStatus, toasts, refetch: fetchGrades };
}
