/**
 * Vite plugin for custom HMR logic for VisionPlayer. Handles two main tasks:
 * 1. Forces a full reload for JS/TS/Vue/JSON files, ensuring app-wide updates.
 * 2. Triggers standard HMR for CSS/SCSS file changes, allowing hot style updates.
 * @returns {Object} The Vite plugin.
 * @author  Frank Kudermann - alphanull
 * @version 1.0.0
 * @license MIT
 */
export default function visionPlayerHmrPlugin() {

    return {
        name: 'vite-plugin-custom-hmr',

        /**
         * Custom HMR handler.
         * @param   {Object} ctx  Vite HMR context.
         * @returns {Array}       Either modules pass through or empty array to disable HMR.
         */
        handleHotUpdate(ctx) {

            const { file, server, modules } = ctx;

            // JS/TS/Vue/JSON files: always trigger full reload.
            if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.vue') || file.endsWith('.json')) {
                server.ws.send({ type: 'full-reload' });
                return []; // Returning [] disables Vite's HMR, forcing browser reload.
            }

            // Other files: just pass through.
            return modules;

        }
    };
}
