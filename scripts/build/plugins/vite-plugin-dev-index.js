import { readFile } from 'fs/promises';

/**
 * Vite plugin to serve a custom "index.dev.html" instead of "index.html" during local development.
 * Has no effect in production builds. Useful for private testing/demo setups.
 * @param   {boolean} isDev  If true, serve alternate page as index.html.
 * @returns {Object}         The Vite plugin.
 * @author  Frank Kudermann - alphanull
 * @version 1.0.0
 * @license MIT
 */
export default function indexHtmlDevPlugin(isDev) {

    return {

        name: 'vite-plugin-dev-index',
        enforce: 'pre',

        transformIndexHtml: async(html, ctx) => {
            if (!isDev) return;
            if (!ctx || !ctx.path) return;
            if (ctx.path === '/' || ctx.path === '/index.html') {
                return await readFile('index.dev.html', 'utf8');
            }
        }
    };
}
