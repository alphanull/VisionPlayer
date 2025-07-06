/**
 * Custom Vite plugin which cleans up unessecary .map files and their references.
 * @returns {Object} The Vite plugin.
 * @author  Frank Kudermann - alphanull
 * @version 1.0.0
 * @license MIT
 */
export default function cleanupMaps() {
    return {
        name: 'cleanup-maps',
        apply: 'build',
        enforce: 'post',
        generateBundle(_, bundle) {

            for (const [fileName, asset] of Object.entries(bundle)) {

                if (fileName.endsWith('.js.map') && !fileName.endsWith('.mjs.map')) {
                    delete bundle[fileName];
                    continue;
                }

                if (fileName.endsWith('.js') // Worker/IIFE/Chunks
                  && !fileName.endsWith('.mjs')
                  && asset.type === 'chunk') {
                    asset.code = asset.code.replace(/\n?\/\/# sourceMappingURL=.*?$/s, '');
                    asset.map = null;
                }
            }
        }
    };
}
