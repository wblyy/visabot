import { randomUUID } from 'node:crypto';
import { getState, setState, updateStep, ensureSessionDir, saveMaterials } from './store.js';
import { generateVisaForm } from './generators/form-filler.js';
import { generateItinerary } from './generators/itinerary.js';
import { generateHotelConfirmation } from './generators/hotel.js';
import { generateEmploymentLetter } from './generators/employment.js';
import { processPhoto } from './generators/photo.js';
import type { MaterialSet, SSEEvent, GenerationStep } from './types.js';

type SSECallback = (event: SSEEvent) => void;

async function runStep(
  step: GenerationStep,
  fn: () => Promise<unknown>,
  emit: SSECallback,
): Promise<unknown> {
  updateStep(step, 'running');
  emit({ type: 'step-update', step, status: 'running' });
  try {
    const result = await fn();
    updateStep(step, 'done');
    emit({ type: 'step-update', step, status: 'done' });
    return result;
  } catch (err) {
    const message = (err as Error).message;
    updateStep(step, 'error', message);
    emit({ type: 'step-update', step, status: 'error', message });
    throw err;
  }
}

export async function generateAll(
  photoBuffer: Buffer | null,
  emit: SSECallback,
): Promise<MaterialSet> {
  const state = getState();
  if (!state.passport) throw new Error('Passport data required');
  if (!state.profile) throw new Error('User profile required');
  if (!state.intent) throw new Error('Travel intent required');

  const sessionId = randomUUID();
  setState({ currentSession: sessionId });
  const outputDir = await ensureSessionDir(sessionId);

  const materials: MaterialSet = {
    sessionId,
    createdAt: new Date().toISOString(),
  };

  // 1. Visa form
  materials.visaForm = await runStep('visa-form', () =>
    generateVisaForm(state.passport!, state.profile!, state.intent!, outputDir),
  emit) as MaterialSet['visaForm'];

  // 2. Itinerary
  materials.itinerary = await runStep('itinerary', () =>
    generateItinerary(state.intent!, state.passport!, outputDir),
  emit) as MaterialSet['itinerary'];

  // 3. Hotel confirmation
  materials.hotelConfirmation = await runStep('hotel', () =>
    generateHotelConfirmation(state.intent!, state.passport!, outputDir),
  emit) as MaterialSet['hotelConfirmation'];

  // 4. Employment letter
  const travelDates = `${state.intent!.startDate} ~ ${state.intent!.endDate}`;
  materials.employmentLetter = await runStep('employment', () =>
    generateEmploymentLetter(state.profile!, state.passport!, travelDates, outputDir),
  emit) as MaterialSet['employmentLetter'];

  // 5. Photo (optional)
  if (photoBuffer) {
    materials.photo = await runStep('photo', () =>
      processPhoto(photoBuffer, outputDir),
    emit) as MaterialSet['photo'];
  } else {
    updateStep('photo', 'done', 'Skipped - no photo uploaded');
    emit({ type: 'step-update', step: 'photo', status: 'done', message: 'Skipped' });
  }

  await saveMaterials(materials);
  emit({ type: 'complete', data: materials });

  return materials;
}
