import { lerp } from '../../lib/util/math.js';
import { extend } from '../../lib/util/object.js';
import Looper from '../../lib/util/Looper.js';
import DomSmith from '../../lib/dom/DomSmith.js';

/**
 * The AnalyserVideo component analyzes video frames to extract pixel-based data for visual processing and visualizations.
 * It captures thumbnails of the current video frame, reduces them to a defined grid, and smooths color values over time.
 * The component supports real-time analysis, debug output to canvas elements, and modular configuration.
 * It is typically used to drive reactive UI elements or visualizers based on video content.
 * @exports module:src/visualizer/AnalyserVideo
 * @requires lib/util/math
 * @requires lib/util/object
 * @requires lib/util/Looper
 * @requires lib/dom/DomSmith
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class AnalyserVideo {

    /**
     * Holds the instance configuration for this component.
     * @type     {Object}
     * @property {number}  [gridSize=3]        The number of grid cells per row/column.
     * @property {number}  [gridScale=3]       The scaling factor applied to the grid cells.
     * @property {number}  [lerp=0.6]          The interpolation factor used for smoothing pixel values.
     * @property {number}  [dim=1]             The dimming multiplier applied to pixel values.
     * @property {boolean} [debug=false]       Enables debug mode with visual outputs.
     * @property {number}  [analyseTimer=250]  Delay (in ms) between iterations of the analysis loop.
     */
    #config;

    /**
     * Reference to the main player instance.
     * @type {module:src/core/Player}
     */
    #player;

    /**
     * Holds tokens of subscriptions (for this subclass only).
     * @type {number[]}
     */
    #subscriptions;

    /**
     * Secret key only known to the player instance and initialized components.
     * Used to be able to restrict access to API methods in conjunction with secure mode.
     * @type {symbol}
     */
    #apiKey;

    /**
     * Flag indicating whether the analyser is enabled.
     * @type {boolean}
     */
    #enabled = true;

    /**
     * Canvas element for processing video frames.
     * @type {HTMLCanvasElement|OffscreenCanvas}
     */
    #canvas;

    /**
     * 2D Rendering Context of the canvas.
     * @type {CanvasRenderingContext2D}
     */
    #ctx;

    /**
     * Debugging DOM elements created by DomSmith.
     * @type {module:lib/dom/DomSmith}
     */
    #debug;

    /**
     * Canvas element for input debugging.
     * @type {HTMLCanvasElement}
     */
    #debugInput;

    /**
     * 2D Rendering Context for the input debugging canvas.
     * @type {CanvasRenderingContext2D}
     */
    #debugInputCtx;

    /**
     * Canvas element for output debugging.
     * @type {HTMLCanvasElement}
     */
    #debugOutput;

    /**
     * 2D Rendering Context for the output debugging canvas.
     * @type {CanvasRenderingContext2D}
     */
    #debugOutputCtx;

    /**
     * Current pixel data after processing.
     * @type {ImageData|null}
     */
    #pixelData;

    /**
     * Previous pixel data for comparison and smoothing.
     * @type {Uint8ClampedArray}
     */
    #oldPixelData;

    /**
     * Analyse Loop Instance, used for updating the viedeo data.
     * @type {module:lib/util/Looper}
     */
    #analyseLoop;

    /**
     * Id for the refresh delay.
     * @type {number|undefined}
     */
    #refreshDelayId;

    /**
     * Creates an instance of the AnalyserVideo component.
     * @param {module:src/core/Player} player  Reference to the VisionPlayer instance.
     * @param {Object}                 config  Configuration object for the AnalyserAudio component. This is passed from the subclass.
     * @param {symbol}                 apiKey  Token for extended access to the player API.
     */
    constructor(player, config = {}, apiKey) {

        const configExt = extend({
            gridSize: 3,
            gridScale: 3,
            lerp: 0.6,
            dim: 1,
            debug: false,
            analyseTimer: 250
        }, config);

        this.#player = player;
        this.#player.subscribe('data/ready', this.#onDataReady);
        this.#config = configExt;
        this.#apiKey = apiKey;
        this.#analyseLoop = new Looper(() => this.analyseLoop(), this.#config.analyseTimer);

        if (this.#config.debug) {

            this.#debug = new DomSmith({
                _ref: 'wrapper',
                style: 'position: fixed; top: 10%; left: 5%; z-index: 15; pointer-events: none;',
                _nodes: [{
                    _ref: 'input',
                    _tag: 'canvas',
                    style: 'position: absolute; top: 0; left: 0; width: 300px; height: 300px;'
                },
                {
                    _ref: 'output',
                    _tag: 'canvas',
                    style: 'position: absolute; top: 0; left: 350px; width: 300px; height: 300px;'
                }
                ]
            }, this.#player.dom.getElement(this.#apiKey));

            this.#debugInput = this.#debug.input;
            this.#debugInputCtx = this.#debugInput.getContext('2d', { alpha: false });
            this.#debugInputCtx.imageSmoothingEnabled = false;

            this.#debugOutput = this.#debug.output;
            this.#debugOutputCtx = this.#debugOutput.getContext('2d', { alpha: false });
            this.#debugOutputCtx.imageSmoothingEnabled = false;

        }

    }

    /**
     * Handles "data/ready" events to activate video analysis based on media type. Deactivated when media type is audio.
     * @param {module:src/core/Data~mediaItem} mediaItem            Object containing media type info.
     * @param {string}                         mediaItem.mediaType  Type of the media ('video' or 'audio').
     * @listens module:src/core/Data#data/ready
     */
    #onDataReady = ({ mediaType }) => {

        this.stopLoop();
        this.#player.unsubscribe(this.#subscriptions);

        if (mediaType !== 'video' || !this.#enabled) return;

        // NOTE: This methods are explicitly bound with .bind(this) to guarantee the correct this context in subclasses,
        // allowing overrides and super.method() calls to work reliably.
        this.#subscriptions = [
            this.#player.subscribe('media/play', this.startLoop.bind(this)),
            this.#player.subscribe('media/pause', this.stopLoop.bind(this)),
            this.#player.subscribe('media/canplay', this.#refreshBounce.bind(this))
        ];

        const scale = this.#config.gridSize * this.#config.gridScale;

        this.#canvas = typeof window.OffscreenCanvas === 'undefined' ? document.createElement('canvas') : new OffscreenCanvas(scale, scale);
        this.#ctx = this.#canvas.getContext('2d', { alpha: false }); // intentionally *not* using `willReadFrequently` – performance is better without it
        this.#ctx.imageSmoothingEnabled = false;

        this.#oldPixelData = new Uint8ClampedArray(this.#config.gridSize * this.#config.gridSize * 4);
        this.#oldPixelData.fill(0);

        this.#pixelData = new Uint8ClampedArray(this.#config.gridSize * this.#config.gridSize * 4);
        this.#pixelData.fill(0);

    };

    /**
     * Starts the analysis loop by initiating the first iteration.
     * @listens module:src/core/Media#media/play
     */
    startLoop() {

        if (this.#enabled) this.#analyseLoop.start();

    }

    /**
     * Stops the ongoing analysis loop.
     * @listens module:src/core/Media#media/pause
     */
    stopLoop() {

        this.#analyseLoop.stop();

    }

    /**
     * Performs one iteration of the analysis loop.
     * @returns {ImageData} Calculated Image Data.
     */
    analyseLoop() {

        const result = this.#getPixelData();

        if (result === false) return false;

        if (this.#config.debug) {
            this.#debugInputCtx.drawImage(this.#canvas, 0, 0, this.#debugInput.width, this.#debugInput.height);
            createImageBitmap(this.#pixelData).then(img => { this.#debugOutputCtx.drawImage(img, 0, 0, this.#debugInput.width, this.#debugInput.height); });
        }

        return this.#pixelData;

    }

    /**
     * Retrieves and processes pixel data from the video stream.
     * Draws a thumbnail for pixel analysis, divides it into grid cells, averages color values, and applies linear interpolation for smoothing.
     * @param   {number}  [lerpVal]  The interpolation value for smoothing.
     * @returns {boolean}            True if pixel data was successfully retrieved and processed, false otherwise.
     */
    #getPixelData(lerpVal = 1 - this.#config.lerp) {

        const videoStream = this.#player.media.getElement(this.#apiKey),
              { gridSize, gridScale } = this.#config,
              gridScaleItems = gridScale * gridScale,
              gridScaleSize = gridSize * gridScale;

        let pixels;

        try {
            // generate thumbnail for pixel analysis
            this.#ctx.drawImage(videoStream, 0, 0, videoStream.videoWidth, videoStream.videoHeight, 0, 0, gridScaleSize, gridScaleSize);
            pixels = this.#ctx.getImageData(0, 0, gridScaleSize, gridScaleSize).data;
        } catch (e) {
            console.error('[VideoAnalyser] Failed to get Image Data', { cause: e }); // eslint-disable-line no-console
            this.stopLoop();
            return false;
        }

        // loop through image data and average color values
        const avgData = new ImageData(gridSize, gridSize);
        // outer loop based on target grid size
        for (let row = 0; row < gridSize; row += 1) {
            // inner loop
            for (let col = 0; col < gridSize; col += 1) {
                let r = 0,
                    b = 0,
                    g = 0;
                // now average pixels
                for (let i = 0; i < gridScale; i += 1) {
                    const rowOffset = (row * gridScale + i) * gridScaleSize;
                    for (let j = 0; j < gridScale; j += 1) {
                        const pos = (rowOffset + col * gridScale + j) * 4;
                        r += pixels[pos + 0];
                        g += pixels[pos + 1];
                        b += pixels[pos + 2];
                    }
                }

                // copy averaged and lerped pixel values to image data
                const targetIdx = (col + row * gridSize) * 4,
                      dimmed = gridScaleItems * this.#config.dim;

                avgData.data[targetIdx + 0] = Math.floor(lerp(this.#oldPixelData[targetIdx + 0], r / dimmed, lerpVal));
                avgData.data[targetIdx + 1] = Math.floor(lerp(this.#oldPixelData[targetIdx + 1], g / dimmed, lerpVal));
                avgData.data[targetIdx + 2] = Math.floor(lerp(this.#oldPixelData[targetIdx + 2], b / dimmed, lerpVal));
                avgData.data[targetIdx + 3] = 255; // always opaque
            }
        }

        this.#oldPixelData = new Uint8ClampedArray(avgData.data);
        this.#pixelData = avgData;

        return true;

    }

    /**
     * Refreshes the analysis loop after a short delay.
     */
    #refreshBounce() {

        clearTimeout(this.#refreshDelayId);
        this.#refreshDelayId = setTimeout(this.refresh.bind(this), 50);

    }

    /**
     * Refreshes the pixel data immediately, resetting the interpolation.
     * @returns {ImageData} Calculated Image Data.
     * @listens module:src/core/Media#media/seeked
     * @listens module:src/core/Media#media/canplay
     */
    refresh() {

        this.#getPixelData(1);

        if (this.#config.debug) {
            this.#debugInputCtx.drawImage(this.#canvas, 0, 0, this.#debugInput.width, this.#debugInput.height);
            createImageBitmap(this.#pixelData).then(img => { this.#debugOutputCtx.drawImage(img, 0, 0, this.#debugInput.width, this.#debugInput.height); });
        }

        return this.#pixelData;
    }

    /**
     * Enables the analyser and restarts the analysis loop if playback is ongoing.
     */
    enable() {

        this.#enabled = true;
        if (this.#player.getState('media.paused')) return;
        this.startLoop();

    }

    /**
     * Disables the analyser.
     */
    disable() {

        this.#enabled = false;
        this.stopLoop();

    }

    /**
     * Removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        if (this.#config.debug) this.#debug.destroy();
        clearTimeout(this.#refreshDelayId);
        this.#analyseLoop.destroy();
        this.#player.unsubscribe(this.#subscriptions);
        this.#player.unsubscribe('data/ready', this.#onDataReady);
        this.#player = this.#canvas = this.#apiKey = this.#analyseLoop = null;

    }

}
