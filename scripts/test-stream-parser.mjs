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
