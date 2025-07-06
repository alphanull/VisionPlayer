/**
 * Minimal headless build of VisionPlayer. This is the entry point if you create a new VisionPlayer.
 * This build does not include any UI components, just the core functionalities like media and data handling,
 * but still provides core player API and events for external control.
 * Also acts as a starting point for all further builds which extend on this one.
 * @exports module:src/builds/VisionPlayer-headless
 * @requires src/core/Media
 * @requires src/core/Data
 * @requires src/core/Player
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */

// enable vite HMR
import '/@hmr-style-imports';
import.meta.hot?.accept(() => {});

import Player from '../core/Player.js';
export default Player;

// add minimum core components

import Dom from '../core/Dom.js';
Player.addComponent('dom', Dom);

import Data from '../core/Data.js';
Player.addComponent('data', Data);

import Media from '../core/Media.js';
Player.addComponent('media', Media);

// add minimum core styles

import coreStyles from '../../assets/scss/core/player.scss?inline';
Player.addStyles('../../assets/scss/core/player.scss?inline', coreStyles);
