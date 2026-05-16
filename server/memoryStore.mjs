import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export class MemoryStore {
  constructor(databasePath, eventBus) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    this.db = new DatabaseSync(databasePath);
    this.eventBus = eventBus ?? { emit() {} };
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
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_memories_normalized_content ON memories(normalized_content);');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_memories_lookup_key ON memories(lookup_key);');
    this.#backfillLookupKeys();
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
      return this.#merge(existing, row);
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
    this.eventBus.emit('memory.deleted', { id: Number(id) });
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
    this.eventBus.emit('memory.updated', updated);
    return updated;
  }

  resetVisible() {
    const deleted = this.db
      .prepare("DELETE FROM memories WHERE kind NOT IN ('demo', 'manual') AND source NOT IN ('ui-demo', 'manual')")
      .run();
    this.eventBus.emit('memory.reset', { deleted: deleted.changes ?? 0 });
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

  relevantFor({ prompt, workspace, limit = 6 }) {
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
    }
    return scored;
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
    return this.db.prepare(`${selectMemoryRows()} WHERE id = ?`).get(existing.id);
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

const stopWords = new Set([
  'about', 'after', 'again', 'also', 'because', 'before', 'codex', 'could', 'from',
  'have', 'into', 'just', 'make', 'more', 'only', 'please', 'prompt', 'should',
  'task', 'that', 'their', 'there', 'these', 'this', 'with', 'work', 'would'
]);
