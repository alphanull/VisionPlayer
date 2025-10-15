/**
 * Secure Build entry point for VisionPlayer.
 * This build enables the strictest security measures:
 * - Enforces ES2022 target (controlled in vite.config.js, no transpilation for legacy environments).
 * - Shadow DOM is always enabled in closed mode, preventing all external access to internals.
 * - Secure mode is enforced, so critical APIs and internal components are fully protected.
 * - Once these security defaults are set, they cannot be reverted at runtime.
 * - Disables all public mutator APIs for extending or altering the player instance (`setApi`, `removeApi`, `addComponent`, `setDefaultConfig`).
 * - The Player object is sealed, prohibiting further extension or reconfiguration.
 * - No subtitle HTML handling allowed, makes the player 100% XSS safe, since all text content is set via text nodes, including translations.
 * @exports module:src/builds/VisionPlayer-secure
 * @author   Frank Kudermann - alphanull
 * @version  1.1.1
 * @license  MIT
 */

// import default player and extend it.
import Player from './VisionPlayer.js';
export default Player;

// add specific security default settings, those can't be changed later!
Player.setDefaultConfig({
    player: { secureApi: true },
    dom: { shadow: 'closed' },
    subtitles: { allowHTML: 'none' }
});

// remove incompatible components
Player.removeComponent('ui.controller.chromeCast');

// remove potentially compromising APIs and lock down player configuration
delete Player.setApi;
delete Player.removeApi;
delete Player.addComponent;
delete Player.removeComponent;
delete Player.setDefaultConfig;
delete Player.addLocale;
delete Player.setLocaleConfig;
delete Player.addStyle;

if (!import.meta.hot) delete Player.updateStyles;

// Finally, freeze Player Object and prototype to prevent any tampering.
Object.freeze(Player);
Object.freeze(Player.prototype);
