import test from 'node:test';
import assert from 'node:assert/strict';
import { PROVIDERS, PROVIDER_NAMES } from '../model-providers.mjs';
import { readGatewaySettings } from '../gateway-config.mjs';
import { createStrandsModel } from '../model-factory.mjs';

const PLACEHOLDER = 'placeholder-not-a-secret-123';
const envFor = (provider, extra = {}) => ({
  TURNO_AI_ENABLED: '1', TURNO_AI_PROVIDER: provider,
  [PROVIDERS[provider].keyEnv[0]]: PLACEHOLDER, ...extra,
});

test('registro alineado con los proveedores TypeScript de Strands', () => {
  assert.deepEqual(PROVIDER_NAMES, ['vercel', 'openai', 'anthropic', 'google', 'bedrock',
    'openrouter', 'fireworks', 'nebius', 'ovhcloud', 'crusoe', 'orcarouter']);
  for (const [name, p] of Object.entries(PROVIDERS)) {
    assert.ok(p.keyEnv.length > 0, name);
    assert.ok(p.defaultModel, name);
    if (p.kind === 'openai-compatible') assert.match(p.baseURL, /^https:\/\//, name);
  }
});

test('cada proveedor construye su modelo de Strands sin red ni secretos reales', async () => {
  for (const provider of PROVIDER_NAMES) {
    const env = envFor(provider);
    const settings = readGatewaySettings(env);
    assert.equal(settings.provider, provider);
    assert.equal(settings.modelId, PROVIDERS[provider].defaultModel);
    assert.equal(settings.authMode, 'api-key');
    assert.equal(JSON.stringify(settings).includes(PLACEHOLDER), false, provider);
    const model = await createStrandsModel(settings, { maxTokens: 64, env });
    assert.equal(typeof model.stream, 'function', provider);
    assert.equal(model.modelId, settings.modelId, provider);
  }
});

test('GPT directo pide esfuerzo de razonamiento solo en modelos que lo admiten', async () => {
  const gpt = readGatewaySettings(envFor('openai', { TURNO_AI_MODEL_ID: 'gpt-6.1-sol' }));
  const m = await createStrandsModel(gpt, { maxTokens: 64, env: envFor('openai') });
  assert.equal(m.getConfig().params?.reasoning_effort, 'low');
  const old = readGatewaySettings(envFor('openai', { TURNO_AI_MODEL_ID: 'gpt-4.1-mini' }));
  const m2 = await createStrandsModel(old, { maxTokens: 64, env: envFor('openai') });
  assert.equal(m2.getConfig().params?.reasoning_effort, undefined);
});

test('autenticación por proveedor: falla cerrado y acepta alternativas válidas', () => {
  assert.throws(() => readGatewaySettings({ TURNO_AI_ENABLED: '1', TURNO_AI_PROVIDER: 'openrouter' }), /OPENROUTER_API_KEY/);
  assert.throws(() => readGatewaySettings({ TURNO_AI_ENABLED: '1', TURNO_AI_PROVIDER: 'anthropic', AI_GATEWAY_API_KEY: 'x' }), /ANTHROPIC_API_KEY/);
  const gemini = readGatewaySettings({ TURNO_AI_ENABLED: '1', TURNO_AI_PROVIDER: 'google', GEMINI_API_KEY: 'x' });
  assert.equal(gemini.keyEnv, 'GEMINI_API_KEY');
  const aws = readGatewaySettings({ TURNO_AI_ENABLED: '1', TURNO_AI_PROVIDER: 'bedrock', AWS_PROFILE: 'turno', AWS_REGION: 'eu-west-1' });
  assert.equal(aws.authMode, 'aws-credentials');
  assert.equal(aws.region, 'eu-west-1');
  // OIDC de Vercel no autentica a otros proveedores.
  assert.throws(() => readGatewaySettings({ TURNO_AI_ENABLED: '1', TURNO_AI_PROVIDER: 'openai', VERCEL: '1' }), /OPENAI_API_KEY/);
});

test('valida proveedor, ids de modelo y región', () => {
  assert.throws(() => readGatewaySettings({ TURNO_AI_PROVIDER: 'ollama' }), /TURNO_AI_PROVIDER/);
  assert.throws(() => readGatewaySettings({ TURNO_AI_PROVIDER: 'openai', TURNO_AI_MODEL_ID: 'https://evil/x?y' }), /Modelo/);
  assert.throws(() => readGatewaySettings({ TURNO_AI_PROVIDER: 'vercel', TURNO_AI_MODEL_ID: 'gpt-5-mini' }), /Modelo/);
  assert.equal(readGatewaySettings({ TURNO_AI_PROVIDER: 'fireworks' }).modelId, 'accounts/fireworks/models/deepseek-v3p1-terminus');
  assert.throws(() => readGatewaySettings({ TURNO_AI_PROVIDER: 'bedrock', AWS_REGION: 'us-east-1; rm' }), /AWS_REGION/);
});
