const explicitPreferenceSignals = /\b(remember that|remember:|i prefer|i like|i want you to|always|never|do not|don't|call me|my name is|use .+ by default|default to)\b/i;
const explicitProjectFactSignals = /\b(this project|the project|this repo|the repo|workspace|default workspace|configured to|uses|stores|runs on|requires)\b/i;
const taskOutcomeSignals = /\b(implemented|updated|changed|fixed|created|added|removed|renamed|configured|verified|tested|built|passed|failed|completed)\b/i;

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    memories: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          kind: {
            type: 'string',
            enum: ['preference', 'project', 'task', 'fact', 'constraint']
          },
          title: {
            type: 'string',
            minLength: 3,
            maxLength: 80
          },
          content: {
            type: 'string',
            minLength: 8,
            maxLength: 500
          },
          importance: {
            type: 'integer',
            minimum: 1,
            maximum: 5
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1
          }
        },
        required: ['kind', 'title', 'content', 'importance', 'confidence']
      }
    },
    skipped: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          reason: { type: 'string', maxLength: 160 },
          content: { type: 'string', maxLength: 240 },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1
          }
        },
        required: ['reason', 'content', 'confidence']
      }
    }
  },
  required: ['memories', 'skipped']
};

export class MemoryExtractor {
  constructor(config = {}) {
    this.config = config;
  }

  async extractFromText(text, source = 'conversation') {
    const cleaned = cleanText(text);
    if (cleaned.length < 12) {
      return { memories: [], skipped: [] };
    }

    if (this.#shouldUseAi()) {
      try {
        const extracted = await this.#extractWithAi(cleaned, source);
        return this.#filterAndSource(extracted, source);
      } catch (error) {
        return this.#withFallbackNote(cleaned, source, error);
      }
    }

    return this.#filterAndSource(this.#extractTextWithRules(cleaned), source);
  }

  async extractFromTask(task) {
    const status = task.status ?? 'unknown';
    const output = cleanText(task.output ?? '');
    if (status !== 'completed') {
      return {
        memories: [],
        skipped: [{ reason: 'Task did not complete, so no durable memory was saved.', content: output.slice(0, 180) || task.prompt || '', confidence: 0.25 }]
      };
    }
    if (output.length < 60) {
      return {
        memories: [],
        skipped: [{ reason: 'Task output was too short for a durable memory.', content: output, confidence: 0.35 }]
      };
    }

    const summary = [
      `Status: ${status}`,
      task.workspace ? `Workspace: ${task.workspace}` : '',
      `Final output: ${output.slice(-1800)}`
    ].filter(Boolean).join('\n');

    if (this.#shouldUseAi()) {
      try {
        const extracted = await this.#extractWithAi(summary, 'codex-task');
        return this.#filterAndSource(extracted, 'codex-task');
      } catch (error) {
        return this.#withFallbackNote(summary, 'codex-task', error);
      }
    }

    return this.#filterAndSource(this.#extractTaskWithRules(task, output, status), 'codex-task');
  }

