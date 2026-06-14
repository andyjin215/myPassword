import React, { useMemo, useCallback } from 'react';
import { useI18n } from '../i18n/LocaleContext';

interface ItemListProps {
    items: any[];
    selectedItem: any | null;
    onSelectItem: (item: any) => void;
    searchQuery: string;
    onSearchChange: (q: string) => void;
    category: string;
    onToggleFavorite: (id: number, fav: boolean) => void;
    onCopyField: (text: string) => void;
}

// Color palette for avatar circles based on first letter
const avatarColors = [
    'bg-brand-600',
    'bg-blue-600',
    'bg-cyan-600',
    'bg-teal-600',
    'bg-emerald-600',
    'bg-amber-600',
    'bg-orange-600',
    'bg-rose-600',
    'bg-pink-600',
    'bg-purple-600',
];

function getAvatarColor(letter: string): string {
    const code = letter.toUpperCase().charCodeAt(0) - 65;
    const index = Math.abs(code) % avatarColors.length;
    return avatarColors[index];
}

function formatRelativeTime(timestamp: number | string, locale: string, t: (key: string, params?: Record<string, any>) => string): string {
    const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('list.justNow');
    if (diffMins < 60) return t('list.mAgo', { n: diffMins });
    if (diffHours < 24) return t('list.hAgo', { n: diffHours });
    if (diffDays < 7) return t('list.dAgo', { n: diffDays });
    return date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });
}

function getSubtitle(item: any): string {
    if (!item?.data) return '';
    switch (item.itemType) {
        case 1: // Login
            return item.data.username || '';
        case 3: // Identity
            return item.data.email || `${item.data.firstName || ''} ${item.data.lastName || ''}`.trim();
        case 2: // Note
            return item.data.content
                ? item.data.content.substring(0, 50) + (item.data.content.length > 50 ? '...' : '')
                : '';
        default:
            return '';
    }
}

function getTitle(item: any, fallback: string): string {
    return item?.data?.title || fallback;
}

export default function ItemList({
    items,
    selectedItem,
    onSelectItem,
    searchQuery,
    onSearchChange,
    category,
    onToggleFavorite,
    onCopyField,
}: ItemListProps) {
    const { t, locale } = useI18n();

    // Filter items based on search query
    const filteredItems = useMemo(() => {
        if (!searchQuery.trim()) return items;
        const query = searchQuery.toLowerCase();
        return items.filter((item) => {
            const title = getTitle(item, t('list.untitled')).toLowerCase();
            const subtitle = getSubtitle(item).toLowerCase();
            return title.includes(query) || subtitle.includes(query);
        });
    }, [items, searchQuery]);

    // Handle double-click to copy password for logins
    const handleDoubleClick = useCallback(
        (item: any) => {
            if (item.itemType === 1 && item.data?.password) {
                onCopyField(item.data.password);
            }
        },
        [onCopyField],
    );

    // Handle favorite toggle with event stop propagation
    const handleToggleFav = useCallback(
        (e: React.MouseEvent, item: any) => {
            e.stopPropagation();
            onToggleFavorite(item.id, !item.favorite);
        },
        [onToggleFavorite],
    );

    const categoryLabels: Record<string, string> = {
        all: t('sidebar.allItems'),
        logins: t('sidebar.logins'),
        identities: t('sidebar.identities'),
        notes: t('sidebar.notes'),
        favorites: t('sidebar.favorites'),
        trash: t('sidebar.trash'),
    };

    return (
        <div className="h-full flex flex-col bg-surface-900">
            {/* Search bar */}
            <div className="px-3 py-2 border-b border-surface-800">
                <div className="relative">
                    <svg
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        placeholder={t('list.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-sm bg-surface-800 border-surface-700"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => onSearchChange('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300 transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Category header */}
            <div className="px-3 py-2 flex items-center justify-between">
                <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
                    {categoryLabels[category] || t('list.items')}
                </h2>
                <span className="text-xs text-surface-600 tabular-nums">
                    {filteredItems.length}
                </span>
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto">
                {filteredItems.length === 0 ? (
                    /* Empty state */
                    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-surface-800 flex items-center justify-center mb-3">
                            {searchQuery ? (
                                <svg className="w-7 h-7 text-surface-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    <line x1="8" y1="11" x2="14" y2="11" />
                                </svg>
                            ) : (
                                <svg className="w-7 h-7 text-surface-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                            )}
                        </div>
                        <p className="text-sm font-medium text-surface-400 mb-1">
                            {searchQuery ? t('list.noResults') : t('list.noItems')}
                        </p>
                        <p className="text-xs text-surface-600">
                            {searchQuery
                                ? t('list.tryDifferent')
                                : t('list.clickToAdd')}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-0.5 px-2 pb-2">
                        {filteredItems.map((item, index) => {
                            const title = getTitle(item, t('list.untitled'));
                            const subtitle = getSubtitle(item);
                            const firstLetter = title.charAt(0).toUpperCase();
                            const isSelected = selectedItem?.id === item.id;
                            const isLogin = item.itemType === 1;

                            return (
                                <div
                                    key={item.id}
                                    onClick={() => onSelectItem(item)}
                                    onDoubleClick={() => handleDoubleClick(item)}
                                    className={`flex items-center gap-3 px-2.5 py-2.5 rounded-lg cursor-pointer transition-all duration-150 animate-fade-in group ${
                                        isSelected
                                            ? 'bg-brand-600/20 border border-brand-500/30'
                                            : 'hover:bg-surface-800 border border-transparent'
                                    }`}
                                    style={{ animationDelay: `${Math.min(index * 20, 200)}ms` }}
                                    title={isLogin ? t('list.dblClickCopy') : undefined}
                                >
                                    {/* Avatar circle */}
                                    <div
                                        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold text-white ${getAvatarColor(firstLetter)}`}
                                    >
                                        {firstLetter}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm truncate ${isSelected ? 'text-surface-100 font-medium' : 'text-surface-200'}`}>
                                            {title}
                                        </p>
                                        {subtitle && (
                                            <p className="text-xs text-surface-500 truncate mt-0.5">
                                                {subtitle}
                                            </p>
                                        )}
                                    </div>

                                    {/* Right side: favorite star + time */}
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {/* Favorite star */}
                                        <button
                                            onClick={(e) => handleToggleFav(e, item)}
                                            className={`p-0.5 rounded transition-colors ${
                                                item.favorite
                                                    ? 'text-yellow-400'
                                                    : 'text-surface-600 opacity-0 group-hover:opacity-100'
                                            } hover:text-yellow-400`}
                                        >
                                            <svg
                                                className="w-3.5 h-3.5"
                                                viewBox="0 0 24 24"
                                                fill={item.favorite ? 'currentColor' : 'none'}
                                                stroke="currentColor"
                                                strokeWidth={2}
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                            </svg>
                                        </button>

                                        {/* Updated time */}
                                        <span className="text-[10px] text-surface-600 tabular-nums min-w-[40px] text-right">
                                            {item.updatedAt ? formatRelativeTime(item.updatedAt, locale, t) : ''}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
