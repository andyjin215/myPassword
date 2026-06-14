import React, { useState, useCallback } from 'react';
import { useI18n } from '../i18n/LocaleContext';

interface ItemDetailProps {
    item: {
        id: number;
        itemType: number;
        favorite: boolean;
        deleted: boolean;
        updatedAt: number;
        data: any;
    };
    onEdit: () => void;
    onDelete: () => void;
    onRestore?: () => void;
    onPermanentDelete?: () => void;
    onToggleFavorite: (fav: boolean) => void;
    onCopyField: (text: string) => void;
}

// Inline SVG icons
const StarIcon = ({ filled }: { filled: boolean }) => (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
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

const EditIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

const TrashIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
);

const RestoreIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
        <polyline points="1 4 1 10 7 10" />
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
);

const GlobeIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
);

// Circle colors by item type
const circleColors: Record<number, string> = {
    1: 'bg-brand-600',
    2: 'bg-emerald-600',
    3: 'bg-amber-600',
};

function CopyButton({ text, onCopy }: { text: string; onCopy: (t: string) => void }) {
    const { t } = useI18n();
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
        onCopy(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }, [text, onCopy]);

    return (
        <button
            onClick={handleCopy}
            className={`p-1.5 rounded-md transition-all duration-200 ${
                copied
                    ? 'text-emerald-400 bg-emerald-400/10'
                    : 'text-surface-500 hover:text-surface-300 hover:bg-surface-700'
            }`}
            title={copied ? t('common.copied') : t('detail.copyToClipboard')}
        >
            {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
    );
}

function FieldRow({
    label,
    value,
    copyable = true,
    onCopy,
}: {
    label: string;
    value: string;
    copyable?: boolean;
    onCopy: (t: string) => void;
}) {
    if (!value) return null;
    return (
        <div className="flex items-start justify-between gap-3 py-3 border-b border-surface-800/60 last:border-0">
            <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-1">{label}</p>
                <p className="text-sm text-surface-200 break-all">{value}</p>
            </div>
            {copyable && value && (
                <div className="flex-shrink-0 pt-4">
                    <CopyButton text={value} onCopy={onCopy} />
                </div>
            )}
        </div>
    );
}

