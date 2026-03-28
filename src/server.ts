import express from 'express';
import multer from 'multer';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { extractPassport } from './ocr.js';
import { generateAll } from './generator.js';
import { getState, setState, loadProfile, saveProfile, resetState, getOutputsDir } from './store.js';
import type { TravelIntent, UserProfile, SSEEvent } from './types.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(join(import.meta.dirname, '..', 'public')));

// SSE clients
const sseClients = new Set<express.Response>();

function broadcast(event: SSEEvent): void {
  const data = JSON.stringify(event);
  for (const client of sseClients) {
    client.write(`data: ${data}\n\n`);
  }
}

// Health check
app.get('/health', (_req, res) => {
  const state = getState();
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    session: state.currentSession,
    steps: state.steps,
  });
});

// SSE stream
app.get('/api/events', (_req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.write('data: {"type":"connected"}\n\n');
  sseClients.add(res);
  _req.on('close', () => sseClients.delete(res));
});

// OCR: upload passport image
app.post('/api/ocr', upload.single('passport'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    const base64 = req.file.buffer.toString('base64');
    const passport = await extractPassport(base64);
    setState({ passport });
    res.json({ success: true, data: passport });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Profile: get
app.get('/api/profile', async (_req, res) => {
  try {
    const profile = await loadProfile();
    res.json({ success: true, data: profile });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Profile: save
app.post('/api/profile', async (req, res) => {
  try {
    const profile = req.body as UserProfile;
    await saveProfile(profile);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Set travel intent
app.post('/api/intent', (req, res) => {
  try {
    const intent = req.body as TravelIntent;
    setState({ intent });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Generate all materials
app.post('/api/generate', upload.single('photo'), async (req, res) => {
  try {
    const state = getState();
    if (!state.passport) {
      res.status(400).json({ error: 'Please upload and OCR passport first' });
      return;
    }
    if (!state.profile) {
      res.status(400).json({ error: 'Please fill in profile first' });
      return;
    }
    if (!state.intent) {
      res.status(400).json({ error: 'Please set travel intent first' });
      return;
    }

    const photoBuffer = req.file?.buffer ?? null;

    // Run generation async, respond immediately
    res.json({ success: true, message: 'Generation started. Watch SSE for progress.' });

    generateAll(photoBuffer, broadcast).catch((err) => {
      broadcast({ type: 'error', message: (err as Error).message });
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Current state
app.get('/api/status', (_req, res) => {
  res.json({ success: true, data: getState() });
});

// Download material
app.get('/api/materials/:sessionId/:filename', async (req, res) => {
  try {
    const filePath = join(getOutputsDir(), req.params.sessionId, req.params.filename);
    const data = await readFile(filePath);
    const ext = req.params.filename.split('.').pop();
    const mimeMap: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', png: 'image/png' };
    res.setHeader('Content-Type', mimeMap[ext ?? ''] ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${req.params.filename}"`);
    res.send(data);
  } catch {
    res.status(404).json({ error: 'File not found' });
  }
});

// Reset session
app.post('/api/reset', (_req, res) => {
  resetState();
  res.json({ success: true });
});

const PORT = Number(process.env.PORT) || 8080;
app.listen(PORT, () => {
  console.log(`VisaBot server running on http://localhost:${PORT}`);
});
