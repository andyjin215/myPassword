import React, { useState, useCallback } from 'react';
import PasswordGenerator from './PasswordGenerator';
import { useI18n } from '../i18n/LocaleContext';

interface ItemFormProps {
    itemType: number;
    existingItem?: { id: number; data: any } | null;
    /** @deprecated Use existingItem instead */
    item?: { id: number; data: any } | null;
    onSave: (...args: any[]) => void;
    onCancel: () => void;
}

// Inline SVG icons
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

const WandIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
        <path d="M15 4V2" />
        <path d="M15 16v-2" />
        <path d="M8 9h2" />
        <path d="M20 9h2" />
        <path d="M17.8 11.8L19 13" />
        <path d="M15 9h.01" />
        <path d="M17.8 6.2L19 5" />
        <path d="M11 6.2L9.7 5" />
        <path d="M2 22l10-10" />
    </svg>
);

const XIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

function FormField({
    label,
    required,
    children,
}: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div>
            <label className="block text-xs font-medium text-surface-500 uppercase tracking-wider mb-1.5">
                {label}
                {required && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            {children}
        </div>
    );
}

export default function ItemForm({ itemType, existingItem, item, onSave, onCancel }: ItemFormProps) {
    const { t } = useI18n();
    const resolvedItem = existingItem || item || null;
    const isEditing = !!resolvedItem;
    const typeLabel = itemType === 1 ? t('form.login') : itemType === 2 ? t('form.note') : itemType === 3 ? t('form.identity') : t('form.item');

    // Login state
    const [title, setTitle] = useState(resolvedItem?.data?.title || '');
    const [username, setUsername] = useState(resolvedItem?.data?.username || '');
    const [password, setPassword] = useState(resolvedItem?.data?.password || '');
    const [websitesInput, setWebsitesInput] = useState(
        resolvedItem?.data?.websites?.join(', ') || ''
    );
    const [memo, setMemo] = useState(resolvedItem?.data?.memo || '');

    // Note state
    const [content, setContent] = useState(resolvedItem?.data?.content || '');

    // Identity state
    const [firstName, setFirstName] = useState(resolvedItem?.data?.firstName || '');
    const [lastName, setLastName] = useState(resolvedItem?.data?.lastName || '');
    const [email, setEmail] = useState(resolvedItem?.data?.email || '');
    const [phone, setPhone] = useState(resolvedItem?.data?.phone || '');
    const [address, setAddress] = useState(resolvedItem?.data?.address || '');

    // UI state
    const [showPassword, setShowPassword] = useState(false);
    const [showGenerator, setShowGenerator] = useState(false);
    const [titleError, setTitleError] = useState(false);

    // Parse websites from comma-separated input
    const parseWebsites = useCallback((input: string): string[] => {
        return input
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }, []);

    const websiteTags = parseWebsites(websitesInput);

    const handleSave = useCallback(() => {
        if (!title.trim()) {
            setTitleError(true);
            return;
        }
        setTitleError(false);

        let data: any;
        if (itemType === 1) {
            data = {
                title: title.trim(),
                username: username.trim(),
                password,
                websites: parseWebsites(websitesInput),
                memo: memo.trim(),
            };
        } else if (itemType === 2) {
            data = {
                title: title.trim(),
                content,
            };
        } else if (itemType === 3) {
            data = {
                title: title.trim(),
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim(),
                phone: phone.trim(),
                address: address.trim(),
                memo: memo.trim(),
            };
        }

        onSave(itemType, data, resolvedItem?.id);
    }, [
        itemType, title, username, password, websitesInput, memo, content,
        firstName, lastName, email, phone, address, resolvedItem, onSave, parseWebsites,
    ]);

    const handleUsePassword = useCallback((pw: string) => {
        setPassword(pw);
        setShowGenerator(false);
    }, []);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-surface-800">
                <h2 className="text-lg font-semibold text-surface-100">
                    {isEditing ? t('form.editTitle', { type: typeLabel }) : t('form.newTitle', { type: typeLabel })}
                </h2>
            </div>

            {/* Scrollable form */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="space-y-5">
                    {/* Title (all types) */}
                    <FormField label={t('form.title')} required>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => {
                                setTitle(e.target.value);
                                if (e.target.value.trim()) setTitleError(false);
                            }}
                            placeholder={t('form.titlePlaceholder', { type: typeLabel })}
                            className={`w-full ${titleError ? 'border-red-500 focus:ring-red-500' : ''}`}
                        />
                        {titleError && (
                            <p className="mt-1 text-xs text-red-400">{t('form.titleRequired')}</p>
                        )}
                    </FormField>

                    {/* Login fields */}
                    {itemType === 1 && (
                        <>
                            <FormField label={t('form.username')}>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder={t('form.usernamePlaceholder')}
                                    className="w-full"
                                />
                            </FormField>

                            <FormField label={t('form.password')}>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder={t('form.passwordPlaceholder')}
                                        className="w-full pr-20"
                                    />
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="p-1.5 text-surface-500 hover:text-surface-300 transition-colors"
                                            title={showPassword ? t('form.hide') : t('form.show')}
                                        >
                                            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowGenerator(!showGenerator)}
                                            className="p-1.5 text-brand-400 hover:text-brand-300 transition-colors"
                                            title={t('form.generatePassword')}
                                        >
                                            <WandIcon />
                                        </button>
                                    </div>
                                </div>
                            </FormField>

                            {/* Inline password generator */}
                            {showGenerator && (
                                <PasswordGenerator
                                    onUse={handleUsePassword}
                                    onClose={() => setShowGenerator(false)}
                                />
                            )}

                            <FormField label={t('form.websites')}>
                                <input
                                    type="text"
                                    value={websitesInput}
                                    onChange={(e) => setWebsitesInput(e.target.value)}
                                    placeholder={t('form.websitesPlaceholder')}
                                    className="w-full"
                                />
                                {websiteTags.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {websiteTags.map((url, idx) => (
                                            <span
                                                key={idx}
                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-brand-300 bg-brand-500/10 rounded-md"
                                            >
                                                {url}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const tags = websiteTags.filter((_, i) => i !== idx);
                                                        setWebsitesInput(tags.join(', '));
                                                    }}
                                                    className="text-surface-500 hover:text-surface-300"
                                                >
                                                    <XIcon />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </FormField>

                            <FormField label={t('form.memo')}>
                                <textarea
                                    value={memo}
                                    onChange={(e) => setMemo(e.target.value)}
                                    placeholder={t('form.memoPlaceholder')}
                                    rows={3}
                                    className="w-full resize-none"
                                />
                            </FormField>
                        </>
                    )}

                    {/* Note fields */}
                    {itemType === 2 && (
                        <FormField label={t('form.content')}>
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder={t('form.contentPlaceholder')}
                                rows={12}
                                className="w-full resize-none"
                            />
                        </FormField>
                    )}

                    {/* Identity fields */}
                    {itemType === 3 && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField label={t('form.firstName')}>
                                    <input
                                        type="text"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        placeholder={t('form.firstNamePlaceholder')}
                                        className="w-full"
                                    />
                                </FormField>
                                <FormField label={t('form.lastName')}>
                                    <input
                                        type="text"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        placeholder={t('form.lastNamePlaceholder')}
                                        className="w-full"
                                    />
                                </FormField>
                            </div>

                            <FormField label={t('form.email')}>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder={t('form.emailPlaceholder')}
                                    className="w-full"
                                />
                            </FormField>

                            <FormField label={t('form.phone')}>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder={t('form.phonePlaceholder')}
                                    className="w-full"
                                />
                            </FormField>

                            <FormField label={t('form.address')}>
                                <textarea
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    placeholder={t('form.addressPlaceholder')}
                                    rows={3}
                                    className="w-full resize-none"
                                />
                            </FormField>

                            <FormField label={t('form.memo')}>
                                <textarea
                                    value={memo}
                                    onChange={(e) => setMemo(e.target.value)}
                                    placeholder={t('form.memoPlaceholder')}
                                    rows={3}
                                    className="w-full resize-none"
                                />
                            </FormField>
                        </>
                    )}
                </div>
            </div>

            {/* Footer with buttons */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-surface-800 flex items-center justify-end gap-3">
                <button onClick={onCancel} className="btn-secondary">
                    {t('common.cancel')}
                </button>
                <button onClick={handleSave} className="btn-primary">
                    {isEditing ? t('form.saveChanges') : t('common.create')}
                </button>
            </div>
        </div>
    );
}
