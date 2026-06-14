import React, { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../i18n/LocaleContext';

interface SettingsProps {
    onClose?: () => void;
}

const api = window.electronAPI;

// Inline SVG icons
const CloseIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const ShieldIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

const PlugIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path d="M12 2v6" />
        <path d="M18 2v6" />
        <path d="M6 2v6" />
        <path d="M4 8h20v4a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8V8z" />
        <path d="M12 20v2" />
    </svg>
);

const InfoIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
);

const CheckIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const EyeIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

const EyeOffIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
);


export default function Settings({ onClose }: SettingsProps) {
    const { t, locale, setLocale } = useI18n();

    const autoLockOptions = [
        { label: t('settings.minute1'), value: 1 },
        { label: t('settings.minutes5'), value: 5 },
        { label: t('settings.minutes15'), value: 15 },
        { label: t('settings.minutes30'), value: 30 },
        { label: t('settings.hour1'), value: 60 },
        { label: t('settings.never'), value: 0 },
    ];

    // Auto-lock state
    const [autoLockMinutes, setAutoLockMinutesState] = useState(15);
    const [autoLockSaved, setAutoLockSaved] = useState(false);

    // Change password state
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [passwordStatus, setPasswordStatus] = useState<{
        type: 'success' | 'error';
        message: string;
    } | null>(null);
    const [changingPassword, setChangingPassword] = useState(false);

    // Paired extensions
    const [pairedExtensions, setPairedExtensions] = useState<
        { extensionId: string; name: string; device: string }[]
    >([]);

    const handleClose = useCallback(() => {
        onClose?.();
    }, [onClose]);

    // Load auto-lock setting
    useEffect(() => {
        (async () => {
            const minutes = await api.getAutoLockMinutes();
            setAutoLockMinutesState(minutes);
        })();
    }, []);

    // Load paired extensions on mount
    useEffect(() => {
        (async () => {
            setPairedExtensions(await api.listExtensions());
        })();
    }, []);

    const handleAutoLockChange = useCallback(async (value: number) => {
        setAutoLockMinutesState(value);
        await api.setAutoLockMinutes(value);
        setAutoLockSaved(true);
        setTimeout(() => setAutoLockSaved(false), 2000);
    }, []);

    const handleChangePassword = useCallback(async () => {
        setPasswordStatus(null);

        if (!oldPassword) {
            setPasswordStatus({ type: 'error', message: t('settings.errCurrentRequired') });
            return;
        }

        if (!newPassword) {
            setPasswordStatus({ type: 'error', message: t('settings.errNewRequired') });
            return;
        }

        if (newPassword.length < 6) {
            setPasswordStatus({ type: 'error', message: t('settings.errNewTooShort') });
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordStatus({ type: 'error', message: t('settings.errMismatch') });
            return;
        }

        setChangingPassword(true);
        try {
            const ok = await api.changePassword(oldPassword, newPassword);
            if (ok) {
                setPasswordStatus({ type: 'success', message: t('settings.successChanged') });
                setOldPassword('');
                setNewPassword('');
                setConfirmPassword('');
            } else {
                setPasswordStatus({ type: 'error', message: t('settings.errWrongCurrent') });
            }
        } catch {
            setPasswordStatus({ type: 'error', message: t('settings.errChangeFailed') });
        }
        setChangingPassword(false);
    }, [oldPassword, newPassword, confirmPassword, t]);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-surface-800 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-surface-100">{t('settings.title')}</h2>
                <button onClick={handleClose} className="btn-icon" title={t('settings.closeSettings')}>
                    <CloseIcon />
                </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="max-w-lg mx-auto space-y-8">

                    {/* Language Section */}
                    <section>
                        <div className="flex items-center gap-2 mb-5">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="2" y1="12" x2="22" y2="12" />
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                            </svg>
                            <h3 className="text-sm font-bold text-surface-300 uppercase tracking-wider">{t('settings.language')}</h3>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setLocale('en')}
                                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-150 ${
                                    locale === 'en'
                                        ? 'bg-brand-600 text-white'
                                        : 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-surface-200'
                                }`}
                            >
                                English
                            </button>
                            <button
                                onClick={() => setLocale('zh')}
                                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-150 ${
                                    locale === 'zh'
                                        ? 'bg-brand-600 text-white'
                                        : 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-surface-200'
                                }`}
                            >
                                中文
                            </button>
                        </div>
                    </section>

                    {/* Divider */}
                    <hr className="border-surface-800" />

                    {/* Security Section */}
                    <section>
                        <div className="flex items-center gap-2 mb-5">
                            <ShieldIcon />
                            <h3 className="text-sm font-bold text-surface-300 uppercase tracking-wider">{t('settings.security')}</h3>
                        </div>

                        {/* Auto-lock timer */}
                        <div className="mb-6">
                            <label className="block text-xs font-medium text-surface-500 uppercase tracking-wider mb-2">
                                {t('settings.autoLock')}
                            </label>
                            <div className="flex items-center gap-3">
                                <select
                                    value={autoLockMinutes}
                                    onChange={(e) => handleAutoLockChange(parseInt(e.target.value))}
                                    className="flex-1"
                                >
                                    {autoLockOptions.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                                {autoLockSaved && (
                                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                                        <CheckIcon /> {t('common.saved')}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-surface-600 mt-1.5">
                                {t('settings.autoLockDesc')}
                            </p>
                        </div>

                        {/* Change master password */}
                        <div>
                            <label className="block text-xs font-medium text-surface-500 uppercase tracking-wider mb-3">
                                {t('settings.changePassword')}
                            </label>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs text-surface-500 mb-1">{t('settings.currentPassword')}</label>
                                    <div className="relative">
                                        <input
                                            type={showOldPassword ? 'text' : 'password'}
                                            value={oldPassword}
                                            onChange={(e) => setOldPassword(e.target.value)}
                                            placeholder={t('settings.currentPasswordPlaceholder')}
                                            className="w-full pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowOldPassword(!showOldPassword)}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300 transition-colors"
                                        >
                                            {showOldPassword ? <EyeOffIcon /> : <EyeIcon />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs text-surface-500 mb-1">{t('settings.newPassword')}</label>
                                    <div className="relative">
                                        <input
                                            type={showNewPassword ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder={t('settings.newPasswordPlaceholder')}
                                            className="w-full pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300 transition-colors"
                                        >
                                            {showNewPassword ? <EyeOffIcon /> : <EyeIcon />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs text-surface-500 mb-1">{t('settings.confirmNewPassword')}</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder={t('settings.confirmNewPlaceholder')}
                                        className="w-full"
                                    />
                                </div>

                                {passwordStatus && (
                                    <div
                                        className={`px-3 py-2 rounded-lg text-xs ${
                                            passwordStatus.type === 'success'
                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                        }`}
                                    >
                                        {passwordStatus.message}
                                    </div>
                                )}

                                <button
                                    onClick={handleChangePassword}
                                    disabled={changingPassword}
                                    className="btn-primary w-full text-sm"
                                >
                                    {changingPassword ? t('settings.changing') : t('settings.changePasswordBtn')}
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Divider */}
                    <hr className="border-surface-800" />

                    {/* Browser Extension Section */}
                    <section>
                        <div className="flex items-center gap-2 mb-5">
                            <PlugIcon />
                            <h3 className="text-sm font-bold text-surface-300 uppercase tracking-wider">{t('settings.extension')}</h3>
                        </div>

                        <div className="bg-surface-800/50 rounded-lg p-4 border border-surface-700/50 mb-4">
                            <p className="text-sm text-surface-300 leading-relaxed">
                                {t('settings.extensionDesc')}
                            </p>
                        </div>

                        {pairedExtensions.length > 0 ? (
                            <div>
                                <label className="block text-xs font-medium text-surface-500 uppercase tracking-wider mb-2">
                                    {t('settings.pairedExtensions')}
                                </label>
                                <div className="space-y-2">
                                    {pairedExtensions.map((ext) => (
                                        <div
                                            key={ext.extensionId}
                                            className="flex items-center justify-between bg-surface-800/50 rounded-lg px-4 py-3 border border-surface-700/30"
                                        >
                                            <div>
                                                <p className="text-sm text-surface-200 font-medium">{ext.name}</p>
                                                <p className="text-xs text-surface-500">{ext.device}</p>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                                <span className="text-xs text-emerald-400">{t('settings.paired')}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-surface-600">
                                {t('settings.noExtensions')}
                            </p>
                        )}
                    </section>

                    {/* Divider */}
                    <hr className="border-surface-800" />

                    {/* About Section */}
                    <section>
                        <div className="flex items-center gap-2 mb-5">
                            <InfoIcon />
                            <h3 className="text-sm font-bold text-surface-300 uppercase tracking-wider">{t('settings.about')}</h3>
                        </div>

                        <div className="text-center py-6">
                            <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-600/20">
                                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" className="w-8 h-8">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-surface-100 mb-1">MyPassword</h3>
                            <p className="text-xs text-surface-500 mb-1">{t('settings.version')}</p>
                            <p className="text-sm text-surface-400">
                                {t('settings.tagline')}
                            </p>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
