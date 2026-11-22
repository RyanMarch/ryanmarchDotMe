// Runs the per-project embed/image scan and remembers the result for a few minutes,
// so Embeds and Media can share one pass over the site.
import { api } from './util.js';

const KEY = 'admin_scan_v1';
const TTL_MS = 10 * 60 * 1000;

export function cachedScan() {
    try {
        const hit = JSON.parse(sessionStorage.getItem(KEY) || 'null');
        return hit && Date.now() - hit.at < TTL_MS ? hit : null;
    } catch { return null; }
}

export async function scanAll(projects, onProgress = () => {}) {
    const queue = projects.filter(p => p.hasExtendedContent).map(p => p.id);
    const total = queue.length;
    const scans = [];
    let failed = 0;
    const run = async () => {
        while (queue.length) {
            const id = queue.shift();
            const res = await api(`/api/admin/scan?project=${encodeURIComponent(id)}`);
            if (res.ok) scans.push(res.body); else failed += 1;
            onProgress(total - queue.length, total);
        }
    };
    await Promise.all([run(), run(), run(), run()]);
    const result = { at: Date.now(), scans, failed, total };
    try { sessionStorage.setItem(KEY, JSON.stringify(result)); } catch { /* storage full or private mode */ }
    return result;
}
