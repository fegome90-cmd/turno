import { PROVIDERS, isOpenAIReasoningModel } from './model-providers.mjs';
import { gatewayProviderOptions } from './gateway-config.mjs';

/**
 * Construye el modelo de Strands para el proveedor configurado. Solo servidor:
 * la clave se lee del entorno del proceso y se entrega en memoria al SDK.
 * Los paquetes de cada proveedor se cargan bajo demanda.
 */
export async function createStrandsModel(settings, { maxTokens, env = process.env }) {
  const spec = PROVIDERS[settings.provider];
  if (!spec) throw new Error('Proveedor no soportado.');
  const key = settings.keyEnv ? env[settings.keyEnv] : undefined;
  const reasoning = isOpenAIReasoningModel(settings.provider, settings.modelId);

  switch (spec.kind) {
    case 'vercel': {
      const [{ VercelModel }, { gateway: defaultGateway, createGateway }] = await Promise.all([
        import('@strands-agents/sdk/models/vercel'), import('@ai-sdk/gateway'),
      ]);
      // The key comes from the validated env (not only process.env); without one, OIDC via the default provider.
      const gateway = key ? createGateway({ apiKey: key }) : defaultGateway;
      return new VercelModel({ provider: gateway(settings.modelId), maxTokens,
        providerOptions: gatewayProviderOptions(settings) });
    }
    case 'openai':
    case 'openai-compatible': {
      const { OpenAIModel } = await import('@strands-agents/sdk/models/openai');
      return new OpenAIModel({
        api: 'chat',
        apiKey: key,
        modelId: settings.modelId,
        maxTokens,
        ...(spec.baseURL && { clientConfig: { baseURL: spec.baseURL, maxRetries: 0 } }),
        ...(!spec.baseURL && { clientConfig: { maxRetries: 0 } }),
        ...(reasoning && { params: { reasoning_effort: settings.reasoningEffort } }),
      });
    }
    case 'anthropic': {
      const { AnthropicModel } = await import('@strands-agents/sdk/models/anthropic');
      return new AnthropicModel({ apiKey: key, modelId: settings.modelId, maxTokens,
        clientConfig: { maxRetries: 0 } });
    }
    case 'google': {
      const { GoogleModel } = await import('@strands-agents/sdk/models/google');
      return new GoogleModel({ apiKey: key, modelId: settings.modelId,
        params: { maxOutputTokens: maxTokens } });
    }
    case 'bedrock': {
      const { BedrockModel } = await import('@strands-agents/sdk/models/bedrock');
      return new BedrockModel({ modelId: settings.modelId, region: settings.region, maxTokens,
        ...(key && { apiKey: key }) });
    }
    default:
      throw new Error('Proveedor no soportado.');
  }
}
