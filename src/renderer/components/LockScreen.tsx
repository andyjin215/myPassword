import React, { useState, useMemo } from 'react';
import { useI18n } from '../i18n/LocaleContext';

interface LockScreenProps {
    mode: 'setup' | 'locked';
    onSubmit: (password: string) => Promise<boolean | void>;
}

function getPasswordStrength(password: string): { level: 'weak' | 'medium' | 'strong'; score: number } {
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score <= 2) return { level: 'weak', score };
    if (score <= 4) return { level: 'medium', score };
    return { level: 'strong', score };
}

const strengthColors = {
    weak: 'bg-red-500',
    medium: 'bg-yellow-500',
    strong: 'bg-green-500',
};

export default function LockScreen({ mode, onSubmit }: LockScreenProps) {
    const { t } = useI18n();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const strength = useMemo(() => getPasswordStrength(password), [password]);

    const isSetup = mode === 'setup';

    const strengthLabels: Record<string, string> = {
        weak: t('lock.weak'),
        medium: t('lock.medium'),
        strong: t('lock.strong'),
    };

    const canSubmit = isSetup
        ? password.length >= 6 && password === confirmPassword && !loading
        : password.length > 0 && !loading;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (isSetup) {
            if (password.length < 6) {
                setError(t('lock.errTooShort'));
                return;
            }
            if (password !== confirmPassword) {
                setError(t('lock.errMismatch'));
                return;
            }
        }

        setLoading(true);
        try {
            const result = await onSubmit(password);
            if (result === false) {
                setError(isSetup ? t('lock.errInitFailed') : t('lock.errWrongPassword'));
            }
        } catch {
            setError(t('lock.errUnexpected'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="h-screen flex items-center justify-center animate-fade-in"
            style={{
                background:
                    'radial-gradient(ellipse at 50% 30%, rgba(99,102,241,0.08) 0%, rgba(15,23,42,1) 70%)',
                paddingTop: 48,
            }}
        >
            <div className="w-full max-w-sm px-4">
                {/* Glow wrapper */}
                <div
                    className="rounded-2xl p-px"
                    style={{
                        background:
                            'linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(99,102,241,0.05) 50%, rgba(99,102,241,0.2) 100%)',
                    }}
                >
                    <div className="bg-surface-900 rounded-2xl px-8 py-10">
                        {/* Shield Icon */}
                        <div className="flex justify-center mb-6">
                            <div className="w-16 h-16 rounded-2xl bg-brand-600/20 flex items-center justify-center">
                                <svg
                                    className="w-8 h-8 text-brand-400"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={1.5}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                    <path d="M9 12l2 2 4-4" />
                                </svg>
                            </div>
                        </div>

                        {/* Title */}
                        <h1 className="text-xl font-semibold text-center text-surface-100 mb-1">
                            MyPassword
                        </h1>
                        <p className="text-sm text-center text-surface-400 mb-8">
                            {isSetup
                                ? t('lock.setupSubtitle')
                                : t('lock.lockedSubtitle')}
                        </p>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Password field */}
                            <div>
                                <label className="block text-xs font-medium text-surface-400 mb-1.5">
                                    {t('lock.masterPassword')}
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder={t('lock.enterPassword')}
                                        className="w-full pr-10"
                                        autoFocus
                                        disabled={loading}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300 transition-colors"
                                        tabIndex={-1}
                                    >
                                        {showPassword ? (
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                                <line x1="1" y1="1" x2="23" y2="23" />
                                            </svg>
                                        ) : (
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Strength indicator (setup mode only) */}
                            {isSetup && password.length > 0 && (
                                <div>
                                    <div className="flex gap-1.5 mb-1">
                                        {[0, 1, 2].map((i) => (
                                            <div
                                                key={i}
                                                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                                                    i < (strength.level === 'weak' ? 1 : strength.level === 'medium' ? 2 : 3)
                                                        ? strengthColors[strength.level]
                                                        : 'bg-surface-700'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                    <p
                                        className={`text-xs ${
                                            strength.level === 'weak'
                                                ? 'text-red-400'
                                                : strength.level === 'medium'
                                                    ? 'text-yellow-400'
                                                    : 'text-green-400'
                                        }`}
                                    >
                                        {strengthLabels[strength.level]}
                                    </p>
                                </div>
                            )}

                            {/* Confirm password (setup mode only) */}
                            {isSetup && (
                                <div>
                                    <label className="block text-xs font-medium text-surface-400 mb-1.5">
                                        {t('lock.confirmPassword')}
                                    </label>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder={t('lock.confirmPlaceholder')}
                                        className="w-full"
                                        disabled={loading}
                                    />
                                </div>
                            )}

                            {/* Error */}
                            {error && (
                                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="15" y1="9" x2="9" y2="15" />
                                        <line x1="9" y1="9" x2="15" y2="15" />
                                    </svg>
                                    {error}
                                </div>
                            )}

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={!canSubmit}
                                className="btn-primary w-full flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : isSetup ? (
                                    <>
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                        </svg>
                                        {t('lock.createVault')}
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                            <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                                        </svg>
                                        {t('lock.unlock')}
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Hint text */}
                <p className="text-xs text-center text-surface-600 mt-6">
                    {isSetup
                        ? t('lock.setupHint')
                        : t('lock.lockedHint')}
                </p>
            </div>
        </div>
    );
}
