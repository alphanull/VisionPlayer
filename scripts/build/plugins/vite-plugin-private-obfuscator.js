/* eslint-disable max-lines-per-function */

/**
 * Vite plugin to obfuscate private fields (#private) with simple sequential naming.
 * Uses Acorn AST parsing for robust detection of private fields in all JavaScript contexts.
 * This plugin transforms private class fields and methods to public fields with obfuscated names,
 * effectively removing the WeakMap/WeakSet overhead that Babel/TypeScript generates for private fields.
 * Transforms:
 * #privateField → _a
 * #anotherField → _b
 * #thirdField → _c
 * etc.
 * Features:
 * - Deterministic naming across builds
 * - Conflict-free name generation
 * - Source map support for debugging
 * - Handles private fields, methods, and field access.
 * @returns {Object} The Vite plugin configuration.
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
import * as acorn from 'acorn';

/**
 * Creates a Vite plugin that obfuscates private class fields and methods.
 * The plugin works by:
 * 1. Parsing JavaScript files with Acorn to detect private fields
 * 2. Generating sequential obfuscated names (_a, _b, _c, etc.)
 * 3. Replacing all private field references with obfuscated names
 * 4. Generating source maps for debugging.
 * @returns {Object} Vite plugin configuration object.
 */
export default function privateObfuscator() {
    /** Counter for generating sequential obfuscated names. */
    let privateCounter = 0;

    /**
     * Generates sequential obfuscated names: a, b, c, ..., z, aa, ab, ac, ...
     * Uses base-26 encoding to create short, readable names.
     * @returns {string} Obfuscated name with underscore prefix (e.g., "_a", "_b", "_aa").
     */
    function generateObfuscatedName() {
        const chars = 'abcdefghijklmnopqrstuvwxyz';
        let name = '';
        let num = privateCounter;
        privateCounter += 1;

        // Generate names like: a, b, c, ..., z, aa, ab, ac, ...
        do {
            name = chars[num % 26] + name;
            num = Math.floor(num / 26);
        } while (num > 0);

        return `_${name}`;
    }

    /**
     * Finds all private fields in the AST and creates a mapping to obfuscated names.
     * Detects private field declarations, private methods, and private field access.
     * @param   {Object}              ast  The parsed AST object.
     * @returns {Map<string, string>}      Mapping of original private field names to obfuscated names.
     */
    function findPrivateFields(ast) {
        const privateFieldMap = new Map();

        /**
         * Recursively traverses AST nodes to find all private fields and methods.
         * @param {Object} node  The current AST node to process.
         */
        function traverse(node) {
            if (!node) return;

            // Private field declarations in class (e.g., #field = value)
            if (node.type === 'PropertyDefinition' && node.key && node.key.type === 'PrivateIdentifier') {
                const originalName = node.key.name;
                if (!privateFieldMap.has(originalName)) {
                    privateFieldMap.set(originalName, generateObfuscatedName());
                }
            }

            // Private field access (e.g., this.#field)
            if (node.type === 'MemberExpression'
              && node.property
              && node.property.type === 'PrivateIdentifier') {
                const originalName = node.property.name;
                if (!privateFieldMap.has(originalName)) {
                    privateFieldMap.set(originalName, generateObfuscatedName());
                }
            }

            // Private method definitions (e.g., #method() {})
            if (node.type === 'MethodDefinition'
              && node.key
              && node.key.type === 'PrivateIdentifier') {
                const originalName = node.key.name;
                if (!privateFieldMap.has(originalName)) {
                    privateFieldMap.set(originalName, generateObfuscatedName());
                }
            }

            // Recursively traverse all child nodes
            for (const key in node) {
                if (node[key] && typeof node[key] === 'object') {
                    if (Array.isArray(node[key])) {
                        node[key].forEach(child => traverse(child));
                    } else {
                        traverse(node[key]);
                    }
                }
            }
        }

        traverse(ast);
        return privateFieldMap;
    }

    /**
     * Transforms the code by replacing private fields with obfuscated names.
     * Uses AST-based replacement to ensure only actual private field accesses are replaced,
     * not strings, comments, or other contexts containing # symbols.
     * @param   {string}              code             Original source code as string.
     * @param   {Map<string, string>} privateFieldMap  Mapping of original to obfuscated names.
     * @returns {string}                               Transformed code with obfuscated names.
     */
    function transformCode(code, privateFieldMap) {
        if (privateFieldMap.size === 0) {
            return code;
        }

        // Parse the code to get AST for precise replacement
        const ast = acorn.parse(code, {
            ecmaVersion: 2022,
            sourceType: 'module',
            allowAwaitOutsideFunction: true,
            allowImportExportEverywhere: true,
            locations: true // Enable location tracking
        });

        // Collect all replacement positions
        const replacements = [];

        /**
         * Recursively traverse AST to find all private field accesses that need replacement.
         * @param {Object} node  The current AST node to process.
         */
        function collectReplacements(node) {
            if (!node) return;

            // Private field access (e.g., this.#field)
            if (node.type === 'MemberExpression'
              && node.property
              && node.property.type === 'PrivateIdentifier') {
                const originalName = node.property.name;
                const obfuscatedName = privateFieldMap.get(originalName);

                if (obfuscatedName && node.property.loc) {
                    replacements.push({
                        start: node.property.start,
                        end: node.property.end,
                        original: `#${originalName}`,
                        replacement: obfuscatedName
                    });
                }
            }

            // Private field declarations in class (e.g., #field = value)
            if (node.type === 'PropertyDefinition' && node.key && node.key.type === 'PrivateIdentifier') {
                const originalName = node.key.name;
                const obfuscatedName = privateFieldMap.get(originalName);

                if (obfuscatedName && node.key.loc) {
                    replacements.push({
                        start: node.key.start,
                        end: node.key.end,
                        original: `#${originalName}`,
                        replacement: obfuscatedName
                    });
                }
            }

            // Private method definitions (e.g., #method() {})
            if (node.type === 'MethodDefinition'
              && node.key
              && node.key.type === 'PrivateIdentifier') {
                const originalName = node.key.name;
                const obfuscatedName = privateFieldMap.get(originalName);

                if (obfuscatedName && node.key.loc) {
                    replacements.push({
                        start: node.key.start,
                        end: node.key.end,
                        original: `#${originalName}`,
                        replacement: obfuscatedName
                    });
                }
            }

            // Recursively traverse all child nodes
            for (const key in node) {
                if (node[key] && typeof node[key] === 'object') {
                    if (Array.isArray(node[key])) {
                        node[key].forEach(child => collectReplacements(child));
                    } else {
                        collectReplacements(node[key]);
                    }
                }
            }
        }

        collectReplacements(ast);

        // Sort replacements by position (descending) to avoid offset issues
        replacements.sort((a, b) => b.start - a.start);

        // Apply replacements from end to beginning to maintain correct positions
        let transformedCode = code;
        for (const replacement of replacements) {
            const before = transformedCode.substring(0, replacement.start);
            const after = transformedCode.substring(replacement.end);
            transformedCode = before + replacement.replacement + after;
        }

        return transformedCode;
    }

    return {
        name: 'private-obfuscator',

        /**
         * Vite transform hook that processes JavaScript files.
         * Parses the code, finds private fields, and transforms them to obfuscated names.
         * @param   {string}      code  The source code to transform.
         * @param   {string}      id    The file ID/path.
         * @param   {Object}      map   The source map for the original code (optional).
         * @returns {Object|null}       Transformed code with source map, or null if no changes.
         */
        transform(code, id, map, xxx) {
            // Only transform JavaScript files
            if (!id.endsWith('.js') && !id.endsWith('.mjs')) {
                return null;
            }

            // Skip node_modules and other external files
            if (id.includes('node_modules') || id.includes('dist')) {
                return null;
            }

            try {
                // Find all private fields and create mapping
                const privateFieldMap = findPrivateFields(acorn.parse(code, {
                    ecmaVersion: 2022,
                    sourceType: 'module',
                    allowAwaitOutsideFunction: true,
                    allowImportExportEverywhere: true
                }));

                // If no private fields found, return null
                if (privateFieldMap.size === 0) {
                    return null;
                }

                // Transform the code
                const transformedCode = transformCode(code, privateFieldMap);

                // If no transformations were made, return null
                if (transformedCode === code) {
                    return null;
                }

                const sourcemap = this?.getCombinedSourcemap();

                return {
                    code: transformedCode,
                    map: sourcemap || null
                };

            } catch (error) {
                // eslint-disable-next-line no-console
                console.warn(`[private-obfuscator] Failed to parse ${id}:`, error.message);
                return null;
            }
        }
    };
}
