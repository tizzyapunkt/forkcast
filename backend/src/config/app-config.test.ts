import { describe, it, expect } from 'vitest';
import { loadAppConfig } from './app-config.ts';
import { InMemoryEnvSource } from './in-memory-env-source.ts';

const requiredKeys = {
  AUTH_PASSWORD: 'pw',
  AUTH_JWT_SECRET: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
};

describe('loadAppConfig', () => {
  it('loads required auth values and applies all defaults when only required keys are present', () => {
    const env = new InMemoryEnvSource(requiredKeys);

    const config = loadAppConfig(env);

    expect(config.auth.password).toBe('pw');
    expect(config.auth.jwtSecret).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(config.ai.anthropicApiKey).toBeNull();
    expect(config.ai.model).toBe('claude-sonnet-4-6');
    expect(config.ai.recipeImport.maxImageBytes).toBe(5 * 1024 * 1024);
    expect(config.ai.recipeImport.maxTotalBytes).toBe(20 * 1024 * 1024);
    expect(config.ai.recipeImport.maxImages).toBe(8);
  });

  it('ignores the retired RECIPE_IMPORT_DEBUG variable instead of failing on it', () => {
    for (const v of ['true', 'false', 'banana']) {
      const env = new InMemoryEnvSource({ ...requiredKeys, RECIPE_IMPORT_DEBUG: v });
      expect(() => loadAppConfig(env)).not.toThrow();
      expect(loadAppConfig(env).ai.recipeImport).not.toHaveProperty('debug');
    }
  });

  it('throws a descriptive error when AUTH_PASSWORD is missing', () => {
    const env = new InMemoryEnvSource({ AUTH_JWT_SECRET: requiredKeys.AUTH_JWT_SECRET });
    expect(() => loadAppConfig(env)).toThrow(/AUTH_PASSWORD/);
  });

  it('throws when AUTH_PASSWORD is empty or whitespace-only', () => {
    const env = new InMemoryEnvSource({ ...requiredKeys, AUTH_PASSWORD: '   ' });
    expect(() => loadAppConfig(env)).toThrow(/AUTH_PASSWORD/);
  });

  it('throws a descriptive error when AUTH_JWT_SECRET is missing', () => {
    const env = new InMemoryEnvSource({ AUTH_PASSWORD: requiredKeys.AUTH_PASSWORD });
    expect(() => loadAppConfig(env)).toThrow(/AUTH_JWT_SECRET/);
  });

  it('treats ANTHROPIC_API_KEY as optional and exposes null when absent', () => {
    const env = new InMemoryEnvSource(requiredKeys);
    const config = loadAppConfig(env);
    expect(config.ai.anthropicApiKey).toBeNull();
  });

  it('exposes ANTHROPIC_API_KEY when set and a custom model when overridden', () => {
    const env = new InMemoryEnvSource({
      ...requiredKeys,
      ANTHROPIC_API_KEY: 'sk-test',
      ANTHROPIC_MODEL: 'claude-future-model',
    });
    const config = loadAppConfig(env);
    expect(config.ai.anthropicApiKey).toBe('sk-test');
    expect(config.ai.model).toBe('claude-future-model');
  });

  it('parses numeric recipe-import limits and falls back to defaults for invalid values', () => {
    const env = new InMemoryEnvSource({
      ...requiredKeys,
      RECIPE_IMPORT_MAX_IMAGE_BYTES: '1024',
      RECIPE_IMPORT_MAX_TOTAL_BYTES: 'not-a-number',
      RECIPE_IMPORT_MAX_IMAGES: '0',
    });
    const config = loadAppConfig(env);
    expect(config.ai.recipeImport.maxImageBytes).toBe(1024);
    // Invalid → fallback to default
    expect(config.ai.recipeImport.maxTotalBytes).toBe(20 * 1024 * 1024);
    // Zero → fallback to default (a zero cap is never what the user means)
    expect(config.ai.recipeImport.maxImages).toBe(8);
  });
});
