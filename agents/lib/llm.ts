import { getEnv } from './env.js';

export type LlmProvider = 'anthropic' | 'openai' | 'gemini';
export type AgentRole = 'extractor' | 'verificador' | 'jurista' | 'editor' | 'vigilante' | 'investigador';

export interface LlmConfig {
  provider: LlmProvider;
  model: string;
}

export interface LlmCallOptions {
  role: AgentRole;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  promptOnly?: boolean;
}

export interface LlmResponse {
  text: string;
  provider: LlmProvider;
  model: string;
  promptOnly: boolean;
}

const DEFAULTS: Record<AgentRole, LlmConfig> = {
  extractor: { provider: 'anthropic', model: 'claude-sonnet-4-5' },
  verificador: { provider: 'openai', model: 'gpt-4.1' },
  jurista: { provider: 'anthropic', model: 'claude-sonnet-4-5' },
  editor: { provider: 'anthropic', model: 'claude-sonnet-4-5' },
  vigilante: { provider: 'anthropic', model: 'claude-sonnet-4-5' },
  investigador: { provider: 'anthropic', model: 'claude-sonnet-4-5' },
};

export function resolveModelConfig(role: AgentRole): LlmConfig {
  const prefix = role.toUpperCase();
  const provider = (getEnv(`${prefix}_PROVIDER`, DEFAULTS[role].provider) as LlmProvider);
  const model = getEnv(`${prefix}_MODEL`, DEFAULTS[role].model)!;
  return { provider, model };
}

/**
 * Regla dura de CLAUDE.md §6: el Verificador DEBE utilizar un modelo distinto al del Extractor.
 */
export function assertVerificadorDistinctFromExtractor(): void {
  const ext = resolveModelConfig('extractor');
  const ver = resolveModelConfig('verificador');
  if (ext.provider === ver.provider && ext.model === ver.model) {
    throw new Error(
      `Regla §6 violada: Verificador (${ver.provider}:${ver.model}) y Extractor (${ext.provider}:${ext.model}) no pueden usar el mismo modelo. Configura VERIFICADOR_PROVIDER / VERIFICADOR_MODEL con un modelo distinto.`,
    );
  }
}

export async function callLlm(options: LlmCallOptions): Promise<LlmResponse> {
  if (options.role === 'verificador') {
    assertVerificadorDistinctFromExtractor();
  }

  const config = resolveModelConfig(options.role);

  if (options.promptOnly) {
    const assembled = [
      `=== AGENTE: ${options.role.toUpperCase()} (${config.provider}:${config.model}) ===`,
      '--- SYSTEM PROMPT ---',
      options.systemPrompt,
      '--- USER PROMPT ---',
      options.userPrompt,
    ].join('\n\n');
    return {
      text: assembled,
      provider: config.provider,
      model: config.model,
      promptOnly: true,
    };
  }

  const temperature = options.temperature ?? 0.1;
  const maxTokens = options.maxTokens ?? 4096;

  if (config.provider === 'anthropic') {
    const apiKey = getEnv('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error(
        `Falta ANTHROPIC_API_KEY para ejecutar el agente ${options.role}. Usa --prompt-only si deseas generar el prompt sin llamar a la API.`,
      );
    }
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: maxTokens,
        temperature,
        system: options.systemPrompt,
        messages: [{ role: 'user', content: options.userPrompt }],
      }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Anthropic API error (${resp.status}): ${body}`);
    }
    const json = (await resp.json()) as { content: Array<{ type: string; text?: string }> };
    const text = json.content
      .filter((c) => c.type === 'text' && c.text)
      .map((c) => c.text)
      .join('\n');
    return { text, provider: config.provider, model: config.model, promptOnly: false };
  }

  if (config.provider === 'openai') {
    const apiKey = getEnv('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error(
        `Falta OPENAI_API_KEY para ejecutar el agente ${options.role}. Usa --prompt-only si deseas generar el prompt sin llamar a la API.`,
      );
    }
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: options.systemPrompt },
          { role: 'user', content: options.userPrompt },
        ],
      }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`OpenAI API error (${resp.status}): ${body}`);
    }
    const json = (await resp.json()) as {
      choices: Array<{ message: { content?: string } }>;
    };
    const text = json.choices[0]?.message?.content ?? '';
    return { text, provider: config.provider, model: config.model, promptOnly: false };
  }

  if (config.provider === 'gemini') {
    const apiKey = getEnv('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error(
        `Falta GEMINI_API_KEY para ejecutar el agente ${options.role}. Usa --prompt-only si deseas generar el prompt sin llamar a la API.`,
      );
    }
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: options.systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: options.userPrompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Gemini API error (${resp.status}): ${body}`);
    }
    const json = (await resp.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text =
      json.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? '')
        .join('\n') ?? '';
    return { text, provider: config.provider, model: config.model, promptOnly: false };
  }

  throw new Error(`Proveedor LLM no soportado: "${config.provider}". Usa anthropic, openai o gemini.`);
}
