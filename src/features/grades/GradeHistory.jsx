import { useState, useEffect, useCallback, memo, useRef } from 'react';
import { getGradeHistory, undoGrade } from '../../services/api.js';
import { useAuth } from '../../auth/AuthProvider.jsx';

/**
 * GradeHistory – chronological audit log for a grade. Updates live via
 * parent refetch trigger. "Annuler" button for ADMIN/TEACHER roles.
 */
function GradeHistory({ gradeId, gradeVersion, onUndoComplete }) {
  const { role, token } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [undoLoading, setUndoLoading] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const canUndo = role === 'ADMIN' || role === 'TEACHER';

  // Fetch history when gradeId or gradeVersion changes
  const fetchHistory = useCallback(async () => {
    if (!gradeId || !token) return;
    const controller = new AbortController();
    setLoading(true);
    try {
      const data = await getGradeHistory(gradeId, controller.signal);
      if (mountedRef.current) {
        setEvents(data);
        setError(null);
      }
    } catch (err) {
      if (err.name !== 'AbortError' && mountedRef.current) {
        setError(err.message);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [gradeId, token]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, gradeVersion]); // refetch when version changes (live update)

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const handleUndo = useCallback(async () => {
    if (!gradeId) return;
    setUndoLoading(true);
    try {
      await undoGrade(gradeId, gradeVersion);
      if (onUndoComplete) onUndoComplete();
      // History will auto-refresh via version change
    } catch (err) {
      if (mountedRef.current) {
        setError(err.body?.error || err.message);
      }
    } finally {
      if (mountedRef.current) setUndoLoading(false);
    }
  }, [gradeId, gradeVersion, onUndoComplete]);

  if (!gradeId) return null;

  return (
    <div className="history-panel">
      <h3>
        📋 Historique des modifications
        {loading && <span className="spinner" style={{ marginLeft: '0.5rem' }} />}
      </h3>

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</p>}

      {events.length === 0 && !loading && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Aucun historique disponible.
        </p>
      )}

      <div className="history-list">
        {events.map(event => {
          const time = new Date(event.timestamp).toLocaleString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          });

          return (
            <div className="history-item" key={event.id}>
              <span className="history-version">v{event.version}</span>
              <span className={`history-type ${event.type.toLowerCase()}`}>
                {event.type === 'UNDO' ? 'Annulation' : 'Modification'}
              </span>
              <span className="history-values">
                <span className="history-old">{event.oldValue}</span>
                <span className="history-arrow">→</span>
                <span className="history-new">{event.newValue}</span>
              </span>
              <span className="history-author">{event.author}</span>
              <span className="history-time">{time}</span>
            </div>
          );
        })}
      </div>

      {canUndo && events.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <button
            className="btn btn-danger btn-sm"
            onClick={handleUndo}
            disabled={undoLoading}
          >
            {undoLoading ? <><span className="spinner" /> Annulation…</> : '↩ Annuler la dernière modification'}
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(GradeHistory);