export default function ItemDetail({
    item,
    onEdit,
    onDelete,
    onRestore,
    onPermanentDelete,
    onToggleFavorite,
    onCopyField,
}: ItemDetailProps) {
    const { t, locale } = useI18n();
    const [showPassword, setShowPassword] = useState(false);
    const [passwordCopied, setPasswordCopied] = useState(false);

    // Reset sensitive state when switching to a different item
    useEffect(() => {
        setShowPassword(false);
        setPasswordCopied(false);
    }, [item.id]);

    const { itemType, favorite, deleted, updatedAt, data } = item;

    const title = data?.title || t('detail.untitled');
    const firstLetter = title.charAt(0).toUpperCase();

    const handleCopyPassword = useCallback(() => {
        if (data?.password) {
            onCopyField(data.password);
            setPasswordCopied(true);
            setTimeout(() => setPasswordCopied(false), 1500);
        }
    }, [data?.password, onCopyField]);

    const formatDate = (ts: number) => {
        const d = new Date(ts);
        return d.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-surface-800">
                <div className="flex items-start gap-4">
                    {/* Circle with first letter */}
                    <div
                        className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-semibold ${
                            circleColors[itemType] || 'bg-surface-600'
                        }`}
                    >
                        {firstLetter}
                    </div>

                    {/* Title and actions */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-semibold text-surface-100 truncate">{title}</h2>
                            {deleted && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-400 rounded-full">
                                    {t('detail.deleted')}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-surface-500 mt-0.5">
                            {itemType === 1 ? t('detail.login') : itemType === 2 ? t('detail.secureNote') : t('detail.identity')}
                        </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                            onClick={() => onToggleFavorite(!favorite)}
                            className={`btn-icon ${favorite ? 'text-amber-400' : ''}`}
                            title={favorite ? t('detail.removeFromFav') : t('detail.addToFav')}
                        >
                            <StarIcon filled={favorite} />
                        </button>

                        {!deleted && (
                            <button onClick={onEdit} className="btn-icon" title={t('detail.edit')}>
                                <EditIcon />
                            </button>
                        )}

                        {!deleted ? (
                            <button onClick={onDelete} className="btn-icon text-red-400 hover:text-red-300 hover:bg-red-500/10" title={t('detail.delete')}>
                                <TrashIcon />
                            </button>
                        ) : (
                            <>
                                {onRestore && (
                                    <button onClick={onRestore} className="btn-icon text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10" title={t('detail.restore')}>
                                        <RestoreIcon />
                                    </button>
                                )}
                                {onPermanentDelete && (
                                    <button onClick={onPermanentDelete} className="btn-icon text-red-400 hover:text-red-300 hover:bg-red-500/10" title={t('detail.deletePermanently')}>
                                        <TrashIcon />
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
                {/* Login fields */}
                {itemType === 1 && (
                    <div className="space-y-1">
                        <FieldRow label={t('detail.username')} value={data?.username || ''} onCopy={onCopyField} />

                        {/* Password field */}
                        {data?.password && (
                            <div className="py-3 border-b border-surface-800/60">
                                <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-1">{t('detail.password')}</p>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-surface-200 font-mono flex-1 truncate">
                                        {showPassword ? data.password : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
                                    </span>
                                    <button
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="p-1.5 rounded-md text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition-all duration-200"
                                        title={showPassword ? t('detail.hidePassword') : t('detail.showPassword')}
                                    >
                                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                                    </button>
                                    <button
                                        onClick={handleCopyPassword}
                                        className={`p-1.5 rounded-md transition-all duration-200 ${
                                            passwordCopied
                                                ? 'text-emerald-400 bg-emerald-400/10'
                                                : 'text-surface-500 hover:text-surface-300 hover:bg-surface-700'
                                        }`}
                                        title={passwordCopied ? t('common.copied') : t('detail.copyPassword')}
                                    >
                                        {passwordCopied ? <CheckIcon /> : <CopyIcon />}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Websites */}
                        {data?.websites && data.websites.length > 0 && (
                            <div className="py-3 border-b border-surface-800/60">
                                <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-2">{t('detail.websites')}</p>
                                <div className="flex flex-wrap gap-2">
                                    {data.websites.map((url: string, idx: number) => (
                                        <a
                                            key={idx}
                                            href={url.startsWith('http') ? url : `https://${url}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-brand-400 bg-brand-500/10 rounded-lg hover:bg-brand-500/20 transition-colors duration-200"
                                        >
                                            <GlobeIcon />
                                            <span className="max-w-48 truncate">{url}</span>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        <FieldRow label={t('detail.memo')} value={data?.memo || ''} copyable={false} onCopy={onCopyField} />
                    </div>
                )}

                {/* Note fields */}
                {itemType === 2 && (
                    <div className="space-y-1">
                        <div className="py-3">
                            <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-2">{t('detail.content')}</p>
                            <div className="bg-surface-800/50 rounded-lg p-4 border border-surface-700/50">
                                <p className="text-sm text-surface-200 whitespace-pre-wrap leading-relaxed">
                                    {data?.content || t('detail.noContent')}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Identity fields */}
                {itemType === 3 && (
                    <div className="space-y-1">
                        <FieldRow label={t('detail.firstName')} value={data?.firstName || ''} onCopy={onCopyField} />
                        <FieldRow label={t('detail.lastName')} value={data?.lastName || ''} onCopy={onCopyField} />
                        <FieldRow label={t('detail.email')} value={data?.email || ''} onCopy={onCopyField} />
                        <FieldRow label={t('detail.phone')} value={data?.phone || ''} onCopy={onCopyField} />
                        <FieldRow label={t('detail.address')} value={data?.address || ''} copyable={false} onCopy={onCopyField} />
                        <FieldRow label={t('detail.memo')} value={data?.memo || ''} copyable={false} onCopy={onCopyField} />
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-6 py-3 border-t border-surface-800">
                <p className="text-xs text-surface-500">
                    {t('detail.lastUpdated')} {formatDate(updatedAt)}
                </p>
            </div>
        </div>
    );
}
