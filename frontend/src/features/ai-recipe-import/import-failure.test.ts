import { ApiError } from '../../api/client';
import { ImportNotConfiguredError } from '../../api/import-recipe-from-photos';
import { describeImportFailure, ImportTimeoutError } from './import-failure';

const onLine = (value: boolean) => {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
};

afterEach(() => onLine(true));

describe('describeImportFailure', () => {
  it('names the missing server configuration and offers no retry', () => {
    const failure = describeImportFailure(new ImportNotConfiguredError());

    expect(failure.message).toMatch(/nicht aktiviert/i);
    expect(failure.canRetry).toBe(false);
  });

  it('reports a lost connection before blaming the server', () => {
    onLine(false);

    const failure = describeImportFailure(new TypeError('Failed to fetch'));

    expect(failure.message).toMatch(/keine internetverbindung/i);
    expect(failure.canRetry).toBe(true);
  });

  it('separates an unreachable server from being offline', () => {
    const failure = describeImportFailure(new TypeError('Failed to fetch'));

    expect(failure.message).toMatch(/nicht erreichbar/i);
    expect(failure.canRetry).toBe(true);
  });

  it('reports a timed-out read with a way to shrink the job', () => {
    const failure = describeImportFailure(new ImportTimeoutError());

    expect(failure.message).toMatch(/zu lange/i);
    expect(failure.hint).toMatch(/weniger fotos/i);
    expect(failure.canRetry).toBe(true);
  });

  it('tells the user to drop a photo when the payload is rejected as too large', () => {
    const failure = describeImportFailure(new ApiError(413, 'Combined image size exceeds the total limit'));

    expect(failure.message).toMatch(/zu groß/i);
    expect(failure.hint).toMatch(/entferne/i);
  });

  it('explains a failed extraction as a photo problem, not a bug', () => {
    const failure = describeImportFailure(new ApiError(502, 'ai-extraction-failed'));

    expect(failure.message).toMatch(/kein rezept lesen/i);
    expect(failure.hint).toMatch(/text/i);
    expect(failure.canRetry).toBe(true);
  });

  it('sends an expired session back to the login instead of a retry', () => {
    const failure = describeImportFailure(new ApiError(401, 'Unauthorized'));

    expect(failure.message).toMatch(/sitzung/i);
    expect(failure.canRetry).toBe(false);
  });

  it('asks the user to wait when rate limited', () => {
    const failure = describeImportFailure(new ApiError(429, 'Too Many Requests'));

    expect(failure.message).toMatch(/zu viele anfragen/i);
    expect(failure.canRetry).toBe(true);
  });

  it('reports a server fault as retryable', () => {
    const failure = describeImportFailure(new ApiError(500, 'Internal Server Error'));

    expect(failure.message).toMatch(/fehler gemeldet/i);
    expect(failure.canRetry).toBe(true);
  });

  it('reports a rejected request as a validation problem', () => {
    const failure = describeImportFailure(new ApiError(400, 'images must be an array'));

    expect(failure.message).toMatch(/nicht verarbeiten/i);
  });

  it('never surfaces a raw non-error value', () => {
    const failure = describeImportFailure('boom');

    expect(failure.message).toMatch(/fehlgeschlagen/i);
    expect(failure.message).not.toMatch(/boom/);
    expect(failure.canRetry).toBe(true);
  });
});
