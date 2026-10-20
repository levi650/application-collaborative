import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_FILE = join(__dirname, "data.json");

// ── Seed data ──────────────────────────────────────────────────────────
const SEED = {
  users: [
    {
      id: "u1",
      email: "admin@test.com",
      password: "admin123",
      role: "ADMIN",
      name: "Admin Principal",
    },
    {
      id: "u2",
      email: "teacher1@test.com",
      password: "teacher123",
      role: "TEACHER",
      name: "Fatima Zahra Mansouri",
    },
    {
      id: "u3",
      email: "teacher2@test.com",
      password: "teacher123",
      role: "TEACHER",
      name: "Mehdi Alami",
    },
    {
      id: "u4",
      email: "student1@test.com",
      password: "student123",
      role: "STUDENT",
      name: "Yassine El Amrani",
    },
  ],
  students: [
    { id: "s1", firstName: "Yassine", lastName: "El Amrani", userId: "u4" },
    { id: "s2", firstName: "Salma", lastName: "Benjelloun", userId: null },
    { id: "s3", firstName: "Omar", lastName: "Idrissi", userId: null },
  ],

  grades: [
    {
      id: "g1",
      studentId: "s1",
      subject: "Algorithmique",
      value: 12,
      version: 4,
      lastAuthor: "Fatima Zahra Mansouri",
      lastUpdatedAt: new Date("2026-10-18T10:00:00Z").toISOString(),
    },
    {
      id: "g2",
      studentId: "s1",
      subject: "Bases de données",
      value: 15,
      version: 1,
      lastAuthor: "Fatima Zahra Mansouri",
      lastUpdatedAt: new Date("2026-10-18T11:00:00Z").toISOString(),
    },
    {
      id: "g3",
      studentId: "s2",
      subject: "Algorithmique",
      value: 10,
      version: 1,
      lastAuthor: "Mehdi Alami",
      lastUpdatedAt: new Date("2026-10-18T12:00:00Z").toISOString(),
    },
    {
      id: "g4",
      studentId: "s2",
      subject: "Bases de données",
      value: 14,
      version: 1,
      lastAuthor: "Mehdi Alami",
      lastUpdatedAt: new Date("2026-10-18T12:30:00Z").toISOString(),
    },
    {
      id: "g5",
      studentId: "s3",
      subject: "Programmation Web",
      value: 18,
      version: 1,
      lastAuthor: "Fatima Zahra Mansouri",
      lastUpdatedAt: new Date("2026-10-18T13:00:00Z").toISOString(),
    },
    {
      id: "g6",
      studentId: "s3",
      subject: "Réseaux informatiques",
      value: 11,
      version: 1,
      lastAuthor: "Mehdi Alami",
      lastUpdatedAt: new Date("2026-10-18T13:30:00Z").toISOString(),
    },
  ],
  auditLog: [
    {
      id: "a1",
      studentId: "s1",
      gradeId: "g1",
      oldValue: 8,
      newValue: 10,
      author: "Fatima Zahra Mansouri",
      timestamp: new Date("2026-10-17T09:00:00Z").toISOString(),
      version: 2,
      type: "UPDATE",
    },
    {
      id: "a2",
      studentId: "s1",
      gradeId: "g1",
      oldValue: 10,
      newValue: 11,
      author: "Mehdi Alami",
      timestamp: new Date("2026-10-17T14:00:00Z").toISOString(),
      version: 3,
      type: "UPDATE",
    },
    {
      id: "a3",
      studentId: "s1",
      gradeId: "g1",
      oldValue: 11,
      newValue: 12,
      author: "Fatima Zahra Mansouri",
      timestamp: new Date("2026-10-18T10:00:00Z").toISOString(),
      version: 4,
      type: "UPDATE",
    },
  ],
};

// ── Data persistence ───────────────────────────────────────────────────
function loadData() {
  if (existsSync(DATA_FILE)) {
    try {
      return JSON.parse(readFileSync(DATA_FILE, "utf-8"));
    } catch {
      /* fall through to seed */
    }
  }
  const data = JSON.parse(JSON.stringify(SEED));
  saveData(data);
  return data;
}

function saveData(data) {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function resetData() {
  const data = JSON.parse(JSON.stringify(SEED));
  saveData(data);
  return data;
}

let db = loadData();

// ── Token helpers (simple HMAC-based tokens for demo) ──────────────────
const SECRET = "collaborative-grades-secret-key-2026";

function createToken(user) {
  const payload = JSON.stringify({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    exp: Date.now() + 24 * 60 * 60 * 1000,
  });
  const b64 = Buffer.from(payload).toString("base64url");
  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(b64)
    .digest("base64url");
  return `${b64}.${sig}`;
}

function verifyToken(token) {
  if (!token) return null;
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(b64)
    .digest("base64url");
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(b64, "base64url").toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Express setup ──────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// Auth middleware
function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer "))
    return res.status(401).json({ error: "Non authentifié" });
  const user = verifyToken(auth.slice(7));
  if (!user) return res.status(401).json({ error: "Token invalide ou expiré" });
  req.user = user;
  next();
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role))
      return res.status(403).json({ error: "Accès interdit" });
    next();
  };
}

