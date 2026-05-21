const failureActions = {
  auth: 'Save a valid OpenCode key or switch to Codex CLI in Settings.',
  rate_limit: 'Wait for the provider limit to reset or retry with Codex CLI.',
  offline: 'Start the local model server or switch providers.',
  model_missing: 'Choose a model reported by the provider scan.',
  timeout: 'Retry after checking the provider status.',
  unknown: 'Open Diagnostics, copy the error, and retry with another provider.'
};

export function providerFailureAction(kind) {
  return failureActions[kind] ?? failureActions.unknown;
}

export function classifyProviderFailure(errorOrText, status = 0) {
  if (errorOrText?.failureKind) {
    return errorOrText.failureKind;
  }
  const text = errorOrText instanceof Error
    ? `${errorOrText.message}\n${errorOrText.stack ?? ''}`
    : String(errorOrText ?? '');
  const lower = text.toLowerCase();
  const code = Number(status || errorOrText?.status || errorOrText?.statusCode || 0);
  if (code === 401 || code === 403 || /\b(401|403|unauthorized|forbidden|invalid api key|api key|promotion has ended)\b/i.test(text)) {
    return 'auth';
  }
  if (code === 429 || /rate limit|too many requests|usage limit|quota/i.test(text)) {
    return 'rate_limit';
  }
  if (code === 404 || /model.*not.*found|not.*model|unknown model|modelerror/i.test(lower)) {
    return 'model_missing';
  }
  if (/abort|timeout|timed out|deadline/i.test(text)) {
    return 'timeout';
  }
  if (/econnrefused|enotfound|fetch failed|network|not reachable|connection refused|server is offline/i.test(text)) {
    return 'offline';
  }
  return 'unknown';
}

export function providerFailureSummary({ kind, provider, model, detail }) {
  const cleanDetail = summarizeProviderDetail(detail);
  const label = providerLabel(provider);
  if (kind === 'auth') {
    return `${label} authentication is not usable for ${model || 'the selected model'}. ${cleanDetail}`;
  }
  if (kind === 'rate_limit') {
    return `${label} is rate-limited right now. ${cleanDetail}`;
  }
  if (kind === 'offline') {
    return `${label} is not reachable. ${cleanDetail}`;
  }
  if (kind === 'model_missing') {
    return `${label} does not report ${model || 'the selected model'} as available. ${cleanDetail}`;
  }
  if (kind === 'timeout') {
    return `${label} did not answer before the health check timed out. ${cleanDetail}`;
  }
  return `${label} failed its provider check. ${cleanDetail}`;
}

