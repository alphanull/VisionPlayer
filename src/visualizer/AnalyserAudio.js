import { extend } from '../../lib/util/object.js';
import Looper from '../../lib/util/Looper.js';

/**
 * The AnalyserAudio component forms the backbone for all audio visualizations in the player.
 * It uses the Web Audio API to perform real-time frequency and time-domain analysis on audio streams.
 * This base class is meant to be subclassed by visual components that make use of the analysis data to render visual effects.
 * It is not intended to be used directly.
 * @exports module:src/visualizer/AnalyserAudio
 * @requires lib/util/object
 * @requires lib/util/Looper
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license   MIT
 */
export default class AnalyserAudio {

    /**
     * Holds the instance configuration for this component.
     * Config object extended by subclasses for specific visualizer settings.
     * @type     {Object}
     * @property {boolean} [audioOnly=false]    If `true`, analysis is active only for audio streams.
     * @property {number}  [channels=1]         Number of audio channels.
     * @property {number}  [hiPass=0]           High-pass filter cutoff value.
     * @property {number}  [loPass=0]           Low-pass filter cutoff value.
     * @property {number}  [fftSize=512]        FFT size for frequency analysis.
     * @property {number}  [minDecibels=-120]   Minimum decibels for analysis.
     * @property {number}  [maxDecibels=0]      Maximum decibels for analysis.
     * @property {number}  [smoothingTime=0.8]  Smoothing time constant for analysis.
     * @property {number}  [stopDelay=1000]     Delay (in ms) after which the analysis loop is stopped when paused.
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
     * Secret key only known to the player instance and initialized components.
     * Used to be able to restrict access to API methods in conjunction with secure mode.
     * @type {symbol}
     */
    #apiKey;

