/**
 * lib/dashboard-cache.ts
 *
 * In-process server-side cache untuk dashboard data.
 *
 * Aturan cache:
 * ┌───────────────────────────────────────────────────────────────┐
 * │ Tahun LAMA (< tahun berjalan)                                 │
 * │   → disimpan PERMANEN di cache (tidak ada TTL)                │
 * │   → HANYA dibuang jika user klik "Refresh Data"               │
 * │   → Alasan: data 2024, 2025 dst tidak pernah berubah          │
 * ├───────────────────────────────────────────────────────────────┤
 * │ Tahun BERJALAN (= tahun sekarang)                             │
 * │   → TTL 5 menit (auto expire)                                 │
 * │   → juga dibuang saat user klik "Refresh Data"                │
 * │   → Alasan: ada ~20-30 row baru per hari                      │
 * └───────────────────────────────────────────────────────────────┘
 *
 * Filter hash:
 *   Cache key = year + hash(categories, clients, modules, detailModules)
 *   Artinya: filter berbeda = cache entry berbeda.
 *   Kalau user ganti filter → cache miss → fetch DB → simpan cache baru.
 *   Kalau filter sama, tahun lama → langsung dari cache, 0 DB query.
 */

const CURRENT_YEAR = new Date().getFullYear();

// TTL untuk tahun berjalan: 5 menit
const TTL_CURRENT_YEAR_MS = 5 * 60 * 1000;

type CacheEntry = {
    data: any;
    /**
     * expiresAt = null  → permanent (data historical, tidak ada expiry)
     * expiresAt = number → unix ms timestamp (data tahun berjalan)
     */
    expiresAt: number | null;
};

// Store tunggal untuk seluruh app (server process)
const _store = new Map<string, CacheEntry>();

// ─────────────────────────────────────────────────────────────────────────────
// Public helpers
// ─────────────────────────────────────────────────────────────────────────────

export function isHistoricalYear(year: number): boolean {
    return year < CURRENT_YEAR;
}

export function buildKey(year: number, filterHash: string): string {
    return `dash:${year}:${filterHash}`;
}

/** Ambil data dari cache. Return null jika miss atau expired. */
export function cacheGet<T>(year: number, filterHash: string): T | null {
    const key = buildKey(year, filterHash);
    const entry = _store.get(key);
    if (!entry) return null;

    // Historical: permanent, tidak pernah expired
    if (entry.expiresAt === null) return entry.data as T;

    // Current year: cek TTL
    if (Date.now() > entry.expiresAt) {
        _store.delete(key);
        return null;
    }
    return entry.data as T;
}

/** Simpan data ke cache dengan TTL sesuai tipe tahun. */
export function cacheSet(year: number, filterHash: string, data: any): void {
    const key = buildKey(year, filterHash);
    _store.set(key, {
        data,
        expiresAt: isHistoricalYear(year)
            ? null                                     // permanent untuk historical
            : Date.now() + TTL_CURRENT_YEAR_MS,        // 5 menit untuk current year
    });
}

/**
 * Invalidate cache.
 *
 * @param force
 *   false (default) — hanya hapus cache tahun berjalan.
 *                     Data lama TETAP di cache.
 *                     Dipakai saat user refresh biasa / ada data baru masuk.
 *
 *   true            — hapus SEMUA cache termasuk historical.
 *                     Dipakai kalau user edit/hapus/impor ulang data lama.
 */
export function cacheInvalidate(force = false): { cleared: number } {
    if (force) {
        const total = _store.size;
        _store.clear();
        console.log(`🗑️  [Cache] Force-cleared all ${total} entries`);
        return { cleared: total };
    }

    // Hanya hapus entries untuk tahun berjalan
    let count = 0;
    for (const key of _store.keys()) {
        if (key.includes(`:${CURRENT_YEAR}:`)) {
            _store.delete(key);
            count++;
        }
    }
    console.log(`🗑️  [Cache] Cleared ${count} entries for year=${CURRENT_YEAR}`);
    return { cleared: count };
}

/**
 * Hash sederhana (djb2) dari kombinasi filter → dipakai sebagai bagian cache key.
 * Setiap kombinasi filter unik akan punya cache entry sendiri.
 */
export function hashFilters(f: {
    categories: string[];
    clients: string[];
    modules: string[];
    detailModules: string[];
}): string {
    const str = [
        [...f.categories].sort().join(','),
        [...f.clients].sort().join(','),
        [...f.modules].sort().join(','),
        [...f.detailModules].sort().join(','),
    ].join('|');

    let h = 5381;
    for (let i = 0; i < str.length; i++) {
        h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
    }
    return h.toString(36);
}

/** Debug info: ringkasan isi cache saat ini. */
export function cacheInfo(): {
    total: number;
    historical: number;
    currentYear: number;
} {
    let historical = 0, currentYear = 0;
    for (const entry of _store.values()) {
        if (entry.expiresAt === null) historical++;
        else currentYear++;
    }
    return { total: _store.size, historical, currentYear };
}