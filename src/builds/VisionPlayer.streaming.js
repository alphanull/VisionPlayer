/* eslint-disable jsdoc/no-undefined-types */

/**
 * VisionPlayer streaming build. This is the entry point if you create a new VisionPlayer.
 * This entry point extends the base VisionPlayer by showing how to incorporate the streaming libs in the build itself.
 * Note that this is just an example and **not** included in `/dist` and the npm package, as usually it is preferred to load the libs externally.
 * @exports module:src/builds/VisionPlayer-streaming
 * @requires src/builds/VisionPlayer
 * @requires dashjs
 * @requires hls.js
 * @author   Frank Kudermann - alphanull
 * @version  1.0.1
 * @license  MIT
 */

// Include streaming 3rd party libraries directly in the build file. This assumes you have included them as a npm dependency.
import 'dashjs';
import Hls from 'hls.js';
window.Hls = Hls;

// import default player and extend it.
import Player from './VisionPlayer.js';
export default Player;
