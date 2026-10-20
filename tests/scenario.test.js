import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import WebSocket from 'ws';
import { app, server } from '../server/index.js';

describe('TP Scenario & Role Security Tests', () => {
  let adminToken;
  let teacherAToken;
  let teacherBToken;
  let studentToken;
  let testPort;

  beforeAll(async () => {
    await new Promise((resolve) => {
      server.listen(0, () => {
        testPort = server.address().port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(async () => {
    // Reset database to initial state
    await request(app).post('/api/reset');

    // Login users to get tokens
    const adminRes = await request(app)
      .post('/api/login')
      .send({ email: 'admin@test.com', password: 'admin123' });
    adminToken = adminRes.body.token;

    const teacherARes = await request(app)
      .post('/api/login')
      .send({ email: 'teacher1@test.com', password: 'teacher123' });
    teacherAToken = teacherARes.body.token;

    const teacherBRes = await request(app)
      .post('/api/login')
      .send({ email: 'teacher2@test.com', password: 'teacher123' });
    teacherBToken = teacherBRes.body.token;

    const studentRes = await request(app)
      .post('/api/login')
      .send({ email: 'student1@test.com', password: 'student123' });
    studentToken = studentRes.body.token;
  });

  describe('Part 1: Moroccan Arabic Names & Computer Science Modules', () => {
    it('should have Moroccan Arabic student names in database', async () => {
      const res = await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.status).toBe(200);
      const studentNames = res.body.map(s => `${s.firstName} ${s.lastName}`);
      expect(studentNames).toContain('Yassine El Amrani');
      expect(studentNames).toContain('Salma Benjelloun');
      expect(studentNames).toContain('Omar Idrissi');
    });

    it('should have computer science modules for grades', async () => {
      const res = await request(app)
        .get('/api/grades')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.status).toBe(200);
      const subjects = res.body.map(g => g.subject);
      expect(subjects).toContain('Algorithmique');
      expect(subjects).toContain('Bases de données');
      expect(subjects).toContain('Programmation Web');
      expect(subjects).toContain('Réseaux informatiques');
    });
  });

  describe('Role Security on Server', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app).get('/api/grades');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Non authentifié');
    });

    it('STUDENT cannot modify any grade (403)', async () => {
      const res = await request(app)
        .put('/api/grades/g1')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ value: 18, expectedVersion: 4 });
      
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Accès interdit');
    });

    it('STUDENT cannot create a grade (403)', async () => {
      const res = await request(app)
        .post('/api/grades')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ studentId: 's1', subject: 'Algorithmique', value: 15 });
      
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Accès interdit');
    });

    it('STUDENT can only read own grades', async () => {
      const res = await request(app)
        .get('/api/grades')
        .set('Authorization', `Bearer ${studentToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      res.body.forEach(grade => {
        expect(grade.studentId).toBe('s1');
      });
    });

    it('TEACHER cannot delete a grade (403)', async () => {
      const res = await request(app)
        .delete('/api/grades/g1')
        .set('Authorization', `Bearer ${teacherAToken}`);
      
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Accès interdit');
    });

    it('TEACHER cannot delete a student (403)', async () => {
      const res = await request(app)
        .delete('/api/students/s1')
        .set('Authorization', `Bearer ${teacherAToken}`);
      
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Accès interdit');
    });

    it('TEACHER cannot manage users (403)', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${teacherAToken}`);
      
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Accès interdit');
    });

    it('ADMIN can manage users (200)', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(4);
    });
  });

  describe('Part 2: Mandatory TP Scenario (Steps 1 to 5)', () => {
    it('Step 1: Teacher A and Teacher B read the same grade at version 4 (12/20)', async () => {
      const resA = await request(app)
        .get('/api/grades/g1')
        .set('Authorization', `Bearer ${teacherAToken}`);
      
      const resB = await request(app)
        .get('/api/grades/g1')
        .set('Authorization', `Bearer ${teacherBToken}`);
      
      expect(resA.status).toBe(200);
      expect(resA.body.id).toBe('g1');
      expect(resA.body.value).toBe(12);
      expect(resA.body.version).toBe(4);

      expect(resB.status).toBe(200);
      expect(resB.body.id).toBe('g1');
      expect(resB.body.value).toBe(12);
      expect(resB.body.version).toBe(4);
    });

    it('Step 2: Teacher A changes 12 → 16: server returns version 5, and Teacher B receives WebSocket event live', async () => {
      // Connect Teacher B to WebSocket
      const wsB = new WebSocket(`ws://localhost:${testPort}/ws?token=${teacherBToken}`);
      
      const wsMessagePromise = new Promise((resolve) => {
        wsB.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'grade:updated') {
            resolve(msg);
          }
        });
      });

      await new Promise((resolve) => wsB.on('open', resolve));

      // Teacher A updates grade
      const resA = await request(app)
        .put('/api/grades/g1')
        .set('Authorization', `Bearer ${teacherAToken}`)
        .send({ value: 16, expectedVersion: 4 });
      
      expect(resA.status).toBe(200);
      expect(resA.body.value).toBe(16);
      expect(resA.body.version).toBe(5);
      expect(resA.body.lastAuthor).toBe('Fatima Zahra Mansouri');
      expect(resA.body.lastUpdatedAt).toBeDefined();

      // Teacher B receives live WebSocket event
      const wsEvent = await wsMessagePromise;
      expect(wsEvent.type).toBe('grade:updated');
      expect(wsEvent.payload.id).toBe('g1');
      expect(wsEvent.payload.value).toBe(16);
      expect(wsEvent.payload.version).toBe(5);
      expect(wsEvent.payload.lastAuthor).toBe('Fatima Zahra Mansouri');
      expect(wsEvent.payload.lastUpdatedAt).toBeDefined();

      wsB.close();
    });

    it('Step 3: Teacher B saves 14 with expectedVersion 4 → returns HTTP 409 conflict, never a silent overwrite', async () => {
      // Teacher A updates first
      await request(app)
        .put('/api/grades/g1')
        .set('Authorization', `Bearer ${teacherAToken}`)
        .send({ value: 16, expectedVersion: 4 });

      // Teacher B attempts update with stale version 4
      const resB = await request(app)
        .put('/api/grades/g1')
        .set('Authorization', `Bearer ${teacherBToken}`)
        .send({ value: 14, expectedVersion: 4 });
      
      expect(resB.status).toBe(409);
      expect(resB.body.error).toBe('Conflit de version');
      expect(resB.body.currentValue).toBe(16);
      expect(resB.body.currentVersion).toBe(5);
      expect(resB.body.lastAuthor).toBe('Fatima Zahra Mansouri');
      expect(resB.body.lastUpdatedAt).toBeDefined();

      // Verify server value was NOT silently overwritten
      const checkRes = await request(app)
        .get('/api/grades/g1')
        .set('Authorization', `Bearer ${teacherBToken}`);
      expect(checkRes.body.value).toBe(16);
      expect(checkRes.body.version).toBe(5);
    });

    it('Step 4: Teacher B can resubmit a new modification based on version 5', async () => {
      // Teacher A updates to 16 (v5)
      await request(app)
        .put('/api/grades/g1')
        .set('Authorization', `Bearer ${teacherAToken}`)
        .send({ value: 16, expectedVersion: 4 });

      // Teacher B resubmits based on server version 5
      const resB = await request(app)
        .put('/api/grades/g1')
        .set('Authorization', `Bearer ${teacherBToken}`)
        .send({ value: 14, expectedVersion: 5 });
      
      expect(resB.status).toBe(200);
      expect(resB.body.value).toBe(14);
      expect(resB.body.version).toBe(6);
      expect(resB.body.lastAuthor).toBe('Mehdi Alami');
    });

    it('Step 5: History shows chronological events & Annuler creates NEW update (type UNDO) without deleting history', async () => {
      // 1. Teacher A modifies 12 -> 16 (version 5)
      await request(app)
        .put('/api/grades/g1')
        .set('Authorization', `Bearer ${teacherAToken}`)
        .send({ value: 16, expectedVersion: 4 });

      // 2. Fetch history
      const historyBeforeUndo = await request(app)
        .get('/api/grades/g1/history')
        .set('Authorization', `Bearer ${teacherAToken}`);
      
      expect(historyBeforeUndo.status).toBe(200);
      const eventsBefore = historyBeforeUndo.body;
      expect(eventsBefore.length).toBe(4); // a1, a2, a3, and new v5 update
      const latestBefore = eventsBefore[eventsBefore.length - 1];
      expect(latestBefore.oldValue).toBe(12);
      expect(latestBefore.newValue).toBe(16);
      expect(latestBefore.version).toBe(5);
      expect(latestBefore.type).toBe('UPDATE');

      // 3. Annuler (Undo) action
      const undoRes = await request(app)
        .post('/api/grades/g1/undo')
        .set('Authorization', `Bearer ${teacherAToken}`)
        .send({ expectedVersion: 5 });
      
      expect(undoRes.status).toBe(200);
      expect(undoRes.body.value).toBe(12); // restored old value
      expect(undoRes.body.version).toBe(6); // new incremented version

      // 4. Fetch history after undo: never deleted, new event appended
      const historyAfterUndo = await request(app)
        .get('/api/grades/g1/history')
        .set('Authorization', `Bearer ${teacherAToken}`);
      
      expect(historyAfterUndo.status).toBe(200);
      const eventsAfter = historyAfterUndo.body;
      expect(eventsAfter.length).toBe(5); // 4 + 1 new UNDO event
      
      const undoEvent = eventsAfter[eventsAfter.length - 1];
      expect(undoEvent.type).toBe('UNDO');
      expect(undoEvent.oldValue).toBe(16);
      expect(undoEvent.newValue).toBe(12);
      expect(undoEvent.version).toBe(6);
      expect(undoEvent.author).toBe('Fatima Zahra Mansouri');
    });
  });
});
