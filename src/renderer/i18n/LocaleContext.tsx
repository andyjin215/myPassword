import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import en from './en';
import zh from './zh';
import type { Translations } from './en';

export type Locale = 'en' | 'zh';

const translations: Record<Locale, Translations> = { en, zh };

const api = window.electronAPI;

interface LocaleContextValue {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: <K extends string>(key: K, params?: Record<string, string | number>) => string;
}

/**
 * Resolve a dot-separated key path on an object.
 * e.g. resolve(en, 'lock.title') → 'MyPassword'
 */
function resolve(obj: any, path: string): string {
    const parts = path.split('.');
    let cur = obj;
    for (const p of parts) {
        if (cur == null) return path;
        cur = cur[p];
    }
    return typeof cur === 'string' ? cur : path;
}

/**
 * Replace {variable} placeholders with values.
 * e.g. interpolate('{n}m ago', { n: 5 }) → '5m ago'
 */
function interpolate(template: string, params?: Record<string, string | number>): string {
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, key) => {
        return params[key] != null ? String(params[key]) : `{${key}}`;
    });
}

const LocaleContext = createContext<LocaleContextValue>({
    locale: 'en',
    setLocale: () => {},
    t: (key: string) => key,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>('en');
    const [loaded, setLoaded] = useState(false);

    // Load saved locale on mount
    useEffect(() => {
        (async () => {
            try {
                const saved = await api.getLocale();
                if (saved === 'zh' || saved === 'en') {
                    setLocaleState(saved);
                }
            } catch {
                // default to 'en'
            }
            setLoaded(true);
        })();
    }, []);

    const setLocale = useCallback((newLocale: Locale) => {
        setLocaleState(newLocale);
        api.setLocale(newLocale).catch(() => {});
    }, []);

    const t = useCallback(
        (key: string, params?: Record<string, string | number>) => {
            const raw = resolve(translations[locale], key);
            return interpolate(raw, params);
        },
        [locale],
    );

    // While loading locale, render children with default 'en'
    // (avoids flash of wrong language since default is 'en')
    if (!loaded) {
        return (
            <LocaleContext.Provider value={{ locale, setLocale, t }}>
                {children}
            </LocaleContext.Provider>
        );
    }

    return (
        <LocaleContext.Provider value={{ locale, setLocale, t }}>
            {children}
        </LocaleContext.Provider>
    );
}

export function useI18n() {
    return useContext(LocaleContext);
}
