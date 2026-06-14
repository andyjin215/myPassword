import React, { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../i18n/LocaleContext';

interface PasswordGeneratorProps {
    onUse?: (password: string) => void;
    onClose?: () => void;
}

const api = window.electronAPI;

// Inline SVG icons
const RefreshIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
        <polyline points="23 4 23 10 17 10" />
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
);

const CopyIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
);

const CheckIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const CloseIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

interface GeneratorOptions {
    length: number;
    uppercase: boolean;
    lowercase: boolean;
    numbers: boolean;
    symbols: boolean;
}

function calculateEntropy(password: string, opts: GeneratorOptions): number {
    let poolSize = 0;
    if (opts.uppercase) poolSize += 26;
    if (opts.lowercase) poolSize += 26;
    if (opts.numbers) poolSize += 10;
    if (opts.symbols) poolSize += 32;
    if (poolSize === 0) return 0;
    return Math.floor(password.length * Math.log2(poolSize));
}

function getStrengthLevel(entropy: number): { label: string; color: string; percent: number } {
    if (entropy < 40) return { label: 'Weak', color: 'bg-red-500', percent: 25 };
    if (entropy < 60) return { label: 'Fair', color: 'bg-orange-500', percent: 50 };
    if (entropy < 80) return { label: 'Good', color: 'bg-yellow-500', percent: 75 };
    return { label: 'Strong', color: 'bg-emerald-500', percent: 100 };
}

