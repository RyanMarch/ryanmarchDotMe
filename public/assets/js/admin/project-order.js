// Reorders the project objects inside project-data.js without touching their text.
// Pure string work so it can be tested; the caller verifies the result re-parses.

/** Finds the top-level `{ ... }` blocks of the myProjects array: [{ id, start, end }]. */
export function findProjectBlocks(source) {
    const open = source.search(/export\s+const\s+myProjects\s*=\s*\[/);
    if (open === -1) throw new Error('Could not find the myProjects array.');
    let i = source.indexOf('[', open) + 1;
    const blocks = [];
    let depth = 0;
    let start = -1;
    let quote = null;

    for (; i < source.length; i++) {
        const ch = source[i];
        const next = source[i + 1];
        if (quote) {
            if (ch === '\\') i++;
            else if (ch === quote) quote = null;
            continue;
        }
        if (ch === '/' && next === '/') { i = source.indexOf('\n', i); if (i === -1) break; continue; }
        if (ch === '/' && next === '*') { i = source.indexOf('*/', i + 2) + 1; if (i === 0) break; continue; }
        if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
        if (ch === '{' || ch === '[') {
            if (depth === 0 && ch === '{') start = i;
            depth++;
        } else if (ch === '}' || ch === ']') {
            if (depth === 0 && ch === ']') break; // end of the array
            depth--;
            if (depth === 0 && ch === '}') {
                const text = source.slice(start, i + 1);
                const id = text.match(/\bid\s*:\s*["']([^"']+)["']/)?.[1];
                blocks.push({ id, start, end: i + 1 });
            }
        }
    }
    if (blocks.some(b => !b.id)) throw new Error('A project block has no id.');
    return blocks;
}

/** Returns the source with its project blocks rearranged to `order` (array of ids). */
export function reorderProjects(source, order) {
    const blocks = findProjectBlocks(source);
    const ids = blocks.map(b => b.id);
    if (order.length !== ids.length || new Set(order).size !== order.length || !order.every(id => ids.includes(id))) {
        throw new Error('The new order must contain every project exactly once.');
    }
    const byId = new Map(blocks.map(b => [b.id, source.slice(b.start, b.end)]));
    // Keep the original gaps (commas, blank lines, comments) in place; swap only the blocks.
    let out = '';
    let cursor = 0;
    blocks.forEach((b, idx) => {
        out += source.slice(cursor, b.start) + byId.get(order[idx]);
        cursor = b.end;
    });
    return out + source.slice(cursor);
}
