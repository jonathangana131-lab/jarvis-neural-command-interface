import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export class TaskStore {
  constructor(databasePath) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    this.db = new DatabaseSync(databasePath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        chat_id TEXT,
        prompt TEXT NOT NULL,
        workspace TEXT NOT NULL,
        status TEXT NOT NULL,
        phase TEXT NOT NULL DEFAULT 'queued',
        output TEXT NOT NULL DEFAULT '',
        logs TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        finished_at TEXT,
        exit_code INTEGER,
        remembered_memory_ids TEXT NOT NULL DEFAULT '[]',
        created_memory_ids TEXT NOT NULL DEFAULT '[]',
        memory_skipped TEXT NOT NULL DEFAULT '[]',
        files_changed TEXT NOT NULL DEFAULT '[]',
        commands_run TEXT NOT NULL DEFAULT '[]',
        tests_run TEXT NOT NULL DEFAULT '[]',
        failure_kind TEXT,
        failure_action TEXT,
        provider_used TEXT,
        task_mode TEXT,
        timing_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        workspace TEXT NOT NULL DEFAULT '',
        archived INTEGER NOT NULL DEFAULT 0,
        pinned INTEGER NOT NULL DEFAULT 0,
        cleared_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);
    `);
    this.#ensureColumn('chat_id', 'TEXT');
    this.#ensureColumn('phase', "TEXT NOT NULL DEFAULT 'queued'");
    this.#ensureColumn('logs', "TEXT NOT NULL DEFAULT ''");
    this.#ensureColumn('remembered_memory_ids', "TEXT NOT NULL DEFAULT '[]'");
    this.#ensureColumn('created_memory_ids', "TEXT NOT NULL DEFAULT '[]'");
    this.#ensureColumn('memory_skipped', "TEXT NOT NULL DEFAULT '[]'");
    this.#ensureColumn('files_changed', "TEXT NOT NULL DEFAULT '[]'");
    this.#ensureColumn('commands_run', "TEXT NOT NULL DEFAULT '[]'");
    this.#ensureColumn('tests_run', "TEXT NOT NULL DEFAULT '[]'");
    this.#ensureColumn('failure_kind', 'TEXT');
    this.#ensureColumn('failure_action', 'TEXT');
    this.#ensureColumn('provider_used', 'TEXT');
    this.#ensureColumn('task_mode', 'TEXT');
    this.#ensureColumn('timing_json', "TEXT NOT NULL DEFAULT '{}'");
    this.#ensureColumn('updated_at', 'TEXT');
    this.#ensureChatColumn('pinned', 'INTEGER NOT NULL DEFAULT 0');
    this.#ensureChatColumn('cleared_at', 'TEXT');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_chat_id ON tasks(chat_id)');
    this.#markInterruptedRunning();
  }

  list(limit = 80) {
    return this.db
      .prepare(`${selectTaskRows()} ORDER BY created_at DESC LIMIT ?`)
      .all(limit)
      .map(normalizeTaskRow);
  }

  listByChat(chatId, limit = 80) {
    const chat = this.getChat(chatId);
    const clearedAt = chat?.clearedAt ?? '';
    return this.db
      .prepare(`${selectTaskRows()} WHERE chat_id = ? AND (? = '' OR created_at > ?) ORDER BY created_at ASC LIMIT ?`)
      .all(chatId, clearedAt, clearedAt, limit)
      .map(normalizeTaskRow);
  }

  get(id) {
    const row = this.db
      .prepare(`${selectTaskRows()} WHERE id = ?`)
      .get(id);
    return row ? normalizeTaskRow(row) : null;
  }

  upsert(task) {
    this.db
      .prepare(`
        INSERT INTO tasks (
          id, chat_id, prompt, workspace, status, phase, output, logs, created_at, finished_at, exit_code,
          remembered_memory_ids, created_memory_ids, memory_skipped, files_changed, commands_run,
          tests_run, failure_kind, failure_action, provider_used, task_mode, timing_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          chat_id = excluded.chat_id,
          prompt = excluded.prompt,
          workspace = excluded.workspace,
          status = excluded.status,
          phase = excluded.phase,
          output = excluded.output,
          logs = excluded.logs,
          finished_at = excluded.finished_at,
          exit_code = excluded.exit_code,
          remembered_memory_ids = excluded.remembered_memory_ids,
          created_memory_ids = excluded.created_memory_ids,
          memory_skipped = excluded.memory_skipped,
          files_changed = excluded.files_changed,
          commands_run = excluded.commands_run,
          tests_run = excluded.tests_run,
          failure_kind = excluded.failure_kind,
          failure_action = excluded.failure_action,
          provider_used = excluded.provider_used,
          task_mode = excluded.task_mode,
          timing_json = excluded.timing_json,
          updated_at = CURRENT_TIMESTAMP
      `)
      .run(
        task.id,
        task.chatId ?? null,
        task.prompt,
        task.workspace,
        task.status,
        task.phase ?? inferPhase(task.status),
        task.output ?? '',
        task.logs ?? '',
        task.createdAt,
        task.finishedAt ?? null,
        task.exitCode ?? null,
        stringifyJson(task.rememberedMemoryIds ?? []),
        stringifyJson(task.createdMemoryIds ?? []),
        stringifyJson(task.memorySkipped ?? []),
        stringifyJson(task.filesChanged ?? []),
        stringifyJson(task.commandsRun ?? []),
        stringifyJson(task.testsRun ?? []),
        task.failureKind ?? null,
        task.failureAction ?? null,
        task.providerUsed ?? null,
        task.taskMode ?? null,
        stringifyJsonObject(task.timing ?? {})
      );
    return this.get(task.id);
  }

  nextQueued() {
    const row = this.db
      .prepare(`${selectTaskRows()} WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1`)
      .get();
    return row ? normalizeTaskRow(row) : null;
  }

  hasActiveTask() {
    return Boolean(this.db
      .prepare("SELECT id FROM tasks WHERE status = 'running' LIMIT 1")
      .get());
  }

  countQueued() {
    const row = this.db
      .prepare("SELECT COUNT(*) AS count FROM tasks WHERE status = 'queued'")
      .get();
    return Number(row?.count ?? 0);
  }

  listQueued(limit = 12) {
    return this.db
      .prepare(`${selectTaskRows()} WHERE status = 'queued' ORDER BY created_at ASC LIMIT ?`)
      .all(limit)
      .map(normalizeTaskRow);
  }

  lastFailedTask() {
    const row = this.db
      .prepare(`${selectTaskRows()} WHERE status IN ('failed', 'timed_out') ORDER BY COALESCE(finished_at, created_at) DESC LIMIT 1`)
      .get();
    return row ? normalizeTaskRow(row) : null;
  }

  listChats({ limit = 80, query = '' } = {}) {
    const q = String(query ?? '').trim().toLowerCase();
    const like = `%${q}%`;
    return this.db
      .prepare(`
        SELECT
          c.id,
          c.title,
          c.workspace,
          c.archived,
          c.pinned,
          c.cleared_at AS clearedAt,
          c.created_at AS createdAt,
          c.updated_at AS updatedAt,
          COUNT(t.id) AS taskCount,
          MAX(t.created_at) AS lastTaskAt,
          (
            SELECT prompt
            FROM tasks
            WHERE chat_id = c.id
              AND (c.cleared_at IS NULL OR created_at > c.cleared_at)
            ORDER BY created_at DESC
            LIMIT 1
          ) AS lastPrompt,
          (
            SELECT status
            FROM tasks
            WHERE chat_id = c.id
              AND (c.cleared_at IS NULL OR created_at > c.cleared_at)
            ORDER BY created_at DESC
            LIMIT 1
          ) AS lastStatus
        FROM chat_sessions c
        LEFT JOIN tasks t ON t.chat_id = c.id
          AND (c.cleared_at IS NULL OR t.created_at > c.cleared_at)
        WHERE c.archived = 0
          AND (? = '' OR lower(c.title) LIKE ? OR lower(c.workspace) LIKE ? OR lower(COALESCE(t.prompt, '')) LIKE ?)
        GROUP BY c.id
        ORDER BY c.pinned DESC, COALESCE(MAX(t.created_at), c.updated_at) DESC
        LIMIT ?
      `)
      .all(q, like, like, like, limit)
      .map(normalizeChatRow);
  }

  getChat(id) {
    const row = this.db
      .prepare(`
        SELECT
          id,
          title,
          workspace,
          archived,
          pinned,
          cleared_at AS clearedAt,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM chat_sessions
        WHERE id = ?
      `)
      .get(id);
    return row ? normalizeChatRow(row) : null;
  }

  createChat({ title, workspace } = {}) {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const cleanTitle = compactTitle(title, 'New Chat');
    const cleanWorkspace = String(workspace ?? '').trim();
    this.db
      .prepare(`
        INSERT INTO chat_sessions (id, title, workspace, archived, created_at, updated_at)
        VALUES (?, ?, ?, 0, ?, ?)
      `)
      .run(id, cleanTitle, cleanWorkspace, now, now);
    return this.getChat(id);
  }

  updateChat(id, updates = {}) {
    const existing = this.getChat(id);
    if (!existing) {
      return null;
    }
    const title = updates.title === undefined
      ? existing.title
      : compactTitle(updates.title, existing.title || 'New Chat');
    const archived = updates.archived === undefined ? existing.archived : Boolean(updates.archived);
    const pinned = updates.pinned === undefined ? existing.pinned : Boolean(updates.pinned);
    const clearedAt = updates.clearedAt === undefined ? existing.clearedAt : (updates.clearedAt || null);
    const workspace = updates.workspace === undefined
      ? existing.workspace
      : String(updates.workspace ?? '').trim();
    this.db
      .prepare(`
        UPDATE chat_sessions
        SET title = ?,
            workspace = ?,
            archived = ?,
            pinned = ?,
            cleared_at = ?,
            updated_at = ?
        WHERE id = ?
      `)
      .run(title, workspace, archived ? 1 : 0, pinned ? 1 : 0, clearedAt, new Date().toISOString(), id);
    return this.getChat(id);
  }

  archiveChat(id) {
    return this.updateChat(id, { archived: true });
  }

  clearChat(id) {
    return this.updateChat(id, { clearedAt: new Date().toISOString() });
  }

  touchChat(id, task = null) {
    const existing = this.getChat(id);
    if (!existing) {
      return null;
    }
    const title = existing.title === 'New Chat' && task?.prompt
      ? titleFromPrompt(task.prompt)
      : existing.title;
    this.db
      .prepare(`
        UPDATE chat_sessions
        SET title = ?,
            workspace = COALESCE(NULLIF(?, ''), workspace),
            updated_at = ?
        WHERE id = ?
      `)
      .run(title, task?.workspace ?? '', new Date().toISOString(), id);
    return this.getChat(id);
  }

  close() {
    this.db.close();
  }

  #ensureColumn(name, definition) {
    const columns = this.db.prepare('PRAGMA table_info(tasks)').all();
    if (!columns.some((column) => column.name === name)) {
      this.db.exec(`ALTER TABLE tasks ADD COLUMN ${name} ${definition}`);
    }
  }

  #ensureChatColumn(name, definition) {
    const columns = this.db.prepare('PRAGMA table_info(chat_sessions)').all();
    if (!columns.some((column) => column.name === name)) {
      this.db.exec(`ALTER TABLE chat_sessions ADD COLUMN ${name} ${definition}`);
    }
  }

  #markInterruptedRunning() {
    const now = new Date().toISOString();
    this.db
      .prepare(`
        UPDATE tasks
        SET status = 'failed',
            phase = 'done',
            finished_at = COALESCE(finished_at, ?),
            output = TRIM(output || CHAR(10) || 'Task interrupted when Jarvis Neural Command Interface restarted.'),
            memory_skipped = ?,
            failure_kind = COALESCE(failure_kind, 'unknown'),
            failure_action = COALESCE(failure_action, 'Review Diagnostics, then retry the task.'),
            updated_at = CURRENT_TIMESTAMP
        WHERE status = 'running'
      `)
      .run(now, stringifyJson([{
        reason: 'Task interrupted before memory extraction.',
        content: 'Jarvis Neural Command Interface restarted while this task was running.',
        confidence: 0
      }]));
  }
}

function selectTaskRows() {
  return `
    SELECT
      id,
      chat_id AS chatId,
      prompt,
      workspace,
      status,
      phase,
      output,
      logs,
      created_at AS createdAt,
      finished_at AS finishedAt,
      exit_code AS exitCode,
      remembered_memory_ids AS rememberedMemoryIds,
      created_memory_ids AS createdMemoryIds,
      memory_skipped AS memorySkipped,
      files_changed AS filesChanged,
      commands_run AS commandsRun,
      tests_run AS testsRun,
      failure_kind AS failureKind,
      failure_action AS failureAction,
      provider_used AS providerUsed,
      task_mode AS taskMode,
      timing_json AS timingJson
    FROM tasks
  `;
}

function normalizeTaskRow(row) {
  return {
    ...row,
    exitCode: row.exitCode === null || row.exitCode === undefined ? null : Number(row.exitCode),
    rememberedMemoryIds: parseJsonArray(row.rememberedMemoryIds),
    createdMemoryIds: parseJsonArray(row.createdMemoryIds),
    memorySkipped: parseJsonArray(row.memorySkipped),
    filesChanged: parseJsonArray(row.filesChanged),
    commandsRun: parseJsonArray(row.commandsRun),
    testsRun: parseJsonArray(row.testsRun),
    timing: parseJsonObject(row.timingJson)
  };
}

function normalizeChatRow(row) {
  return {
    ...row,
    archived: Boolean(row.archived),
    pinned: Boolean(row.pinned),
    clearedAt: row.clearedAt ?? null,
    taskCount: Number(row.taskCount ?? 0),
    lastTaskAt: row.lastTaskAt ?? null,
    lastPrompt: row.lastPrompt ?? null,
    lastStatus: row.lastStatus ?? null
  };
}

function compactTitle(value, fallback) {
  const title = String(value ?? '').replace(/\s+/g, ' ').trim();
  return (title || fallback).slice(0, 96);
}

function titleFromPrompt(prompt) {
  const cleaned = String(prompt ?? '').replace(/\s+/g, ' ').trim().replace(/[.!?]+$/g, '');
  return compactTitle(cleaned || 'New Chat', 'New Chat');
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(String(value ?? '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function stringifyJson(value) {
  return JSON.stringify(Array.isArray(value) ? value : []);
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(String(value ?? '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function stringifyJsonObject(value) {
  return JSON.stringify(value && typeof value === 'object' && !Array.isArray(value) ? value : {});
}

function inferPhase(status) {
  if (status === 'queued') {
    return 'queued';
  }
  if (status === 'running') {
    return 'planning';
  }
  return 'done';
}
