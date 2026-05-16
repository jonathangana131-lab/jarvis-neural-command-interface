import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export class TaskStore {
  constructor(databasePath) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    this.db = new DatabaseSync(databasePath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
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
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    `);
    this.#ensureColumn('phase', "TEXT NOT NULL DEFAULT 'queued'");
    this.#ensureColumn('logs', "TEXT NOT NULL DEFAULT ''");
    this.#ensureColumn('remembered_memory_ids', "TEXT NOT NULL DEFAULT '[]'");
    this.#ensureColumn('created_memory_ids', "TEXT NOT NULL DEFAULT '[]'");
    this.#ensureColumn('memory_skipped', "TEXT NOT NULL DEFAULT '[]'");
    this.#ensureColumn('files_changed', "TEXT NOT NULL DEFAULT '[]'");
    this.#ensureColumn('commands_run', "TEXT NOT NULL DEFAULT '[]'");
    this.#ensureColumn('tests_run', "TEXT NOT NULL DEFAULT '[]'");
    this.#ensureColumn('updated_at', 'TEXT');
    this.#markInterruptedRunning();
  }

  list(limit = 80) {
    return this.db
      .prepare(`${selectTaskRows()} ORDER BY created_at DESC LIMIT ?`)
      .all(limit)
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
          id, prompt, workspace, status, phase, output, logs, created_at, finished_at, exit_code,
          remembered_memory_ids, created_memory_ids, memory_skipped, files_changed, commands_run,
          tests_run, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
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
          updated_at = CURRENT_TIMESTAMP
      `)
      .run(
        task.id,
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
        stringifyJson(task.testsRun ?? [])
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

  close() {
    this.db.close();
  }

  #ensureColumn(name, definition) {
    const columns = this.db.prepare('PRAGMA table_info(tasks)').all();
    if (!columns.some((column) => column.name === name)) {
      this.db.exec(`ALTER TABLE tasks ADD COLUMN ${name} ${definition}`);
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
      tests_run AS testsRun
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
    testsRun: parseJsonArray(row.testsRun)
  };
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

function inferPhase(status) {
  if (status === 'queued') {
    return 'queued';
  }
  if (status === 'running') {
    return 'planning';
  }
  return 'done';
}
