// background.js — MyPassword Extension Service Worker

const DAEMON_URL = 'http://127.0.0.1:27432';

// ─── HMAC-SHA256 signing via Web Crypto API ────────────────────────────

async function hmacSign(message, seed) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(seed);
    const msgData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    const bytes = new Uint8Array(signatureBuffer);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Core request helper ────────────────────────────────────────────────

async function daemonRequest(method, path, body) {
    const url = `${DAEMON_URL}${path}`;
    const headers = { 'Content-Type': 'application/json' };

    // Attach auth headers when pairing data is available
    const storage = await chrome.storage.local.get(['extensionId', 'hmacSeed']);
    if (storage.extensionId && storage.hmacSeed) {
        const timestamp = Date.now().toString();
        const bodyStr = (body !== undefined && body !== null) ? JSON.stringify(body) : '';
        // Hash the body to include in the signature (matches server-side computation)
        const bodyHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(bodyStr));
        const bodyHash = Array.from(new Uint8Array(bodyHashBuffer))
            .map(b => b.toString(16).padStart(2, '0')).join('');
        const messageToSign = `${timestamp}:${method}:${path}:${bodyHash}`;
        const signature = await hmacSign(messageToSign, storage.hmacSeed);
        headers['X-Extension-Id'] = storage.extensionId;
        headers['X-Extension-Timestamp'] = timestamp;
        headers['X-Extension-Signature'] = signature;
    }

    const fetchOptions = { method, headers };
    if (body !== undefined && body !== null) {
        fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
        let errBody = null;
        try { errBody = await response.json(); } catch (_) { /* ignore */ }
        const errMsg = errBody?.error || `HTTP ${response.status}`;

        // If server doesn't recognize us, clear stale pairing data
        if (errMsg === 'Unknown extension' || errMsg === 'Invalid signature') {
            await chrome.storage.local.remove(['extensionId', 'hmacSeed']);
        }

        const err = new Error(errMsg);
        err.status = response.status;
        err.body = errBody;
        throw err;
    }

    // Some endpoints may return empty body
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text);
}

// ─── Badge helpers ──────────────────────────────────────────────────────

function extractHostname(url) {
    try {
        return new URL(url).hostname;
    } catch (_) {
        return '';
    }
}

function normalizeHostname(w) {
    try {
        return new URL(w).hostname;
    } catch (_) {
        try {
            return new URL('https://' + w).hostname;
        } catch (_2) {
            return '';
        }
    }
}

function domainMatches(hostname, domain) {
    if (!domain) return false;
    if (hostname === domain) return true;
    // Allow subdomain matching: passport.baidu.com matches baidu.com
    return hostname.endsWith('.' + domain);
}

async function updateBadgeForTab(tabId, url) {
    const hostname = extractHostname(url);
    if (!hostname) {
        await chrome.action.setBadgeText({ text: '', tabId });
        return;
    }

    try {
        const items = await daemonRequest('GET', '/items/list?type=1');
        if (Array.isArray(items)) {
            const matched = items.filter(item => {
                const websites = item.data?.websites || item.websites;
                if (!websites || !Array.isArray(websites)) return false;
                return websites.some(w => {
                    const itemDomain = normalizeHostname(w);
                    return itemDomain && domainMatches(hostname, itemDomain);
                });
            });
            const count = matched.length;
            await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '', tabId });
            await chrome.action.setBadgeBackgroundColor({ color: '#6366f1', tabId });
        }
    } catch (_) {
        await chrome.action.setBadgeText({ text: '', tabId });
    }
}

// ─── Message handler ────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async response
});

