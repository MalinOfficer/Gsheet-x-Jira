'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserPreferences, saveUserPreferences, type UserPreferences } from '@/app/actions';

// ─────────────────────────────────────────────────────────────────────────────
// Debounce helper — save ke DB tidak langsung tiap perubahan
// ─────────────────────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debounced;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level cache — persists selama SPA session
// Hilang hanya jika tab ditutup atau hard reload
// ─────────────────────────────────────────────────────────────────────────────
const _prefsCache: { data: UserPreferences | null } = { data: null };

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
export function useUserPreferences() {
    const { user } = useAuth();

    const [prefs, setPrefs]         = useState<UserPreferences>(_prefsCache.data ?? {});
    const [isLoading, setIsLoading] = useState(_prefsCache.data === null);
    const isFirstLoad               = useRef(true);

    // ── Load preferences saat login ──────────────────────────────────────────
    useEffect(() => {
        if (!user?.id) {
            setIsLoading(false);
            return;
        }

        // ✅ Gunakan cache jika sudah ada — tidak perlu fetch ulang
        if (_prefsCache.data !== null) {
            setPrefs(_prefsCache.data);
            setIsLoading(false);
            return;
        }

        getUserPreferences(user.id).then(result => {
            if (result.success && result.data) {
                _prefsCache.data = result.data;
                setPrefs(result.data);

                // ✅ Sync ke localStorage untuk akses sinkron
                // (theme, sidebar, menu visibility dibaca sebelum React hydrate)
                try {
                    if (result.data.theme) {
                        localStorage.setItem('app-theme', result.data.theme);
                    }
                    if (result.data.sidebarCollapsed !== undefined) {
                        localStorage.setItem('sidebar-collapsed', JSON.stringify(result.data.sidebarCollapsed));
                    }
                    if (result.data.menuVisibility) {
                        localStorage.setItem('menuVisibility', JSON.stringify(result.data.menuVisibility));
                    }
                } catch {}
            }
            setIsLoading(false);
        }).catch(() => setIsLoading(false));
    }, [user?.id]);

    // ── Clear cache saat logout (listen event dari AuthContext) ───────────────
    // ✅ Penting: tanpa ini, saat user logout dan login dengan akun lain,
    // preferences user sebelumnya masih terbaca dari cache
    useEffect(() => {
        const handleLogout = () => {
            _prefsCache.data    = null;
            isFirstLoad.current = true; // ✅ Reset agar auto-save tidak skip
            setPrefs({});
        };
        window.addEventListener('user-logout', handleLogout);
        return () => window.removeEventListener('user-logout', handleLogout);
    }, []);

    // ── Auto-save ke DB saat prefs berubah (debounce 1.5 detik) ──────────────
    const debouncedPrefs = useDebounce(prefs, 1500);

    useEffect(() => {
        // ✅ Skip save saat pertama kali load dari DB
        if (isFirstLoad.current) {
            isFirstLoad.current = false;
            return;
        }
        if (!user?.id || _prefsCache.data === null) return;

        saveUserPreferences(user.id, debouncedPrefs)
            .then(result => {
                if (result.success) {
                    _prefsCache.data = debouncedPrefs;
                }
            })
            .catch(err => console.error('❌ Failed to save preferences:', err));
    }, [debouncedPrefs, user?.id]);

    // ── Update satu preference ────────────────────────────────────────────────
    const updatePref = useCallback(<K extends keyof UserPreferences>(
        key: K,
        value: UserPreferences[K]
    ) => {
        setPrefs(prev => {
            const next = { ...prev, [key]: value };
            _prefsCache.data = next;
            return next;
        });

        // ✅ Sync ke localStorage sesuai key untuk akses sinkron
        try {
            if (key === 'theme') {
                localStorage.setItem('app-theme', value as string);
            } else if (key === 'sidebarCollapsed') {
                localStorage.setItem('sidebar-collapsed', JSON.stringify(value));
            } else if (key === 'menuVisibility') {
                localStorage.setItem('menuVisibility', JSON.stringify(value));
            }
        } catch {}
    }, []);

    // ── Clear cache (dipanggil manual saat logout) ────────────────────────────
    // ✅ Reset isFirstLoad agar setelah login ulang, fetch dan save berjalan normal
    const clearPrefsCache = useCallback(() => {
        _prefsCache.data    = null;
        isFirstLoad.current = true;
        setPrefs({});
    }, []);

    return { prefs, updatePref, isLoading, clearPrefsCache };
}