    /**
     * Audio analysis data.
     * @property {ChannelSplitterNode} splitter       The channel splitter node used to divide the audio signal into channels.
     * @property {AudioNode[]}         analysers      Array of AnalyserNode objects for each channel.
     * @property {Uint8Array[]}        frequencyData  Array of Uint8Array storing frequency data for each channel.
     * @property {Uint8Array[]}        waveformData   Array of Uint8Array storing time-domain data for each channel.
     */
    #audio = {
        splitter: null,
        analysers: [],
        frequencyData: [],
        waveformData: []
    };

    /**
     * Use the shared AudioContext from the player's Audio Manager.
     * @type {AudioContext}
     */
    #audioCtx;

    /**
     * Flag indicating if the analyser loop is running.
     * @type {boolean}
     */
    #isActive = false;

    /**
     * Render Loop Instance, used for updating the scrubber.
     * @type {module:lib/util/Looper}
     */
    #renderLoop;

    /**
     * ID of the stop delay timeout.
     * @type {number}
     */
    #stopDelayId = 0;

    /**
     * Creates an instance of the AnalyserAudio component.
     * @param {module:src/core/Player} player  Reference to the main player instance.
     * @param {Object}                 config  Configuration object for the AnalyserAudio component. This is passed from the subclass.
     * @param {symbol}                 apiKey  Token for extended access to the player API.
     */
    constructor(player, config = {}, apiKey) {

        const audioCtx = player.audio.getContext(apiKey);

        if (!config || !audioCtx) return [false];

        const configExt = extend({
            audioOnly: true,
            channels: 1,
            hiPass: 0,
            loPass: 0,
            fftSize: 512,
            minDecibels: -120,
            maxDecibels: 0,
            smoothingTime: 0.8,
            stopDelay: 1000
        }, config);

        this.#player = player;
        this.#apiKey = apiKey;
        this.#config = configExt;
        this.#audioCtx = audioCtx;
        this.#renderLoop = new Looper(() => this.analyseLoop());

        this.#subscriptions = [
            this.#player.subscribe('data/ready', this.#onDataReady),
            this.#player.subscribe('media/play', this.startLoop.bind(this)),
            this.#player.subscribe('media/pause', this.stopLoop.bind(this))
        ];

        this.#initAnalysers();
        this.#player.audio.addNode(this.#audio.splitter, null, 99, apiKey);

    }

    /**
     * Handles "data/ready" events to activate audio analysis based on media type.
     * @param {module:src/core/Data~mediaItem} mediaItem            Object containing media type info.
     * @param {string}                         mediaItem.mediaType  Type of the media ('video' or 'audio').
     * @listens module:src/core/Data#data/ready
     */
    #onDataReady = ({ mediaType }) => {

        this.#isActive = this.#config.audioOnly ? mediaType === 'audio' : true;
        this.#player.dom.getElement(this.#apiKey).classList.toggle('has-audio-analyser', this.#isActive);
        if (!this.#isActive) this.stopLoop();

    };

    /**
     * Initializes the audio analysers for each channel.
     * Creates a ChannelSplitter and an Analyser for each channel, and connects them.
     */
    #initAnalysers() {

        this.#audio.splitter = this.#audioCtx.createChannelSplitter(this.#config.channels);

        for (let i = 0; i < this.#config.channels; i += 1) {
            const analyser = this.#audioCtx.createAnalyser();
            analyser.fftSize = this.#config.fftSize;
            analyser.minDecibels = this.#config.minDecibels;
            analyser.maxDecibels = this.#config.maxDecibels;
            analyser.smoothingTime = this.#config.smoothingTime;

            this.#audio.frequencyData.push(new Uint8Array(analyser.frequencyBinCount));
            this.#audio.waveformData.push(new Uint8Array(analyser.frequencyBinCount));
            this.#audio.analysers.push(analyser);
        }

        this.#audio.analysers.forEach((analyser, index) => {
            this.#audio.splitter.connect(analyser, index);
        });

    }

    /**
     * Starts the audio analysis loop.
     * @listens module:src/core/Media#media/play
     */
    startLoop() {

        if (!this.#isActive) return;

        clearTimeout(this.#stopDelayId);
        this.#renderLoop.start();

    }

    /**
     * Stops the audio analysis loop after a configured delay.
     * The delay is used to that the visualization can "cool down" without being frozen inplace.
     * @listens module:src/core/Media#media/pause
     */
    stopLoop() {

        clearTimeout(this.#stopDelayId);
        this.#stopDelayId = setTimeout(() => this.#renderLoop.stop(), this.#config.stopDelay);

    }

    /**
     * Main loop for audio analysis. Retrieves frequency and time domain data, then schedules the next iteration.
     * Used by subclasses in their own rendering loops for collecting data from the analyser.
     * @returns {Object} Object containing both `frequencyData` and `waveformData`.
     */
    analyseLoop() {

        this.#audio.analysers.forEach((analyser, index) => {
            analyser.getByteFrequencyData(this.#audio.frequencyData[index]);
            analyser.getByteTimeDomainData(this.#audio.waveformData[index]);
        });

        return {
            frequencyData: this.#audio.frequencyData,
            waveformData: this.#audio.waveformData
        };

    }

    /**
     * Tears down the AnalyserAudio component.
     * Disconnects audio nodes, cancels timeouts/animation frames, unsubscribes from events, and releases references.
     */
    destroy() {

        clearTimeout(this.#stopDelayId);
        this.#renderLoop.destroy();
        this.#audio.splitter.disconnect();
        this.#audio.analysers.forEach(analyser => analyser.disconnect());
        this.#player.audio.removeNode(this.#audio.splitter, null, this.#apiKey);
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#audio = this.#audioCtx = this.#apiKey = null;

    }

    /**
     * Reduces the size of the frequency array to the target size by averaging groups of frequencyData.
     * @param   {number[]} inputArray  Original frequency data array.
     * @param   {number}   targetSize  Desired size of the output array.
     * @returns {number[]}             The reduced frequency data array.
     */
    static reduceFrequencies(inputArray, targetSize) {
        const inputSize = inputArray.length;

        // If the target size is equal to or larger than the input size, return a copy of the array
        if (inputSize <= targetSize) return inputArray.slice(); // Return a copy of the array

        const groupSize = Math.floor(inputSize / targetSize);

        // Array with the averaged values, using map and slice
        return Array.from({ length: targetSize }, (_, i) => {
            const start = i * groupSize,
                  end = i === targetSize - 1 ? inputSize : (i + 1) * groupSize,
                  group = inputArray.slice(start, end);

            // Calculate the average of the current group
            return group.reduce((sum, value) => sum + value, 0) / group.length;
        });
    }
}
