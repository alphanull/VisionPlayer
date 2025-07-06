/**
 * Custom Vite plugin to replace code patterns using regular expressions.
 * @param   {Array<{search: RegExp, replace: string}>} options  An array of replacement rules.
 * @returns {Object}                                            The Vite plugin.
 * @author  Frank Kudermann - alphanull
 * @version 1.0.0
 * @license MIT
 */
export default function replaceWithRegex(options = []) {
    return {
        name: 'vite-plugin-replace-with-regex',
        /**
         * The `transform` hook is called for each module.
         * @param   {string}                             code  The source code of the module.
         * @param   {string}                             id    The path of the module.
         * @returns {{ code: string, map: null } | null}       The transformed code and source map.
         */
        transform(code, id) {

            if (!options.length || !id.endsWith('.js')) return null;

            let modifiedCode = code;
            options.forEach(({ search, replace }) => {
                modifiedCode = modifiedCode.replace(search, replace);
            });

            return {
                code: modifiedCode,
                map: null
            };
        }
    };
}
