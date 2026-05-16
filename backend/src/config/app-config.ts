import type { EnvSource } from './env-source.ts';

export interface AppConfig {
  auth: {
    password: string;
    jwtSecret: string;
  };
  ai: {
    anthropicApiKey: string | null;
    model: string;
    recipeImport: {
      maxImageBytes: number;
      maxTotalBytes: number;
      maxImages: number;
      debug: boolean;
    };
  };
}

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const DEFAULT_MAX_IMAGES = 8;

export function loadAppConfig(env: EnvSource): AppConfig {
  const password = readNonEmpty(env, 'AUTH_PASSWORD');
  const jwtSecret = readNonEmpty(env, 'AUTH_JWT_SECRET');

  const anthropicApiKey = readOptionalNonEmpty(env, 'ANTHROPIC_API_KEY');
  const model = readOptionalNonEmpty(env, 'ANTHROPIC_MODEL') ?? DEFAULT_MODEL;

  const maxImageBytes = readPositiveInt(env, 'RECIPE_IMPORT_MAX_IMAGE_BYTES', DEFAULT_MAX_IMAGE_BYTES);
  const maxTotalBytes = readPositiveInt(env, 'RECIPE_IMPORT_MAX_TOTAL_BYTES', DEFAULT_MAX_TOTAL_BYTES);
  const maxImages = readPositiveInt(env, 'RECIPE_IMPORT_MAX_IMAGES', DEFAULT_MAX_IMAGES);
  const debug = readBoolean(env, 'RECIPE_IMPORT_DEBUG', false);

  return {
    auth: { password, jwtSecret },
    ai: {
      anthropicApiKey,
      model,
      recipeImport: { maxImageBytes, maxTotalBytes, maxImages, debug },
    },
  };
}

function readNonEmpty(env: EnvSource, key: string): string {
  const value = env.get(key);
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${key} environment variable is required but not set`);
  }
  return value;
}

function readOptionalNonEmpty(env: EnvSource, key: string): string | null {
  const value = env.get(key);
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  return value;
}

function readPositiveInt(env: EnvSource, key: string, fallback: number): number {
  const raw = env.get(key);
  if (typeof raw !== 'string' || raw.trim().length === 0) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function readBoolean(env: EnvSource, key: string, fallback: boolean): boolean {
  const raw = env.get(key);
  if (typeof raw !== 'string') return fallback;
  const v = raw.trim().toLowerCase();
  if (v.length === 0) return fallback;
  if (v === 'true') return true;
  if (v === 'false') return false;
  throw new Error(`${key} must be "true" or "false" (got "${raw}")`);
}
