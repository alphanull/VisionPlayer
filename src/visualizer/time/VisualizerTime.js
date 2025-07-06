import AnalyserAudio from '../AnalyserAudio.js';
import DomSmith from '../../../lib/dom/DomSmith.js';
import TimeWorker from './VisualizerTimeWorker.js?worker&inline';
import supportsWorkerModules from '../../../lib/util/supportsWorkerModules.js';

/**
 * VisualizerTime component for rendering a waveform visualization from audio time-domain data.
 * It extends AnalyserAudio to capture and process audio analyser data and then renders the processed
 * time-domain data onto a canvas as a waveform. Also uses a worker for rendering, if available.
 * @exports module:src/visualizer/time/VisualizerTime
 * @requires src/visualizer/time/VisualizerTimeWorker
 * @requires lib/util/supportsWorkerModules
 * @requires lib/dom/DomSmith
 * @augments module:src/visualizer/AnalyserAudio
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class VisualizerTime extends AnalyserAudio {

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
     * Reference to the DomSmith Instance.
     * @type {module:lib/dom/DomSmith}
     */
    #dom;

    /**
     * Local canvas element and 2D context for rendering when worker is not used.
     * @type     {Object}
     * @property {HTMLCanvasElement}        ele  The canvas element.
     * @property {CanvasRenderingContext2D} ctx  The 2D rendering context.
     */
    #canvas;

    /**
     * Optional worker which renders the canvas offscreen.
     * @type {module:src/visualizer/frequency/VisualizerTimeWorker}
     */
    #worker;

    /**
     * Indicates if OffscreenCanvas worker rendering is used.
     * @type {OffscreenCanvas|undefined}
     */
    #useWorker;

    /**
     * Creates an instance of the VisualizerTime component.
     * @param {module:src/core/Player}     player            Reference to the VisionPlayer instance.
     * @param {module:src/util/AudioChain} parent            Reference to the parent instance.
     * @param {Object}                     [options]         Additional options.
     * @param {symbol}                     [options.apiKey]  Token for extended access to the player API.
     */
    constructor(player, parent, { apiKey }) {

        const config = player.initConfig('visualizerTime', {
            channels: 1,
            fftSize: 512,
            smoothingTimeConstant: 1
        });

        if (super(player, config, apiKey)[0] === false) return [false];

        this.#player = player;
        this.#apiKey = apiKey;

        this.#dom = new DomSmith({
            _ref: 'wrapper',
            className: 'vip-visualizer vip-visualizer-audio vip-visualizer-time',
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

        if (this.#useWorker) {
            const offscreen = canvas.transferControlToOffscreen();
            this.#worker = new TimeWorker();
            this.#worker.postMessage({ type: 'init', offscreenCanvas: offscreen }, [offscreen]);
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
     * Overrides the parent's analyseLoop method to render time-domain data.
     * @override
     * @listens module:src/core/Media#media/play
     * @listens module:src/core/Media#media/pause
     */
    analyseLoop() {

        const data = super.analyseLoop();

        if (this.#useWorker) this.#worker.postMessage({ type: 'render', timeData: data.waveformData }, {});
        else this.#render(data.waveformData);

    }

    /**
     * Renders the time-domain data as a waveform on the canvas.
     * @param {number[][]} timeData  Array of time-domain data per channel.
     */
    #render(timeData) {

        const { ele: canvas, ctx } = this.#canvas,
              bufferLength = timeData[0].length,
              sliceWidth = canvas.width / bufferLength;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgb(255 255 255)';

        let x = 0;

        ctx.beginPath();

        for (let i = 0; i < bufferLength; i += 1) {

            const v = timeData[0][i] / 128.0,
                  y = v * canvas.height / 2;

            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);

            x += sliceWidth;
        }

        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();

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
        this.#player = this.#dom = this.#worker = this.#canvas = this.#apiKey = null;

        super.destroy();

    }

}