export async function checkProviderHealth({
  provider,
  endpoint,
  model,
  apiKey,
  codexStatus,
  timeoutMs = 3500
}) {
  const normalizedProvider = normalizeProvider(provider);
  const checkedAt = new Date().toISOString();
  const selectedModel = String(model ?? '').trim();
  if (normalizedProvider === 'codex') {
    const status = await codexStatus?.();
    const available = Boolean(status?.available);
    return {
      provider: normalizedProvider,
      endpoint: '',
      model: selectedModel || 'gpt-5.5',
      available,
      failureKind: available ? null : 'offline',
      failureAction: available ? null : providerFailureAction('offline'),
      detail: status?.detail ?? (available ? 'Codex CLI is available.' : 'Codex CLI is unavailable.'),
      checkedAt
    };
  }

  const resolvedEndpoint = String(endpoint ?? defaultEndpoint(normalizedProvider)).trim() || defaultEndpoint(normalizedProvider);
  if (normalizedProvider === 'opencode' && !String(apiKey ?? '').trim()) {
    const kind = 'auth';
    return {
      provider: normalizedProvider,
      endpoint: resolvedEndpoint,
      model: selectedModel,
      available: false,
      failureKind: kind,
      failureAction: providerFailureAction(kind),
      detail: 'Missing OpenCode API key.',
      checkedAt
    };
  }

  const baseUrl = resolvedEndpoint.replace(/\/+$/, '');
  const target = normalizedProvider === 'ollama' ? `${baseUrl}/api/tags` : `${baseUrl}/models`;
  try {
    const headers = normalizedProvider === 'opencode'
      ? { Authorization: `Bearer ${apiKey}` }
      : undefined;
    const response = await fetch(target, { headers, signal: AbortSignal.timeout(timeoutMs) });
    const bodyText = await response.text();
    let data = null;
    try {
      data = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      data = null;
    }
    if (!response.ok) {
      const kind = classifyProviderFailure(bodyText || `${response.status} ${response.statusText}`, response.status);
      return {
        provider: normalizedProvider,
        endpoint: resolvedEndpoint,
        model: selectedModel,
        available: false,
        failureKind: kind,
        failureAction: providerFailureAction(kind),
        detail: providerFailureSummary({ kind, provider: normalizedProvider, model: selectedModel, detail: bodyText || response.statusText }),
        checkedAt
      };
    }
    const models = normalizedProvider === 'ollama'
      ? (data?.models ?? []).map((entry) => entry.name).filter(Boolean)
      : (data?.data ?? []).map((entry) => entry.id).filter(Boolean);
    if (selectedModel && models.length > 0 && !models.includes(selectedModel)) {
      const kind = 'model_missing';
      return {
        provider: normalizedProvider,
        endpoint: resolvedEndpoint,
        model: selectedModel,
        available: false,
        failureKind: kind,
        failureAction: providerFailureAction(kind),
        detail: providerFailureSummary({ kind, provider: normalizedProvider, model: selectedModel, detail: `${models.length} models detected.` }),
        checkedAt
      };
    }
    return {
      provider: normalizedProvider,
      endpoint: resolvedEndpoint,
      model: selectedModel,
      available: true,
      failureKind: null,
      failureAction: null,
      detail: models.length > 0 ? `${models.length} model${models.length === 1 ? '' : 's'} detected.` : 'Provider is online, but no models were reported.',
      checkedAt
    };
  } catch (error) {
    const kind = classifyProviderFailure(error);
    return {
      provider: normalizedProvider,
      endpoint: resolvedEndpoint,
      model: selectedModel,
      available: false,
      failureKind: kind,
      failureAction: providerFailureAction(kind),
      detail: providerFailureSummary({ kind, provider: normalizedProvider, model: selectedModel, detail: error instanceof Error ? error.message : String(error) }),
      checkedAt
    };
  }
}

export function providerLabel(provider) {
  if (provider === 'codex') return 'Codex CLI';
  if (provider === 'lmstudio') return 'LM Studio';
  if (provider === 'ollama') return 'Ollama';
  return 'OpenCode Zen';
}

function summarizeProviderDetail(value) {
  const raw = String(value ?? '').trim();
  let extracted = raw;
  const jsonStart = raw.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const data = JSON.parse(raw.slice(jsonStart));
      const message = data?.error?.message ?? data?.message ?? data?.detail ?? data?.error;
      if (message) {
        extracted = `${raw.slice(0, jsonStart).trim()} ${message}`.trim();
      }
    } catch {}
  }
  const text = extracted
    .replace(/\s+/g, ' ')
    .replace(/"[^"]*api[_-]?key[^"]*"\s*:\s*"[^"]+"/ig, '"apiKey":"[redacted]"')
    .trim();
  if (!text) {
    return '';
  }
  return text.length > 220 ? `${text.slice(0, 217).trim()}...` : text;
}

function normalizeProvider(provider) {
  const value = String(provider ?? '').toLowerCase();
  if (value === 'ollama') return 'ollama';
  if (value === 'lmstudio') return 'lmstudio';
  if (value === 'codex') return 'codex';
  return 'opencode';
}

function defaultEndpoint(provider) {
  if (provider === 'ollama') return 'http://127.0.0.1:11434';
  if (provider === 'lmstudio') return 'http://127.0.0.1:1234/v1';
  if (provider === 'codex') return '';
  return 'https://opencode.ai/zen/v1';
}
