import test from 'node:test';
import assert from 'node:assert/strict';
import { readGatewayConfig } from '../src/config.mjs';

const valid = {AI_GATEWAY_API_KEY:'test-secret-never-display', TURNO_AGENT_MODEL:'google/gemini-2.5-flash'};

test('never accepts unauthenticated server model access', () => {
  assert.throws(() => readGatewayConfig({TURNO_AGENT_MODEL:valid.TURNO_AGENT_MODEL}),/AI_GATEWAY_API_KEY|VERCEL_OIDC_TOKEN/);
});
test('OIDC is an alternative to an API key', () => {
  assert.equal(readGatewayConfig({VERCEL_OIDC_TOKEN:'fake-oidc',TURNO_AGENT_MODEL:valid.TURNO_AGENT_MODEL}).mode,'GATEWAY');
});
test('does not leak credentials, even as JSON', () => {
  const actual = readGatewayConfig(valid);
  assert.deepEqual(actual,{modelId:'google/gemini-2.5-flash',decisionModelId:'typesafe-ai/jev',mode:'GATEWAY'});
  assert.equal(JSON.stringify(actual).includes(valid.AI_GATEWAY_API_KEY),false);
});
test('rejects unrecognized mode and malformed model identifiers', () => {
  assert.throws(()=>readGatewayConfig({...valid,TURNO_AGENT_MODE:'other'}),/TURNO_AGENT_MODE/);
  assert.throws(()=>readGatewayConfig({...valid,TURNO_AGENT_MODEL:'http://localhost:3333'}),/TURNO_AGENT_MODEL/);
});
