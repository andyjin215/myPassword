import Database from 'better-sqlite3';
import path from 'node:path';

export interface VaultRow {
    id: number;
    favorite: number;
    deleted: number;
    item_type: number;
    b64_encrypted_data: string;
    b64_encrypted_iv: string;
    b64_encrypted_tag: string;
    updated_at: number;
}

let db: Database.Database;

/**
  * Initialize (or open) the SQLite database at the given directory.
  */
export function initDatabase(dataDir: string): Database.Database {
    const dbPath = path.join(dataDir, 'vault.db');
    db = new Database(dbPath);

    // Performance and safety settings
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Create tables
    db.exec(`
        CREATE TABLE IF NOT EXISTS vault_meta (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS items (
            id                    INTEGER PRIMARY KEY AUTOINCREMENT,
            favorite              INTEGER DEFAULT 0,
            deleted               INTEGER DEFAULT 0,
            item_type             INTEGER NOT NULL,
            b64_encrypted_data    TEXT    NOT NULL,
            b64_encrypted_iv      TEXT    NOT NULL,
            b64_encrypted_tag     TEXT    NOT NULL,
            updated_at            INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_items_type ON items(item_type);
        CREATE INDEX IF NOT EXISTS idx_items_deleted ON items(deleted);
    `);

    return db;
}

export function getDb(): Database.Database {
    if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
    return db;
}

export function closeDatabase(): void {
    if (db) {
        db.close();
    }
}

// ─── Vault metadata ─────────────────────────────────────────────

export function setMeta(key: string, value: string): void {
    const stmt = getDb().prepare(
        'INSERT OR REPLACE INTO vault_meta (key, value) VALUES (?, ?)'
    );
    stmt.run(key, value);
}

export function getMeta(key: string): string | undefined {
    const row = getDb().prepare('SELECT value FROM vault_meta WHERE key = ?').get(key) as
        | { value: string }
        | undefined;
    return row?.value;
}

// ─── Item CRUD ──────────────────────────────────────────────────

export function insertItem(
    itemType: number,
    encryptedData: string,
    encryptedIV: string,
    encryptedTag: string,
    favorite: number = 0
): number {
    const now = Date.now();
    const result = getDb().prepare(
        `INSERT INTO items (item_type, b64_encrypted_data, b64_encrypted_iv, b64_encrypted_tag, favorite, deleted, updated_at)
          VALUES (?, ?, ?, ?, ?, 0, ?)`
    ).run(itemType, encryptedData, encryptedIV, encryptedTag, favorite, now);
    return Number(result.lastInsertRowid);
}

export function getItems(
    itemType?: number,
    includeDeleted: boolean = false
): VaultRow[] {
    let sql = 'SELECT * FROM items WHERE 1=1';
    const params: (number | string)[] = [];

    if (!includeDeleted) {
        sql += ' AND deleted = 0';
    }
    if (itemType !== undefined) {
        sql += ' AND item_type = ?';
        params.push(itemType);
    }

    sql += ' ORDER BY updated_at DESC';

    return getDb().prepare(sql).all(...params) as VaultRow[];
}

export function getFavorites(): VaultRow[] {
    return getDb().prepare(
        'SELECT * FROM items WHERE favorite = 1 AND deleted = 0 ORDER BY updated_at DESC'
    ).all() as VaultRow[];
}

export function getItemById(id: number): VaultRow | undefined {
    return getDb().prepare('SELECT * FROM items WHERE id = ? AND deleted = 0').get(id) as VaultRow | undefined;
}

export function updateItem(
    id: number,
    encryptedData: string,
    encryptedIV: string,
    encryptedTag: string
): void {
    getDb().prepare(
        `UPDATE items
          SET b64_encrypted_data = ?, b64_encrypted_iv = ?, b64_encrypted_tag = ?, updated_at = ?
          WHERE id = ?`
    ).run(encryptedData, encryptedIV, encryptedTag, Date.now(), id);
}

export function toggleFavorite(id: number, favorite: number): void {
    getDb().prepare('UPDATE items SET favorite = ?, updated_at = ? WHERE id = ?')
        .run(favorite ? 1 : 0, Date.now(), id);
}

export function softDeleteItem(id: number): void {
    getDb().prepare('UPDATE items SET deleted = 1, updated_at = ? WHERE id = ?')
        .run(Date.now(), id);
}

export function permanentDeleteItem(id: number): void {
    getDb().prepare('DELETE FROM items WHERE id = ?').run(id);
}

export function restoreItem(id: number): void {
    getDb().prepare('UPDATE items SET deleted = 0, updated_at = ? WHERE id = ?')
        .run(Date.now(), id);
}