  #shouldUseAi() {
    return Boolean(process.env.OPENAI_API_KEY) && this.config.extractor !== 'local-rules';
  }

  async #extractWithAi(text, source) {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model ?? 'gpt-5.5',
        reasoning: { effort: this.config.reasoningEffort ?? 'low' },
        input: [
          {
            role: 'system',
            content: [{
              type: 'input_text',
              text: [
                'Extract only durable assistant memories.',
                'Return an empty memories array for ordinary prompts, commands, transient UI actions, praise, screenshots, vague notes, or temporary status.',
                'A valid memory must be useful in a later session: a stable user preference, recurring constraint, project fact, environment fact, or completed task outcome.',
                'For codex-task input, use the final output and status as evidence; do not save a memory that only restates the original request.',
                'Rewrite each saved memory as a clean fact. Do not start with "User asked" or "Prompt".'
              ].join(' ')
            }]
          },
          {
            role: 'user',
            content: [{
              type: 'input_text',
              text: `Source: ${source}\n\n${text}`
            }]
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'memory_extraction',
            strict: true,
            schema
          }
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message ?? 'OpenAI memory extraction failed.');
    }

    return JSON.parse(extractOutputText(data));
  }

  #extractTextWithRules(cleaned) {
    const memories = [];
    if (explicitPreferenceSignals.test(cleaned)) {
      memories.push({
        kind: /\b(always|never|do not|don't|default to)\b/i.test(cleaned) ? 'constraint' : 'preference',
        title: titleFromText(cleaned, 'User preference'),
        content: cleaned.slice(0, 500),
        importance: 4,
        confidence: 0.74
      });
    } else if (explicitProjectFactSignals.test(cleaned) && /\b(is|are|uses|has|stores|runs|requires|configured)\b/i.test(cleaned)) {
      memories.push({
        kind: 'project',
        title: titleFromText(cleaned, 'Project fact'),
        content: cleaned.slice(0, 500),
        importance: 3,
        confidence: 0.7
      });
    }

    return {
      memories,
      skipped: memories.length === 0
        ? [{ reason: 'No explicit durable preference or fact found.', content: cleaned.slice(0, 180), confidence: 0.45 }]
        : []
    };
  }

  #extractTaskWithRules(task, output, status) {
    if (!taskOutcomeSignals.test(output)) {
      return {
        memories: [],
        skipped: [{ reason: 'Task output did not describe a durable outcome.', content: output.slice(0, 180), confidence: 0.5 }]
      };
    }

    const workspace = task.workspace ? ` in ${task.workspace}` : '';
    const content = `Codex task ${status}${workspace}: ${output.slice(0, 430)}`;
    return {
      memories: [{
        kind: status === 'completed' ? 'task' : 'fact',
        title: titleFromText(output, `Codex task ${status}`),
        content,
        importance: status === 'completed' ? 4 : 2,
        confidence: status === 'completed' ? 0.76 : 0.64
      }],
      skipped: []
    };
  }

  #withFallbackNote(text, source, error) {
    const fallback = source === 'codex-task'
      ? this.#extractTaskWithRules({ status: 'completed', output: text, workspace: '' }, cleanText(text), 'completed')
      : this.#extractTextWithRules(text);
    fallback.skipped.push({
      reason: `AI extraction unavailable: ${error.message}`,
      content: text.slice(0, 180),
      confidence: 0
    });
    return this.#filterAndSource(fallback, source);
  }

  #filterAndSource(extracted, source) {
    const minConfidence = Number(this.config.minConfidence ?? 0.68);
    const memories = [];
    const skipped = [...(extracted.skipped ?? [])];

    for (const memory of extracted.memories ?? []) {
      const confidence = Number(memory.confidence ?? 0);
      const content = cleanText(memory.content);
      if (confidence < minConfidence) {
        skipped.push({
          reason: `Below confidence threshold ${minConfidence}.`,
          content: content || memory.title || '',
          confidence
        });
        continue;
      }
      if (!isDurableMemory(memory, content, source)) {
        skipped.push({
          reason: 'Rejected transient or prompt-shaped memory.',
          content: content || memory.title || '',
          confidence
        });
        continue;
      }
      memories.push({
        kind: memory.kind,
        title: cleanText(memory.title).slice(0, 80),
        content,
        importance: Math.max(1, Math.min(5, Number(memory.importance ?? 1))),
        confidence,
        source
      });
    }

    return { memories, skipped };
  }
}

function cleanText(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

function titleFromText(text, fallback) {
  const cleaned = cleanText(text)
    .replace(/^(codex task completed|task result|final output|remember that|remember:)\s*:?\s*/i, '');
  const sentence = cleaned.split(/[.!?]\s+/)[0] ?? '';
  return (sentence || fallback).slice(0, 80);
}

function isDurableMemory(memory, content, source) {
  if (!content || content.length < 8) {
    return false;
  }
  if (/\b(waiting for codex output|learning event|visible neural cluster|manually triggered|user asked|prompt:)\b/i.test(content)) {
    return false;
  }
  if (source === 'codex-task') {
    return taskOutcomeSignals.test(content);
  }
  return explicitPreferenceSignals.test(content) || explicitProjectFactSignals.test(content);
}

function extractOutputText(data) {
  if (typeof data.output_text === 'string') {
    return data.output_text;
  }
  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        return content.text;
      }
    }
  }
  throw new Error('OpenAI response did not include output text.');
}
