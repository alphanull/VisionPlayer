import AnalyserAudio from '../AnalyserAudio.js';
import DomSmith from '../../../lib/dom/DomSmith.js';
import supportsWorkerModules from '../../../lib/util/supportsWorkerModules.js';
import render from './VisualizerFrequencyRender.js';
import FrequencyWorker from './VisualizerFrequencyWorker.js?worker&inline';

/**
 * The VisualizerFrequency component renders a real-time frequency visualization of audio signals.
 * It extends the base AnalyserAudio component and visualizes the frequency spectrum either on the main thread or via a worker using OffscreenCanvas.
 * It is typically used in audio-focused contexts, providing audio-reactive visual effects, and is compatible with both audio and video content.
 * @exports module:src/visualizer/frequency/VisualizerFrequency
 * @requires src/visualizer/frequency/VisualizerFrequencyRender
 * @requires src/visualizer/frequency/VisualizerFrequencyWorker
 * @requires lib/dom/DomSmith
 * @requires lib/util/supportsWorkerModules
 * @augments module:src/visualizer/AnalyserAudio
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class VisualizerFrequency extends AnalyserAudio {

    /**
     * Configuration options for the VisualizerBar component, seperated from the superclass config.
     * @type     {Object}
     * @property {number} [channels=2]   Number of audio channels.
     * @property {number} [hiPass=0]     High-pass filter value.
     * @property {number} [loPass=0]     Low-pass filter value.
     * @property {number} [fftSize=512]  FFT size specific to VisualizerBar.
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
     * DOM elements for the visualizer.
     * @type {module:lib/dom/DomSmith}
     */
    #dom;

    /**
     * Canvas element and its drawing context.
     * @property {HTMLCanvasElement}        ele  Canvas element.
     * @property {CanvasRenderingContext2D} ctx  2D drawing context.
     */
    #canvas;

    /**
     * Flag indicating if the visualizer should use a worker.
     * @type {boolean}
     */
    #useWorker;

    /**
     * Optional worker which renders the canvas offscreen.
     * @type {module:src/visualizer/frequency/VisualizerFrequencyWorker}
     */
    #worker;

    /**
     * Creates an instance of the VisualizerFrequency component.
     * @param {module:src/core/Player}     player            Reference to the VisionPlayer instance.
     * @param {module:src/util/AudioChain} parent            Reference to the parent instance.
     * @param {Object}                     [options]         Additional options.
     * @param {symbol}                     [options.apiKey]  Token for extended access to the player API.
     */
    constructor(player, parent, { apiKey }) {

        const config = player.initConfig('visualizerFrequency', {
            channels: 2,
            hiPass: 0,
            loPass: 0,
            fftSize: 512
        });

        if (super(player, config, apiKey)[0] === false) return [false];

        this.#player = player;
        this.#apiKey = apiKey;
        this.#config = config;

        this.#dom = new DomSmith({
            _ref: 'wrapper',
            className: 'vip-visualizer vip-visualizer-audio vip-visualizer-frequency',
            ariaHidden: true,
            _nodes: [{
                _ref: 'canvas',
                _tag: 'canvas',
                className: 'vip-visualizer-audio-canvas'
            }]
        }, player.dom.getElement(apiKey));

        this.#subscriptions = [
            this.#player.subscribe('ui/resize', this.#resize)
        ];

        this.#initWorker();

    }

    /**
     * Initializes the worker for offloading rendering, if supported.
     * If workers are not supported, sets up local canvas rendering.
     */
    async #initWorker() {

        const { canvas } = this.#dom;
        this.#useWorker = await supportsWorkerModules();
        this.#useWorker = this.#useWorker && canvas.transferControlToOffscreen;

        if (this.#useWorker) {
            const offscreen = canvas.transferControlToOffscreen();
            this.#worker = new FrequencyWorker();
            this.#worker.postMessage({ type: 'init', offscreenCanvas: offscreen, config: this.#config }, [offscreen]);
        } else {
            this.#canvas = {
                ele: canvas,
                ctx: canvas.getContext('2d')
            };
        }

        this.#resize();
    }

    /**
     * Starts the audio analysis loop.
     * @listens module:src/core/Media#media/play
     */
    startLoop() {

        this.#resize();
        super.startLoop();

    }

    /**
     * Main analysis loop.
     * Calls the parent's analyseLoop and then sends frequency data to the worker or renders locally.
     */
    analyseLoop() {

        const { frequencyData } = super.analyseLoop();

        if (this.#useWorker) this.#worker.postMessage({ type: 'render', frequencyData }, {});
        else render(frequencyData, this.#canvas, this.#canvas.ctx, this.#config);

    }

    /**
     * Invoked when window resizes. Sets the canvas dimensions accordingly.
     * @listens module:src/ui/UI#ui/resize
     */
    #resize = () => {

        // TODO: maybe a bit too brittle, refactor later with own state?
        if (!this.#canvas && !this.#worker || !this.#player.dom.getElement(this.#apiKey).classList.contains('has-audio-analyser')) return;

        const ele = this.#dom.canvas,
              deviceRatio = window.devicePixelRatio ?? 1,
              { width, height } = ele.getBoundingClientRect();

        if (this.#useWorker) this.#worker.postMessage({ type: 'resize', width: width * deviceRatio, height: height * deviceRatio });
        else {
            ele.width = this.#canvas.width = width * deviceRatio;
            ele.height = this.#canvas.height = height * deviceRatio;
        }

    };

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        this.#worker?.terminate();
        this.#dom.destroy();
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#dom = this.#worker = this.#apiKey = null;
        super.destroy();

    }

}
