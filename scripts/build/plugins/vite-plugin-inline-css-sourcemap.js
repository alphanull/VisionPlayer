/* global Buffer */

/**
 * This plugin rewrites all JavaScript modules that import CSS/SCSS files
 * using `?inline` to export their CSS as ES6 template literals **including**
 * any present sourceMappingURL. This solves issues with quotes, SVG URLs,
 * and allows correct inline sourcemaps for HMR or dev environments.
 * @returns {Object} The Vite plugin.
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default function inlineCssTemplate() {
    return {
        name: 'vite-plugin-inline-css-sourcemap',
        /**
         * Runs only in dev-server, not in build.
         * Intercepts all JS modules importing *.css?inline or *.scss?inline,
         * and converts export default "..."; with mapping-comment appended.
         * @param {Object} server  The Vite development server instance, providing access to the module graph and server events.
         */
        configureServer(server) {

            server.middlewares.use((req, res, next) => {

                if (req.url && /\.(s?css)\?.*inline\b/.test(req.url)) {

                    const chunks = [],
                          originalWrite = res.write,
                          originalEnd = res.end;

                    res.write = function(chunk) {
                        chunks.push(Buffer.from(chunk));
                    };

                    res.end = function(chunk) {

                        if (chunk) chunks.push(Buffer.from(chunk));
                        let body = Buffer.concat(chunks).toString();

                        // Match: export default "...."\n//# sourceMappingURL=...
                        const exportDefault = body.match(/^export default "(.*)"[\r\n]*\/\/# sourceMappingURL=([^\n]*)/s);

                        if (exportDefault) {

                            const cssContent = exportDefault[1],
                                  sourceMap = exportDefault[2];

                            // Rewrite including mapping comment
                            // eslint-disable-next-line prefer-template
                            body = 'export default `' + cssContent + '/*# sourceMappingURL=' + sourceMap + '*/`;';

                        }

                        res.setHeader('content-length', Buffer.byteLength(body));
                        originalWrite.call(res, body);
                        originalEnd.call(res);

                    };
                }

                next();

            });
        }
    };
}
