// content.js — MyPassword Content Script
// Injected into all pages to provide autofill, save, and update functionality.

(function () {
    'use strict';

    // Prevent double-injection
    if (window.__myPasswordContentInjected) return;
    window.__myPasswordContentInjected = true;

    // ─── Constants ────────────────────────────────────────────────────────

    const DROPDOWN_ID  = 'mp-autofill-dropdown';
    const PANEL_ID     = 'mp-save-panel';
    const Z_INDEX      = 999999;
    const CACHE_TTL_MS = 60000; // 60s for pending credentials across pages

    // ─── i18n ─────────────────────────────────────────────────────────

    const contentI18n = {
        en: {
            dropdownHeader: 'MyPassword',
            untitled: 'Untitled',
            savePassword: 'Save Password?',
            updatePassword: 'Update Password?',
            site: 'Site',
            username: 'Username',
            none: '(none)',
            dismiss: 'Dismiss',
            save: 'Save',
            update: 'Update',
        },
        zh: {
            dropdownHeader: 'MyPassword',
            untitled: '未命名',
            savePassword: '保存密码？',
            updatePassword: '更新密码？',
            site: '网站',
            username: '用户名',
            none: '（无）',
            dismiss: '忽略',
            save: '保存',
            update: '更新',
        }
    };

    let contentLocale = 'en';

    function ct(key) {
        return (contentI18n[contentLocale] && contentI18n[contentLocale][key]) || contentI18n.en[key] || key;
    }

    // Load locale from storage
    chrome.storage.local.get(['locale'], (result) => {
        if (result.locale === 'zh' || result.locale === 'en') {
            contentLocale = result.locale;
        }
    });

    // Listen for locale changes from popup/background
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.locale) {
            contentLocale = changes.locale.newValue || 'en';
        }
    });

    // ─── Helpers ──────────────────────────────────────────────────────────

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

    /**
      * Set an input value in a React/framework-compatible way.
      */
    function setInputValue(input, value) {
        const nativeSetter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype, 'value'
        ).set;
        nativeSetter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

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

    // ─── Credential Field Detection ───────────────────────────────────────

    /**
      * Find all password fields on the page.
      */
    function findPasswordFields() {
        return Array.from(document.querySelectorAll('input[type="password"]'))
            .filter(el => isVisible(el) && !el.disabled);
    }

    /**
      * For a given password field, find the closest preceding text/email input
      * that serves as the username field.
      */
    function findUsernameField(passwordField) {
        // Walk backwards through the DOM looking for text/email inputs
        const form = passwordField.closest('form');
        const scope = form || document;
        const allInputs = Array.from(
            scope.querySelectorAll('input[type="text"], input[type="email"], input:not([type])')
        ).filter(el => isVisible(el) && !el.disabled && !isSearchInput(el));

        // Find the input that appears just before the password field in DOM order
        let best = null;
        for (const inp of allInputs) {
            const pos = passwordField.compareDocumentPosition(inp);
            // Node.DOCUMENT_POSITION_PRECEDING = 2
            if (pos & Node.DOCUMENT_POSITION_PRECEDING) {
                best = inp; // keep the last one that precedes
            }
        }
        return best;
    }

    function isVisible(el) {
        if (!el.offsetParent && el.tagName !== 'BODY') return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }

    function isSearchInput(el) {
        const type = (el.getAttribute('type') || '').toLowerCase();
        if (type === 'search') return true;
        const name = (el.name || '').toLowerCase();
        const id = (el.id || '').toLowerCase();
        const placeholder = (el.placeholder || '').toLowerCase();
        return name.includes('search') || id.includes('search') || placeholder.includes('search');
    }

    // ─── Autofill Dropdown ────────────────────────────────────────────────

    let activeDropdown = null;
    let activeField = null;

    function removeDropdown() {
        if (activeDropdown) {
            activeDropdown.remove();
            activeDropdown = null;
        }
        activeField = null;
    }

    async function showDropdown(field) {
        removeDropdown();
        activeField = field;

        try {
            const items = await send({
                type: 'GET_MATCHED_ITEMS',
                url: window.location.href
            });

            if (!Array.isArray(items) || items.length === 0) return;

            const dropdown = document.createElement('div');
            dropdown.id = DROPDOWN_ID;
            dropdown.setAttribute('data-mp', 'true');
            Object.assign(dropdown.style, {
                position: 'absolute',
                zIndex: String(Z_INDEX),
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
                padding: '4px',
                maxHeight: '220px',
                overflowY: 'auto',
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                fontSize: '13px',
                color: '#e2e8f0',
                minWidth: '260px',
                cursor: 'default'
            });

            // Position below the field
            const rect = field.getBoundingClientRect();
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
            dropdown.style.top = (rect.bottom + scrollTop + 4) + 'px';
            dropdown.style.left = (rect.left + scrollLeft) + 'px';
            dropdown.style.width = Math.max(rect.width, 260) + 'px';

            // Header
            const header = document.createElement('div');
            Object.assign(header.style, {
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: '600',
                color: '#64748b',
                borderBottom: '1px solid #334155',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
            });
            header.textContent = ct('dropdownHeader');
            dropdown.appendChild(header);

            // Items
            items.forEach(item => {
                const d = item.data || {};
                const title = d.title || item.title || ct('untitled');
                const username = d.username || item.username || '';
                const firstChar = title.charAt(0);

                const row = document.createElement('div');
                Object.assign(row.style, {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'background 0.1s'
                });

                row.addEventListener('mouseenter', () => { row.style.background = '#334155'; });
                row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });

                // Avatar
                const avatar = document.createElement('div');
                Object.assign(avatar.style, {
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    backgroundColor: avatarColor(title),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#fff',
                    flexShrink: '0',
                    textTransform: 'uppercase'
                });
                avatar.textContent = firstChar;

                // Info
                const info = document.createElement('div');
                Object.assign(info.style, { flex: '1', minWidth: '0' });

                const titleEl = document.createElement('div');
                Object.assign(titleEl.style, {
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#f1f5f9',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                });
                titleEl.textContent = title;

                const subEl = document.createElement('div');
                Object.assign(subEl.style, {
                    fontSize: '11px',
                    color: '#64748b',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                });
                subEl.textContent = username;

                info.appendChild(titleEl);
                info.appendChild(subEl);
                row.appendChild(avatar);
                row.appendChild(info);

                row.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeDropdown();
                    try {
                        await send({
                            type: 'FILL_CREDENTIALS',
                            id: item.id,
                            tabId: null // will be resolved in message handler
                        });
                    } catch (err) {
                        console.error('[MyPassword] Fill error:', err);
                    }
                });

                dropdown.appendChild(row);
            });

            document.body.appendChild(dropdown);
            activeDropdown = dropdown;

        } catch (err) {
            // Daemon may not be running — silently ignore
            console.debug('[MyPassword] Could not fetch items:', err.message);
        }
    }

    // ─── Field Event Binding ──────────────────────────────────────────────

    const boundFields = new WeakSet();

    function bindFieldEvents(passwordField) {
        if (boundFields.has(passwordField)) return;
        boundFields.add(passwordField);

        passwordField.addEventListener('focus', () => {
            showDropdown(passwordField);
        });

        // Also bind the username field if found
        const usernameField = findUsernameField(passwordField);
        if (usernameField && !boundFields.has(usernameField)) {
            boundFields.add(usernameField);
            usernameField.addEventListener('focus', () => {
                showDropdown(passwordField);
            });
        }
    }

    // ─── Close dropdown on outside click / Escape ─────────────────────────

    document.addEventListener('click', (e) => {
        if (activeDropdown && !activeDropdown.contains(e.target) && e.target !== activeField) {
            removeDropdown();
        }
    }, true);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            removeDropdown();
            removeSavePanel();
        }
    });

    // ─── Form Submit Interception ─────────────────────────────────────────

    function captureFormCredentials(form) {
        const passwordFields = Array.from(form.querySelectorAll('input[type="password"]'))
            .filter(el => isVisible(el) && el.value);
        if (passwordFields.length === 0) return;

        for (const pwField of passwordFields) {
            const usernameField = findUsernameField(pwField);
            const password = pwField.value;
            const username = usernameField ? usernameField.value : '';

            if (password) {
                handleCapturedCredentials(username, password);
            }
        }
    }

    function handleCapturedCredentials(username, password) {
        // Credentials are passed directly via function parameters — no persistent storage.
        // Check if we should save or update by looking at existing items
        checkAndPromptSave(username, password);
    }

    async function checkAndPromptSave(username, password) {
        try {
            const items = await send({
                type: 'GET_MATCHED_ITEMS',
                url: window.location.href
            });

            if (!Array.isArray(items)) {
                showSavePanel(username, password, null);
                return;
            }

            // Check if an existing item matches the username
            const existing = items.find(item => {
                const itemUser = item.data?.username || item.username || '';
                return itemUser === username;
            });

            if (existing) {
                // Possible password change
                showSavePanel(username, password, existing);
            } else {
                // New credential
                showSavePanel(username, password, null);
            }
        } catch (_) {
            showSavePanel(username, password, null);
        }
    }

    // Bind form submit listeners
    function bindFormSubmitListeners() {
        document.querySelectorAll('form').forEach(form => {
            if (form.__mpBound) return;
            form.__mpBound = true;
            form.addEventListener('submit', () => captureFormCredentials(form));
        });

        // Also watch for submit button clicks (some sites don't use form submit)
        document.querySelectorAll('button[type="submit"], input[type="submit"]').forEach(btn => {
            if (btn.__mpBound) return;
            btn.__mpBound = true;
            btn.addEventListener('click', () => {
                const form = btn.closest('form');
                if (form) {
                    // Small delay to let the form values finalize
                    setTimeout(() => captureFormCredentials(form), 100);
                }
            });
        });
    }

    // ─── Save / Update Floating Panel ─────────────────────────────────────

    let savePanel = null;

    function removeSavePanel() {
        if (savePanel) {
            savePanel.remove();
            savePanel = null;
        }
    }

    function showSavePanel(username, password, existingItem) {
        removeSavePanel();

        const isUpdate = !!existingItem;
        const siteName = window.location.hostname;

        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.setAttribute('data-mp', 'true');
        Object.assign(panel.style, {
            position: 'fixed',
            top: '16px',
            right: '16px',
            zIndex: String(Z_INDEX),
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '12px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            padding: '20px',
            width: '320px',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize: '13px',
            color: '#e2e8f0',
            animation: 'mpSlideIn 0.25s ease'
        });

        // Inject keyframes if not present
        if (!document.getElementById('mp-styles')) {
            const style = document.createElement('style');
            style.id = 'mp-styles';
            style.textContent = `
                @keyframes mpSlideIn {
                    from { opacity: 0; transform: translateX(20px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `;
            document.head.appendChild(style);
        }

        // Header
        const headerEl = document.createElement('div');
        Object.assign(headerEl.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px'
        });

        const lockIcon = document.createElement('div');
        lockIcon.innerHTML = `<svg width="20" height="20" viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="12" fill="#6366f1"/><path d="M24 12c-3.3 0-6 2.7-6 6v4h-2a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V24a2 2 0 00-2-2h-2v-4c0-3.3-2.7-6-6-6zm-2 10v-4a2 2 0 114 0v4h-4zm2 6a2 2 0 110 4 2 2 0 010-4z" fill="#fff"/></svg>`;

        const titleText = document.createElement('span');
        Object.assign(titleText.style, { fontWeight: '600', fontSize: '14px', color: '#f1f5f9' });
        titleText.textContent = isUpdate ? ct('updatePassword') : ct('savePassword');

        headerEl.appendChild(lockIcon);
        headerEl.appendChild(titleText);

        // Info
        const infoEl = document.createElement('div');
        Object.assign(infoEl.style, {
            background: '#0f172a',
            borderRadius: '8px',
            padding: '10px 12px',
            marginBottom: '14px'
        });

        const siteRow = document.createElement('div');
        Object.assign(siteRow.style, { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' });
        const siteLabel = document.createElement('span');
        siteLabel.style.color = '#64748b';
        siteLabel.textContent = ct('site');
        const siteVal = document.createElement('span');
        siteVal.style.color = '#e2e8f0';
        siteVal.textContent = siteName;
        siteRow.appendChild(siteLabel);
        siteRow.appendChild(siteVal);

        const userRow = document.createElement('div');
        Object.assign(userRow.style, { display: 'flex', justifyContent: 'space-between' });
        const userLabel = document.createElement('span');
        userLabel.style.color = '#64748b';
        userLabel.textContent = ct('username');
        const userVal = document.createElement('span');
        userVal.style.color = '#e2e8f0';
        userVal.textContent = username || ct('none');
        userRow.appendChild(userLabel);
        userRow.appendChild(userVal);

        infoEl.appendChild(siteRow);
        infoEl.appendChild(userRow);

        // Buttons
        const btnRow = document.createElement('div');
        Object.assign(btnRow.style, { display: 'flex', gap: '8px' });

        const dismissBtn = document.createElement('button');
        Object.assign(dismissBtn.style, {
            flex: '1',
            padding: '8px 12px',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '6px',
            color: '#94a3b8',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer',
            fontFamily: 'inherit'
        });
        dismissBtn.textContent = ct('dismiss');
        dismissBtn.addEventListener('click', removeSavePanel);

        const saveBtn = document.createElement('button');
        Object.assign(saveBtn.style, {
            flex: '1',
            padding: '8px 12px',
            background: '#6366f1',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer',
            fontFamily: 'inherit'
        });
        saveBtn.textContent = isUpdate ? ct('update') : ct('save');
        saveBtn.addEventListener('click', async () => {
            try {
                if (isUpdate) {
                    await send({
                        type: 'UPDATE_ITEM',
                        id: existingItem.id,
                        data: {
                            username,
                            password,
                            title: existingItem.title || siteName,
                            websites: existingItem.websites || [window.location.origin]
                        }
                    });
                } else {
                    await send({
                        type: 'CREATE_ITEM',
                        itemType: 1,
                        data: {
                            title: siteName,
                            username,
                            password,
                            websites: [window.location.origin]
                        }
                    });
                }
                removeSavePanel();
            } catch (err) {
                console.error('[MyPassword] Save failed:', err);
            }
        });

        btnRow.appendChild(dismissBtn);
        btnRow.appendChild(saveBtn);

        panel.appendChild(headerEl);
        panel.appendChild(infoEl);
        panel.appendChild(btnRow);

        document.body.appendChild(panel);
        savePanel = panel;
    }

    // ─── Message Listener ─────────────────────────────────────────────────

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'FILL_CREDENTIALS' && message.item) {
            fillCredentials(message.item);
            sendResponse({ success: true });
        }
        return true;
    });

    function fillCredentials(item) {
        const data = item.data || item;
        const username = data.username || item.username || '';
        const password = data.password || item.password || '';

        const passwordFields = findPasswordFields();
        for (const pwField of passwordFields) {
            setInputValue(pwField, password);

            const usernameField = findUsernameField(pwField);
            if (usernameField && username) {
                setInputValue(usernameField, username);
            }
        }
    }

    // ─── MutationObserver (SPA support) ───────────────────────────────────

    function scanAndBind() {
        const pwFields = findPasswordFields();
        pwFields.forEach(bindFieldEvents);
        bindFormSubmitListeners();
    }

    const observer = new MutationObserver(() => {
        scanAndBind();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // ─── Cleanup on navigation ────────────────────────────────────────────

    window.addEventListener('beforeunload', () => {
        removeDropdown();
        removeSavePanel();
        observer.disconnect();
    });

    // ─── Initial scan ─────────────────────────────────────────────────────

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scanAndBind);
    } else {
        scanAndBind();
    }
})();