export default function PasswordGenerator({ onUse, onClose }: PasswordGeneratorProps) {
    const { t } = useI18n();
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const [opts, setOpts] = useState<GeneratorOptions>({
        length: 20,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true,
    });

    const generate = useCallback(async () => {
        setLoading(true);
        try {
            const result = await api.generatePassword({
                length: opts.length,
                uppercase: opts.uppercase,
                lowercase: opts.lowercase,
                numbers: opts.numbers,
                symbols: opts.symbols,
            });
            setPassword(result);
            setCopied(false);
        } catch {
            // Fallback: simple client-side generation
            const chars: Record<string, string> = {
                uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
                lowercase: 'abcdefghijklmnopqrstuvwxyz',
                numbers: '0123456789',
                symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
            };
            let pool = '';
            if (opts.uppercase) pool += chars.uppercase;
            if (opts.lowercase) pool += chars.lowercase;
            if (opts.numbers) pool += chars.numbers;
            if (opts.symbols) pool += chars.symbols;
            if (!pool) pool = chars.lowercase;
            let pw = '';
            const arr = new Uint32Array(opts.length);
            crypto.getRandomValues(arr);
            for (let i = 0; i < opts.length; i++) {
                pw += pool[arr[i] % pool.length];
            }
            setPassword(pw);
            setCopied(false);
        }
        setLoading(false);
    }, [opts]);

    // Generate on mount and when options change
    useEffect(() => {
        generate();
    }, [generate]);

    const handleCopy = useCallback(async () => {
        if (!password) return;
        await api.copyToClipboard(password);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }, [password]);

    const toggleOpt = (key: keyof GeneratorOptions) => {
        // Ensure at least one option remains checked
        const next = { ...opts, [key]: !opts[key] };
        if (!next.uppercase && !next.lowercase && !next.numbers && !next.symbols) return;
        setOpts(next);
    };

    const entropy = calculateEntropy(password, opts);
    const strength = getStrengthLevel(entropy);
    const strengthLabel = entropy < 40 ? t('generator.weak') : entropy < 60 ? t('generator.fair') : entropy < 80 ? t('generator.good') : t('generator.strong');

    const checkboxes: { key: keyof GeneratorOptions; label: string; desc: string }[] = [
        { key: 'uppercase' as const, label: 'A-Z', desc: t('generator.uppercase') },
        { key: 'lowercase' as const, label: 'a-z', desc: t('generator.lowercase') },
        { key: 'numbers' as const, label: '0-9', desc: t('generator.numbers') },
        { key: 'symbols' as const, label: '!@#$', desc: t('generator.symbols') },
    ];

    return (
        <div className="bg-surface-800 border border-surface-700 rounded-xl p-4 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-surface-200">{t('generator.title')}</h3>
                {onClose && (
                    <button onClick={onClose} className="p-1 text-surface-500 hover:text-surface-300 transition-colors rounded">
                        <CloseIcon />
                    </button>
                )}
            </div>

            {/* Generated password display */}
            <div className="bg-surface-900 rounded-lg px-4 py-3 mb-4 flex items-center gap-2">
                <span
                    className="flex-1 font-mono text-sm text-surface-100 break-all select-all leading-relaxed"
                    style={{ userSelect: 'all' }}
                >
                    {loading ? (
                        <span className="text-surface-500">{t('generator.generating')}</span>
                    ) : (
                        password
                    )}
                </span>
                <button
                    onClick={handleCopy}
                    className={`flex-shrink-0 p-1.5 rounded-md transition-all duration-200 ${
                        copied
                            ? 'text-emerald-400 bg-emerald-400/10'
                            : 'text-surface-500 hover:text-surface-300 hover:bg-surface-700'
                    }`}
                    title={copied ? t('common.copied') : t('common.copy')}
                >
                    {copied ? <CheckIcon /> : <CopyIcon />}
                </button>
                <button
                    onClick={generate}
                    className="flex-shrink-0 p-1.5 text-surface-500 hover:text-surface-300 hover:bg-surface-700 rounded-md transition-all duration-200"
                    title={t('generator.regenerate')}
                >
                    <RefreshIcon />
                </button>
            </div>

            {/* Strength bar */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-surface-500">{t('generator.strength')}</span>
                    <span className={`text-xs font-medium ${
                        strength.color === 'bg-red-500' ? 'text-red-400' :
                        strength.color === 'bg-orange-500' ? 'text-orange-400' :
                        strength.color === 'bg-yellow-500' ? 'text-yellow-400' :
                        'text-emerald-400'
                    }`}>
                        {strengthLabel}
                    </span>
                </div>
                <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${strength.color} rounded-full transition-all duration-500`}
                        style={{ width: `${strength.percent}%` }}
                    />
                </div>
            </div>

            {/* Length slider */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-surface-500">{t('generator.length')}</label>
                    <span className="text-xs font-mono text-surface-300 bg-surface-700 px-2 py-0.5 rounded">
                        {opts.length}
                    </span>
                </div>
                <input
                    type="range"
                    min={8}
                    max={64}
                    value={opts.length}
                    onChange={(e) => setOpts({ ...opts, length: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-surface-700 rounded-full appearance-none cursor-pointer accent-brand-500
                                          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                                          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-500
                                          [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg"
                />
                <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-surface-600">8</span>
                    <span className="text-[10px] text-surface-600">64</span>
                </div>
            </div>

            {/* Character type toggles */}
            <div className="grid grid-cols-2 gap-2 mb-4">
                {checkboxes.map(({ key, label, desc }) => (
                    <label
                        key={key}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 ${
                            opts[key]
                                ? 'bg-brand-500/10 border border-brand-500/30'
                                : 'bg-surface-700/50 border border-surface-700'
                        }`}
                    >
                        <input
                            type="checkbox"
                            checked={opts[key] as boolean}
                            onChange={() => toggleOpt(key)}
                        />
                        <div>
                            <span className="text-xs font-mono text-surface-300">{label}</span>
                            <span className="text-[10px] text-surface-500 ml-1">{desc}</span>
                        </div>
                    </label>
                ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
                {onClose && (
                    <button onClick={onClose} className="btn-secondary flex-1 text-sm">
                        {t('common.cancel')}
                    </button>
                )}
                <button
                    onClick={() => onUse?.(password)}
                    disabled={!password || !onUse}
                    className={`flex-1 text-sm ${onClose ? '' : 'w-full'} ${onUse ? 'btn-primary' : 'btn-secondary'}`}
                >
                    {onUse ? t('generator.usePassword') : t('generator.copyAndClose')}
                </button>
            </div>
        </div>
    );
}
