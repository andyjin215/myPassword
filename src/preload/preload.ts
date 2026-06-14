import { contextBridge, ipcRenderer } from 'electron';

/**
  * Preload script: exposes a safe API bridge between
  * the Electron main process and the React renderer.
  */
contextBridge.exposeInMainWorld('electronAPI', {
    // ─── Vault ──────────────────────────────────────
    isInitialized: (): Promise<boolean> =>
        ipcRenderer.invoke('vault:is-initialized'),

    isUnlocked: (): Promise<boolean> =>
        ipcRenderer.invoke('vault:is-unlocked'),

    initVault: (masterPassword: string): Promise<boolean> =>
        ipcRenderer.invoke('vault:init', masterPassword),

    unlock: (masterPassword: string): Promise<boolean> =>
        ipcRenderer.invoke('vault:unlock', masterPassword),

    lock: (): Promise<boolean> =>
        ipcRenderer.invoke('vault:lock'),

    changePassword: (oldPassword: string, newPassword: string): Promise<boolean> =>
        ipcRenderer.invoke('vault:change-password', oldPassword, newPassword),

    // ─── Items ──────────────────────────────────────
    listItems: (itemType?: number): Promise<any[]> =>
        ipcRenderer.invoke('items:list', itemType),

    listFavorites: (): Promise<any[]> =>
        ipcRenderer.invoke('items:favorites'),

    listTrash: (): Promise<any[]> =>
        ipcRenderer.invoke('items:trash'),

    createItem: (itemType: number, data: any): Promise<number> =>
        ipcRenderer.invoke('items:create', itemType, data),

    updateItem: (id: number, data: any): Promise<boolean> =>
        ipcRenderer.invoke('items:update', id, data),

    toggleFavorite: (id: number, favorite: boolean): Promise<boolean> =>
        ipcRenderer.invoke('items:toggle-favorite', id, favorite),

    deleteItem: (id: number): Promise<boolean> =>
        ipcRenderer.invoke('items:delete', id),

    restoreItem: (id: number): Promise<boolean> =>
        ipcRenderer.invoke('items:restore', id),

    permanentDelete: (id: number): Promise<boolean> =>
        ipcRenderer.invoke('items:permanent-delete', id),

    // ─── Utilities ──────────────────────────────────
    generatePassword: (options?: {
        length?: number;
        uppercase?: boolean;
        lowercase?: boolean;
        numbers?: boolean;
        symbols?: boolean;
    }): Promise<string> =>
        ipcRenderer.invoke('password:generate', options),

    copyToClipboard: (text: string): Promise<boolean> =>
        ipcRenderer.invoke('clipboard:write', text),

    // ─── Settings ───────────────────────────────────
    getAutoLockMinutes: (): Promise<number> =>
        ipcRenderer.invoke('settings:get-auto-lock'),

    setAutoLockMinutes: (minutes: number): Promise<boolean> =>
        ipcRenderer.invoke('settings:set-auto-lock', minutes),

    // ─── Locale ─────────────────────────────────────
    getLocale: (): Promise<string> =>
        ipcRenderer.invoke('locale:get'),

    setLocale: (locale: string): Promise<boolean> =>
        ipcRenderer.invoke('locale:set', locale),

    // ─── Events (main → renderer) ──────────────────
    onVaultLocked: (callback: () => void) => {
        ipcRenderer.on('vault:locked', callback);
        return () => { ipcRenderer.removeListener('vault:locked', callback); };
    },

    onPairRequest: (callback: (info: { extensionId: string; name: string; device: string }) => void) => {
        const handler = (_e: any, info: { extensionId: string; name: string; device: string }) => callback(info);
        ipcRenderer.on('extension:pair-request', handler);
        return () => { ipcRenderer.removeListener('extension:pair-request', handler); };
    },

    confirmPair: (extensionId: string): Promise<boolean> =>
        ipcRenderer.invoke('extension:confirm-pair', extensionId),

    rejectPair: (extensionId: string): Promise<boolean> =>
        ipcRenderer.invoke('extension:reject-pair', extensionId),

    listExtensions: (): Promise<{ extensionId: string; name: string; device: string }[]> =>
        ipcRenderer.invoke('extension:list'),

    // ─── Platform ─────────────────────────────────────
    getPlatform: (): string => process.platform,
});
