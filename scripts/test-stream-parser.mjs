import assert from 'node:assert/strict';
import { parseChatCompletionStreamLine, runChatCompletion } from '../server/codexTaskRunner.mjs';

assert.equal(
  parseChatCompletionStreamLine('data: {"choices":[{"delta":{"content":"hel"}}]}'),
  'hel',
  'OpenAI-compatible delta content should stream'
);

assert.equal(
  parseChatCompletionStreamLine('{"choices":[{"delta":{"reasoning_content":"thinking"}}]}'),
  'thinking',
  'JSONL reasoning content should stream'
);

assert.equal(
  parseChatCompletionStreamLine('data: {"type":"response.output_text.delta","delta":"lo"}'),
  'lo',
  'Responses-style output text deltas should stream'
);

assert.equal(
  parseChatCompletionStreamLine('data: {"choices":[{"delta":{"content":[{"text":" array"}]}}]}'),
  ' array',
  'array content chunks should stream'
);

assert.equal(parseChatCompletionStreamLine('data: [DONE]'), '', 'done marker should not render');

console.log('stream parser tests passed');

let requestedUrl = '';
globalThis.fetch = async (url) => {
  requestedUrl = String(url);
  return new Response(JSON.stringify({ choices: [{ message: { content: 'fallback response' } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
};
const fallbackResponse = await runChatCompletion({
  endpoint: 'https://mock.local/v1/',
  apiKey: 'test-key',
  model: 'mock-model',
  prompt: 'hello'
});
assert.equal(fallbackResponse, 'fallback response', 'non-streaming compatible responses should parse');
assert.equal(
  requestedUrl,
  'https://mock.local/v1/chat/completions',
  'chat endpoint should tolerate a trailing slash in user settings'
);

globalThis.fetch = async () => new Response(JSON.stringify({ error: 'too many requests' }), {
  status: 429,
  statusText: 'Too Many Requests',
  headers: {
    'content-type': 'application/json',
    'retry-after': '60'
  }
});
await assert.rejects(
  () => runChatCompletion({
    endpoint: 'https://mock.local/v1',
    apiKey: 'test-key',
    model: 'mock-model',
    prompt: 'hello'
  }),
  /rate limit: 429 Too Many Requests.*60/
);

console.log('rate limit error test passed');
