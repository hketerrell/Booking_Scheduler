import { BookingState } from '../types';
import { hydrateState } from './initialData';

const WORKER_API_URL = import.meta.env.VITE_WORKER_API_URL as string | undefined;
const WORKER_API_KEY = import.meta.env.VITE_WORKER_API_KEY as string | undefined;

const getHeaders = () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (WORKER_API_KEY) {
    headers.Authorization = `Bearer ${WORKER_API_KEY}`;
  }

  return headers;
};

export const isRemotePersistenceEnabled = (): boolean => Boolean(WORKER_API_URL);

export const loadRemoteState = async (): Promise<BookingState> => {
  if (!WORKER_API_URL) {
    throw new Error('Remote persistence is not configured. Set VITE_WORKER_API_URL.');
  }

  const response = await fetch(WORKER_API_URL, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to load remote data (${response.status})`);
  }

  const payload = (await response.json()) as { state?: Partial<BookingState> };
  if (!payload.state) {
    throw new Error('Remote state payload is missing.');
  }

  const hydrated = hydrateState(payload.state);
  if (!hydrated) {
    throw new Error('Remote state payload is invalid.');
  }

  return hydrated;
};

export const saveRemoteState = async (state: BookingState): Promise<void> => {
  if (!WORKER_API_URL) {
    throw new Error('Remote persistence is not configured. Set VITE_WORKER_API_URL.');
  }

  const response = await fetch(WORKER_API_URL, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ state }),
  });

  if (!response.ok) {
    throw new Error(`Failed to save remote data (${response.status})`);
  }
};
