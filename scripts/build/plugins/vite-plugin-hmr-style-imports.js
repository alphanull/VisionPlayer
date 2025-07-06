/**
 * Vite plugin to auto-generate and hot-update all SCSS/CSS style imports for VisionPlayer.
 * This plugin tracks all `?inline`-imported SCSS/CSS files, generates a virtual module,
 * and sets up HMR handlers so style updates can be propagated to the Player at runtime.
 * @returns {Object} The Vite plugin.
 * @author  Frank Kudermann - alphanull
 * @version 1.0.0
 * @license MIT
 */
export default function hmrStyleImportsPlugin() {

    // Holds the current list of all discovered style modules (urls)
    let lastModuleList = [];
    let pendingInvalidation = false;

    return {

        name: 'vite-plugin-hmr-style-imports',
        apply: 'serve', // Only in dev mode

        /**
         * Vite hook to resolve the special virtual module id.
         * @param   {string}      id  The module id being resolved. For the virtual module, this is '/@hmr-style-imports'.
         * @returns {string|void}     Returns the same id if it matches, so Vite will treat it as a resolved virtual module.
         */
        resolveId(id) {
            // The client will import '/@hmr-style-imports'
            if (id === '/@hmr-style-imports') return id;
        },

        /**
         * Generates the contents of the virtual module '/@hmr-style-imports'.
         * @param   {string}                      id  The id of the module being loaded. For this virtual module, it will always be '/@hmr-style-imports'.
         * @returns {Promise<string>|string|void}     Returns the source code for the virtual module as a string, or a Promise resolving to that string. If the id does not match, returns undefined so that other plugins or Vite's default handling can take over.
         */
        load(id) {

            if (id === '/@hmr-style-imports') {

                /**
                 * Normalizes a SCSS/CSS import URL so that imports always use the same canonical format,
                 * regardless of the order or presence of query parameters.
                 * This ensures that both `/foo/bar.scss?inline&t=...` and `/foo/bar.scss?t=...&inline`
                 * are consistently reduced to `/foo/bar.scss?inline`. Non-matching URLs are returned unchanged.
                 * @param   {string} url  The URL of the imported SCSS or CSS file (potentially with query params).
                 * @returns {string}      The normalized URL, containing only the `.scss` or `.css` path and `?inline` query if present.
                 */
                function normalizeScssImport(url) {
                    // Keeps only .scss/.css?inline (order agnostic)
                    const m = url.match(/^(.+?\.(?:s?css))(\?.*inline)?/);
                    if (!m) return url;
                    return m[1] + (m[2] || '?inline');
                }

                const normalizedUrls = lastModuleList.map(normalizeScssImport);

                return `
                    // AUTO-GENERATED HMR STYLE IMPORTS (virtual)
                    import Player from "/src/core/Player.js";
                    // Import each SCSS/CSS as a Vite module for HMR tracking
                    ${normalizedUrls.map(url => `import "${url}";`).join('\n')}
                    // List of all style module URLs
                    const urls = ${JSON.stringify(normalizedUrls)};
                    if (import.meta.hot) {
                        import.meta.hot.accept(${JSON.stringify(normalizedUrls)}, newModules => {
                            // Gather updates for the Player
                            const updates = [];
                            newModules.forEach((newModule, index) => {
                                if (newModule) updates.push({ key: urls[index], css: newModule.default });
                            });
                            // Propagate to the Player, which should update styles live
                            Player.updateStyles(updates);
                        });
                    }
                `;
            }

        },

        /**
         * Called by Vite when the dev server starts.
         * Attaches a watcher for all file changes and updates the style module list as needed,
         * ensuring that the virtual style import module always reflects the current SCSS/CSS landscape.
         * @param {Object} server  The Vite development server instance, providing access to the module graph and server events.
         */
        configureServer(server) {

            /**
             * Scans all modules for .scss/.css?inline, updates the list, and triggers invalidation.
             */
            function updateModuleList() {
                // Get all modules from the server's module graph
                const allModules = Array.from(server.moduleGraph.urlToModuleMap.values());
                // Find style modules (excluding node_modules)
                const styleModules = allModules
                    .filter(m => m.url
                      && (m.url.endsWith('.scss?inline') || m.url.endsWith('.css?inline'))
                      && m.url.indexOf('node_modules') === -1
                    )
                    .map(m => m.url);

                // Only invalidate if changed (avoids unnecessary triggers)
                if (JSON.stringify(styleModules) !== JSON.stringify(lastModuleList)) {
                    lastModuleList = styleModules;
                    tryInvalidate();
                }
            }

            /**
             * Attempts to invalidate the virtual module so it is reloaded.
             * If not yet present, retries after 500ms.
             */
            function tryInvalidate() {
                const mod = server.moduleGraph.getModuleById('/@hmr-style-imports');
                if (mod) {
                    server.moduleGraph.invalidateModule(mod);
                    pendingInvalidation = false;
                } else if (!pendingInvalidation) {
                    // Not yet loaded? Try again later.
                    pendingInvalidation = true;
                    setTimeout(() => {
                        pendingInvalidation = false;
                        tryInvalidate();
                    }, 500);
                }
            }

            server.watcher.on('all', updateModuleList); // Watch ALL file changes (adds/removes/renames)
            setTimeout(updateModuleList, 2000); // Initial scan after server boots

        }
    };
}
