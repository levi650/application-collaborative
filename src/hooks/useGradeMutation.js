import { useState, useCallback, useRef } from 'react';
import { updateGrade } from '../services/api.js';

/**
 * useGradeMutation – handles optimistic-locking grade updates.
 * Returns { mutate, loading, error, conflict, clearConflict }.
 * On 409 conflict, stores the conflict details for ConflictResolver.
 */
export default function useGradeMutation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [conflict, setConflict] = useState(null); // { myValue, serverValue, serverVersion, lastAuthor, lastUpdatedAt }
  const abortRef = useRef(null);

  const mutate = useCallback(async (gradeId, value, expectedVersion) => {
    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setConflict(null);

    try {
      const result = await updateGrade(gradeId, value, expectedVersion, controller.signal);
      setLoading(false);
      return { success: true, grade: result };
    } catch (err) {
      if (err.name === 'AbortError') {
        setLoading(false);
        return { success: false, aborted: true };
      }

      if (err.status === 409) {
        // Version conflict
        const body = err.body;
        setConflict({
          gradeId,
          myValue: value,
          myVersion: expectedVersion,
          serverValue: body.currentValue,
          serverVersion: body.currentVersion,
          lastAuthor: body.lastAuthor,
          lastUpdatedAt: body.lastUpdatedAt,
        });
        setLoading(false);
        return { success: false, conflict: true };
      }

      setError(err.body?.error || err.message);
      setLoading(false);
      return { success: false, error: err };
    }
  }, []);

  const clearConflict = useCallback(() => {
    setConflict(null);
  }, []);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
  }, []);

  return { mutate, loading, error, conflict, clearConflict, cleanup };
}
