import { useState, useCallback, useEffect, memo } from 'react';

/**
 * GradeEditor – modal to edit a grade value. Sends expectedVersion for
 * optimistic locking. Calls onSave(gradeId, value, expectedVersion).
 */
function GradeEditor({ grade, onSave, onClose, loading }) {
  const [value, setValue] = useState(grade?.value ?? '');
  const [validationError, setValidationError] = useState(null);

  // Update value when grade changes (e.g. after conflict resolution)
  useEffect(() => {
    if (grade) setValue(grade.value);
  }, [grade]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    const num = parseFloat(value);
    if (isNaN(num) || num < 0 || num > 20) {
      setValidationError('La note doit être un nombre entre 0 et 20');
      return;
    }
    setValidationError(null);
    onSave(grade.id, num, grade.version);
  }, [value, grade, onSave]);

  if (!grade) return null;

  return (
    <div className="grade-editor-overlay" onClick={onClose}>
      <div className="grade-editor" onClick={e => e.stopPropagation()}>
        <h2>✏️ Modifier la note</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          {grade.subject} – Version actuelle : <strong>v{grade.version}</strong>
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="grade-value">Note (sur 20)</label>
            <input
              id="grade-value"
              className="input"
              type="number"
              min="0"
              max="20"
              step="0.5"
              value={value}
              onChange={e => { setValue(e.target.value); setValidationError(null); }}
              autoFocus
              disabled={loading}
            />
            {validationError && (
              <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
                {validationError}
              </p>
            )}
          </div>

          <div className="editor-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><span className="spinner" /> Sauvegarde…</> : 'Sauvegarder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default memo(GradeEditor);
