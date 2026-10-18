/**
 * Conversation persistence — Node 22 built-in `node:sqlite` (zero native deps).
 * User-controlled memory is an AGENTS.md non-negotiable: every conversation can
 * be listed, read, and deleted via the API. Nothing is learned silently.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** @param {string} dbPath */
export function createStore(dbPath) {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id, id);
  `);

  /** @param {string} id */
  function getConversation(id) {
    const conversation = /** @type {any} */ (
      db.prepare('SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?').get(id)
    );
    if (!conversation) return null;
    const messages = db
      .prepare('SELECT id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY id ASC')
      .all(id);
    return { ...conversation, messages };
  }

  return {
    /** @param {string} [title] */
    createConversation(title = 'New conversation') {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
        id,
        title,
        now,
        now
      );
      return getConversation(id);
    },
    /**
     * @param {number} [limit]
     * @param {number} [offset]
     */
    listConversations(limit = 50, offset = 0) {
      return /** @type {any[]} */ (
        db
          .prepare('SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT ? OFFSET ?')
          .all(limit, offset)
      );
    },
    /** @param {string} id */
    getConversation,
    /**
     * @param {string} conversationId
     * @param {'user'|'assistant'|'system'} role
     * @param {string} content
     */
    addMessage(conversationId, role, content) {
      const now = new Date().toISOString();
      db.prepare('INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)').run(
        conversationId,
        role,
        content,
        now
      );
      db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, conversationId);
    },
    /** @param {string} id */
    deleteConversation(id) {
      db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(id);
      return db.prepare('DELETE FROM conversations WHERE id = ?').run(id).changes > 0;
    },
    close() {
      db.close();
    },
  };
}
