import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Support large base64 payload for live captured camera photos
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // ================= API ROUTES =================

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Factory Attendance & Payroll Management Server',
      serverTime: new Date().toISOString(),
    });
  });

  // Workers
  app.get('/api/workers', (req, res) => {
    try {
      const workers = db.getWorkers();
      res.json(workers);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/workers/:id', (req, res) => {
    try {
      const worker = db.getWorkerById(req.params.id);
      if (!worker) return res.status(404).json({ error: 'Worker not found' });
      res.json(worker);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/workers', (req, res) => {
    try {
      const created = db.createWorker(req.body);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/workers/:id', (req, res) => {
    try {
      const updated = db.updateWorker(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Worker not found' });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/workers/:id', (req, res) => {
    try {
      const success = db.deleteWorker(req.params.id);
      if (!success) return res.status(404).json({ error: 'Worker not found' });
      res.json({ success: true, message: 'Worker deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Guards
  app.get('/api/guards', (req, res) => {
    try {
      const guards = db.getGuards();
      res.json(guards);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/guards', (req, res) => {
    try {
      const created = db.createGuard(req.body);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/guards/:id', (req, res) => {
    try {
      const updated = db.updateGuard(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Guard not found' });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch('/api/guards/:id/status', (req, res) => {
    try {
      const updated = db.toggleGuardStatus(req.params.id);
      if (!updated) return res.status(404).json({ error: 'Guard not found' });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Attendance
  app.get('/api/attendance', (req, res) => {
    try {
      const { date, month, workerId, status } = req.query;
      const records = db.getAttendance({
        date: date as string | undefined,
        month: month as string | undefined,
        workerId: workerId as string | undefined,
        status: status as string | undefined,
      });
      res.json(records);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/attendance/check-in', (req, res) => {
    try {
      const record = db.recordCheckIn(req.body);
      res.status(201).json(record);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/attendance/check-out', (req, res) => {
    try {
      const record = db.recordCheckOut(req.body);
      res.json(record);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/attendance/override', (req, res) => {
    try {
      const { recordId, updates, adminName, reason } = req.body;
      if (!recordId || !reason) {
        return res.status(400).json({ error: 'recordId and reason are required' });
      }
      const record = db.adminOverrideAttendance(recordId, updates, adminName || 'Admin', reason);
      res.json(record);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Rules
  app.get('/api/rules', (req, res) => {
    try {
      res.json(db.getRules());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/rules', (req, res) => {
    try {
      const updated = db.updateRules(req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Payroll
  app.get('/api/payroll', (req, res) => {
    try {
      const month = (req.query.month as string) || '2026-10';
      const records = db.getPayroll(month);
      res.json(records);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/payroll/calculate', (req, res) => {
    try {
      const month = req.body.month || '2026-10';
      const recalculated = db.recalculatePayroll(month);
      res.json(recalculated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/payroll/:id/pay', (req, res) => {
    try {
      const record = db.markPayrollPaid(req.params.id);
      if (!record) return res.status(404).json({ error: 'Payroll record not found' });
      res.json(record);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Advance Salary Management
  app.get('/api/advances', (req, res) => {
    try {
      const { workerId, month, status, paymentMode, search } = req.query;
      const advances = db.getAdvances({
        workerId: workerId as string | undefined,
        month: month as string | undefined,
        status: status as string | undefined,
        paymentMode: paymentMode as string | undefined,
        search: search as string | undefined,
      });
      res.json(advances);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/advances/stats', (req, res) => {
    try {
      const month = (req.query.month as string) || '2026-10';
      const stats = db.getAdvanceStats(month);
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get(['/api/advances/worker/:workerId', '/api/advances/worker/:workerId/summary'], (req, res) => {
    try {
      const summary = db.getWorkerAdvanceSummary(req.params.workerId);
      res.json(summary);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.get('/api/advances/:id', (req, res) => {
    try {
      const advance = db.getAdvanceById(req.params.id);
      if (!advance) return res.status(404).json({ error: 'Advance transaction not found' });
      res.json(advance);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/advances', (req, res) => {
    try {
      const created = db.createAdvance(req.body);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/advances/:id', (req, res) => {
    try {
      const updated = db.updateAdvance(req.params.id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/advances/:id/void', (req, res) => {
    try {
      const { voidedBy, reason } = req.body;
      const voided = db.voidAdvance(req.params.id, voidedBy, reason);
      res.json(voided);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Reports
  app.get('/api/reports', (req, res) => {
    try {
      const month = (req.query.month as string) || '2026-10';
      const reports = db.getReports(month);
      res.json(reports);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Dashboard Stats
  app.get('/api/stats', (req, res) => {
    try {
      const date = (req.query.date as string) || '2026-10-08';
      const month = (req.query.month as string) || '2026-10';
      const stats = db.getDashboardStats(date, month);
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Audit Logs
  app.get('/api/audit-logs', (req, res) => {
    try {
      res.json(db.getAuditLogs());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Reset database to complete seed state
  app.post('/api/database/reset', (req, res) => {
    try {
      db.resetToDefaults();
      res.json({ success: true, message: 'Database reset to seed data successfully.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ================= VITE MIDDLEWARE (DEV) / STATIC (PROD) =================
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Factory GatePass] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
