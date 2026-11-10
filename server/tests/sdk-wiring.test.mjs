import test from 'node:test';
import assert from 'node:assert/strict';
// Verifica los imports reales y la compatibilidad de objetos SIN invocar APIs.
test('Strands acepta Vercel Gateway como modelo sin red ni credenciales', async () => {
  const [{ Agent }, { VercelModel }, { gateway }, { experimental_decide }] = await Promise.all([
    import('@strands-agents/sdk'),
    import('@strands-agents/sdk/models/vercel'),
    import('@ai-sdk/gateway'),
    import('ai'),
  ]);
  const model = new VercelModel({ provider: gateway('anthropic/claude-haiku-4.5'), maxTokens:180 });
  const agent = new Agent({ model, systemPrompt:'Solo test de construcción.', tools:[], printer:false });
  assert.equal(typeof agent.invoke,'function');
  assert.equal(typeof experimental_decide,'function');
  assert.equal(typeof gateway.decisionModel,'function');
});
