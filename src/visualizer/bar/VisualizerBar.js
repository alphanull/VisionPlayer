import AnalyserAudio from './../AnalyserAudio.js';
import DomSmith from '../../../lib/dom/DomSmith';
import render from './VisualizerBarRender.js';
import supportsWorkerModules from '../../../lib/util/supportsWorkerModules.js';
import BarWorker from './VisualizerBarWorker.js?worker&inline';

/**
 * The VisualizerBar component displays a real-time mirrored bar visualization of audio signals.
 * It extends the base AnalyserAudio class and renders a symmetric set of vertical bars based on frequency data using an HTML5 Canvas element.
 * This component is useful for compact audio-only UIs or background visualizations.
 * @exports module:src/visualizer/bar/VisualizerBar
 * @requires lib/dom/DomSmith
 * @requires lib/util/supportsWorkerModules
 * @requires src/visualizer/bar/VisualizerBarRender
 * @requires src/visualizer/bar/VisualizerBarWorker
 * @augments module:src/visualizer/AnalyserAudio
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class VisualizerBar extends AnalyserAudio {

    /**
     * Configuration options for the VisualizerBar component, seperated from the superclass config.
     * @property {number} [bands=7]     Number of EQ bands to displayed as mirrored bars.
     * @property {number} [channels=1]  Number of audio channels.
     * @property {number} [hiPass=0]    High-pass filter value.
     * @property {number} [loPass=0]    Low-pass filter value.
     * @property {number} [fftSize=32]  FFT size specific to VisualizerBar.
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
     * @type {module:src/visualizer/bar/VisualizerBarWorker}
     */
    #worker;

    /**
     * Creates an instance of the VisualizerBar component.
     * @param {module:src/core/Player}     player            Reference to the main player instance.
     * @param {module:src/util/AudioChain} parent            Reference to the parent instance.
     * @param {Object}                     [options]         Additional options.
     * @param {symbol}                     [options.apiKey]  Token for extended access to the player API.
     */
    constructor(player, parent, { apiKey }) {

        const config = player.initConfig('visualizerBar', {
            bands: 7,
            channels: 2,
            hiPass: 0,
            loPass: 0,
            fftSize: 32
        });

        if (super(player, config, apiKey)[0] === false) return [false];

        this.#config = config;
        this.#player = player;
        this.#apiKey = apiKey;

        this.#dom = new DomSmith({
            _ref: 'wrapper',
            className: 'vip-visualizer vip-visualizer-audio vip-visualizer-bar',
            ariaHidden: true,
            _nodes: [{
                _ref: 'canvas',
                _tag: 'canvas',
                className: 'vip-visualizer-audio-canvas'
            }]
        }, player.dom.getElement(apiKey));

        this.#subscriptions = [
            player.subscribe('ui/resize', this.#resize)
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
            this.#worker = new BarWorker();
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
     * Performs one iteration of the analysis loop and calls the rendering routine.
     * This method overrides the parent's analyseLoop.
     * @override
     */
    analyseLoop() {

        const { frequencyData } = super.analyseLoop(),
              reduced = AnalyserAudio.reduceFrequencies(frequencyData[0], this.#config.bands);

        if (this.#useWorker) this.#worker.postMessage({ type: 'render', frequencyData: reduced }, {});
        else render(reduced, this.#canvas, this.#canvas.ctx, this.#config);

    }

    /**
     * Resizes the canvas based on UI changes.
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
     * Cleans up all events, subscriptions, and DOM nodes created by this component.
     */
    destroy() {

        this.#dom.destroy();
        this.#dom = this.#apiKey = null;
        this.#player.unsubscribe(this.#subscriptions);
        super.destroy();

    }

}
