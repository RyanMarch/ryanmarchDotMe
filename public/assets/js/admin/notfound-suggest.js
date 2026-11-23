// Guesses where a broken address should redirect to. Pure, so it can be tested.

/** Edit distance between two short strings. */
export function distance(a, b) {
    const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        let diag = prev[0];
        prev[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const keep = prev[j];
            prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
            diag = keep;
        }
    }
    return prev[b.length];
}

/** The closest project id to a word, if it is close enough to be a typo or an old spelling. */
function closestProject(word, projects) {
    const w = word.toLowerCase();
    let best = null;
    for (const p of projects) {
        const id = p.id.toLowerCase();
        const d = id === w ? 0 : distance(w, id);
        if (d <= Math.max(2, Math.floor(id.length / 4)) && (!best || d < best.d)) best = { id: p.id, d };
    }
    return best?.id || null;
}

/**
 * "/project/ledgr" → "/project/ledger/". Looks at published projects with a write-up. Returns '' when there is no good guess.
 */
export function suggestDestination(path, projects = []) {
    const live = projects.filter(p => p.hasExtendedContent && !p.unpublished);
    const parts = path.toLowerCase().split('/').filter(Boolean);
    if (!parts.length) return '/';
    const candidate = parts[0] === 'project' || parts[0] === 'projects' || parts[0] === 'portfolio' ? parts[1] : parts[parts.length - 1];
    if (!candidate) return '';
    const id = closestProject(candidate.replace(/\.html?$/, ''), live);
    return id ? `/project/${id}/` : '';
}
