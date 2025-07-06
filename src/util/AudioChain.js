/**
 * The `AudioChain` component implements an own audio processing chain for the player, where other components can insert their own processing chains in order to add effects, filters, analyzers or other processing.
 * This component ensures that all audio is routed through a consistent and controllable flow and also automatically suspends or resumes audio processing based on the media's playback state.
 * If no external `AudioNode`s are attached, the audio is simply passed through. As soon as other modules insert nodes into the chain, they are automatically connected in a logical sequence,
 * and disconnected when removed. Please note that this component has some limitations when building the audio graph, so it is recommended to add `AudioNode`s early during initialization and not change the graph later on.
 * @exports module:src/util/AudioChain
 * @author Frank Kudermann - alphanull
 * @version 1.0.0
 * @license MIT
 */
export default class AudioChain {

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
     * The Web Audio API context.
     * @type {AudioContext}
     */
    #audioContext;

    /**
     * The Master Gain Node. All nodes will eventually connect to masterGain -> speakers.
     * @type {AudioNode}
     */
    #masterGain;

    /**
     * List of registered audio nodes.
     * @type {Array<{ input: AudioNode, output: AudioNode|null, order: number }>}
     */
    #nodes = [];

    /**
     * The MediaElementSourceNode connected to the video element. Will be set in `connectVideo()`.
     * @type {MediaElementAudioSourceNode|null}
     */
    #mediaSource = null;

    /**
     * Timeout id delaying suspending.
     * @type {number}
     */
    #suspendDelayId;

