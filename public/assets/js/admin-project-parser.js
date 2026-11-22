/**
 * CSP-safe parser for public/assets/js/project-data.js.
 * Extracts the myProjects array literal without eval or dynamic code execution.
 */

const SIMPLE_ESCAPES = {
    '"': '"',
    "'": "'",
    '\\': '\\',
    '/': '/',
    b: '\b',
    f: '\f',
    n: '\n',
    r: '\r',
    t: '\t',
    v: '\v',
    '0': '\0'
};

function isDigit(ch) {
    return ch >= '0' && ch <= '9';
}

function isIdentStart(ch) {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$';
}

function isIdentPart(ch) {
    return isIdentStart(ch) || isDigit(ch);
}

/**
 * Parse the `myProjects` array literal out of a project-data.js source string.
 * @param {string} source
 * @returns {Array<object>}
 */
export function parseProjectDataSource(source) {
    if (typeof source !== 'string' || source.trim() === '') {
        throw new Error('Project data source must be a non-empty string.');
    }

    const len = source.length;
    let index = 0;

    function skipWhitespaceAndComments() {
        while (index < len) {
            const ch = source[index];
            if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v') {
                index++;
                continue;
            }
            if (ch === '/' && source[index + 1] === '/') {
                index += 2;
                while (index < len && source[index] !== '\n' && source[index] !== '\r') {
                    index++;
                }
                continue;
            }
            if (ch === '/' && source[index + 1] === '*') {
                const closeIdx = source.indexOf('*/', index + 2);
                if (closeIdx === -1) {
                    throw new SyntaxError(`Unterminated block comment at index ${index}`);
                }
                index = closeIdx + 2;
                continue;
            }
            break;
        }
    }

    function parseString() {
        const quote = source[index];
        const start = index;
        index++;
        let result = '';

        while (index < len) {
            const ch = source[index];
            if (ch === quote) {
                index++;
                return result;
            }
            if (ch === '\n' || ch === '\r') {
                throw new SyntaxError(`Unterminated string literal starting at index ${start}`);
            }
            if (ch === '\\') {
                index++;
                if (index >= len) {
                    throw new SyntaxError(`Unterminated escape sequence at index ${index}`);
                }
                const esc = source[index];
                if (esc === '\r') {
                    index += source[index + 1] === '\n' ? 2 : 1;
                    continue;
                }
                if (esc === '\n') {
                    index++;
                    continue;
                }
                if (esc === 'u') {
                    if (source[index + 1] === '{') {
                        const closeBrace = source.indexOf('}', index + 2);
                        if (closeBrace === -1) {
                            throw new SyntaxError(`Invalid Unicode escape at index ${index}`);
                        }
                        const hex = source.slice(index + 2, closeBrace);
                        const codePoint = Number.parseInt(hex, 16);
                        if (!/^[0-9a-fA-F]+$/.test(hex) || Number.isNaN(codePoint) || codePoint > 0x10ffff) {
                            throw new SyntaxError(`Invalid Unicode escape at index ${index}`);
                        }
                        result += String.fromCodePoint(codePoint);
                        index = closeBrace + 1;
                        continue;
                    }
                    const hex = source.slice(index + 1, index + 5);
                    if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
                        throw new SyntaxError(`Invalid Unicode escape at index ${index}`);
                    }
                    result += String.fromCharCode(Number.parseInt(hex, 16));
                    index += 5;
                    continue;
                }
                if (esc === 'x') {
                    const hex = source.slice(index + 1, index + 3);
                    if (!/^[0-9a-fA-F]{2}$/.test(hex)) {
                        throw new SyntaxError(`Invalid hex escape at index ${index}`);
                    }
                    result += String.fromCharCode(Number.parseInt(hex, 16));
                    index += 3;
                    continue;
                }
                if (Object.hasOwn(SIMPLE_ESCAPES, esc)) {
                    result += SIMPLE_ESCAPES[esc];
                } else {
                    result += esc;
                }
                index++;
                continue;
            }
            result += ch;
            index++;
        }

        throw new SyntaxError(`Unterminated string literal starting at index ${start}`);
    }

    function parseNumber() {
        const numberRegex = /-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
        numberRegex.lastIndex = index;
        const match = numberRegex.exec(source);
        if (!match) {
            throw new SyntaxError(`Invalid number at index ${index}`);
        }
        index = numberRegex.lastIndex;
        if (index < len && isIdentPart(source[index])) {
            throw new SyntaxError(`Unexpected character '${source[index]}' after number at index ${index}`);
        }
        return Number(match[0]);
    }

    function parseIdentifier() {
        const start = index;
        if (index < len && isIdentStart(source[index])) {
            index++;
            while (index < len && isIdentPart(source[index])) {
                index++;
            }
            return source.slice(start, index);
        }
        throw new SyntaxError(`Expected property name at index ${index}`);
    }

    function parseArray() {
        index++; // consume '['
        const arr = [];
        while (index < len) {
            skipWhitespaceAndComments();
            if (source[index] === ']') {
                index++;
                return arr;
            }
            arr.push(parseValue());
            skipWhitespaceAndComments();
            if (source[index] === ',') {
                index++;
                continue;
            }
            if (source[index] === ']') {
                continue;
            }
            throw new SyntaxError(`Expected ',' or ']' at index ${index}`);
        }
        throw new SyntaxError('Unterminated array literal.');
    }

    function parseObject() {
        index++; // consume '{'
        const obj = {};
        while (index < len) {
            skipWhitespaceAndComments();
            if (source[index] === '}') {
                index++;
                return obj;
            }
            const ch = source[index];
            const key = (ch === '"' || ch === "'") ? parseString() : parseIdentifier();
            skipWhitespaceAndComments();
            if (source[index] !== ':') {
                throw new SyntaxError(`Expected ':' after key '${key}' at index ${index}`);
            }
            index++;
            obj[key] = parseValue();
            skipWhitespaceAndComments();
            if (source[index] === ',') {
                index++;
                continue;
            }
            if (source[index] === '}') {
                continue;
            }
            throw new SyntaxError(`Expected ',' or '}' at index ${index}`);
        }
        throw new SyntaxError('Unterminated object literal.');
    }

    function parseValue() {
        skipWhitespaceAndComments();
        if (index >= len) {
            throw new SyntaxError(`Unexpected end of input at index ${index}`);
        }
        const ch = source[index];
        if (ch === '[') return parseArray();
        if (ch === '{') return parseObject();
        if (ch === '"' || ch === "'") return parseString();
        if (ch === '-' || isDigit(ch) || (ch === '.' && isDigit(source[index + 1] || ''))) {
            return parseNumber();
        }
        if (source.startsWith('true', index) && !isIdentPart(source[index + 4] || '')) {
            index += 4;
            return true;
        }
        if (source.startsWith('false', index) && !isIdentPart(source[index + 5] || '')) {
            index += 5;
            return false;
        }
        if (source.startsWith('null', index) && !isIdentPart(source[index + 4] || '')) {
            index += 4;
            return null;
        }
        throw new SyntaxError(`Unexpected token '${ch}' at index ${index}`);
    }

    const declRegex = /(?:export\s+)?(?:const|let|var)\s+myProjects\s*=/y;
    while (index < len) {
        skipWhitespaceAndComments();
        if (index >= len) break;

        declRegex.lastIndex = index;
        const match = declRegex.exec(source);
        if (match) {
            index = declRegex.lastIndex;
            skipWhitespaceAndComments();
            if (source[index] !== '[') {
                throw new SyntaxError(`Expected '[' after 'myProjects =' at index ${index}`);
            }
            const parsed = parseArray();
            if (!Array.isArray(parsed)) {
                throw new Error('Parsed myProjects value is not an array.');
            }
            return parsed;
        }

        const ch = source[index];
        if (ch === '"' || ch === "'") {
            parseString();
        } else {
            index++;
        }
    }

    throw new Error('Could not find myProjects array in project data source.');
}
