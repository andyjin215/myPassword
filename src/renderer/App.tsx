import React, { useState, useEffect, useCallback } from 'react';
import LockScreen from './components/LockScreen';
import Layout from './components/Layout';
import { LocaleProvider, useI18n } from './i18n/LocaleContext';

// Type declaration for the preload-exposed API
declare global {
    interface Window {
        electronAPI: {
            isInitialized: () => Promise<boolean>;
            isUnlocked: () => Promise<boolean>;
            initVault: (password: string) => Promise<boolean>;
            unlock: (password: string) => Promise<boolean>;
            lock: () => Promise<boolean>;
            changePassword: (oldPw: string, newPw: string) => Promise<boolean>;
            listItems: (itemType?: number) => Promise<any[]>;
            listFavorites: () => Promise<any[]>;
            listTrash: () => Promise<any[]>;
            createItem: (itemType: number, data: any) => Promise<number>;
            updateItem: (id: number, data: any) => Promise<boolean>;
            toggleFavorite: (id: number, fav: boolean) => Promise<boolean>;
            deleteItem: (id: number) => Promise<boolean>;
            restoreItem: (id: number) => Promise<boolean>;
            permanentDelete: (id: number) => Promise<boolean>;
            generatePassword: (opts?: {
                length?: number;
                uppercase?: boolean;
                lowercase?: boolean;
                numbers?: boolean;
                symbols?: boolean;
            }) => Promise<string>;
            copyToClipboard: (text: string) => Promise<boolean>;
            getAutoLockMinutes: () => Promise<number>;
            setAutoLockMinutes: (m: number) => Promise<boolean>;
            getLocale: () => Promise<string>;
            setLocale: (locale: string) => Promise<boolean>;
            onVaultLocked: (cb: () => void) => () => void;
            onPairRequest: (cb: (info: { extensionId: string; name: string; device: string }) => void) => () => void;
            confirmPair: (extensionId: string) => Promise<boolean>;
            rejectPair: (extensionId: string) => Promise<boolean>;
            listExtensions: () => Promise<{ extensionId: string; name: string; device: string }[]>;
            getPlatform: () => string;
        };
    }
}

const api = window.electronAPI;

type AppState = 'loading' | 'setup' | 'locked' | 'unlocked';

interface PendingPair {
    extensionId: string;
    name: string;
    device: string;
}

function AppInner() {
    const [appState, setAppState] = useState<AppState>('loading');
    const { t } = useI18n();

    // Global pairing state — active on ALL screens
    const [pendingPair, setPendingPair] = useState<PendingPair | null>(null);

    // Initialize app state
    useEffect(() => {
        (async () => {
            const initialized = await api.isInitialized();
            if (!initialized) {
                setAppState('setup');
            } else {
                const unlocked = await api.isUnlocked();
                setAppState(unlocked ? 'unlocked' : 'locked');
            }
        })();
    }, []);

    // Listen for auto-lock events
    useEffect(() => {
        const unsubscribe = api.onVaultLocked(() => {
            setAppState('locked');
        });
        return unsubscribe;
    }, []);

    // Listen for pairing requests globally (works on setup, locked, and unlocked screens)
    useEffect(() => {
        const unsubscribe = api.onPairRequest((info) => {
            setPendingPair(info);
        });
        return unsubscribe;
    }, []);

    const handleSetup = useCallback(async (masterPassword: string) => {
        await api.initVault(masterPassword);
        setAppState('unlocked');
    }, []);

    const handleUnlock = useCallback(async (masterPassword: string): Promise<boolean> => {
        const ok = await api.unlock(masterPassword);
        if (ok) {
            setAppState('unlocked');
        }
        return ok;
    }, []);

    const handleLock = useCallback(async () => {
        await api.lock();
        setAppState('locked');
    }, []);

    const handleConfirmPair = useCallback(async () => {
        if (!pendingPair) return;
        const ok = await api.confirmPair(pendingPair.extensionId);
        setPendingPair(null);
        if (!ok) {
            // Brief feedback — pairing failed
        }
    }, [pendingPair]);

    const handleDenyPair = useCallback(async () => {
        if (pendingPair) {
            await api.rejectPair(pendingPair.extensionId);
        }
        setPendingPair(null);
    }, [pendingPair]);

    // Pairing overlay — shown on ALL screens when a pairing request is pending
    const pairingOverlay = pendingPair && (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        >
            <div
                className="w-full max-w-sm mx-4 rounded-2xl p-px"
                style={{
                    background:
                        'linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(99,102,241,0.05) 50%, rgba(99,102,241,0.2) 100%)',
                }}
            >
                <div className="bg-surface-900 rounded-2xl px-6 py-8">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-brand-600/20 flex items-center justify-center flex-shrink-0">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-brand-400">
                                <path d="M12 2v6" />
                                <path d="M18 2v6" />
                                <path d="M6 2v6" />
                                <path d="M4 8h20v4a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8V8z" />
                                <path d="M12 20v2" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-surface-100">{t('pair.title')}</h3>
                            <p className="text-xs text-surface-500">{t('pair.subtitle')}</p>
                        </div>
                    </div>

                    <div className="bg-surface-800/60 rounded-lg px-4 py-3 mb-5 space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-surface-500 w-16">{t('pair.name')}</span>
                            <span className="text-sm text-surface-200 font-medium">{pendingPair.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-surface-500 w-16">{t('pair.device')}</span>
                            <span className="text-sm text-surface-300">{pendingPair.device}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-surface-500 w-16">{t('pair.id')}</span>
                            <span className="text-xs text-surface-500 font-mono truncate">{pendingPair.extensionId}</span>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleConfirmPair}
                            className="btn-primary text-sm flex-1 py-2.5"
                        >
                            {t('pair.confirm')}
                        </button>
                        <button
                            onClick={handleDenyPair}
                            className="btn-secondary text-sm flex-1 py-2.5"
                        >
                            {t('pair.deny')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    // Loading state
    if (appState === 'loading') {
        return (
            <div className="h-screen flex items-center justify-center bg-surface-900">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-surface-400 text-sm">{t('common.loading')}</p>
                </div>
                {pairingOverlay}
            </div>
        );
    }

    // Setup or locked state
    if (appState === 'setup' || appState === 'locked') {
        return (
            <>
                <LockScreen
                    mode={appState}
                    onSubmit={appState === 'setup' ? handleSetup : handleUnlock}
                />
                {pairingOverlay}
            </>
        );
    }

    // Main app
    return (
        <>
            <Layout onLock={handleLock} />
            {pairingOverlay}
        </>
    );
}

export default function App() {
    return (
        <LocaleProvider>
            <AppInner />
        </LocaleProvider>
    );
}
