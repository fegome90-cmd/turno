import test from 'node:test';
import assert from 'node:assert/strict';
import { readGatewaySettings, assertSyntheticEvent, gatewayProviderOptions } from '../gateway-config.mjs';
test('predeterminado desactivado y sintético',()=>{
  const x=readGatewaySettings({});
  assert.equal(x.enabled,false);assert.equal(x.syntheticOnly,true);assert.equal(x.authMode,'missing');
});
test('habilitado requiere clave u OIDC y nunca expone la clave',()=>{
  assert.throws(()=>readGatewaySettings({TURNO_AI_ENABLED:'1'}),/autenticación/);
  const key='secret-synthetic-test-key';
  const x=readGatewaySettings({TURNO_AI_ENABLED:'1',AI_GATEWAY_API_KEY:key});
  assert.equal(x.authMode,'api-key');
  assert.equal(JSON.stringify(x).includes(key),false);
  assert.equal(Object.isFrozen(x),true);
  assert.equal(readGatewaySettings({TURNO_AI_ENABLED:'1',VERCEL:'1'}).authMode,'oidc');
});
test('modo remoto permitido, sin clasificador local',()=>{
  for(const mode of ['GATEWAY','DUAL','DECISION']) assert.equal(readGatewaySettings({TURNO_DECISION_MODE:mode}).decisionMode,mode);
  assert.throws(()=>readGatewaySettings({TURNO_DECISION_MODE:'DECIDER'}),/Modo/);
});
test('ID de modelo válido y chequeo de evento',()=>{
  assert.throws(()=>readGatewaySettings({TURNO_AI_MODEL_ID:'https://localhost/secret'}),/Modelo/);
  const s={enabled:true,syntheticOnly:true};
  assert.throws(()=>assertSyntheticEvent({id:'a',synthetic:false},s),/sintéticos/);
  assert.doesNotThrow(()=>assertSyntheticEvent({id:'a',synthetic:true},s));
});
test('modelo por defecto gratuito y GPT configurable',()=>{
  assert.equal(readGatewaySettings({}).modelId,'nvidia/nemotron-3.5-lightning-free');
  assert.equal(readGatewaySettings({TURNO_AI_MODEL_ID:'openai/gpt-6.1-sol'}).modelId,'openai/gpt-6.1-sol');
});
test('opciones de Gateway: enrutamiento opcional, tags y razonamiento solo en GPT',()=>{
  const free=gatewayProviderOptions(readGatewaySettings({}));
  assert.deepEqual(free,{gateway:{tags:['turno','synthetic-pilot']}});
  const gpt=gatewayProviderOptions(readGatewaySettings({TURNO_AI_MODEL_ID:'openai/gpt-6.1-sol',TURNO_GATEWAY_ONLY:'openai'}));
  assert.deepEqual(gpt.gateway.only,['openai']);
  assert.equal(gpt.openai.reasoningEffort,'low');
  assert.equal(gatewayProviderOptions(readGatewaySettings({TURNO_AI_MODEL_ID:'openai/gpt-4.1-mini'})).openai,undefined);
  assert.equal(readGatewaySettings({TURNO_GATEWAY_ONLY:'*'}).providerOnly,null);
  assert.throws(()=>readGatewaySettings({TURNO_GATEWAY_ONLY:'openai,https://x'}),/TURNO_GATEWAY_ONLY/);
  assert.throws(()=>readGatewaySettings({TURNO_AI_REASONING_EFFORT:'max'}),/REASONING/);
});
