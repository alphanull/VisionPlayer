import DomSmith from '../../lib/dom/DomSmith.js';
import Looper from '../../lib/util/Looper.js';

/**
 * Displays a small overlay with real-time FPS & video rendering stats inside the VisionPlayer UI.
 * @exports module:src/util/PerformanceMonitor
 * @requires lib/dom/DomSmith
 * @requires lib/util/Looper
 * @author Frank Kudermann - alphanull
 * @version 1.0.0
 * @license MIT
 */
export default class PerformanceMonitor {

    /**
     * Reference to the VisionPlayer instance.
     * @type {module:src/core/Player}
     */
    #player;

    /**
     * Secret key only known to the player instance and initialized components.
     * Used to be able to restrict access to API methods in conjunction with secure mode.
     * @type {symbol}
     */
    #apiKey;

    /**
     * Text line with latest dropped frame info.
     * @type {string}
     */
    #qualityInfo = '';

    /**
     * Previously recorded totalVideoFrames value.
     * @type {number}
     */
    #lastTotal = 0;

    /**
     * Previously recorded droppedVideoFrames value.
     * @type {number}
     */
    #lastDropped = 0;

    /**
     * DomSmith instance holding the floating stats overlay.
     * @type {module:lib/dom/DomSmith}
     */
    #dom;

    /**
     * Render Loop Instance, used for updating the scrubber.
     * @type {module:lib/util/Looper}
     */
    #renderLoop;

    /**
     * ID for the stats loop.
     * @type {number}
     */
    #statsInterval;

    /**
     * Creates an instance of the PerformanceMonitor component.
     * @param {module:src/core/Player} player            Reference to the VisionPlayer instance.
     * @param {module:src/core/Player} parent            Reference to the parent instance.
     * @param {Object}                 [options]         Additional options.
     * @param {symbol}                 [options.apiKey]  Token for extended access to the player API.
     */
    constructor(player, parent, { apiKey }) {

        if (!player.initConfig('performanceMonitor', true)) return [false];

        this.#player = player;
        this.#apiKey = apiKey;

        this.#dom = new DomSmith({
            class: 'vip-performance-monitor',
            _ref: 'container',
            style: `
                position: absolute;
                top: 0;
                left: 0;
                font-family: monospace;
                font-size: 12px;
                background: rgba(0,0,0,0.6);
                color: #0f0;
                padding: 4px 6px;
                pointer-events: none;
                z-index: 9999;
                line-height: 1.4;
                white-space: pre;
            `
        }, player.dom.getElement(apiKey));

        this.#renderLoop = new Looper(() => {});
        this.#renderLoop.start();
        this.#statsInterval = setInterval(this.#update, 1000);

    }

    /**
     * Update loop, runs every 1 second.
     * Updates FPS and video quality stats (if supported).
     */
    #update = () => {

        // update FPS
        const fps = this.#renderLoop.getFPS();
        this.#dom.container.textContent = `FPS : ${fps}${this.#qualityInfo}`;

        // update dropped frames
        const video = this.#player.media.getElement(this.#apiKey);
        if (!video || typeof video.getVideoPlaybackQuality !== 'function') return;

        const q = video.getVideoPlaybackQuality(),
              total = q.totalVideoFrames,
              dropped = q.droppedVideoFrames,
              deltaTotal = total - this.#lastTotal,
              deltaDropped = dropped - this.#lastDropped,
              percent = deltaTotal > 0
                  ? (deltaDropped / deltaTotal * 100).toFixed(1)
                  : '0.0';

        this.#qualityInfo = `\nDrop: ${dropped} (${percent}%)`;
        this.#lastTotal = total;
        this.#lastDropped = dropped;

    };

    /**
     * Teardown and cleanup.
     */
    destroy() {

        clearInterval(this.#statsInterval);
        this.#renderLoop.destroy();
        this.#dom.destroy();
        this.#player = this.#dom = this.#apiKey = null;

    }
}
