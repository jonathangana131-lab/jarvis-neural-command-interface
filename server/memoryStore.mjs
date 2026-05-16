import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Embedder } from './embeddings.mjs';

const EMBED_DEBOUNCE_MS = 750;
const DEFAULT_EDGE_THRESHOLD = 0.62;
const DEFAULT_DUPLICATE_THRESHOLD = 0.93;

export class MemoryStore {
  /**
   * @param {string} databasePath
   * @param {{ emit?: Function }} [eventBus]
   * @param {{ embedder?: Embedder, edgeThreshold?: number }} [options]
   */
  constructor(databasePath, eventBus, options = {}) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    this.db = new DatabaseSync(databasePath);
    this.eventBus = eventBus ?? { emit() {} };
    this.embedder = options.embedder ?? null;
    this.edgeThreshold = options.edgeThreshold ?? DEFAULT_EDGE_THRESHOLD;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        importance INTEGER NOT NULL DEFAULT 1,
        confidence REAL NOT NULL DEFAULT 1,
        source TEXT NOT NULL,
        normalized_content TEXT,
        lookup_key TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_used_at TEXT,
        use_count INTEGER NOT NULL DEFAULT 0,
        pinned INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0,
        scope TEXT NOT NULL DEFAULT 'project',
        workspace TEXT,
        last_seen_source TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at DESC);
    `);
    this.#ensureColumn('confidence', 'REAL NOT NULL DEFAULT 1');
    this.#ensureColumn('normalized_content', 'TEXT');
    this.#ensureColumn('lookup_key', 'TEXT');
    this.#ensureColumn('updated_at', 'TEXT');
    this.#ensureColumn('last_used_at', 'TEXT');
    this.#ensureColumn('use_count', 'INTEGER NOT NULL DEFAULT 0');
    this.#ensureColumn('pinned', 'INTEGER NOT NULL DEFAULT 0');
    this.#ensureColumn('archived', 'INTEGER NOT NULL DEFAULT 0');
    this.#ensureColumn('scope', "TEXT NOT NULL DEFAULT 'project'");
    this.#ensureColumn('workspace', 'TEXT');
    this.#ensureColumn('last_seen_source', 'TEXT');
    this.#ensureColumn('embedding', 'BLOB');
    this.#ensureColumn('embedding_model', 'TEXT');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_memories_normalized_content ON memories(normalized_content);');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_memories_lookup_key ON memories(lookup_key);');
    this.#backfillLookupKeys();

    // Caches keyed by memory id so we don't reparse BLOBs on every search.
    /** @type {Map<number, Float32Array>} */
    this.embeddingCache = new Map();
    /** @type {NodeJS.Timeout | null} */
    this.edgeEmitTimer = null;
    /** @type {boolean} */
    this.backfillInProgress = false;

    if (this.embedder) {
      // Fire-and-forget backfill so cold starts don't block server boot.
      void this.#backfillEmbeddings().catch((error) => {
        console.warn(`[memoryStore] embedding backfill failed: ${error?.message ?? error}`);
      });
    }
  }

  list({ limit = 80, query = '', scope = '', workspace = '' } = {}) {
    const conditions = [
      "archived = 0",
      "kind NOT IN ('demo', 'manual')",
      "source NOT IN ('ui-demo', 'manual')"
    ];
    const params = [];
    const cleanQuery = String(query ?? '').trim().toLowerCase();
    if (cleanQuery) {
      conditions.push('(LOWER(title) LIKE ? OR LOWER(content) LIKE ? OR LOWER(kind) LIKE ?)');
      params.push(`%${cleanQuery}%`, `%${cleanQuery}%`, `%${cleanQuery}%`);
    }
    if (scope === 'global' || scope === 'project') {
      conditions.push('scope = ?');
      params.push(scope);
    }
    if (workspace) {
      conditions.push("(scope = 'global' OR workspace IS NULL OR workspace = '' OR LOWER(workspace) = LOWER(?))");
      params.push(workspace);
    }
    params.push(Number(limit));
    return this.db
      .prepare(`${selectMemoryRows()} WHERE ${conditions.join(' AND ')} ORDER BY pinned DESC, importance DESC, id DESC LIMIT ?`)
      .all(...params);
  }

  create(memory) {
    const row = {
      kind: memory.kind ?? 'fact',
      title: memory.title?.slice(0, 120) || 'Untitled memory',
      content: memory.content?.slice(0, 2000) || '',
      importance: Math.max(1, Math.min(5, Number(memory.importance ?? 1))),
      confidence: Math.max(0, Math.min(1, Number(memory.confidence ?? 1))),
      normalizedContent: normalizeMemoryContent(memory.content ?? memory.title ?? ''),
      lookupKey: lookupKey(memory.kind ?? 'fact', memory.title ?? '', memory.content ?? ''),
      source: memory.source ?? 'assistant',
      scope: normalizeScope(memory.scope),
      workspace: memory.workspace ? path.resolve(memory.workspace) : '',
      pinned: memory.pinned ? 1 : 0,
      archived: memory.archived ? 1 : 0
    };
    if (!row.normalizedContent) {
      return null;
    }
    const existing = this.db
      .prepare(`${selectMemoryRows()} WHERE lookup_key = ? OR normalized_content = ? OR (kind = ? AND title = ? AND content = ?) ORDER BY id DESC LIMIT 1`)
      .get(row.lookupKey, row.normalizedContent, row.kind, row.title, row.content);
    if (existing) {
      const merged = this.#merge(existing, row);
      this.#queueEmbedding(merged);
      return merged;
    }
    const result = this.db
      .prepare(`
        INSERT INTO memories (
          kind, title, content, importance, confidence, source, normalized_content,
          lookup_key, pinned, archived, scope, workspace, last_seen_source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(row.kind, row.title, row.content, row.importance, row.confidence, row.source, row.normalizedContent, row.lookupKey, row.pinned, row.archived, row.scope, row.workspace, row.source);
    const inserted = this.db
      .prepare(`${selectMemoryRows()} WHERE id = ?`)
      .get(result.lastInsertRowid);
    this.eventBus.emit('memory.created', inserted);
    this.#queueEmbedding(inserted);
    return inserted;
  }

  delete(id) {
    const existing = this.db
      .prepare(`${selectMemoryRows()} WHERE id = ?`)
      .get(id);
    if (!existing) {
      return null;
    }
    this.db.prepare('DELETE FROM memories WHERE id = ?').run(id);
    this.embeddingCache.delete(Number(id));
    this.eventBus.emit('memory.deleted', { id: Number(id) });
    this.#scheduleEdgeEmit();
    return existing;
  }

  update(id, updates) {
    const existing = this.db
      .prepare(`${selectMemoryRows()} WHERE id = ?`)
      .get(id);
    if (!existing) {
      return null;
    }
    const title = cleanUpdateText(updates.title, existing.title, 120);
    const content = cleanUpdateText(updates.content, existing.content, 2000);
    const kind = cleanUpdateText(updates.kind, existing.kind, 40);
    const importance = updates.importance === undefined
      ? Number(existing.importance)
      : Math.max(1, Math.min(5, Number(updates.importance)));
    const confidence = updates.confidence === undefined
      ? Number(existing.confidence ?? 1)
      : Math.max(0, Math.min(1, Number(updates.confidence)));
    const pinned = updates.pinned === undefined ? Number(existing.pinned) : (updates.pinned ? 1 : 0);
    const archived = updates.archived === undefined ? Number(existing.archived) : (updates.archived ? 1 : 0);
    const scope = updates.scope === undefined ? existing.scope : normalizeScope(updates.scope);
    const workspace = updates.workspace === undefined
      ? existing.workspace ?? ''
      : (updates.workspace ? path.resolve(updates.workspace) : '');
    const contentChanged = title !== existing.title || content !== existing.content || kind !== existing.kind;
    this.db
      .prepare(`
        UPDATE memories
        SET kind = ?,
            title = ?,
            content = ?,
            importance = ?,
            confidence = ?,
            normalized_content = ?,
            lookup_key = ?,
            pinned = ?,
            archived = ?,
            scope = ?,
            workspace = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .run(kind, title, content, importance, confidence, normalizeMemoryContent(content || title), lookupKey(kind, title, content), pinned, archived, scope, workspace, id);
    const updated = this.db.prepare(`${selectMemoryRows()} WHERE id = ?`).get(id);
    if (contentChanged) {
      this.#clearStoredEmbedding(id);
      this.#queueEmbedding(updated);
    }
    this.eventBus.emit('memory.updated', updated);
    return updated;
  }

  resetVisible() {
    const ids = this.db
      .prepare("SELECT id FROM memories WHERE kind NOT IN ('demo', 'manual') AND source NOT IN ('ui-demo', 'manual')")
      .all()
      .map((row) => row.id);
    const deleted = this.db
      .prepare("DELETE FROM memories WHERE kind NOT IN ('demo', 'manual') AND source NOT IN ('ui-demo', 'manual')")
      .run();
    for (const id of ids) {
      this.embeddingCache.delete(Number(id));
    }
    this.eventBus.emit('memory.reset', { deleted: deleted.changes ?? 0 });
    this.#scheduleEdgeEmit();
    return deleted.changes ?? 0;
  }

  count() {
    return this.db
      .prepare("SELECT COUNT(*) AS count FROM memories WHERE archived = 0 AND kind NOT IN ('demo', 'manual') AND source NOT IN ('ui-demo', 'manual')")
      .get().count;
  }

  close() {
    this.db.close();
  }

  /**
   * Recall API used by the codex task runner.
   *
   * `relevantFor` stays synchronous for callers that can't await — it uses
   * the keyword scorer and still emits `memory.recalled` so the orb reacts.
   * Newer call sites should prefer `relevantForAsync`, which tries the
   * semantic path first and only falls back to keyword recall if no
   * embedded memories meet the threshold or the embedder isn't ready.
   */
  relevantFor({ prompt, workspace, limit = 6, emit = true } = {}) {
    return this.relevantForKeyword({ prompt, workspace, limit, emit });
  }

  async relevantForAsync({ prompt, workspace, limit = 6, emit = true } = {}) {
    const semantic = await this.relevantForSemantic({ prompt, workspace, limit, emit: false });
    if (semantic && semantic.length > 0) {
      if (emit) {
        this.eventBus.emit('memory.recalled', {
          prompt: String(prompt ?? '').slice(0, 240),
          workspace: workspace ?? null,
          mode: 'semantic',
          ids: semantic.map((memory) => memory.id),
          memories: semantic.map(toRecalledShape)
        });
      }
      return semantic;
    }
    return this.relevantForKeyword({ prompt, workspace, limit, emit });
  }

  relevantForKeyword({ prompt, workspace, limit = 6, emit = true }) {
    const promptTokens = tokenize(`${prompt ?? ''} ${workspace ?? ''}`);
    if (promptTokens.size === 0) {
      return [];
    }
    const candidates = this.db
      .prepare(`${selectMemoryRows()} WHERE archived = 0 AND kind NOT IN ('demo', 'manual') AND source NOT IN ('ui-demo', 'manual') AND confidence >= 0.62 AND (scope = 'global' OR workspace IS NULL OR workspace = '' OR LOWER(workspace) = LOWER(?)) ORDER BY pinned DESC, importance DESC, updated_at DESC LIMIT 240`)
      .all(workspace ?? '');
    const scored = candidates
      .map((memory) => ({ ...memory, relevanceScore: scoreMemory(memory, promptTokens, workspace) }))
      .filter((memory) => memory.relevanceScore > 0.9)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

    if (scored.length > 0) {
      const now = new Date().toISOString();
      const update = this.db.prepare('UPDATE memories SET last_used_at = ?, use_count = use_count + 1 WHERE id = ?');
      for (const memory of scored) {
        update.run(now, memory.id);
      }
      if (emit) {
        this.eventBus.emit('memory.recalled', {
          prompt: String(prompt ?? '').slice(0, 240),
          workspace: workspace ?? null,
          mode: 'keyword',
          ids: scored.map((memory) => memory.id),
          memories: scored.map(toRecalledShape)
        });
      }
    }
    return scored;
  }

  /**
   * Semantic recall. Returns null (not []) if the embedder isn't ready or
   * there are no embedded memories yet — callers should treat that as
   * "fall back to keyword".
   */
  async relevantForSemantic({ prompt, workspace, limit = 6, threshold = 0.42, emit = true } = {}) {
    if (!this.embedder || this.embedder.disabled) return null;
    const cleanPrompt = String(prompt ?? '').replace(/\s+/g, ' ').trim();
    if (!cleanPrompt) return null;

    let queryVector;
    try {
      queryVector = await this.embedder.embed(cleanPrompt);
    } catch (error) {
      return null;
    }
    if (!queryVector) return null;

    const candidates = this.db
      .prepare(`SELECT id, embedding FROM memories WHERE archived = 0 AND kind NOT IN ('demo', 'manual') AND source NOT IN ('ui-demo', 'manual') AND embedding IS NOT NULL AND (scope = 'global' OR workspace IS NULL OR workspace = '' OR LOWER(workspace) = LOWER(?))`)
      .all(workspace ?? '');
    if (candidates.length === 0) return null;

    const scored = [];
    for (const candidate of candidates) {
      const vector = this.#getCachedVector(candidate.id, candidate.embedding);
      if (!vector) continue;
      const similarity = Embedder.cosine(queryVector, vector);
      if (similarity >= threshold) {
        scored.push({ id: candidate.id, similarity });
      }
    }
    if (scored.length === 0) return null;
    scored.sort((a, b) => b.similarity - a.similarity);
    const topIds = scored.slice(0, limit).map((row) => row.id);
    const memoryRows = this.db
      .prepare(`${selectMemoryRows()} WHERE id IN (${topIds.map(() => '?').join(',')})`)
      .all(...topIds);
    const byId = new Map(memoryRows.map((row) => [row.id, row]));
    const enriched = topIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((memory, index) => ({
        ...memory,
        relevanceScore: scored[index].similarity,
        similarity: scored[index].similarity
      }));

    if (enriched.length > 0) {
      const now = new Date().toISOString();
      const update = this.db.prepare('UPDATE memories SET last_used_at = ?, use_count = use_count + 1 WHERE id = ?');
      for (const memory of enriched) {
        update.run(now, memory.id);
      }
      if (emit) {
        this.eventBus.emit('memory.recalled', {
          prompt: cleanPrompt.slice(0, 240),
          workspace: workspace ?? null,
          mode: 'semantic',
          ids: enriched.map((memory) => memory.id),
          memories: enriched.map(toRecalledShape)
        });
      }
    }
    return enriched;
  }

  /**
   * Free-form semantic search exposed to the UI. Embeds the query,
   * returns top-K with similarity scores. Empty array if disabled.
   */
  async semanticSearch({ query, limit = 20, scope = '', workspace = '', threshold = 0.32 } = {}) {
    if (!this.embedder || this.embedder.disabled) return [];
    const cleanQuery = String(query ?? '').replace(/\s+/g, ' ').trim();
    if (!cleanQuery) return [];
    const queryVector = await this.embedder.embed(cleanQuery);
    if (!queryVector) return [];

    const conditions = [
      'archived = 0',
      "kind NOT IN ('demo', 'manual')",
      "source NOT IN ('ui-demo', 'manual')",
      'embedding IS NOT NULL'
    ];
    const params = [];
    if (scope === 'global' || scope === 'project') {
      conditions.push('scope = ?');
      params.push(scope);
    }
    if (workspace) {
      conditions.push("(scope = 'global' OR workspace IS NULL OR workspace = '' OR LOWER(workspace) = LOWER(?))");
      params.push(workspace);
    }
    const rows = this.db
      .prepare(`SELECT id, embedding FROM memories WHERE ${conditions.join(' AND ')}`)
      .all(...params);
    const scored = [];
    for (const row of rows) {
      const vector = this.#getCachedVector(row.id, row.embedding);
      if (!vector) continue;
      const similarity = Embedder.cosine(queryVector, vector);
      if (similarity >= threshold) {
        scored.push({ id: row.id, similarity });
      }
    }
    scored.sort((a, b) => b.similarity - a.similarity);
    const topIds = scored.slice(0, limit).map((row) => row.id);
    if (topIds.length === 0) return [];
    const memoryRows = this.db
      .prepare(`${selectMemoryRows()} WHERE id IN (${topIds.map(() => '?').join(',')})`)
      .all(...topIds);
    const byId = new Map(memoryRows.map((row) => [row.id, row]));
    return topIds.map((id, index) => ({
      ...(byId.get(id) ?? {}),
      similarity: scored[index].similarity
    })).filter((row) => row.id);
  }

  /**
   * Returns symmetric semantic edges between memories whose cosine
   * similarity exceeds the threshold. Capped at `limit` to keep the
   * payload small for the renderer.
   */
  similarityEdges({ threshold = this.edgeThreshold, limit = 480, maxPerNode = 6 } = {}) {
    if (!this.embedder || this.embedder.disabled) {
      return { edges: [], threshold, totalCandidates: 0, dim: 0 };
    }
    const rows = this.db
      .prepare(`SELECT id, embedding FROM memories WHERE archived = 0 AND kind NOT IN ('demo', 'manual') AND source NOT IN ('ui-demo', 'manual') AND embedding IS NOT NULL`)
      .all();
    const vectors = [];
    for (const row of rows) {
      const vector = this.#getCachedVector(row.id, row.embedding);
      if (vector) vectors.push({ id: row.id, vector });
    }
    const edgeList = [];
    for (let i = 0; i < vectors.length; i += 1) {
      for (let j = i + 1; j < vectors.length; j += 1) {
        const similarity = Embedder.cosine(vectors[i].vector, vectors[j].vector);
        if (similarity >= threshold) {
          edgeList.push({ from: vectors[i].id, to: vectors[j].id, weight: similarity });
        }
      }
    }
    edgeList.sort((a, b) => b.weight - a.weight);

    // Cap per-node so dense clusters don't dominate.
    const seenPerNode = new Map();
    const kept = [];
    for (const edge of edgeList) {
      const fromCount = seenPerNode.get(edge.from) ?? 0;
      const toCount = seenPerNode.get(edge.to) ?? 0;
      if (fromCount >= maxPerNode || toCount >= maxPerNode) continue;
      seenPerNode.set(edge.from, fromCount + 1);
      seenPerNode.set(edge.to, toCount + 1);
      kept.push(edge);
      if (kept.length >= limit) break;
    }
    return { edges: kept, threshold, totalCandidates: vectors.length, dim: this.embedder.dim };
  }

  /** Returns near-duplicate candidate pairs ranked by similarity. */
  nearDuplicates({ threshold = DEFAULT_DUPLICATE_THRESHOLD, limit = 50 } = {}) {
    const result = this.similarityEdges({ threshold, limit: limit * 4, maxPerNode: 4 });
    return {
      pairs: result.edges.slice(0, limit),
      threshold
    };
  }

  embeddingsReady() {
    if (!this.embedder || this.embedder.disabled) {
      return { available: false, model: null, embedded: 0, total: 0, dim: 0 };
    }
    const totalRow = this.db
      .prepare("SELECT COUNT(*) AS count FROM memories WHERE archived = 0 AND kind NOT IN ('demo', 'manual') AND source NOT IN ('ui-demo', 'manual')")
      .get();
    const embeddedRow = this.db
      .prepare("SELECT COUNT(*) AS count FROM memories WHERE archived = 0 AND kind NOT IN ('demo', 'manual') AND source NOT IN ('ui-demo', 'manual') AND embedding IS NOT NULL")
      .get();
    return {
      available: true,
      model: this.embedder.lastError ? `disabled (${this.embedder.lastError})` : 'minilm-l6-v2',
      embedded: embeddedRow.count,
      total: totalRow.count,
      dim: this.embedder.dim,
      backfilling: this.backfillInProgress
    };
  }

  #ensureColumn(name, definition) {
    const columns = this.db.prepare('PRAGMA table_info(memories)').all();
    if (!columns.some((column) => column.name === name)) {
      this.db.exec(`ALTER TABLE memories ADD COLUMN ${name} ${definition}`);
    }
  }

  #backfillLookupKeys() {
    const rows = this.db.prepare("SELECT id, kind, title, content FROM memories WHERE lookup_key IS NULL OR lookup_key = '' OR normalized_content IS NULL OR normalized_content = '' OR updated_at IS NULL").all();
    const update = this.db.prepare("UPDATE memories SET lookup_key = ?, normalized_content = COALESCE(NULLIF(normalized_content, ''), ?), updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP) WHERE id = ?");
    for (const row of rows) {
      update.run(lookupKey(row.kind, row.title, row.content), normalizeMemoryContent(row.content ?? row.title ?? ''), row.id);
    }
  }

  async #backfillEmbeddings() {
    if (!this.embedder) return;
    const rows = this.db
      .prepare("SELECT id, kind, title, content FROM memories WHERE archived = 0 AND embedding IS NULL AND kind NOT IN ('demo', 'manual') AND source NOT IN ('ui-demo', 'manual') ORDER BY id ASC LIMIT 2000")
      .all();
    if (rows.length === 0) return;
    this.backfillInProgress = true;
    for (const row of rows) {
      const text = `${row.title}\n${row.content}`;
      const vector = await this.embedder.embed(text);
      if (!vector) continue;
      this.#writeEmbedding(row.id, vector);
    }
    this.backfillInProgress = false;
    this.#scheduleEdgeEmit(60);
  }

  #merge(existing, row) {
    const nextContent = row.content.length > String(existing.content ?? '').length ? row.content : existing.content;
    const nextTitle = row.title.length > String(existing.title ?? '').length ? row.title : existing.title;
    this.db
      .prepare(`
        UPDATE memories
        SET title = ?,
            content = ?,
            importance = MAX(importance, ?),
            confidence = MAX(confidence, ?),
            normalized_content = ?,
            lookup_key = ?,
            updated_at = CURRENT_TIMESTAMP,
            archived = 0,
            pinned = MAX(pinned, ?),
            scope = ?,
            workspace = ?,
            last_seen_source = ?
        WHERE id = ?
      `)
      .run(nextTitle, nextContent, row.importance, row.confidence, row.normalizedContent, row.lookupKey, row.pinned, row.scope, row.workspace, row.source, existing.id);
    if (nextContent !== existing.content || nextTitle !== existing.title) {
      this.#clearStoredEmbedding(existing.id);
    }
    return this.db.prepare(`${selectMemoryRows()} WHERE id = ?`).get(existing.id);
  }

  #queueEmbedding(row) {
    if (!this.embedder || this.embedder.disabled || !row || !row.id) return;
    const text = `${row.title}\n${row.content}`;
    void this.embedder.embed(text)
      .then((vector) => {
        if (!vector) return;
        this.#writeEmbedding(row.id, vector);
        this.#scheduleEdgeEmit();
      })
      .catch((error) => {
        console.warn(`[memoryStore] embedding failed for memory ${row.id}: ${error?.message ?? error}`);
      });
  }

  #writeEmbedding(id, vector) {
    const blob = Embedder.toBlob(vector);
    if (!blob) return;
    this.db
      .prepare('UPDATE memories SET embedding = ?, embedding_model = ? WHERE id = ?')
      .run(blob, 'minilm-l6-v2', id);
    this.embeddingCache.set(Number(id), vector);
  }

  #clearStoredEmbedding(id) {
    this.db.prepare('UPDATE memories SET embedding = NULL, embedding_model = NULL WHERE id = ?').run(id);
    this.embeddingCache.delete(Number(id));
  }

  #getCachedVector(id, blob) {
    const cached = this.embeddingCache.get(Number(id));
    if (cached) return cached;
    const vector = Embedder.fromBlob(blob);
    if (vector) this.embeddingCache.set(Number(id), vector);
    return vector;
  }

  #scheduleEdgeEmit(delay = EMBED_DEBOUNCE_MS) {
    if (this.edgeEmitTimer) {
      clearTimeout(this.edgeEmitTimer);
    }
    this.edgeEmitTimer = setTimeout(() => {
      this.edgeEmitTimer = null;
      try {
        const summary = this.similarityEdges();
        this.eventBus.emit('memory.edges.updated', {
          count: summary.edges.length,
          threshold: summary.threshold,
          totalCandidates: summary.totalCandidates
        });
      } catch (error) {
        console.warn(`[memoryStore] edge emit failed: ${error?.message ?? error}`);
      }
    }, delay);
    this.edgeEmitTimer.unref?.();
  }

}

export function normalizeMemoryContent(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|a|an|to|of|and|or|it|is|are|was|were)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function selectMemoryRows() {
  return `
    SELECT
      id, kind, title, content, importance, confidence, source,
      normalized_content AS normalizedContent,
      lookup_key AS lookupKey,
      created_at AS createdAt,
      updated_at AS updatedAt,
      last_used_at AS lastUsedAt,
      use_count AS useCount,
      pinned,
      archived,
      scope,
      workspace,
      last_seen_source AS lastSeenSource
    FROM memories
  `;
}

function normalizeScope(value) {
  return value === 'global' ? 'global' : 'project';
}

function cleanUpdateText(value, fallback, limit) {
  const text = value === undefined ? String(fallback ?? '') : String(value ?? '');
  return text.replace(/\s+/g, ' ').trim().slice(0, limit);
}

function lookupKey(kind, title, content) {
  const normalized = normalizeMemoryContent(`${kind} ${title} ${content}`);
  return normalized.split(' ').slice(0, 42).join(' ');
}

function tokenize(value) {
  return new Set(String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9:\\._-]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3)
    .filter((token) => !stopWords.has(token)));
}

function scoreMemory(memory, promptTokens, workspace) {
  const memoryTokens = tokenize(`${memory.kind} ${memory.title} ${memory.content}`);
  let overlap = 0;
  for (const token of memoryTokens) {
    if (promptTokens.has(token)) {
      overlap += 1;
    }
  }
  const workspaceBonus = workspace && String(memory.content).toLowerCase().includes(String(workspace).toLowerCase()) ? 1.4 : 0;
  const globalPreference = ['preference', 'constraint'].includes(memory.kind)
    && /\b(always|never|prefer|default|call me|my name)\b/i.test(`${memory.title} ${memory.content}`);
  if (overlap === 0 && workspaceBonus === 0 && !Number(memory.pinned) && !globalPreference) {
    return 0;
  }
  const kindBonus = memory.kind === 'preference' ? 0.8 : memory.kind === 'project' ? 0.55 : 0.25;
  const pinnedBonus = Number(memory.pinned) ? 1.4 : 0;
  const importance = Number(memory.importance ?? 1) * 0.28;
  const confidence = Number(memory.confidence ?? 0) * 0.9;
  const usePenalty = Math.min(Number(memory.useCount ?? 0), 12) * 0.015;
  return overlap * 0.85 + workspaceBonus + kindBonus + pinnedBonus + importance + confidence - usePenalty;
}

function toRecalledShape(memory) {
  return {
    id: memory.id,
    kind: memory.kind,
    title: memory.title,
    importance: Number(memory.importance ?? 0),
    confidence: Number(memory.confidence ?? 0),
    pinned: Number(memory.pinned ?? 0),
    scope: memory.scope,
    similarity: memory.similarity ?? null,
    relevanceScore: memory.relevanceScore ?? null
  };
}

const stopWords = new Set([
  'about', 'after', 'again', 'also', 'because', 'before', 'codex', 'could', 'from',
  'have', 'into', 'just', 'make', 'more', 'only', 'please', 'prompt', 'should',
  'task', 'that', 'their', 'there', 'these', 'this', 'with', 'work', 'would'
]);
