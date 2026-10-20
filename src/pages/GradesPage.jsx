import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { getStudents, createGrade, deleteGrade } from '../services/api.js';
import useRealtimeGrades from '../hooks/useRealtimeGrades.js';
import useGradeMutation from '../hooks/useGradeMutation.js';
import GradeEditor from '../features/grades/GradeEditor.jsx';
import ConflictResolver from '../features/grades/ConflictResolver.jsx';
import GradeHistory from '../features/grades/GradeHistory.jsx';

/**
 * GradesPage – main page displaying students and their grades.
 * Handles real-time sync, editing, conflict resolution, and history.
 */
export default function GradesPage() {
  const { user, role, logout } = useAuth();
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [editingGrade, setEditingGrade] = useState(null);
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [showNewGrade, setShowNewGrade] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newValue, setNewValue] = useState('');
  const [studentsLoading, setStudentsLoading] = useState(true);
  const mountedRef = useRef(true);

  const canEdit = role === 'ADMIN' || role === 'TEACHER';
  const canDelete = role === 'ADMIN';
  const canCreate = role === 'ADMIN' || role === 'TEACHER';

  // Fetch students
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const data = await getStudents(controller.signal);
        if (mountedRef.current) {
          setStudents(data);
          if (data.length > 0 && !selectedStudent) {
            setSelectedStudent(data[0].id);
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Failed to load students:', err);
      } finally {
        if (mountedRef.current) setStudentsLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Real-time grades for the selected student
  const { grades, loading: gradesLoading, error: gradesError, connectionStatus, toasts, refetch } =
    useRealtimeGrades(selectedStudent);

  // Grade mutation (with conflict detection)
  const { mutate, loading: mutationLoading, conflict, clearConflict, cleanup: cleanupMutation } =
    useGradeMutation();

  useEffect(() => cleanupMutation, [cleanupMutation]);

  // Grade value color
  const getValueClass = useCallback((value) => {
    if (value >= 14) return 'high';
    if (value >= 10) return 'medium';
    return 'low';
  }, []);

  // Handle grade save from editor
  const handleSave = useCallback(async (gradeId, value, expectedVersion) => {
    const result = await mutate(gradeId, value, expectedVersion);
    if (result.success) {
      setEditingGrade(null);
      refetch();
    }
    // If conflict, ConflictResolver will appear via conflict state
  }, [mutate, refetch]);

  // Handle "keep server version" in conflict resolver
  const handleKeepServer = useCallback(() => {
    clearConflict();
    setEditingGrade(null);
    refetch();
  }, [clearConflict, refetch]);

  // Handle "resubmit with new version" from conflict resolver
  const handleResubmit = useCallback(async (gradeId, value, serverVersion) => {
    const result = await mutate(gradeId, value, serverVersion);
    if (result.success) {
      clearConflict();
      setEditingGrade(null);
      refetch();
    }
  }, [mutate, clearConflict, refetch]);

  // Handle creating a new grade
  const handleCreateGrade = useCallback(async (e) => {
    e.preventDefault();
    if (!selectedStudent || !newSubject || newValue === '') return;
    const num = parseFloat(newValue);
    if (isNaN(num) || num < 0 || num > 20) return;
    try {
      await createGrade({ studentId: selectedStudent, subject: newSubject, value: num });
      setShowNewGrade(false);
      setNewSubject('');
      setNewValue('');
      refetch();
    } catch (err) {
      console.error('Failed to create grade:', err);
    }
  }, [selectedStudent, newSubject, newValue, refetch]);

  // Handle deleting a grade (ADMIN only)
  const handleDeleteGrade = useCallback(async (gradeId) => {
    if (!window.confirm('Supprimer cette note ?')) return;
    try {
      await deleteGrade(gradeId);
      refetch();
    } catch (err) {
      console.error('Failed to delete grade:', err);
    }
  }, [refetch]);

  // Current student name
  const currentStudent = useMemo(() =>
    students.find(s => s.id === selectedStudent),
    [students, selectedStudent]
  );

  // Find selected grade for history
  const historyGrade = useMemo(() =>
    grades.find(g => g.id === expandedHistory),
    [grades, expandedHistory]
  );

  if (studentsLoading) {
    return (
      <div className="loading-state">
        <span className="spinner lg" />
        <span>Chargement des étudiants…</span>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <div className="logo">📊 GradeSync</div>
        <div className="user-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className={`status-dot ${connectionStatus}`} title={connectionStatus} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {connectionStatus === 'connected' ? 'En ligne' :
               connectionStatus === 'reconnecting' ? 'Reconnexion…' :
               connectionStatus === 'connecting' ? 'Connexion…' : 'Déconnecté'}
            </span>
          </div>
          <div className="user-badge">
            {user?.name}
            <span className="role-tag">{role}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout}>
            Déconnexion
          </button>
        </div>
      </header>

      {/* Connection warning banner */}
      {connectionStatus === 'reconnecting' && (
        <div className="connection-banner reconnecting">
          🔄 Reconnexion au serveur en cours… Les données peuvent être obsolètes.
        </div>
      )}
      {connectionStatus === 'disconnected' && (
        <div className="connection-banner disconnected">
          ❌ Connexion au serveur perdue. Vérifiez votre connexion.
        </div>
      )}

      {/* Main content */}
      <main className="app-main">
        <div className="grades-header">
          <h1>
            {role === 'STUDENT' ? 'Mes résultats' : 'Gestion des notes'}
          </h1>
        </div>

        {/* Student tabs (hidden for STUDENT role – they only see their own) */}
        {role !== 'STUDENT' && (
          <div className="student-tabs">
            {students.map(s => (
              <button
                key={s.id}
                className={`student-tab ${selectedStudent === s.id ? 'active' : ''}`}
                onClick={() => { setSelectedStudent(s.id); setExpandedHistory(null); }}
              >
                {s.firstName} {s.lastName}
              </button>
            ))}
          </div>
        )}

        {/* Current student info */}
        {currentStudent && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            📝 Notes de <strong>{currentStudent.firstName} {currentStudent.lastName}</strong>
          </p>
        )}

        {/* New grade form */}
        {canCreate && selectedStudent && (
          <div style={{ marginBottom: '1rem' }}>
            {!showNewGrade ? (
              <button className="btn btn-secondary btn-sm" onClick={() => setShowNewGrade(true)}>
                + Ajouter une note
              </button>
            ) : (
              <form className="new-grade-form" onSubmit={handleCreateGrade}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="new-subject">Matière</label>
                    <input
                      id="new-subject"
                      className="input"
                      type="text"
                      placeholder="ex: Algorithmique"
                      value={newSubject}
                      onChange={e => setNewSubject(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="new-value">Note (sur 20)</label>
                    <input
                      id="new-value"
                      className="input"
                      type="number"
                      min="0"
                      max="20"
                      step="0.5"
                      value={newValue}
                      onChange={e => setNewValue(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button type="submit" className="btn btn-primary btn-sm">Ajouter</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowNewGrade(false)}>
                    Annuler
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Grades list */}
        {gradesLoading && grades.length === 0 && (
          <div className="loading-state">
            <span className="spinner lg" />
            <span>Chargement des notes…</span>
          </div>
        )}

        {gradesError && (
          <div className="error-state">
            <p>❌ Erreur : {gradesError}</p>
            <button className="btn btn-secondary" onClick={refetch}>Réessayer</button>
          </div>
        )}

        {!gradesLoading && !gradesError && grades.length === 0 && (
          <div className="empty-state">
            <p>Aucune note enregistrée pour cet étudiant.</p>
          </div>
        )}

        <div className="grades-grid">
          {grades.map(grade => (
            <div key={grade.id}>
              <div className="grade-card">
                <div className="grade-info">
                  <div className="grade-subject">{grade.subject}</div>
                  <div className="grade-meta">
                    v{grade.version} · Modifié par {grade.lastAuthor} ·{' '}
                    {new Date(grade.lastUpdatedAt).toLocaleString('fr-FR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                </div>

                <div className={`grade-value ${getValueClass(grade.value)}`}>
                  {grade.value}<span style={{ fontSize: '0.85rem', fontWeight: 400 }}>/20</span>
                </div>

                <div className="grade-actions">
                  {canEdit && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditingGrade(grade)}
                      title="Modifier"
                    >
                      ✏️
                    </button>
                  )}
                  {canDelete && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteGrade(grade.id)}
                      title="Supprimer"
                    >
                      🗑️
                    </button>
                  )}
                  <button
                    className={`btn btn-sm ${expandedHistory === grade.id ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setExpandedHistory(expandedHistory === grade.id ? null : grade.id)}
                    title="Historique"
                  >
                    📋
                  </button>
                </div>
              </div>

              {/* History panel (inline, below the grade card) */}
              {expandedHistory === grade.id && (
                <GradeHistory
                  gradeId={grade.id}
                  gradeVersion={grade.version}
                  onUndoComplete={refetch}
                />
              )}
            </div>
          ))}
        </div>
      </main>

      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map(toast => (
            <div key={toast.id} className={`toast ${toast.type}`}>
              {toast.message}
            </div>
          ))}
        </div>
      )}

      {/* Grade editor modal */}
      {editingGrade && !conflict && (
        <GradeEditor
          grade={editingGrade}
          onSave={handleSave}
          onClose={() => setEditingGrade(null)}
          loading={mutationLoading}
        />
      )}

      {/* Conflict resolver modal */}
      {conflict && (
        <ConflictResolver
          conflict={conflict}
          onKeepServer={handleKeepServer}
          onResubmit={handleResubmit}
          loading={mutationLoading}
        />
      )}
    </div>
  );
}
