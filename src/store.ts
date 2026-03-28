import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { UserProfile, AppState, GenerationStep, MaterialSet } from './types.js';

const DATA_DIR = join(import.meta.dirname, '..', 'data');
const OUTPUTS_DIR = join(import.meta.dirname, '..', 'outputs');

function defaultState(): AppState {
  const steps = {} as AppState['steps'];
  const allSteps: GenerationStep[] = ['ocr', 'visa-form', 'itinerary', 'hotel', 'employment', 'photo'];
  for (const s of allSteps) steps[s] = { status: 'pending' };
  return {
    currentSession: null,
    passport: null,
    profile: null,
    intent: null,
    materials: null,
    steps,
  };
}

let state: AppState = defaultState();

export function getState(): AppState {
  return state;
}

export function resetState(): void {
  state = defaultState();
}

export function updateStep(step: GenerationStep, status: AppState['steps'][GenerationStep]['status'], message?: string): void {
  state.steps[step] = { status, message };
}

export function setState(partial: Partial<AppState>): void {
  Object.assign(state, partial);
}

export async function loadProfile(): Promise<UserProfile | null> {
  try {
    const raw = await readFile(join(DATA_DIR, 'user-profile.json'), 'utf-8');
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(join(DATA_DIR, 'user-profile.json'), JSON.stringify(profile, null, 2));
  state.profile = profile;
}

export async function ensureSessionDir(sessionId: string): Promise<string> {
  const dir = join(OUTPUTS_DIR, sessionId);
  await mkdir(dir, { recursive: true });
  return dir;
}

export function getOutputsDir(): string {
  return OUTPUTS_DIR;
}

export async function saveMaterials(materials: MaterialSet): Promise<void> {
  state.materials = materials;
  const dir = await ensureSessionDir(materials.sessionId);
  await writeFile(join(dir, 'materials.json'), JSON.stringify(materials, null, 2));
}