    /**
     * Creates an instance of the AudioChain component.
     * @param {module:src/core/Player} player            The player instance.
     * @param {module:src/core/Player} parent            Reference to the parent instance.
     * @param {Object}                 [options]         Additional options.
     * @param {symbol}                 [options.apiKey]  Token for extended access to the player API.
     */
    constructor(player, parent, { apiKey }) {

        if (!player.initConfig('audioChain', true)) return [false];

        // use latencyHint: 'playback' to prevent 'bad' audio on android
        this.#audioContext = new AudioContext({ latencyHint: 'playback' });

        this.#masterGain = this.#audioContext.createGain();
        this.#masterGain.gain.value = 1;
        this.#masterGain.connect(this.#audioContext.destination);

        this.#apiKey = apiKey;

        this.#player = player;
        this.#player.setApi('audio.addNode', this.#addNode, this.#apiKey);
        this.#player.setApi('audio.removeNode', this.#removeNode, this.#apiKey);
        this.#player.setApi('audio.getContext', this.#getContext, this.#apiKey);

        this.#subscriptions = [
            ['data/ready', this.#disconnectVideo],
            ['media/ready', this.#connectVideo],
            ['media/play', this.#resumeAudio],
            ['media/pause', this.#suspendAudio]
        ].map(([event, handler]) => this.#player.subscribe(event, handler));

    }

    /**
     * Provides the audio context of this component.
     * @param   {symbol}       apiKey  Token needed to grant access in secure mode.
     * @returns {AudioContext}         The current AudioContext.
     * @throws  {Error}                If safe mode access was denied.
     */
    #getContext = apiKey => {

        if (this.#apiKey && this.#apiKey !== apiKey) {
            throw new Error('[Visionplayer] Secure mode: access denied.');
        }

        return this.#audioContext;

    };

    /**
     * Inserts an audio node into the internal processing chain. This method expects the input and output (or `null` if no output is defined, as with analysers)
     * of the processing chain to be inserted, and optionally an `order` value which determines when the inserted chain will be executed.
     * @param  {AudioNode}      input    Input node receiving audio.
     * @param  {AudioNode|null} output   Output node passing audio forward (null if not chaining).
     * @param  {number}         [order]  Sorting index for node processing order.
     * @param  {symbol}         apiKey   Token needed to grant access in secure mode.
     * @throws {Error}                   If safe mode access was denied.
     */
    #addNode = (input, output, order = 0, apiKey) => {

        if (this.#apiKey && this.#apiKey !== apiKey) {
            throw new Error('[Visionplayer] Secure mode: access denied.');
        }

        this.#nodes.push({ input, output, order });

        // Maybe rebuild chain later in dev,
        // but for now it is only meant to be used during setup time, not runtime
        // this.#disconnectAudio();
        // this.#connectAudio();
    };

    /**
     * Removes a previously added audio node from the processing chain. This method expects the input and outputs of the processing chain to be removed from the 'master chain'.
     * @param  {AudioNode}      input   Input node to remove.
     * @param  {AudioNode|null} output  Output node to remove.
     * @param  {symbol}         apiKey  Token needed to grant access in secure mode.
     * @throws {Error}                  If safe mode access was denied.
     */
    #removeNode = (input, output, apiKey) => {

        if (this.#apiKey && this.#apiKey !== apiKey) {
            throw new Error('[Visionplayer] Secure mode: access denied.');
        }

        const idx = this.#nodes.findIndex(n => n.input === input && (n.output === output || !n.output && !output));

        if (idx >= 0) {
            // Maybe rebuild chain later in dev,
            // but for now it is only meant to be used during setup time, not runtime
            input.disconnect();
            if (output) output.disconnect();
            // this.#disconnectAudio();
            this.#nodes.splice(idx, 1);
            // this.#connectAudio();
        }
    };

    /**
     * Connects the MediaElementAudioSourceNode to the Web Audio graph.
     * Ensures that only one instance of mediaSource exists.
     * @listens module:src/core/Media#media/ready
     */
    #connectVideo = () => {

        if (this.#mediaSource) return;

        const videoElem = this.#player.media.getElement(this.#apiKey);
        this.#mediaSource = this.#audioContext.createMediaElementSource(videoElem); // Create exactly one MediaElementSource for the <video>
        this.#connectAudio(); // Now wire all nodes in the chain

    };

    /**
     * Disconnects the MediaElementAudioSourceNode.
     * @listens module:src/core/Data#data/ready
     */
    #disconnectVideo = () => {

        if (!this.#mediaSource) return;

        this.#mediaSource.disconnect();
        this.#mediaSource = null;
    };

    /**
     * Suspends the audio context with a delay after pausing.
     * @listens module:src/core/Media#media/pause
     */
    #suspendAudio = () => {

        clearTimeout(this.#suspendDelayId);
        this.#suspendDelayId = setTimeout(() => this.#audioContext.suspend(), 2000);

    };

    /**
     * Resumes the audio context immediately when playback starts.
     * @listens module:src/core/Media#media/play
     */
    #resumeAudio = () => {

        clearTimeout(this.#suspendDelayId);
        this.#audioContext.resume();
    };

    /**
     * Builds the audio processing chain and connects nodes in the correct order.
     */
    #connectAudio() {

        // Sort nodes by order
        const sorted = [...this.#nodes].sort((a, b) => (a.order || 0) - (b.order || 0));

        // If there are any nodes in the chain, attach them to mediaSource
        if (sorted.length) {

            let prev = this.#mediaSource;
            for (const { input, output } of sorted) {
                prev.connect(input);
                prev = output || prev; // If output is null (e.g., AnalyserNode), prev remains the same
            }
            prev.connect(this.#masterGain);

        } else this.#mediaSource.connect(this.#masterGain); // No additional nodes, directly connect mediaSource to masterGain

        // Close the chain by connecting masterGain to the output

        this.#masterGain.connect(this.#audioContext.destination);
    }

    /**
     * Disconnects all audio nodes and resets the processing chain.
     */
    #disconnectAudio() {

        clearTimeout(this.#suspendDelayId);
        this.#mediaSource?.disconnect();
        this.#masterGain.disconnect();

        // Remove only the first connection from mediaSource
        this.#nodes.forEach(({ input }) => {
            this.#mediaSource.disconnect(input);
        });

        this.#nodes = [];
    }

    /**
     * Completely tears down the audio system.
     * Unsubscribes from all events, removes nodes, and closes the audio context.
     */
    destroy() {

        this.#disconnectAudio();
        this.#disconnectVideo();
        this.#audioContext.close();

        this.#player.removeApi(['audio.addNode', 'audio.removeNode', 'audio.getContext'], this.#apiKey);
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#audioContext = this.#mediaSource = this.#apiKey = null;

    }

}