async function handleMessage(message, sender) {
    switch (message.type) {

        case 'GET_INFO': {
            return await daemonRequest('POST', '/info');
        }

        case 'PAIR': {
            const pairResult = await daemonRequest('POST', '/pair', {
                name: 'MyPassword Extension',
                device: navigator.platform || 'Browser Extension'
            });

            if (!pairResult || !pairResult.extensionId) {
                throw new Error('Pairing failed: no extension ID returned');
            }

            const extId = pairResult.extensionId;

            // Poll /pair/status until user confirms or rejects (max 60 seconds)
            const maxAttempts = 30; // 30 * 2s = 60s
            for (let i = 0; i < maxAttempts; i++) {
                await new Promise(resolve => setTimeout(resolve, 2000));

                const status = await daemonRequest('POST', '/pair/status', { extensionId: extId });

                if (status.status === 'confirmed' && status.seed) {
                    await chrome.storage.local.set({
                        extensionId: extId,
                        hmacSeed: status.seed
                    });
                    return { extensionId: extId, paired: true };
                }

                if (status.status === 'rejected') {
                    throw new Error('Pairing was rejected on desktop');
                }

                // status === 'pending' — keep polling
            }

            throw new Error('Pairing timed out. Please try again.');
        }

        case 'UNLOCK': {
            return await daemonRequest('POST', '/vault/unlock', { password: message.password });
        }

        case 'LOCK': {
            return await daemonRequest('POST', '/vault/lock');
        }

        case 'LIST_ITEMS': {
            const typeParam = message.itemType ? `?type=${message.itemType}` : '';
            return await daemonRequest('GET', `/items/list${typeParam}`);
        }

        case 'GET_ITEM': {
            return await daemonRequest('GET', `/items/${message.id}/get`);
        }

        case 'COPY_PASSWORD': {
            return await daemonRequest('POST', `/items/${message.id}/copy`);
        }

        case 'CREATE_ITEM': {
            return await daemonRequest('POST', '/items/create', {
                itemType: message.itemType,
                data: message.data
            });
        }

        case 'UPDATE_ITEM': {
            return await daemonRequest('POST', `/items/${message.id}/update`, {
                data: message.data
            });
        }

        case 'GENERATE_PASSWORD': {
            return await daemonRequest('POST', '/items/generatePassword', {
                length: message.length || 20,
                uppercase: message.uppercase !== false,
                lowercase: message.lowercase !== false,
                numbers: message.numbers !== false,
                symbols: message.symbols !== false
            });
        }

        case 'FILL_CREDENTIALS': {
            // Fetch the full item (with password) then forward to content script
            const item = await daemonRequest('GET', `/items/${message.id}/get`);
            const tabId = message.tabId || (sender && sender.tab && sender.tab.id);
            if (!tabId) throw new Error('No tab ID for fill');

            // Inject content script if needed, then send credentials
            try {
                await chrome.scripting.executeScript({
                    target: { tabId },
                    files: ['content.js']
                });
            } catch (_) {
                // content script may already be injected — that's fine
            }

            await chrome.tabs.sendMessage(tabId, {
                type: 'FILL_CREDENTIALS',
                item
            });
            return item;
        }

        case 'SET_BADGE': {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]) {
                await updateBadgeForTab(tabs[0].id, tabs[0].url);
            }
            return null;
        }

        case 'GET_MATCHED_ITEMS': {
            // Used by content script to get items matching current hostname
            const hostname = extractHostname(message.url);
            if (!hostname) return [];
            const items = await daemonRequest('GET', '/items/list?type=1');
            if (!Array.isArray(items)) return [];
            return items.filter(item => {
                const websites = item.data?.websites || item.websites;
                if (!websites || !Array.isArray(websites)) return false;
                return websites.some(w => {
                    const itemDomain = normalizeHostname(w);
                    return itemDomain && domainMatches(hostname, itemDomain);
                });
            });
        }

        default:
            throw new Error(`Unknown message type: ${message.type}`);
    }
}

// ─── Tab & startup listeners ────────────────────────────────────────────

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        updateBadgeForTab(tabId, changeInfo.url);
    }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url) {
            await updateBadgeForTab(activeInfo.tabId, tab.url);
        }
    } catch (_) { /* tab may not exist */ }
});

// On service worker startup, refresh badges for the active tab
chrome.runtime.onStartup.addListener(async () => {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0] && tabs[0].url) {
            await updateBadgeForTab(tabs[0].id, tabs[0].url);
        }
    } catch (_) { /* ignore */ }
});

// Also handle install / update
chrome.runtime.onInstalled.addListener(async () => {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0] && tabs[0].url) {
            await updateBadgeForTab(tabs[0].id, tabs[0].url);
        }
    } catch (_) { /* ignore */ }
});
