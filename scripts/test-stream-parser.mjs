import assert from 'node:assert/strict';
import { parseChatCompletionStreamLine } from '../server/codexTaskRunner.mjs';

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
