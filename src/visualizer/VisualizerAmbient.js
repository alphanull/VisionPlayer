import AnalyserVideo from './AnalyserVideo.js';
import DomSmith from '../../lib/dom/DomSmith.js';
import Looper from '../../lib/util/Looper.js';
import { lerp } from '../../lib/util/math.js';
import { extend, isString } from '../../lib/util/object.js';

/**
 * The VisualizerAmbient component renders a real-time ambient visualization based on color data extracted from the video stream in real time.
 * It creates a visual effect similar to "AmbiLight", where the average color of the video is extended to the surrounding canvas.
 * @exports module:src/visualizer/VisualizerAmbient
 * @requires lib/dom/DomSmith
 * @requires lib/util/Looper
 * @requires lib/util/object
 * @requires lib/util/math
 * @augments module:src/visualizer/AnalyserVideo
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class VisualizerAmbient extends AnalyserVideo {

    /**
     * Configuration options for the VisualizerAmbient component.
     * @type     {Object}
     * @property {number} [selector="body"]  CSS selector resolving to the dom element to attach to.
     * @property {number} [smooth=0.96]      Additional interpolation factor (on top on "lerp") to smooth pixel values over time.
     */
    #config;

    /**
     * Reference to the main player instance.
     * @type {module:src/core/Player}
     */
    #player;

    /**
     * Holds tokens of subscriptions to player events, for later unsubscribe.
     * @type {number[]}
     */
    #subscriptions;

    /**
     * DomSmith instance for the ambient visualizer container.
     * @type {module:lib/dom/DomSmith}
     */
    #dom;

    /**
     * DomSmith instance for the settings menu slider.
     * @type {module:lib/dom/DomSmith|undefined}
     */
    #menu;

    /**
     * Canvas element used to draw the final ambient visualization.
     * @type {HTMLCanvasElement}
     */
    #renderCanvas;

    /**
     * 2D rendering context for the render canvas.
     * @type {CanvasRenderingContext2D}
     */
    #renderCtx;

    /**
     * Canvas element used for the final upscale.
     * @type {HTMLCanvasElement|OffscreenCanvas}
     */
    #scaleCanvas;

    /**
     * 2D rendering context for the scale canvas.
     * @type {CanvasRenderingContext2D}
     */
    #scaleCtx;

    /**
     * Pixel data from the current analysis frame.
     * @type {ImageData}
     */
    #pixelData;

    /**
     * Pixel data from the previous render iteration, used for smoothing.
     * @type {Uint8ClampedArray}
     */
    #prevPixelData;

    /**
     * Flag indicating whether the analyser is enabled.
     * @type {boolean}
     */
    #enabled = true;

    /**
     * Render Loop Instance, used for updating the scrubber.
     * @type {module:lib/util/Looper}
     */
    #renderLoop;

    /**
     * Creates an instance of the VisualizerAmbient component.
     * @param {module:src/core/Player}     player            Reference to the media player instance.
     * @param {module:src/util/AudioChain} parent            Reference to the parent instance.
     * @param {Object}                     [options]         Additional options.
     * @param {symbol}                     [options.apiKey]  Token for extended access to the player API.
     */
    constructor(player, parent, { apiKey }) {

        const config = player.getConfig('visualizerAmbient');
        if (!config || !config.selector) return [false];

        const configExt = extend({
            selector: config === true ? 'body' : isString(config) ? config : config.selector,
            gridSize: 4,
            gridScale: 4,
            smooth: 0.96,
            opacity: 0.7,
            analyseTimer: 250
        }, config);

        const attachNode = document.querySelector(configExt.selector);
        if (!attachNode) throw new Error(`[VisualizerAmbient] provided selector: ${config.selector} yielded no match.`);

        super(player, configExt, apiKey); // Call the parent class constructor with the extended configuration.

        this.#config = configExt;
        this.#player = player;
        this.#player.setConfig({ visualizerAmbient: this.#config });

        this.#dom = new DomSmith({
            _ref: 'wrapper',
            className: 'vip-visualizer vip-visualizer-ambient',
            _nodes: [{
                _ref: 'renderCanvas',
                _tag: 'canvas',
                className: 'vip-visualizer-ambient-canvas',
                style: `opacity: ${this.#config.opacity};`
            }]
        }, attachNode);

        // check if we have the settings menu available for additional UI
        const settingsPopup = this.#player.getComponent('ui.controller.popupSettings', apiKey);

        if (settingsPopup) {
            this.#menu = new DomSmith({
                _ref: 'menu',
                className: 'vip-menu',
                _nodes: [{
                    _tag: 'label',
                    _nodes: [
                        {
                            _tag: 'span',
                            className: 'form-label-text',
                            _nodes: [this.#player.locale.t('visualizerAmbient.header')]
                        }, {
                            _tag: 'input',
                            _ref: 'slider',
                            type: 'range',
                            min: 0,
                            max: 1,
                            step: 0.01,
                            value: this.#config.opacity,
                            className: 'has-center-line',
                            ariaLabel: this.#player.locale.t('visualizerAmbient.slider'),
                            'aria-valuetext': `${this.#config.opacity * 100}%`,
                            style: this.#config.opacity === 0 ? 'opacity: 0.5;' : '',
                            change: this.#setOpacity,
                            input: this.#setOpacity
                        }
                    ]
                }]
            }, settingsPopup.getElement('bottom'));
        }

        this.#prevPixelData = new Uint8ClampedArray(this.#config.gridSize * this.#config.gridSize * 4);
        this.#prevPixelData.fill(0);

        this.#renderLoop = new Looper(this.#render);

        this.#renderCanvas = this.#dom.renderCanvas;
        this.#renderCtx = this.#renderCanvas.getContext('2d', { alpha: false });
        this.#renderCtx.filter = 'blur(8px)';

        if (typeof window.OffscreenCanvas === 'undefined') {
            this.#scaleCanvas = document.createElement('canvas');
            this.#scaleCanvas.width = this.#scaleCanvas.height = this.#config.gridSize;
        } else {
            // use offscreencanvas if possible for better performance
            this.#scaleCanvas = new OffscreenCanvas(this.#config.gridSize, this.#config.gridSize);
        }

        this.#scaleCtx = this.#scaleCanvas.getContext('2d', { alpha: false });

        // NOTE: This methods are explicitly bound with .bind(this) to guarantee the correct this context in subclasses,
        // allowing overrides and super.method() calls to work reliably.
        this.#subscriptions = [
            ['data/ready', this.#onDataReady],
            ['media/enterpictureinpicture', this.stopLoop.bind(this)],
            ['media/leavepictureinpicture', this.startLoop.bind(this)],
            ['airplay/start', this.stopLoop.bind(this)],
            ['airplay/stop', this.startLoop.bind(this)],
            ['chromecast/start', this.stopLoop.bind(this)],
            ['chromecast/stop', this.startLoop.bind(this)],
            ['fullscreen/enter', this.disable.bind(this)],
            ['fullscreen/leave', this.enable.bind(this)]
        ].map(([event, handler]) => player.subscribe(event, handler));

    }

    /**
     * Called when media data is ready. If opacity is 0, disables the visualizer.
     * @param {module:src/core/Data~mediaItem} mediaItem  Object containing media info.
     * @listens module:src/core/Data#data/ready
     */
    #onDataReady = ({ mediaType }) => {

        if (!this.#enabled) return;

        if (this.#config.opacity === 0) this.disable();
        this.#dom.wrapper.classList.toggle('is-visible', mediaType !== 'audio');
        if (mediaType === 'audio') this.#menu?.unmount(); else this.#menu?.mount();

    };

    /**
     * Starts the ambient visualizer render loop.
     * @override
     * @listens module:src/casting/ChromeCast#chromecast/stop
     * @listens module:src/casting/AirPlay#airplay/stop
     * @listens module:src/core/Media#media/leavepictureinpicture
     */
    startLoop() {

        if (this.#player.getConfig('visualizerAmbient.opacity') === 0) this.disable();
        if (this.#player.getState('media.paused') || !this.#enabled) return;

        super.startLoop();
        this.#renderLoop.start();

    }

    /**
     * Stops the ambient visualizer render loop.
     * @override
     * @listens module:src/casting/ChromeCast#chromecast/start
     * @listens module:src/casting/AirPlay#airplay/start
     * @listens module:src/core/Media#media/enterpictureinpicture
     */
    stopLoop() {

        super.stopLoop();
        this.#renderLoop.stop();

    }

    /**
     * Performs one iteration of the analysis loop and schedules the next.
     * @override
     */
    analyseLoop() {

        this.#pixelData = super.analyseLoop();

    }

    /**
     * Refreshes the visualization immediately. Used when seeking.
     * @override
     * @listens module:src/core/Media#media/seeked
     * @listens module:src/core/Media#media/canplay
     */
    refresh() {

        if (this.#player.getConfig('visualizerAmbient.opacity') === 0 || !this.#player.getState('media.paused')) return;

        this.#pixelData = super.refresh();
        // start some render iterations to get a smooth transition even when the video is paused
        this.#renderLoop.start(20);

    }

    /**
     * Renders the ambient visualization. Applies linear interpolation to smooth pixel data,
     * draws the processed image onto the scale canvas, and then draws the scaled image onto the render canvas.
     * @param {number} [lr]  Interpolation factor for smoothing.
     */
    #render = (lr = 1 - this.#config.smooth) => {

        if (!this.#pixelData?.width) return;

        const avgData = new ImageData(this.#pixelData.width, this.#pixelData.height);
        for (let i = 0; i < avgData.data.length; i += 1) {
            avgData.data[i] = lerp(this.#prevPixelData[i], this.#pixelData.data[i], lr);
        }

        this.#prevPixelData = avgData.data;
        this.#scaleCtx.putImageData(avgData, 0, 0);
        this.#renderCtx.drawImage(this.#scaleCanvas, 0, 0, this.#renderCanvas.width, this.#renderCanvas.height);

    };

    /**
     * Sets the ambient visualizer opacity.
     * @param {event} event  The event object containing the target element.
     */
    #setOpacity = ({ target }) => {

        const oldOpacity = this.#config.opacity,
              newOpacity = Number(target.value);

        this.#config.opacity = this.#dom.renderCanvas.style.opacity = newOpacity;
        this.#player.setConfig({ visualizerAmbient: { opacity: newOpacity } });
        this.#menu.slider.setAttribute('aria-valuetext', `${newOpacity * 100}%`);

        if (oldOpacity === 0 && newOpacity) {
            this.#menu.slider.style.opacity = 1;
            this.startLoop();
        } else if (newOpacity === 0) {
            this.stopLoop();
            this.#menu.slider.style.opacity = 0.5;
        }
    };

    /**
     * Enables the analyser and restarts the analysis loop if playback is ongoing.
     */
    enable() {

        this.#enabled = true;
        super.enable();

    }

    /**
     * Disables the analyser.
     */
    disable() {

        this.#renderLoop.stop();
        this.#enabled = false;
        super.disable();

    }

    /**
     * Removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        this.#player.unsubscribe(this.#subscriptions);
        this.#renderLoop.destroy();
        this.#menu?.destroy();
        this.#dom.destroy();
        this.#player = this.#dom = this.#menu = this.#scaleCtx = this.#scaleCanvas = this.#renderCtx = this.#renderCanvas = this.#renderLoop = null;
        super.destroy();

    }
}
