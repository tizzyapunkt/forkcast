import { fetchJson } from './client';
import type {
  ConfirmResolutionPayload,
  ConfirmResolutionResponse,
  ResolutionItemInput,
  ResolutionProposal,
} from '../domain/food-resolution';

/** Batch-propose resolutions for unmatched ingredients (one AI call, one proposal per item). */
export async function proposeResolutions(items: ResolutionItemInput[]): Promise<ResolutionProposal[]> {
  const body = await fetchJson<{ proposals: ResolutionProposal[] }>('/api/propose-ingredient-resolutions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  return body.proposals;
}

/** Confirm a (possibly edited) resolution; returns the resolved matched draft row. */
export async function confirmResolution(payload: ConfirmResolutionPayload): Promise<ConfirmResolutionResponse> {
  return fetchJson<ConfirmResolutionResponse>('/api/confirm-ingredient-resolution', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
