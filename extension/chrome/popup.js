// popup.js — MyPassword Extension Popup Logic

(function () {
    'use strict';

    // ─── DOM references ───────────────────────────────────────────────────

    const sections = {
        loading: document.getElementById('state-loading'),
        pair:    document.getElementById('state-pair'),
        unlock:  document.getElementById('state-unlock'),
        items:   document.getElementById('state-items'),
        error:   document.getElementById('state-error')
    };

    const pairBtn     = document.getElementById('btn-pair');
    const pairStatus  = document.getElementById('pair-status');
    const unlockForm  = document.getElementById('form-unlock');
    const passwordIn  = document.getElementById('input-password');
    const unlockStatus = document.getElementById('unlock-status');
    const lockBtn     = document.getElementById('btn-lock');
    const addBtn      = document.getElementById('btn-add');
    const searchInput = document.getElementById('input-search');
    const itemList    = document.getElementById('item-list');
    const emptyState  = document.getElementById('empty-state');
    const itemsStatus = document.getElementById('items-status');
    const errorMessage = document.getElementById('error-message');
    const retryBtn    = document.getElementById('btn-retry');

    let allItems = [];
    let currentHostname = '';

    // ─── i18n ────────────────────────────────────────────────────────────────

    const translations = {
        en: {
            connecting: 'Connecting...',
            extTitle: 'MyPassword Extension',
            extSubtitle: 'Connect to the desktop app to manage your passwords.',
            pairBtn: 'Pair with Desktop App',
            waitingApproval: 'Waiting for approval on desktop...',
            pairedSuccess: 'Paired successfully!',
            pairFailed: 'Pairing failed. Try again.',
            unlockTitle: 'Unlock Vault',
            unlockSubtitle: 'Enter your master password to continue.',
            unlockPlaceholder: 'Master password',
            unlockBtn: 'Unlock',
            unlocking: 'Unlocking...',
            wrongPassword: 'Wrong password',
            lockVault: 'Lock vault',
            addItem: 'Add new item',
            searchPlaceholder: 'Search passwords...',
            noPasswords: 'No passwords found.',
            noPasswordsSub: 'Add items in the desktop app or create one here.',
            loading: 'Loading...',
            failedLoad: 'Failed to load items',
            matched: 'Matched',
            allItems: 'All Items',
            untitled: 'Untitled',
            match: 'Match',
            autoFill: 'Auto-fill',
            fillFailed: 'Fill failed: ',
            copyPassword: 'Copy password',
            copyFailed: 'Copy failed: ',
            lockFailed: 'Lock failed: ',
            generated: 'Generated: ',
            genFailed: 'Failed to generate password',
            connError: 'Connection Error',
            defaultError: 'Desktop app not running.',
            retry: 'Retry',
            vaultNotSetup: 'Vault not set up. Please configure MyPassword desktop app first.',
            appNotRunning: 'Desktop app not running. Start MyPassword on your computer.',
            connectFailed: 'Failed to connect to desktop app.',
            authRequired: 'Session expired. Please unlock again.',
        },
        zh: {
            connecting: '连接中...',
            extTitle: 'MyPassword 扩展',
            extSubtitle: '连接到桌面应用以管理您的密码。',
            pairBtn: '配对桌面应用',
            waitingApproval: '正在等待桌面端确认...',
            pairedSuccess: '配对成功！',
            pairFailed: '配对失败，请重试。',
            unlockTitle: '解锁保险库',
            unlockSubtitle: '输入主密码以继续。',
            unlockPlaceholder: '主密码',
            unlockBtn: '解锁',
            unlocking: '解锁中...',
            wrongPassword: '密码错误',
            lockVault: '锁定保险库',
            addItem: '新建项目',
            searchPlaceholder: '搜索密码...',
            noPasswords: '未找到密码。',
            noPasswordsSub: '在桌面应用中创建项目，或在此处添加。',
            loading: '加载中...',
            failedLoad: '加载失败',
            matched: '匹配',
            allItems: '全部项目',
            untitled: '未命名',
            match: '匹配',
            autoFill: '自动填充',
            fillFailed: '填充失败：',
            copyPassword: '复制密码',
            copyFailed: '复制失败：',
            lockFailed: '锁定失败：',
            generated: '已生成：',
            genFailed: '生成密码失败',
            connError: '连接错误',
            defaultError: '桌面应用未运行。',
            retry: '重试',
            vaultNotSetup: '保险库未配置，请先设置 MyPassword 桌面应用。',
            appNotRunning: '桌面应用未运行，请在电脑上启动 MyPassword。',
            connectFailed: '无法连接到桌面应用。',
            authRequired: '会话已过期，请重新解锁。',
        }
    };

    let currentLocale = 'en';

    function t(key) {
        return (translations[currentLocale] && translations[currentLocale][key]) || translations.en[key] || key;
    }

    function applyStaticTranslations() {
        const loadingText = document.querySelector('#state-loading .status-text');
        if (loadingText) loadingText.textContent = t('connecting');

        const pairTitle = document.querySelector('#state-pair .app-title');
        if (pairTitle) pairTitle.textContent = t('extTitle');
        const pairSub = document.querySelector('#state-pair .app-subtitle');
        if (pairSub) pairSub.textContent = t('extSubtitle');
        const pairBtnEl = document.getElementById('btn-pair');
        if (pairBtnEl) pairBtnEl.textContent = t('pairBtn');

        const unlockTitleEl = document.querySelector('#state-unlock .app-title');
        if (unlockTitleEl) unlockTitleEl.textContent = t('unlockTitle');
        const unlockSub = document.querySelector('#state-unlock .app-subtitle');
        if (unlockSub) unlockSub.textContent = t('unlockSubtitle');
        const unlockPlaceholder = document.getElementById('input-password');
        if (unlockPlaceholder) unlockPlaceholder.placeholder = t('unlockPlaceholder');
        const unlockBtnEl = document.querySelector('#form-unlock button[type="submit"]');
        if (unlockBtnEl) unlockBtnEl.textContent = t('unlockBtn');

        const itemsTitle = document.querySelector('.items-header-title');
        if (itemsTitle) itemsTitle.textContent = 'MyPassword';
        const lockBtnEl = document.getElementById('btn-lock');
        if (lockBtnEl) lockBtnEl.title = t('lockVault');
        const addBtnEl = document.getElementById('btn-add');
        if (addBtnEl) addBtnEl.title = t('addItem');
        const searchEl = document.getElementById('input-search');
        if (searchEl) searchEl.placeholder = t('searchPlaceholder');

        const emptyP = document.querySelector('#empty-state p');
        if (emptyP) emptyP.textContent = t('noPasswords');
        const emptySub = document.querySelector('#empty-state .empty-sub');
        if (emptySub) emptySub.textContent = t('noPasswordsSub');

        const errTitle = document.querySelector('#state-error .app-title');
        if (errTitle) errTitle.textContent = t('connError');
        const retryBtnEl = document.getElementById('btn-retry');
        if (retryBtnEl) retryBtnEl.textContent = t('retry');
    }

    // ─── Helpers ──────────────────────────────────────────────────────────

    function showState(name) {
        Object.entries(sections).forEach(([key, el]) => {
            el.classList.toggle('active', key === name);
        });
    }

    function send(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, response => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                if (!response) {
                    reject(new Error('No response from background'));
                    return;
                }
                if (response.success) {
                    resolve(response.data);
                } else {
                    reject(new Error(response.error || 'Unknown error'));
                }
            });
        });
    }

    function extractHostname(url) {
        try { return new URL(url).hostname; } catch (_) { return ''; }
    }

    // Deterministic color from string for avatars
    const avatarColors = [
        '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
        '#ec4899', '#f43f5e', '#ef4444', '#f97316',
        '#eab308', '#84cc16', '#22c55e', '#14b8a6',
        '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1'
    ];

    function avatarColor(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return avatarColors[Math.abs(hash) % avatarColors.length];
    }

    function normalizeHostname(w) {
        try {
            // If it's already a full URL, extract hostname directly
            return new URL(w).hostname;
        } catch (_) {
            // Bare domain like 'baidu.com' — prepend scheme to parse
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

    function itemMatchesHostname(item, hostname) {
        if (!hostname) return false;
        const websites = item.data?.websites || item.websites;
        if (!websites || !Array.isArray(websites)) return false;
        return websites.some(w => {
            const itemDomain = normalizeHostname(w);
            return itemDomain && domainMatches(hostname, itemDomain);
        });
    }

    // ─── Initialization ───────────────────────────────────────────────────

    async function init() {
        showState('loading');

        // Check pairing status
        const storage = await chrome.storage.local.get(['extensionId', 'hmacSeed']);
        const isPaired = !!(storage.extensionId && storage.hmacSeed);

        // Get current tab hostname
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0] && tabs[0].url) {
                currentHostname = extractHostname(tabs[0].url);
            }
        } catch (_) { /* ignore */ }

        // Try to reach daemon
        try {
            const info = await send({ type: 'GET_INFO' });

            currentLocale = info.locale || 'en';
            applyStaticTranslations();

            if (!info.initialized) {
                showError(t('vaultNotSetup'));
                return;
            }

            // Re-check pairing after GET_INFO (background may have cleared stale data)
            const freshStorage = await chrome.storage.local.get(['extensionId', 'hmacSeed']);
            const stillPaired = !!(freshStorage.extensionId && freshStorage.hmacSeed);

            if (!stillPaired) {
                showState('pair');
                return;
            }

            if (info.locked) {
                showState('unlock');
                passwordIn.focus();
                return;
            }

            // Unlocked and paired — show items
            showState('items');
            await loadItems();
        } catch (err) {
            currentLocale = 'en';
            applyStaticTranslations();
            if (err.message && (err.message.includes('fetch') || err.message.includes('Failed') || err.message.includes('NetworkError'))) {
                showError(t('appNotRunning'));
            } else if (err.message && err.message.includes('Unknown extension')) {
                // Stale pairing — background already cleared storage, show pair screen
                showState('pair');
            } else {
                showError(err.message || t('connectFailed'));
            }
        }
    }

    function showError(msg) {
        errorMessage.textContent = msg;
        showState('error');
    }

    // ─── Pair flow ────────────────────────────────────────────────────────

    pairBtn.addEventListener('click', async () => {
        pairBtn.disabled = true;
        pairStatus.classList.remove('hidden', 'error', 'success');
        pairStatus.textContent = t('waitingApproval');

        try {
            const result = await send({ type: 'PAIR' });
            pairStatus.textContent = t('pairedSuccess');
            pairStatus.classList.add('success');

            // Refresh info to determine state
            setTimeout(() => init(), 600);
        } catch (err) {
            pairStatus.textContent = err.message || t('pairFailed');
            pairStatus.classList.add('error');
            pairBtn.disabled = false;
        }
    });

    // ─── Unlock flow ──────────────────────────────────────────────────────

    unlockForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = passwordIn.value;
        if (!password) return;

        unlockStatus.classList.remove('hidden', 'error', 'success');
        unlockStatus.textContent = t('unlocking');

        try {
            await send({ type: 'UNLOCK', password });
            passwordIn.value = '';
            unlockStatus.textContent = '';
            showState('items');
            await loadItems();
        } catch (err) {
            unlockStatus.textContent = err.message || t('wrongPassword');
            unlockStatus.classList.add('error');
            passwordIn.select();
        }
    });

    // ─── Items view ───────────────────────────────────────────────────────

    async function loadItems() {
        itemsStatus.classList.remove('hidden');
        itemsStatus.textContent = t('loading');
        itemList.innerHTML = '';
        emptyState.classList.add('hidden');

        try {
            const items = await send({ type: 'LIST_ITEMS', itemType: 1 });
            allItems = Array.isArray(items) ? items : [];

            // Update badge
            try {
                await send({ type: 'SET_BADGE' });
            } catch (_) { /* ignore */ }

            renderItems(allItems);
            itemsStatus.classList.add('hidden');
        } catch (err) {
            if (err.message && err.message.includes('Unknown extension')) {
                // Pairing invalidated — go back to pair screen
                showState('pair');
                return;
            }
            // Auth-related errors — vault is effectively locked, show unlock screen
            if (err.message && (
                err.message.includes('Authentication required') ||
                err.message.includes('Invalid signature') ||
                err.message.includes('Missing auth')
            )) {
                showState('unlock');
                passwordIn.value = '';
                unlockStatus.classList.remove('hidden', 'success');
                unlockStatus.classList.add('error');
                unlockStatus.textContent = t('authRequired');
                passwordIn.focus();
                return;
            }
            itemsStatus.textContent = err.message || t('failedLoad');
            itemsStatus.classList.add('error');
        }
    }

    function renderItems(items) {
        const query = searchInput.value.toLowerCase().trim();

        // Split into matched and other
        const matched = [];
        const others = [];

        for (const item of items) {
            if (itemMatchesHostname(item, currentHostname)) {
                matched.push(item);
            } else {
                others.push(item);
            }
        }

        // Apply search filter
        const filterFn = (item) => {
            if (!query) return true;
            const d = item.data || {};
            const title = (d.title || item.title || '').toLowerCase();
            const username = (d.username || item.username || '').toLowerCase();
            return title.includes(query) || username.includes(query);
        };

        const filteredMatched = matched.filter(filterFn);
        const filteredOthers = others.filter(filterFn);

        itemList.innerHTML = '';

        if (filteredMatched.length === 0 && filteredOthers.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');

        if (filteredMatched.length > 0) {
            const divider = document.createElement('div');
            divider.className = 'section-divider';
            divider.textContent = `${t('matched')} (${filteredMatched.length})`;
            itemList.appendChild(divider);

            filteredMatched.forEach(item => {
                itemList.appendChild(createItemRow(item, true));
            });
        }

        if (filteredOthers.length > 0) {
            if (filteredMatched.length > 0) {
                const divider = document.createElement('div');
                divider.className = 'section-divider';
                divider.textContent = `${t('allItems')} (${filteredOthers.length})`;
                itemList.appendChild(divider);
            }

            filteredOthers.forEach(item => {
                itemList.appendChild(createItemRow(item, false));
            });
        }
    }

    function createItemRow(item, isMatched) {
        const row = document.createElement('div');
        row.className = 'item-row';

        const d = item.data || {};
        const title = d.title || item.title || t('untitled');
        const username = d.username || item.username || '';
        const firstChar = title.charAt(0);

        // Avatar
        const avatar = document.createElement('div');
        avatar.className = 'item-avatar';
        avatar.style.backgroundColor = avatarColor(title);
        avatar.textContent = firstChar;

        // Info
        const info = document.createElement('div');
        info.className = 'item-info';

        const titleEl = document.createElement('div');
        titleEl.className = 'item-title';
        titleEl.textContent = title;
        if (isMatched) {
            const badge = document.createElement('span');
            badge.className = 'matched-badge';
            badge.textContent = t('match');
            titleEl.appendChild(badge);
        }

        const subtitleEl = document.createElement('div');
        subtitleEl.className = 'item-subtitle';
        subtitleEl.textContent = username;

        info.appendChild(titleEl);
        info.appendChild(subtitleEl);

        // Actions
        const actions = document.createElement('div');
        actions.className = 'item-actions';

        // Fill button
        const fillBtn = document.createElement('button');
        fillBtn.className = 'item-action-btn';
        fillBtn.title = t('autoFill');
        fillBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
        fillBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tabs[0]) {
                    await send({ type: 'FILL_CREDENTIALS', id: item.id, tabId: tabs[0].id });
                    window.close();
                }
            } catch (err) {
                fillBtn.classList.add('copied');
                fillBtn.style.color = '#f87171';
                fillBtn.title = t('fillFailed') + (err.message || 'Unknown error');
                setTimeout(() => {
                    fillBtn.classList.remove('copied');
                    fillBtn.style.color = '';
                    fillBtn.title = t('autoFill');
                }, 2000);
            }
        });

        // Copy button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'item-action-btn';
        copyBtn.title = t('copyPassword');
        copyBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;
        copyBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                await send({ type: 'COPY_PASSWORD', id: item.id });
                copyBtn.classList.add('copied');
                copyBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                    copyBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;
                }, 2000);
            } catch (err) {
                copyBtn.style.color = '#f87171';
                copyBtn.title = t('copyFailed') + (err.message || 'Unknown error');
                setTimeout(() => {
                    copyBtn.style.color = '';
                    copyBtn.title = t('copyPassword');
                }, 2000);
            }
        });

        actions.appendChild(fillBtn);
        actions.appendChild(copyBtn);

        row.appendChild(avatar);
        row.appendChild(info);
        row.appendChild(actions);

        return row;
    }

    // ─── Search ───────────────────────────────────────────────────────────

    searchInput.addEventListener('input', () => {
        renderItems(allItems);
    });

    // ─── Lock ─────────────────────────────────────────────────────────────

    lockBtn.addEventListener('click', async () => {
        lockBtn.disabled = true;
        lockBtn.style.opacity = '0.5';
        try {
            await send({ type: 'LOCK' });
            showState('unlock');
            passwordIn.value = '';
            unlockStatus.classList.add('hidden');
            passwordIn.focus();
        } catch (err) {
            lockBtn.disabled = false;
            lockBtn.style.opacity = '';
            itemsStatus.classList.remove('hidden', 'success');
            itemsStatus.classList.add('error');
            itemsStatus.textContent = t('lockFailed') + (err.message || 'Unknown error');
            setTimeout(() => itemsStatus.classList.add('hidden'), 3000);
        }
    });

    // ─── Add (generate password placeholder) ──────────────────────────────

    addBtn.addEventListener('click', async () => {
        // For now, generate and copy a password as a quick action
        try {
            const result = await send({
                type: 'GENERATE_PASSWORD',
                length: 20,
                uppercase: true,
                lowercase: true,
                numbers: true,
                symbols: true
            });
            const pw = result.password || result;
            // Copy to clipboard via the daemon or show a notification
            itemsStatus.classList.remove('hidden', 'error');
            itemsStatus.classList.add('success');
            itemsStatus.textContent = `${t('generated')}${pw}`;
            setTimeout(() => itemsStatus.classList.add('hidden'), 4000);
        } catch (err) {
            itemsStatus.classList.remove('hidden', 'success');
            itemsStatus.classList.add('error');
            itemsStatus.textContent = err.message || t('genFailed');
        }
    });

    // ─── Retry ────────────────────────────────────────────────────────────

    retryBtn.addEventListener('click', () => init());

    // ─── Go ───────────────────────────────────────────────────────────────

    init();
})();