// ── Auth routes ────────────────────────────────────────────────────────
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const user = db.users.find(
    (u) => u.email === email && u.password === password,
  );
  if (!user) return res.status(401).json({ error: "Identifiants incorrects" });
  const token = createToken(user);
  res.json({
    token,
    user: { id: user.id, email: user.email, role: user.role, name: user.name },
  });
});

app.get("/api/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

// ── Students routes ────────────────────────────────────────────────────
app.get("/api/students", authenticate, (req, res) => {
  if (req.user.role === "STUDENT") {
    const student = db.students.find((s) => s.userId === req.user.id);
    return res.json(student ? [student] : []);
  }
  res.json(db.students);
});

app.post("/api/students", authenticate, authorize("ADMIN"), (req, res) => {
  const { firstName, lastName } = req.body;
  if (!firstName || !lastName)
    return res.status(400).json({ error: "Prénom et nom requis" });
  const student = { id: `s${Date.now()}`, firstName, lastName, userId: null };
  db.students.push(student);
  saveData(db);
  res.status(201).json(student);
});

app.delete(
  "/api/students/:id",
  authenticate,
  authorize("ADMIN"),
  (req, res) => {
    const idx = db.students.findIndex((s) => s.id === req.params.id);
    if (idx === -1)
      return res.status(404).json({ error: "Étudiant non trouvé" });
    db.students.splice(idx, 1);
    // Also remove their grades
    db.grades = db.grades.filter((g) => g.studentId !== req.params.id);
    saveData(db);
    res.json({ success: true });
  },
);

// ── Grades routes ──────────────────────────────────────────────────────
app.get("/api/grades", authenticate, (req, res) => {
  const { studentId } = req.query;
  let grades = db.grades;
  if (req.user.role === "STUDENT") {
    const student = db.students.find((s) => s.userId === req.user.id);
    if (!student) return res.json([]);
    grades = grades.filter((g) => g.studentId === student.id);
  } else if (studentId) {
    grades = grades.filter((g) => g.studentId === studentId);
  }
  res.json(grades);
});

app.post(
  "/api/grades",
  authenticate,
  authorize("ADMIN", "TEACHER"),
  (req, res) => {
    const { studentId, subject, value } = req.body;
    if (!studentId || !subject || value === undefined)
      return res
        .status(400)
        .json({ error: "Champs requis: studentId, subject, value" });
    if (typeof value !== "number" || value < 0 || value > 20)
      return res
        .status(400)
        .json({ error: "La note doit être un nombre entre 0 et 20" });
    const grade = {
      id: `g${Date.now()}`,
      studentId,
      subject,
      value,
      version: 1,
      lastAuthor: req.user.name,
      lastUpdatedAt: new Date().toISOString(),
    };
    db.grades.push(grade);
    saveData(db);
    broadcast({ type: "grade:created", payload: grade });
    res.status(201).json(grade);
  },
);

app.get("/api/grades/:id", authenticate, (req, res) => {
  const grade = db.grades.find((g) => g.id === req.params.id);
  if (!grade) return res.status(404).json({ error: "Note non trouvée" });
  // Students can only see their own grades
  if (req.user.role === "STUDENT") {
    const student = db.students.find((s) => s.userId === req.user.id);
    if (!student || grade.studentId !== student.id)
      return res.status(403).json({ error: "Accès interdit" });
  }
  res.json(grade);
});

app.put(
  "/api/grades/:id",
  authenticate,
  authorize("ADMIN", "TEACHER"),
  (req, res) => {
    const { value, expectedVersion } = req.body;
    if (value === undefined || expectedVersion === undefined) {
      return res
        .status(400)
        .json({ error: "Champs requis: value, expectedVersion" });
    }
    if (typeof value !== "number" || value < 0 || value > 20) {
      return res
        .status(400)
        .json({ error: "La note doit être un nombre entre 0 et 20" });
    }

    const grade = db.grades.find((g) => g.id === req.params.id);
    if (!grade) return res.status(404).json({ error: "Note non trouvée" });

    // Optimistic locking: check version
    if (expectedVersion !== grade.version) {
      return res.status(409).json({
        error: "Conflit de version",
        currentValue: grade.value,
        currentVersion: grade.version,
        lastAuthor: grade.lastAuthor,
        lastUpdatedAt: grade.lastUpdatedAt,
      });
    }

    const oldValue = grade.value;
    grade.value = value;
    grade.version += 1;
    grade.lastAuthor = req.user.name;
    grade.lastUpdatedAt = new Date().toISOString();

    // Audit event
    const auditEvent = {
      id: `a${Date.now()}`,
      studentId: grade.studentId,
      gradeId: grade.id,
      oldValue,
      newValue: value,
      author: req.user.name,
      timestamp: grade.lastUpdatedAt,
      version: grade.version,
      type: "UPDATE",
    };
    db.auditLog.push(auditEvent);
    saveData(db);

    // Broadcast to all WebSocket clients
    broadcast({
      type: "grade:updated",
      payload: {
        id: grade.id,
        studentId: grade.studentId,
        subject: grade.subject,
        value: grade.value,
        version: grade.version,
        lastAuthor: grade.lastAuthor,
        lastUpdatedAt: grade.lastUpdatedAt,
      },
    });

    res.json(grade);
  },
);

app.delete("/api/grades/:id", authenticate, authorize("ADMIN"), (req, res) => {
  const idx = db.grades.findIndex((g) => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Note non trouvée" });
  const removed = db.grades.splice(idx, 1)[0];
  saveData(db);
  broadcast({
    type: "grade:deleted",
    payload: { id: removed.id, studentId: removed.studentId },
  });
  res.json({ success: true });
});

// ── Grade history ──────────────────────────────────────────────────────
app.get("/api/grades/:id/history", authenticate, (req, res) => {
  const grade = db.grades.find((g) => g.id === req.params.id);
  if (!grade) return res.status(404).json({ error: "Note non trouvée" });

  if (req.user.role === "STUDENT") {
    const student = db.students.find((s) => s.userId === req.user.id);
    if (!student || grade.studentId !== student.id)
      return res.status(403).json({ error: "Accès interdit" });
  }

  const events = db.auditLog
    .filter((e) => e.gradeId === req.params.id)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  res.json(events);
});

// ── Undo endpoint ──────────────────────────────────────────────────────
app.post(
  "/api/grades/:id/undo",
  authenticate,
  authorize("ADMIN", "TEACHER"),
  (req, res) => {
    const { expectedVersion } = req.body;
    const grade = db.grades.find((g) => g.id === req.params.id);
    if (!grade) return res.status(404).json({ error: "Note non trouvée" });

    if (expectedVersion !== undefined && expectedVersion !== grade.version) {
      return res.status(409).json({
        error: "Conflit de version",
        currentValue: grade.value,
        currentVersion: grade.version,
        lastAuthor: grade.lastAuthor,
        lastUpdatedAt: grade.lastUpdatedAt,
      });
    }

    // Find the previous audit event to get the old value
    const events = db.auditLog
      .filter((e) => e.gradeId === grade.id)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (events.length === 0)
      return res.status(400).json({ error: "Aucun historique pour annuler" });

    const lastEvent = events[events.length - 1];
    const oldValue = grade.value;
    const restoredValue = lastEvent.oldValue;

    grade.value = restoredValue;
    grade.version += 1;
    grade.lastAuthor = req.user.name;
    grade.lastUpdatedAt = new Date().toISOString();

    const auditEvent = {
      id: `a${Date.now()}`,
      studentId: grade.studentId,
      gradeId: grade.id,
      oldValue,
      newValue: restoredValue,
      author: req.user.name,
      timestamp: grade.lastUpdatedAt,
      version: grade.version,
      type: "UNDO",
    };
    db.auditLog.push(auditEvent);
    saveData(db);

    broadcast({
      type: "grade:updated",
      payload: {
        id: grade.id,
        studentId: grade.studentId,
        subject: grade.subject,
        value: grade.value,
        version: grade.version,
        lastAuthor: grade.lastAuthor,
        lastUpdatedAt: grade.lastUpdatedAt,
      },
    });

    res.json(grade);
  },
);

// ── Users management (ADMIN only) ─────────────────────────────────────
app.get("/api/users", authenticate, authorize("ADMIN"), (req, res) => {
  res.json(db.users.map(({ password, ...u }) => u));
});

// ── Reset endpoint (for testing) ──────────────────────────────────────
app.post("/api/reset", (req, res) => {
  db = resetData();
  broadcast({ type: "data:reset", payload: {} });
  res.json({ success: true });
});

// ── HTTP + WebSocket server ────────────────────────────────────────────
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

const clients = new Set();

wss.on("connection", (ws, req) => {
  // Extract token from query string for auth
  const url = new URL(req.url, "http://localhost");
  const token = url.searchParams.get("token");
  const user = verifyToken(token);

  ws.user = user; // may be null if not authenticated
  ws.isAlive = true;
  clients.add(ws);

  ws.on("pong", () => {
    ws.isAlive = true;
  });
  ws.on("close", () => {
    clients.delete(ws);
  });
  ws.on("error", () => {
    clients.delete(ws);
  });

  // Send initial connection confirmation
  ws.send(
    JSON.stringify({
      type: "connected",
      payload: { user: user ? { name: user.name, role: user.role } : null },
    }),
  );
});

// Heartbeat to detect dead connections
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      ws.terminate();
      clients.delete(ws);
      return;
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on("close", () => clearInterval(heartbeat));

function broadcast(message) {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// ── Start ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🔌 WebSocket available at ws://localhost:${PORT}/ws`);
  });
}

export { app, server, db, resetData, loadData, verifyToken, createToken };
