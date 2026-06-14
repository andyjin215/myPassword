import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useI18n } from '../i18n/LocaleContext';

interface SidebarProps {
    selectedCategory: string;
    onSelectCategory: (cat: string) => void;
    onNewLogin: () => void;
    onNewNote: () => void;
    onNewIdentity: () => void;
    onLock: () => void;
    counts: {
        logins: number;
        identities: number;
        notes: number;
        favorites: number;
        trash: number;
    };
}

const categories = [
    {
        id: 'all',
        labelKey: 'sidebar.allItems',
        icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
        ),
        countKey: null,
    },
    {
        id: 'logins',
        labelKey: 'sidebar.logins',
        icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
        ),
        countKey: 'logins',
    },
    {
        id: 'identities',
        labelKey: 'sidebar.identities',
        icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
            </svg>
        ),
        countKey: 'identities',
    },
    {
        id: 'notes',
        labelKey: 'sidebar.notes',
        icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
            </svg>
        ),
        countKey: 'notes',
    },
    {
        id: 'favorites',
        labelKey: 'sidebar.favorites',
        icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
        ),
        countKey: 'favorites',
    },
    {
        id: 'trash',
        labelKey: 'sidebar.trash',
        icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
        ),
        countKey: 'trash',
    },
];

export default function Sidebar({
    selectedCategory,
    onSelectCategory,
    onNewLogin,
    onNewNote,
    onNewIdentity,
    onLock,
    counts,
}: SidebarProps) {
    const { t } = useI18n();
    const [showAddMenu, setShowAddMenu] = useState(false);
    const addMenuRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
                setShowAddMenu(false);
            }
        };
        if (showAddMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showAddMenu]);

    const handleAddNew = (handler: () => void) => {
        handler();
        setShowAddMenu(false);
    };

    const getCount = (countKey: string | null): number => {
        if (!countKey) {
            return counts.logins + counts.identities + counts.notes;
        }
        return counts[countKey as keyof typeof counts] || 0;
    };

    return (
        <div className="h-full flex flex-col bg-surface-950">
            {/* Logo area */}
            <div className="titlebar-drag px-4 pt-2 pb-3 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-600/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                </div>
                <span className="text-sm font-semibold text-surface-200 titlebar-no-drag">MyPassword</span>
            </div>

            {/* Add new button */}
            <div className="px-3 mb-2 relative" ref={addMenuRef}>
                <button
                    onClick={() => setShowAddMenu(!showAddMenu)}
                    className="w-full btn-secondary text-sm flex items-center justify-center gap-1.5 py-1.5"
                >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    {t('sidebar.addNew')}
                </button>

                {/* Dropdown menu */}
                {showAddMenu && (
                    <div className="absolute left-3 right-3 top-full mt-1 bg-surface-800 border border-surface-700 rounded-lg shadow-xl z-50 py-1 animate-fade-in">
                        <button
                            onClick={() => handleAddNew(onNewLogin)}
                            className="w-full text-left px-3 py-2 text-sm text-surface-300 hover:bg-surface-700 hover:text-surface-100 flex items-center gap-2.5 transition-colors"
                        >
                            <svg className="w-4 h-4 text-surface-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                            </svg>
                            {t('sidebar.newLogin')}
                        </button>
                        <button
                            onClick={() => handleAddNew(onNewNote)}
                            className="w-full text-left px-3 py-2 text-sm text-surface-300 hover:bg-surface-700 hover:text-surface-100 flex items-center gap-2.5 transition-colors"
                        >
                            <svg className="w-4 h-4 text-surface-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                            </svg>
                            {t('sidebar.newNote')}
                        </button>
                        <button
                            onClick={() => handleAddNew(onNewIdentity)}
                            className="w-full text-left px-3 py-2 text-sm text-surface-300 hover:bg-surface-700 hover:text-surface-100 flex items-center gap-2.5 transition-colors"
                        >
                            <svg className="w-4 h-4 text-surface-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                            {t('sidebar.newIdentity')}
                        </button>
                    </div>
                )}
            </div>

            {/* Categories */}
            <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
                {categories.map((cat) => {
                    const isActive = selectedCategory === cat.id;
                    const count = getCount(cat.countKey);

                    return (
                        <button
                            key={cat.id}
                            onClick={() => onSelectCategory(cat.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 group ${
                                isActive
                                    ? 'bg-brand-600 text-white'
                                    : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200'
                            }`}
                        >
                            <span className={isActive ? 'text-white' : 'text-surface-500 group-hover:text-surface-300'}>
                                {cat.icon}
                            </span>
                            <span className="flex-1 text-left truncate">{t(cat.labelKey)}</span>
                            {count > 0 && (
                                <span
                                    className={`text-xs tabular-nums px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                                        isActive
                                            ? 'bg-brand-500 text-brand-100'
                                            : 'bg-surface-800 text-surface-500 group-hover:bg-surface-700'
                                    }`}
                                >
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Bottom section */}
            <div className="px-2 pb-3 pt-2 border-t border-surface-800 mt-2 space-y-0.5">
                {/* Settings */}
                <button
                    onClick={() => onSelectCategory('settings')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 group ${
                        selectedCategory === 'settings'
                            ? 'bg-brand-600 text-white'
                            : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200'
                    }`}
                >
                    <svg className="w-4 h-4 text-surface-500 group-hover:text-surface-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    <span>{t('sidebar.settings')}</span>
                </button>

                {/* Lock button */}
                <button
                    onClick={onLock}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-surface-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150 group"
                >
                    <svg className="w-4 h-4 text-surface-500 group-hover:text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>{t('sidebar.lockVault')}</span>
                </button>
            </div>
        </div>
    );
}
