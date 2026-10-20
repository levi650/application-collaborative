import { useState, useCallback, memo } from 'react';

/**
 * ConflictResolver – displayed on HTTP 409 version conflict.
 * Shows two panels: "Votre modification" vs "Version du serveur".
 * Actions: keep server version (discard mine) or submit a new value.
 */
function ConflictResolver({ conflict, onKeepServer, onResubmit, loading }) {
  const [newValue, setNewValue] = useState(conflict?.myValue ?? '');

  const handleResubmit = useCallback((e) => {
    e.preventDefault();
    const num = parseFloat(newValue);
    if (isNaN(num) || num < 0 || num > 20) return;
    onResubmit(conflict.gradeId, num, conflict.serverVersion);
  }, [newValue, conflict, onResubmit]);

  if (!conflict) return null;

  const serverTime = new Date(conflict.lastUpdatedAt).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="conflict-overlay">
      <div className="conflict-panel">
        <h2>⚠️ Conflit de version détecté</h2>
        <p className="conflict-desc">
          Un autre utilisateur a modifié cette note entre-temps. Votre version ({`v${conflict.myVersion}`})
          est obsolète. La version actuelle du serveur est <strong>v{conflict.serverVersion}</strong>.
        </p>

        <div className="conflict-columns">
          <div className="conflict-col mine">
            <h3>Votre modification</h3>
            <div className="conflict-value">{conflict.myValue}/20</div>
            <div className="conflict-meta">
              Version envoyée : v{conflict.myVersion}
            </div>
          </div>

          <div className="conflict-col server">
            <h3>Version du serveur</h3>
            <div className="conflict-value">{conflict.serverValue}/20</div>
            <div className="conflict-meta">
              Par {conflict.lastAuthor}<br />
              {serverTime} – v{conflict.serverVersion}
            </div>
          </div>
        </div>

        <form onSubmit={handleResubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="conflict-new-value">
              Proposer une nouvelle note (optionnel)
            </label>
            <input
              id="conflict-new-value"
              className="input"
              type="number"
              min="0"
              max="20"
              step="0.5"
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="conflict-actions">
            <button
              type="button"
              className="btn btn-success"
              onClick={onKeepServer}
              disabled={loading}
            >
              ✓ Conserver la version du serveur
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading
                ? <><span className="spinner" /> Envoi…</>
                : '↻ Proposer une nouvelle modification'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default memo(ConflictResolver);
