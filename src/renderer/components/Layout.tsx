import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './Sidebar';
import ItemList from './ItemList';
import ItemDetail from './ItemDetail';
import ItemForm from './ItemForm';
import PasswordGenerator from './PasswordGenerator';
import Settings from './Settings';
import { useI18n } from '../i18n/LocaleContext';

const api = window.electronAPI;

type CategoryType = 'all' | 'logins' | 'identities' | 'notes' | 'favorites' | 'trash' | 'settings';
type RightView = 'detail' | 'create' | 'edit' | 'settings' | 'generator' | 'empty';

interface LayoutProps {
    onLock: () => Promise<void>;
}

export default function Layout({ onLock }: LayoutProps) {
    const { t } = useI18n();
    const [selectedCategory, setSelectedCategory] = useState<CategoryType>('all');
    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [items, setItems] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [rightView, setRightView] = useState<RightView>('empty');
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [createItemType, setCreateItemType] = useState<number>(1);
    const [loading, setLoading] = useState(false);

    // Fetch items based on category
    const fetchItems = useCallback(async (category: CategoryType) => {
        setLoading(true);
        try {
            let result: any[] = [];
            switch (category) {
                case 'all':
                    result = await api.listItems();
                    break;
                case 'logins':
                    result = await api.listItems(1);
                    break;
                case 'identities':
                    result = await api.listItems(3);
                    break;
                case 'notes':
                    result = await api.listItems(2);
                    break;
                case 'favorites':
                    result = await api.listFavorites();
                    break;
                case 'trash':
                    result = await api.listTrash();
                    break;
                default:
                    result = [];
            }
            setItems(result);
        } catch (err) {
            console.error('Failed to fetch items:', err);
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch items when category changes
    useEffect(() => {
        if (selectedCategory !== 'settings') {
            setSelectedItem(null);
            setRightView('empty');
            fetchItems(selectedCategory);
        }
    }, [selectedCategory, fetchItems]);

    // Fetch all counts for sidebar badges
    const [allCounts, setAllCounts] = useState({ logins: 0, identities: 0, notes: 0, favorites: 0, trash: 0 });

    const refreshCounts = useCallback(async () => {
        try {
            const [logins, notes, identities, favorites, trash] = await Promise.all([
                api.listItems(1),
                api.listItems(2),
                api.listItems(3),
                api.listFavorites(),
                api.listTrash(),
            ]);
            setAllCounts({
                logins: logins.length,
                identities: identities.length,
                notes: notes.length,
                favorites: favorites.length,
                trash: trash.length,
            });
        } catch {
            // silently fail
        }
    }, []);

    useEffect(() => {
        refreshCounts();
    }, [refreshCounts]);

    // Handle category change
    const handleSelectCategory = useCallback((cat: string) => {
        setSelectedCategory(cat as CategoryType);
        setSearchQuery('');
    }, []);

    // Handle item selection
    const handleSelectItem = useCallback((item: any) => {
        setSelectedItem(item);
        setRightView('detail');
        setEditingItem(null);
    }, []);

    // Handle refresh
    const handleRefresh = useCallback(() => {
        fetchItems(selectedCategory);
        refreshCounts();
    }, [selectedCategory, fetchItems, refreshCounts]);

    // Handle create new item
    const handleCreate = useCallback((itemType: number) => {
        setCreateItemType(itemType);
        setEditingItem(null);
        setSelectedItem(null);
        setRightView('create');
    }, []);

    const handleNewLogin = useCallback(() => handleCreate(1), [handleCreate]);
    const handleNewNote = useCallback(() => handleCreate(2), [handleCreate]);
    const handleNewIdentity = useCallback(() => handleCreate(3), [handleCreate]);

    // Handle edit item
    const handleEdit = useCallback((item: any) => {
        setEditingItem(item);
        setRightView('edit');
    }, []);

    // Handle save (create or update)
    const handleSave = useCallback(async (itemType: number, data: any, id?: number) => {
        try {
            if (id !== undefined) {
                await api.updateItem(id, data);
            } else {
                await api.createItem(itemType, data);
            }
            await handleRefresh();
            // After save, go back to empty or select the item
            setRightView('empty');
            setEditingItem(null);
            setSelectedItem(null);
        } catch (err) {
            console.error('Failed to save item:', err);
        }
    }, [handleRefresh]);

    // Handle delete
    const handleDelete = useCallback(async (id: number) => {
        try {
            await api.deleteItem(id);
            await handleRefresh();
            setSelectedItem(null);
            setRightView('empty');
        } catch (err) {
            console.error('Failed to delete item:', err);
        }
    }, [handleRefresh]);

    // Handle restore from trash
    const handleRestore = useCallback(async (id: number) => {
        try {
            await api.restoreItem(id);
            await handleRefresh();
            setSelectedItem(null);
            setRightView('empty');
        } catch (err) {
            console.error('Failed to restore item:', err);
        }
    }, [handleRefresh]);

    // Handle permanent delete
    const handlePermanentDelete = useCallback(async (id: number) => {
        try {
            await api.permanentDelete(id);
            await handleRefresh();
            setSelectedItem(null);
            setRightView('empty');
        } catch (err) {
            console.error('Failed to permanently delete item:', err);
        }
    }, [handleRefresh]);

    // Handle toggle favorite
    const handleToggleFavorite = useCallback(async (id: number, fav: boolean) => {
        try {
            await api.toggleFavorite(id, fav);
            await handleRefresh();
            // Update selectedItem if it was the toggled one
            if (selectedItem?.id === id) {
                setSelectedItem((prev: any) => prev ? { ...prev, favorite: fav } : null);
            }
        } catch (err) {
            console.error('Failed to toggle favorite:', err);
        }
    }, [selectedItem, handleRefresh]);

    // Handle copy field
    const handleCopyField = useCallback(async (text: string) => {
        try {
            await api.copyToClipboard(text);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }, []);

    // Handle lock
    const handleLock = useCallback(async () => {
        await onLock();
    }, [onLock]);

    // Handle cancel form
    const handleCancelForm = useCallback(() => {
        setRightView(selectedItem ? 'detail' : 'empty');
        setEditingItem(null);
    }, [selectedItem]);

    // Determine right panel content
    const renderRightPanel = () => {
        if (selectedCategory === 'settings' || rightView === 'settings') {
            return <Settings />;
        }

        if (rightView === 'generator') {
            return <PasswordGenerator />;
        }

        if (rightView === 'create') {
            return (
                <ItemForm
                    itemType={createItemType}
                    onSave={(_itemType: number, data: any, id?: number) => handleSave(createItemType, data, id)}
                    onCancel={handleCancelForm}
                />
            );
        }

        if (rightView === 'edit' && editingItem) {
            return (
                <ItemForm
                    itemType={editingItem.itemType}
                    existingItem={editingItem}
                    onSave={(_itemType: number, data: any, id?: number) => handleSave(editingItem.itemType, data, id)}
                    onCancel={handleCancelForm}
                />
            );
        }

        if (rightView === 'detail' && selectedItem) {
            return (
                <ItemDetail
                    item={selectedItem}
                    onEdit={() => handleEdit(selectedItem)}
                    onDelete={() => handleDelete(selectedItem.id)}
                    onRestore={() => handleRestore(selectedItem.id)}
                    onPermanentDelete={() => handlePermanentDelete(selectedItem.id)}
                    onToggleFavorite={(fav: boolean) => handleToggleFavorite(selectedItem.id, fav)}
                    onCopyField={handleCopyField}
                />
            );
        }

        // Empty state
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-20 h-20 rounded-2xl bg-surface-800 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-surface-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                    </div>
                    <p className="text-surface-500 text-sm font-medium">{t('layout.selectItem')}</p>
                    <p className="text-surface-600 text-xs mt-1">{t('layout.createNew')}</p>
                </div>
            </div>
        );
    };

    return (
        <div className="h-screen flex flex-col bg-surface-900 overflow-hidden">
            {/* Titlebar drag region */}
            <div className="titlebar-drag h-8 flex-shrink-0" />

            {/* Main content area */}
            <div className="flex-1 flex overflow-hidden titlebar-no-drag">
                {/* Sidebar - 220px */}
                <div className="w-[220px] flex-shrink-0">
                    <Sidebar
                        selectedCategory={selectedCategory}
                        onSelectCategory={handleSelectCategory}
                        onNewLogin={handleNewLogin}
                        onNewNote={handleNewNote}
                        onNewIdentity={handleNewIdentity}
                        onLock={handleLock}
                        counts={allCounts}
                    />
                </div>

                {/* Divider */}
                <div className="w-px bg-surface-800 flex-shrink-0" />

                {/* Item List - 320px */}
                {selectedCategory !== 'settings' && (
                    <>
                        <div className="w-[320px] flex-shrink-0">
                            <ItemList
                                items={items}
                                selectedItem={selectedItem}
                                onSelectItem={handleSelectItem}
                                searchQuery={searchQuery}
                                onSearchChange={setSearchQuery}
                                category={selectedCategory}
                                onToggleFavorite={handleToggleFavorite}
                                onCopyField={handleCopyField}
                            />
                        </div>

                        {/* Divider */}
                        <div className="w-px bg-surface-800 flex-shrink-0" />
                    </>
                )}

                {/* Main content area - flex */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {renderRightPanel()}
                </div>
            </div>
        </div>
    );
}
