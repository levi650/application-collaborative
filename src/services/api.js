// API service – centralised HTTP client with auth headers and AbortController support

const API_BASE = '/api';

/**
 * Get the stored auth token from sessionStorage.
 */
function getToken() {
  const session = sessionStorage.getItem('auth');
  if (!session) return null;
  try { return JSON.parse(session).token; } catch { return null; }
}

/**
 * Generic fetch wrapper that injects the Bearer token,
 * handles errors, and supports AbortController signals.
 */
async function request(path, options = {}) {
  const { signal, ...rest } = options;
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...rest.headers,
  };

  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers, signal });

  // Parse body (may be empty on 204)
  let body = null;
  const text = await res.text();
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }

  if (!res.ok) {
    const err = new Error(body?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body;
}

// ── Auth ────────────────────────────────────────────────────────────
export function login(email, password) {
  return request('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function getMe(signal) {
  return request('/me', { signal });
}

// ── Students ────────────────────────────────────────────────────────
export function getStudents(signal) {
  return request('/students', { signal });
}

export function createStudent(data, signal) {
  return request('/students', {
    method: 'POST',
    body: JSON.stringify(data),
    signal,
  });
}

export function deleteStudent(id, signal) {
  return request(`/students/${id}`, { method: 'DELETE', signal });
}

// ── Grades ──────────────────────────────────────────────────────────
export function getGrades(studentId, signal) {
  const qs = studentId ? `?studentId=${studentId}` : '';
  return request(`/grades${qs}`, { signal });
}

export function getGrade(id, signal) {
  return request(`/grades/${id}`, { signal });
}

export function createGrade(data, signal) {
  return request('/grades', {
    method: 'POST',
    body: JSON.stringify(data),
    signal,
  });
}

export function updateGrade(id, value, expectedVersion, signal) {
  return request(`/grades/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ value, expectedVersion }),
    signal,
  });
}

export function deleteGrade(id, signal) {
  return request(`/grades/${id}`, { method: 'DELETE', signal });
}

// ── History ─────────────────────────────────────────────────────────
export function getGradeHistory(id, signal) {
  return request(`/grades/${id}/history`, { signal });
}

// ── Undo ────────────────────────────────────────────────────────────
export function undoGrade(id, expectedVersion, signal) {
  return request(`/grades/${id}/undo`, {
    method: 'POST',
    body: JSON.stringify({ expectedVersion }),
    signal,
  });
}

// ── Users ───────────────────────────────────────────────────────────
export function getUsers(signal) {
  return request('/users', { signal });
}

// ── Reset (testing) ─────────────────────────────────────────────────
export function resetData() {
  return request('/reset', { method: 'POST' });
}
