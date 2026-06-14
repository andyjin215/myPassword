import {
    app, BrowserWindow, ipcMain, clipboard, Menu, Tray,
    nativeImage, powerMonitor,
} from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import http from 'node:http';
import {
    deriveKEK, generateDEK, encryptAES, decryptAES,
    generatePassword, generateSalt,
} from '../core/crypto';
import {
    initDatabase, closeDatabase, getDb, getMeta, setMeta,
    insertItem, getItems, getFavorites, getItemById,
    updateItem, toggleFavorite, softDeleteItem,
    permanentDeleteItem, restoreItem,
} from '../core/database';

// ─── State ──────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let dek: Buffer | null = null;               // Data Encryption Key (in memory only)
let autoLockTimer: ReturnType<typeof setTimeout> | null = null;
let autoLockMinutes: number = 5;

const DATA_DIR = path.join(app.getPath('userData'), 'MyPassword');

// ─── Window Creation ────────────────────────────────────────────

function createWindow() {
    const isMac = process.platform === 'darwin';
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 750,
        minWidth: 800,
        minHeight: 600,
        titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
        ...(isMac ? { trafficLightPosition: { x: 16, y: 16 } } : {}),
        frame: true,
        backgroundColor: '#0f172a',
        show: false,
        webPreferences: {
            preload: path.join(__dirname, '..', 'preload', 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    // Load the renderer
    if (process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ─── Tray i18n ───────────────────────────────────────────────────

const trayI18n: Record<string, Record<string, string>> = {
    en: { show: 'Show MyPassword', lock: 'Lock', quit: 'Quit' },
    zh: { show: '显示 MyPassword', lock: '锁定', quit: '退出' },
};

function getTrayLocale(): string {
    try {
        const loc = getMeta('locale');
        if (loc === 'zh') return 'zh';
    } catch { /* db not ready yet */ }
    return 'en';
}

function createTray() {
    // Create a 16x16 lock icon for the tray
    const isMac = process.platform === 'darwin';
    const canvas = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${isMac ? 'black' : '#818cf8'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
    const icon = nativeImage.createFromBuffer(Buffer.from(canvas));
    if (isMac) {
        icon.setTemplateImage(true);
    }
    tray = new Tray(icon);
    tray.setToolTip('MyPassword');
    rebuildTrayMenu();

    // On Windows/Linux, left-click toggles window visibility (standard behavior)
    if (!isMac) {
        tray.on('click', () => {
            if (mainWindow) {
                mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
            }
        });
    }
}

function rebuildTrayMenu() {
    if (!tray) return;
    const t = trayI18n[getTrayLocale()] || trayI18n.en;
    const contextMenu = Menu.buildFromTemplate([
        {
            label: t.show,
            click: () => mainWindow?.show(),
        },
        {
            label: t.lock,
            click: () => {
                lock();
            },
        },
        { type: 'separator' },
        {
            label: t.quit,
            click: () => {
                app.quit();
            },
        },
    ]);
    tray.setContextMenu(contextMenu);
}

// ─── Vault Lock/Unlock ──────────────────────────────────────────

function lock() {
    if (dek) {
        dek.fill(0);  // Zero the key material from memory before releasing
    }
    dek = null;
    clearAutoLockTimer();
    mainWindow?.webContents.send('vault:locked');
}

function resetAutoLockTimer() {
    clearAutoLockTimer();
    if (dek && autoLockMinutes > 0) {
        autoLockTimer = setTimeout(() => {
            lock();
        }, autoLockMinutes * 60 * 1000);
    }
}

function clearAutoLockTimer() {
    if (autoLockTimer) {
        clearTimeout(autoLockTimer);
        autoLockTimer = null;
    }
}

// ─── Data helpers ───────────────────────────────────────────────

function encryptItemData(jsonStr: string) {
    if (!dek) throw new Error('Vault is locked');
    return encryptAES(dek, jsonStr);
}

function decryptItemData(encryptedData: string, encryptedIV: string, encryptedTag: string): string {
    if (!dek) throw new Error('Vault is locked');
    const result = decryptAES(dek, { data: encryptedData, iv: encryptedIV, tag: encryptedTag });
    return result.toString('utf-8');
}

// ─── IPC Handlers ───────────────────────────────────────────────

function registerIpcHandlers() {
    // Check if vault is initialized (master password exists)
    ipcMain.handle('vault:is-initialized', () => {
        return !!getMeta('encrypted_dek');
    });

    // Check if vault is currently unlocked
    ipcMain.handle('vault:is-unlocked', () => {
        return dek !== null;
    });

    // Initialize vault with a new master password
    ipcMain.handle('vault:init', async (_e, masterPassword: string) => {
        // Generate salt for PBKDF2
        const salt = generateSalt();
        setMeta('salt', salt.toString('base64'));

        // Derive KEK from master password
        const kek = deriveKEK(masterPassword, salt);

        // Generate random DEK
        dek = generateDEK();

        // Encrypt DEK with KEK
        const encDEK = encryptAES(kek, dek);
        setMeta('encrypted_dek', encDEK.data);
        setMeta('encrypted_dek_iv', encDEK.iv);
        setMeta('encrypted_dek_tag', encDEK.tag);

        // Store auto-lock setting
        const currentAutoLock = getMeta('auto_lock_minutes');
        if (!currentAutoLock) {
            setMeta('auto_lock_minutes', '5');
        }

        resetAutoLockTimer();
        return true;
    });

    // Unlock vault with master password
    ipcMain.handle('vault:unlock', async (_e, masterPassword: string) => {
        const saltB64 = getMeta('salt');
        const encDEKData = getMeta('encrypted_dek');
        const encDEKIV = getMeta('encrypted_dek_iv');
        const encDEKTag = getMeta('encrypted_dek_tag');

        if (!saltB64 || !encDEKData || !encDEKIV || !encDEKTag) {
            throw new Error('Vault not initialized');
        }

        try {
            const salt = Buffer.from(saltB64, 'base64');
            const kek = deriveKEK(masterPassword, salt);
            dek = decryptAES(kek, { data: encDEKData, iv: encDEKIV, tag: encDEKTag });

            const storedAutoLock = getMeta('auto_lock_minutes');
            if (storedAutoLock) {
                autoLockMinutes = parseInt(storedAutoLock, 10);
            }

            resetAutoLockTimer();
            return true;
        } catch {
            dek = null;
            return false;
        }
    });

    // Lock vault
    ipcMain.handle('vault:lock', async () => {
        lock();
        return true;
    });

    // List items
    ipcMain.handle('items:list', async (_e, itemType?: number) => {
        if (!dek) throw new Error('Vault is locked');
        resetAutoLockTimer();

        const rows = getItems(itemType);
        return rows.map((row) => {
            try {
                const jsonStr = decryptItemData(row.b64_encrypted_data, row.b64_encrypted_iv, row.b64_encrypted_tag);
                return {
                    id: row.id,
                    itemType: row.item_type,
                    favorite: row.favorite === 1,
                    deleted: row.deleted === 1,
                    updatedAt: row.updated_at,
                    data: JSON.parse(jsonStr),
                };
            } catch {
                return null;
            }
        }).filter(Boolean);
    });

    // List favorites
    ipcMain.handle('items:favorites', async () => {
        if (!dek) throw new Error('Vault is locked');
        resetAutoLockTimer();

        const rows = getFavorites();
        return rows.map((row) => {
            try {
                const jsonStr = decryptItemData(row.b64_encrypted_data, row.b64_encrypted_iv, row.b64_encrypted_tag);
                return {
                    id: row.id,
                    itemType: row.item_type,
                    favorite: true,
                    deleted: false,
                    updatedAt: row.updated_at,
                    data: JSON.parse(jsonStr),
                };
            } catch {
                return null;
            }
        }).filter(Boolean);
    });

    // List trash
    ipcMain.handle('items:trash', async () => {
        if (!dek) throw new Error('Vault is locked');
        resetAutoLockTimer();

        const rows = getItems(undefined, true).filter(r => r.deleted === 1);
        return rows.map((row) => {
            try {
                const jsonStr = decryptItemData(row.b64_encrypted_data, row.b64_encrypted_iv, row.b64_encrypted_tag);
                return {
                    id: row.id,
                    itemType: row.item_type,
                    favorite: row.favorite === 1,
                    deleted: true,
                    updatedAt: row.updated_at,
                    data: JSON.parse(jsonStr),
                };
            } catch {
                return null;
            }
        }).filter(Boolean);
    });

    // Create item
    ipcMain.handle('items:create', async (_e, itemType: number, data: object) => {
        if (!dek) throw new Error('Vault is locked');
        resetAutoLockTimer();

        const jsonStr = JSON.stringify(data);
        const enc = encryptItemData(jsonStr);
        const id = insertItem(itemType, enc.data, enc.iv, enc.tag);
        return id;
    });

    // Update item
    ipcMain.handle('items:update', async (_e, id: number, data: object) => {
        if (!dek) throw new Error('Vault is locked');
        resetAutoLockTimer();

        const jsonStr = JSON.stringify(data);
        const enc = encryptItemData(jsonStr);
        updateItem(id, enc.data, enc.iv, enc.tag);
        return true;
    });

    // Toggle favorite
    ipcMain.handle('items:toggle-favorite', async (_e, id: number, favorite: boolean) => {
        if (!dek) throw new Error('Vault is locked');
        resetAutoLockTimer();
        toggleFavorite(id, favorite ? 1 : 0);
        return true;
    });

    // Delete item (soft)
    ipcMain.handle('items:delete', async (_e, id: number) => {
        if (!dek) throw new Error('Vault is locked');
        resetAutoLockTimer();
        softDeleteItem(id);
        return true;
    });

    // Restore item from trash
    ipcMain.handle('items:restore', async (_e, id: number) => {
        if (!dek) throw new Error('Vault is locked');
        resetAutoLockTimer();
        restoreItem(id);
        return true;
    });

    // Permanent delete
    ipcMain.handle('items:permanent-delete', async (_e, id: number) => {
        if (!dek) throw new Error('Vault is locked');
        resetAutoLockTimer();
        permanentDeleteItem(id);
        return true;
    });

    // Generate password
    ipcMain.handle('password:generate', async (_e, options: {
        length?: number;
        uppercase?: boolean;
        lowercase?: boolean;
        numbers?: boolean;
        symbols?: boolean;
    }) => {
        return generatePassword(options);
    });

    // Copy to clipboard
    ipcMain.handle('clipboard:write', async (_e, text: string) => {
        clipboard.writeText(text);
        // Clear clipboard after 30 seconds for security
        setTimeout(() => {
            if (clipboard.readText() === text) {
                clipboard.writeText('');
            }
        }, 30_000);
        return true;
    });

    // Settings
    ipcMain.handle('settings:get-auto-lock', async () => {
        const val = getMeta('auto_lock_minutes');
        return val ? parseInt(val, 10) : 5;
    });

    ipcMain.handle('settings:set-auto-lock', async (_e, minutes: number) => {
        autoLockMinutes = minutes;
        setMeta('auto_lock_minutes', String(minutes));
        resetAutoLockTimer();
        return true;
    });

    // ─── Locale ─────────────────────────────────
    ipcMain.handle('locale:get', () => {
        return getMeta('locale') || 'en';
    });

    ipcMain.handle('locale:set', (_e, locale: string) => {
        if (locale !== 'en' && locale !== 'zh') return false;
        setMeta('locale', locale);
        rebuildTrayMenu();
        return true;
    });

    // Change master password
    ipcMain.handle('vault:change-password', async (_e, oldPassword: string, newPassword: string) => {
        if (!dek) throw new Error('Vault is locked');

        const saltB64 = getMeta('salt');
        if (!saltB64) throw new Error('Salt not found');

        const oldSalt = Buffer.from(saltB64, 'base64');

        // Verify old password
        const oldKEK = deriveKEK(oldPassword, oldSalt);
        try {
            const encDEKData = getMeta('encrypted_dek')!;
            const encDEKIV = getMeta('encrypted_dek_iv')!;
            const encDEKTag = getMeta('encrypted_dek_tag')!;
            decryptAES(oldKEK, { data: encDEKData, iv: encDEKIV, tag: encDEKTag });
        } catch {
            throw new Error('Old password is incorrect');
        }

        // Generate fresh salt and re-encrypt DEK with new KEK
        const newSalt = generateSalt();
        const newKEK = deriveKEK(newPassword, newSalt);
        const newEncDEK = encryptAES(newKEK, dek);

        // Write all meta in a single transaction to prevent vault corruption on crash
        const writeAll = getDb().transaction(() => {
            setMeta('salt', newSalt.toString('base64'));
            setMeta('encrypted_dek', newEncDEK.data);
            setMeta('encrypted_dek_iv', newEncDEK.iv);
            setMeta('encrypted_dek_tag', newEncDEK.tag);
        });
        writeAll();

        return true;
    });

    // Extension pairing: confirm a pending pair request
    ipcMain.handle('extension:confirm-pair', async (_e, extensionId: string) => {
        const pendingRaw = getMeta(`ext_pending_${extensionId}`);
        if (!pendingRaw) throw new Error('Pending pair not found');

        const pending = JSON.parse(pendingRaw);
        // Move from pending to active
        setMeta(`ext_seed_${extensionId}`, pending.seed);
        // Preserve name/device info for display
        setMeta(`ext_info_${extensionId}`, JSON.stringify({ name: pending.name, device: pending.device }));

        // Clean up pending data
        const db = getDb();
        db.prepare("DELETE FROM vault_meta WHERE key = ?").run(`ext_pending_${extensionId}`);

        return true;
    });

    // Extension pairing: reject a pending pair
    ipcMain.handle('extension:reject-pair', async (_e, extensionId: string) => {
        const db = getDb();
        // Remove both seed (in case it was somehow stored) and pending data
        db.prepare("DELETE FROM vault_meta WHERE key = ?").run(`ext_seed_${extensionId}`);
        db.prepare("DELETE FROM vault_meta WHERE key = ?").run(`ext_pending_${extensionId}`);
        return true;
    });

    // List paired extensions
    ipcMain.handle('extension:list', async () => {
        const db = getDb();
        const rows = db.prepare(
            "SELECT key, value FROM vault_meta WHERE key LIKE 'ext_seed_%'"
        ).all() as { key: string; value: string }[];

        return rows.map((row) => {
            const extId = row.key.replace('ext_seed_', '');
            // Try ext_info first (new format), fall back to ext_pending (legacy)
            const infoRaw = getMeta(`ext_info_${extId}`) || getMeta(`ext_pending_${extId}`);
            const info = infoRaw ? JSON.parse(infoRaw) : { name: 'Unknown', device: 'Unknown' };
            return { extensionId: extId, name: info.name, device: info.device };
        });
    });
}

// ─── HTTP RPC Server (for browser extension) ────────────────────

const RPC_PORT = 27432;
const HMAC_WINDOW_MS = 30_000; // 30-second replay protection

interface RpcRequest {
    method: string;
    path: string;
    body: any;
    extensionId?: string;
}

function startRpcServer() {
    // Rate limiting state
    const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
    function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
        const now = Date.now();
        const entry = rateLimitMap.get(key);
        if (!entry || now > entry.resetAt) {
            rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
            return true;
        }
        if (entry.count >= maxRequests) return false;
        entry.count++;
        return true;
    }

    // Clean up stale rate limit entries periodically
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of rateLimitMap) {
            if (now > entry.resetAt) rateLimitMap.delete(key);
        }
    }, 60_000);

    const MAX_BODY_SIZE = 1024 * 1024; // 1 MB

    const server = http.createServer(async (req, res) => {
        // CORS — restrict to paired extensions and localhost only
        const origin = req.headers.origin || '';
        let corsAllowed = false;
        if (origin.startsWith('chrome-extension://')) {
            // Only allow specifically paired extension IDs
            try {
                const extId = origin.replace('chrome-extension://', '');
                const pendingRaw = getMeta(`ext_pending_${extId}`);
                const seed = getMeta(`ext_seed_${extId}`);
                if (pendingRaw || seed) corsAllowed = true;
            } catch { /* ignore */ }
        } else if (origin === 'http://localhost' || origin === 'http://127.0.0.1' ||
                   origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
            corsAllowed = true;
        }
        res.setHeader('Access-Control-Allow-Origin', corsAllowed ? origin : '');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers',
            'Content-Type, X-Extension-Id, X-Extension-Timestamp, X-Extension-Signature');

        if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

        const url = new URL(req.url || '/', `http://127.0.0.1:${RPC_PORT}`);
        const path = url.pathname;
        const fullPath = req.url || '/';  // Full path including query string, for HMAC verification
        const method = req.method || 'GET';

        // Read body with size limit
        let body: any = {};
        let rawBody = '';  // Raw body string for HMAC verification
        if (method === 'POST') {
            const raw = await new Promise<string>((resolve, reject) => {
                let data = '';
                let size = 0;
                req.on('data', (chunk: Buffer) => {
                    size += chunk.length;
                    if (size > MAX_BODY_SIZE) {
                        reject(new Error('Request body too large'));
                        return;
                    }
                    data += chunk;
                });
                req.on('end', () => resolve(data));
                req.on('error', reject);
            }).catch((err) => {
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
                return null;
            });
            if (raw === null) return; // Already responded with 413
            rawBody = raw || '';
            try { body = rawBody ? JSON.parse(rawBody) : {}; } catch { body = {}; }
        }

        // Parse query params
        const query = Object.fromEntries(url.searchParams);

        // Public endpoints (no auth required)
        const publicPaths = ['/info', '/pair', '/pair/status', '/vault/unlock'];

        // Rate limiting for sensitive public endpoints
        if (path === '/pair' && method === 'POST') {
            if (!checkRateLimit('pair', 5, 60_000)) {
                res.writeHead(429, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Too many pairing requests. Please wait.' }));
                return;
            }
        }
        if (path === '/vault/unlock' && method === 'POST') {
            if (!checkRateLimit('unlock', 10, 60_000)) {
                res.writeHead(429, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Too many unlock attempts. Please wait.' }));
                return;
            }
        }

        if (!publicPaths.includes(path)) {
            // Authenticate extension
            const extId = req.headers['x-extension-id'] as string;
            const timestamp = req.headers['x-extension-timestamp'] as string;
            const signature = req.headers['x-extension-signature'] as string;

            if (!extId || !timestamp || !signature) {
                res.writeHead(401);
                res.end(JSON.stringify({ error: 'Authentication required' }));
                return;
            }

            // Check timestamp window (30-second replay protection)
            const ts = parseInt(timestamp, 10);
            if (isNaN(ts) || Math.abs(Date.now() - ts) > HMAC_WINDOW_MS) {
                res.writeHead(401);
                res.end(JSON.stringify({ error: 'Timestamp expired' }));
                return;
            }

            // Verify HMAC
            const storedSeed = getMeta(`ext_seed_${extId}`);
            if (!storedSeed) {
                res.writeHead(401);
                res.end(JSON.stringify({ error: 'Unknown extension' }));
                return;
            }

            const bodyStr = rawBody;
            const bodyHash = crypto.createHash('sha256').update(bodyStr).digest('hex');
            const messageToSign = `${timestamp}:${method}:${fullPath}:${bodyHash}`;

            const expectedSig = crypto
                .createHmac('sha256', storedSeed)
                .update(messageToSign)
                .digest('hex');

            // Use timing-safe comparison to prevent timing attacks
            const sigBuf = Buffer.from(signature, 'hex');
            const expectedBuf = Buffer.from(expectedSig, 'hex');
            if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
                res.writeHead(403);
                res.end(JSON.stringify({ error: 'Invalid signature' }));
                return;
            }
        }

        // Route request
        try {
            const result = await routeRequest(method, path, body, query);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (err: any) {
            const status = err.status || 500;
            res.writeHead(status);
            res.end(JSON.stringify({ error: err.message }));
        }
    });

    server.listen(RPC_PORT, '127.0.0.1', () => {
        console.log(`RPC server listening on http://127.0.0.1:${RPC_PORT}`);
    });
}

function stripSecrets(data: any): any {
    const stripped = { ...data };
    if ('password' in stripped) stripped.password = '';
    return stripped;
}

function decryptRow(row: any) {
    try {
        const jsonStr = decryptItemData(
            row.b64_encrypted_data, row.b64_encrypted_iv, row.b64_encrypted_tag
        );
        return {
            id: row.id,
            itemType: row.item_type,
            favorite: row.favorite === 1,
            updatedAt: row.updated_at,
            data: JSON.parse(jsonStr),
        };
    } catch {
        return null;
    }
}

async function routeRequest(method: string, path: string, body: any, query: any): Promise<any> {
    // ─── Public endpoints ───────────────────────────────
    if (path === '/info' && method === 'POST') {
        const initialized = !!getMeta('encrypted_dek');
        return { initialized, locked: dek === null, locale: getMeta('locale') || 'en' };
    }

    if (path === '/pair' && method === 'POST') {
        const extId = crypto.randomUUID();
        const seed = crypto.randomBytes(16).toString('hex');

        // Store as PENDING only — seed is NOT activated until user confirms
        setMeta(`ext_pending_${extId}`, JSON.stringify({
            name: body.name || 'Unknown',
            device: body.device || 'Unknown',
            seed,
        }));

        // Notify renderer to show approval dialog
        mainWindow?.webContents.send('extension:pair-request', {
            extensionId: extId,
            name: body.name || 'Unknown',
            device: body.device || 'Unknown',
        });

        // Return extensionId only — seed will be available after user confirms via /pair/status
        return { extensionId: extId, status: 'pending' };
    }

    // GET /pair/status — extension polls this to check if user approved pairing
    if (path === '/pair/status' && method === 'POST') {
        const extId = body.extensionId;
        if (!extId) { const e: any = new Error('extensionId required'); e.status = 400; throw e; }

        // Check if seed has been activated (user confirmed)
        const seed = getMeta(`ext_seed_${extId}`);
        if (seed) {
            return { status: 'confirmed', seed };
        }

        // Check if pending pair exists
        const pendingRaw = getMeta(`ext_pending_${extId}`);
        if (!pendingRaw) {
            return { status: 'rejected' };
        }

        return { status: 'pending' };
    }

    // ─── Vault unlock (works even when locked) ───────────
    if (path === '/vault/unlock' && method === 'POST') {
        if (dek !== null) {
            return { locked: false, message: 'Already unlocked' };
        }
        const password = body.password;
        if (!password) { const e: any = new Error('Password required'); e.status = 400; throw e; }

        const saltB64 = getMeta('salt');
        const encDEKData = getMeta('encrypted_dek');
        const encDEKIV = getMeta('encrypted_dek_iv');
        const encDEKTag = getMeta('encrypted_dek_tag');

        if (!saltB64 || !encDEKData || !encDEKIV || !encDEKTag) {
            const e: any = new Error('Vault not initialized'); e.status = 400; throw e;
        }

        try {
            const salt = Buffer.from(saltB64, 'base64');
            const kek = deriveKEK(password, salt);
            dek = decryptAES(kek, { data: encDEKData, iv: encDEKIV, tag: encDEKTag });
            resetAutoLockTimer();
            return { locked: false };
        } catch {
            dek = null;
            const e: any = new Error('Incorrect password'); e.status = 401; throw e;
        }
    }

    // POST /activate — bring window to front (works when locked)
    if (path === '/activate' && method === 'POST') {
        mainWindow?.show();
        mainWindow?.focus();
        return { activated: true };
    }

    // ─── Authenticated endpoints (require unlocked vault) ─
    if (dek === null) {
        const err: any = new Error('Vault is locked');
        err.status = 423;
        throw err;
    }
    resetAutoLockTimer();

    // POST /vault/lock
    if (path === '/vault/lock' && method === 'POST') {
        lock();
        return { locked: true };
    }

    // GET /items/list?type=N
    if (path === '/items/list' && method === 'GET') {
        const itemType = query.type ? parseInt(query.type, 10) : undefined;
        const rows = getItems(itemType);
        return rows.map((row) => {
            const item = decryptRow(row);
            if (!item) return null;
            return { ...item, data: stripSecrets(item.data) };
        }).filter(Boolean);
    }

    // GET /items/:id/get
    const getItemMatch = path.match(/^\/items\/(\d+)\/get$/);
    if (getItemMatch && method === 'GET') {
        const id = parseInt(getItemMatch[1], 10);
        const row = getItemById(id);
        if (!row) { const e: any = new Error('Item not found'); e.status = 404; throw e; }
        return decryptRow(row);
    }

    // POST /items/:id/copy
    const copyMatch = path.match(/^\/items\/(\d+)\/copy$/);
    if (copyMatch && method === 'POST') {
        const id = parseInt(copyMatch[1], 10);
        const row = getItemById(id);
        if (!row) { const e: any = new Error('Item not found'); e.status = 404; throw e; }
        const item = decryptRow(row);
        if (item?.data?.password) {
            clipboard.writeText(item.data.password);
            setTimeout(() => {
                if (clipboard.readText() === item.data.password) clipboard.writeText('');
            }, 30_000);
        }
        return { copied: true };
    }

    // POST /items/create
    if (path === '/items/create' && method === 'POST') {
        const { itemType, data } = body;
        if (!data) { const e: any = new Error('data required'); e.status = 400; throw e; }
        const jsonStr = JSON.stringify(data);
        const enc = encryptItemData(jsonStr);
        const id = insertItem(itemType || 1, enc.data, enc.iv, enc.tag);
        return { id };
    }

    // POST /items/:id/update
    const updateMatch = path.match(/^\/items\/(\d+)\/update$/);
    if (updateMatch && method === 'POST') {
        const id = parseInt(updateMatch[1], 10);
        const { data } = body;
        if (!data) { const e: any = new Error('data required'); e.status = 400; throw e; }
        const jsonStr = JSON.stringify(data);
        const enc = encryptItemData(jsonStr);
        updateItem(id, enc.data, enc.iv, enc.tag);
        return { updated: true };
    }

    // POST /items/generatePassword
    if (path === '/items/generatePassword' && method === 'POST') {
        return { password: generatePassword(body) };
    }

    const e: any = new Error(`Unknown endpoint: ${method} ${path}`);
    e.status = 404;
    throw e;
}

// ─── App Lifecycle ──────────────────────────────────────────────

app.whenReady().then(() => {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Initialize database
    initDatabase(DATA_DIR);

    // Register IPC handlers
    registerIpcHandlers();

    // Create window and tray
    createWindow();
    createTray();

    // Start RPC server for browser extension
    startRpcServer();

    // Auto-lock on system suspend/lock
    powerMonitor.on('suspend', () => lock());
    powerMonitor.on('lock-screen', () => lock());

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    clearAutoLockTimer();
    dek = null;
    closeDatabase();
});
