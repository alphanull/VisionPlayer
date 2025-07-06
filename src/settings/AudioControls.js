import DomSmith from '../../lib/dom/DomSmith.js';

/**
 * The AudioControls component provides an equalizer for adjusting multiple frequency bands of the audio output.
 * It integrates with the player’s internal audio processing chain and provides real-time feedback for all adjustments.
 * This component is part of the player’s extended audio feature set and attaches its UI to the 'controls' popup component.
 * @exports module:src/settings/AudioControls
 * @requires lib/dom/DomSmith
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class AudioControls {

    /**
     * Holds the instance configuration for this component.
     * @type     {Object}
     * @property {number[]} [bands=[1, 1, 1, 1, 1]]  Default frequency band values. Each band controls a specific frequency range from low to high.
     */
    #config = {
        bands: Array(5).fill(1)
    };

    /**
     * Reference to the main player instance.
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
     * Reference to the DomSmith instance. Displays UI elements for the equalizer.
     * @type {module:lib/dom/DomSmith}
     */
    #dom;

    /**
     * Use the shared AudioContext from the player's Audio Manager.
     * @type {AudioContext}
     */
    #audioCtx;

    /**
     * Logarithmically spaced crossover frequencies.
     * @type {number[]}
     */
    #edges = [];

    /**
     * Stores all frequency bands.
     * @type {Array<{gainNode: GainNode, filters: BiquadFilterNode[]}>}
     */
    #eqBands = [];

    /**
     * Master output gain node.
     * @type {GainNode}
     */
    #output;

    /**
     * Gain node for the bypass path.
     * @type {GainNode}
     */
    #bypassGain;

    /**
     * Input gain node for the equalizer path.
     * @type {GainNode}
     */
    #eqInput;

    /**
     * Output gain node for the equalizer path.
     * @type {GainNode}
     */
    #eqOutput;

    /**
     * Main input gain node that connects to both bypass and EQ paths.
     * @type {GainNode}
     */
    #input;

    /**
     * Stores shared filter instances to optimize processing.
     * @type {Array<{low: BiquadFilterNode[], high: BiquadFilterNode[]}>|null}
     */
    #sharedFilters = null;

    /**
     * Creates an instance of the AudioControls Component.
     * @param {module:src/core/Player} player            Reference to the media player instance.
     * @param {module:src/ui/Popup}    parent            Reference to the parent instance (In this case the settings popup).
     * @param {Object}                 [options]         Additional options.
     * @param {symbol}                 [options.apiKey]  Token for extended access to the player API.
     */
    constructor(player, parent, { apiKey }) {

        this.#config = player.initConfig('audioControls', this.#config);

        const audioContext = player?.audio?.getContext(apiKey);

        if (!this.#config || !audioContext) return [false];

        if (this.#config.bands.length < 2) this.#config.bands = Array(2).fill(1);
        if (this.#config.bands.length > 16) this.#config.bands = Array(16).fill(1);

        this.#player = player;
        this.#audioCtx = audioContext;
        this.#apiKey = apiKey;

        const standardFreqs = [20, 25, 31, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000];

        /**
         * Finds the nearest standard center frequency for a given value.
         * This is used to display user-friendly frequency labels (e.g. 40, 160, 630, 2.5K, 10K) instead of raw calculated values.
         * @param   {number} f  The frequency value to match (in Hz).
         * @returns {number}    The closest standard frequency from the standardFreqs array.
         */
        function findNearestStandardFreq(f) {
            return standardFreqs.reduce((prev, curr) => Math.abs(curr - f) < Math.abs(prev - f) ? curr : prev);
        }

        /**
         * Formats a frequency value for display as a label.
         * Values >= 1000 Hz are shown as "xK" (e.g. 2.5K), others as integer Hz (e.g. 160).
         * @param   {number} f  The frequency value in Hz.
         * @returns {string}    The formatted frequency label.
         */
        function formatFreq(f) {
            return f >= 1000 ? `${(f / 1000).toFixed(f % 1000 === 0 ? 0 : 1)}K` : f;
        }

        const minFreq = 20,
              maxFreq = 20000,
              bands = this.#config.bands.length,
              labels = Array.from({ length: bands }, (_, i) => formatFreq(findNearestStandardFreq(
                  Math.sqrt(
                      minFreq * (maxFreq / minFreq) ** (i / bands)
                      * (minFreq * (maxFreq / minFreq) ** ((i + 1) / bands))
                  )
              )));

        this.#dom = new DomSmith({
            _ref: 'wrapper',
            className: 'vip-audio-controls',
            _nodes: [{
                _tag: 'h3',
                _nodes: [
                    this.#player.locale.t('misc.audio'),
                    {
                        _tag: 'button',
                        className: 'icon reset',
                        ariaLabel: this.#player.locale.t('commands.reset'),
                        click: this.#reset,
                        $tooltip: { player, text: this.#player.locale.t('commands.reset') }
                    }
                ]
            }, {
                className: 'vip-audio-controls-wrapper',
                _nodes: this.#config.bands.map((value, index) => ({
                    className: 'vip-audio-control-wrapper',
                    _nodes: [
                        {
                            _tag: 'input',
                            _ref: `band-${index}`,
                            'data-ref': index,
                            orient: 'vertical',
                            min: 0,
                            max: 2,
                            step: 0.01,
                            value,
                            defaultValue: value,
                            ariaLabel: `${this.#player.locale.t('audioControls.freqBand')} ${index + 1}`,
                            className: 'vip-audio-control has-center-line',
                            type: 'range',
                            change: this.#applySettings,
                            input: this.#applySettings,
                            pointermove: event => event.preventDefault()
                        },
                        {
                            _tag: 'span',
                            _nodes: [labels[index].toString()]
                        }
                    ]
                }))
            }]
        }, parent.getElement('center'));

        this.#createSubgraph(); // Setup Audio Chain
        this.#player.audio.addNode(this.#input, this.#output, 10, this.#apiKey); // Register to the player's audio manager
        this.#applySettings(); // Initial Render

    }

    /**
     * Creates the audio processing subgraph for the equalizer.
     * Sets up gain nodes for master output, bypass, and EQ paths.
     */
    #createSubgraph() {

        this.#output = this.#audioCtx.createGain();

        // Normalize overall gain so total power across N bands remains constant
        this.#output.gain.value = 1 / Math.sqrt(this.#config.bands.length);

        this.#bypassGain = this.#audioCtx.createGain();
        this.#bypassGain.gain.value = 1.0;
        this.#bypassGain.connect(this.#output);

        this.#eqInput = this.#audioCtx.createGain();

        this.#eqOutput = this.#audioCtx.createGain();
        this.#eqOutput.connect(this.#output);

        this.#input = this.#audioCtx.createGain();
        this.#input.connect(this.#bypassGain);
        this.#input.connect(this.#eqInput);

        // Now build linkwitz-riley inside eqInput -> eqOutput
        this.#buildLinkwitzRileyChain();

    }

    /**
     * Builds a multi-band Linkwitz-Riley crossover filter chain.
     * This method divides the frequency spectrum into multiple bands
     * and applies separate gain nodes to each band.
     */
    #buildLinkwitzRileyChain() {

        const numberOfBands = this.#config.bands.length; // Number of equalizer bands.

        if (numberOfBands < 1) return;

        const numberOfEdges = numberOfBands - 1, // Number of crossover edges (one less than the number of bands).
              minFreq = 20, // Minimum frequency for the crossover.
              maxFreq = 20000; // Maximum frequency for the crossover.

        this.#edges = Array.from({ length: numberOfEdges }, (_, i) => {
            const ratio = (i + 1) / numberOfBands;
            return minFreq * (maxFreq / minFreq) ** ratio;
        }).sort((a, b) => a - b);

        // Optimize by reusing shared filters if available
        if (!this.#sharedFilters) {
            this.#sharedFilters = this.#edges.map(freq => this.#createLinkwitzRiley(freq));
        }

        const splitBand = (inputNode, idx) => {

            if (idx >= this.#edges.length) {
                // Last remaining band (everything above the last crossover frequency)
                const leftoverGain = this.#audioCtx.createGain();
                leftoverGain.gain.value = 1.0;
                inputNode.connect(leftoverGain);
                leftoverGain.connect(this.#eqOutput);

                this.#eqBands.push({
                    gainNode: leftoverGain,
                    name: `Band ${idx} (leftover > ${this.#edges[idx - 1] || minFreq} Hz)`,
                    filters: []
                });
                return;
            }

            const lr = this.#sharedFilters[idx]; // Use precomputed Linkwitz-Riley filter

            // Connect input to both low-pass and high-pass branches
            inputNode.connect(lr.low[0]);
            inputNode.connect(lr.high[0]);

            const lowOut = lr.low[lr.low.length - 1],
                  highOut = lr.high[lr.high.length - 1],
                  lowGain = this.#audioCtx.createGain(); // Create a gain node for the low-frequency band

            lowGain.gain.value = 1.0;
            lowOut.connect(lowGain);
            lowGain.connect(this.#eqOutput);

            this.#eqBands.push({
                gainNode: lowGain,
                name: `Band ${idx} (< ${this.#edges[idx]} Hz)`,
                filters: lr.low
            });

            splitBand(highOut, idx + 1); // Recursively process the high-frequency band
        };

        splitBand(this.#eqInput, 0);

    }

    /**
     * Creates a 4th-order Linkwitz-Riley crossover at a given frequency.
     * This method generates two cascaded biquad filters for both
     * low-pass and high-pass filtering, resulting in a smooth crossover.
     * @param   {number} freq  The crossover frequency in Hz.
     * @returns {Object}       An object containing low-pass and high-pass filter arrays.
     */
    #createLinkwitzRiley = freq => {

        const low1 = this.#audioCtx.createBiquadFilter(); // First-order low-pass filter.
        low1.type = 'lowpass';
        low1.frequency.value = freq;
        low1.Q.value = Math.SQRT1_2;

        const low2 = this.#audioCtx.createBiquadFilter(); // Second-order low-pass filter.
        low2.type = 'lowpass';
        low2.frequency.value = freq;
        low2.Q.value = Math.SQRT1_2;

        // Chain the low-pass filters
        low1.connect(low2);

        const high1 = this.#audioCtx.createBiquadFilter(); // First-order high-pass filter.
        high1.type = 'highpass';
        high1.frequency.value = freq;
        high1.Q.value = Math.SQRT1_2;

        const high2 = this.#audioCtx.createBiquadFilter(); // Second-order high-pass filter.
        high2.type = 'highpass';
        high2.frequency.value = freq;
        high2.Q.value = Math.SQRT1_2;

        high1.connect(high2); // Chain the high-pass filters

        return {
            low: [low1, low2],
            high: [high1, high2]
        };
    };

    /**
     * Updates the gains of the equalizer bands when a slider changes or during initialization.
     * If all sliders remain at neutral (1.0), the EQ is bypassed entirely.
     * Otherwise, the equalizer bands are adjusted dynamically based on user input.
     * @param {Event} [target]  The event object containing the modified slider reference.
     */
    #applySettings = ({ target } = {}) => {

        if (target) {
            const value = Number(target.value),
                  ref = Number(target.getAttribute('data-ref'));

            if (this.#config.bands[ref] === value) return; // Skip if no change
            this.#config.bands[ref] = value;
        }

        // Adjust individual band gains
        this.#eqBands.forEach((bandObj, i) => {
            const sliderVal = this.#config.bands[i] ?? 1,
                  mappedGain = sliderVal <= 1 ? sliderVal : 1 + (sliderVal - 1) * 2.2;

            this.#fadeGain(bandObj.gainNode.gain, mappedGain);
        });

        /**
         * Computes a normalization factor to balance EQ loudness.
         * @private
         * @type {number}
         */
        const avgGain = this.#config.bands.reduce((a, b) => a + b, 0) / this.#eqBands.length,
              baseEQGain = avgGain > 0 ? 1 / avgGain : 0;

        // Enable bypass mode if all bands are neutral
        if (this.#config.bands.every(v => v === 1)) {
            this.#fadeGain(this.#output.gain, 1);
            this.#fadeGain(this.#bypassGain.gain, 1);
            this.#fadeGain(this.#eqOutput.gain, 0);
        } else {
            this.#fadeGain(this.#output.gain, 1 / Math.sqrt(this.#config.bands.length));
            this.#fadeGain(this.#bypassGain.gain, 0);
            this.#fadeGain(this.#eqOutput.gain, baseEQGain);
        }
    };

    /**
     * Smoothly transitions the gain parameter to a target value.
     * Uses `setTargetAtTime` for a subtle and natural fade effect.
     * @param {AudioParam} gParam  The gain parameter to adjust.
     * @param {number}     value   The target gain value.
     */
    #fadeGain(gParam, value) {

        gParam.cancelScheduledValues(this.#audioCtx.currentTime);
        gParam.setTargetAtTime(value, this.#audioCtx.currentTime, 0.02);

    }

    /**
     * Resets all equalizer bands to their default values.
     * Updates the UI and applies the default band settings.
     */
    #reset = () => {

        this.#config.bands.forEach((value, index) => {
            this.#dom[`band-${index}`].value = this.#config.bands[index] = Number(this.#dom[`band-${index}`].defaultValue);
        });

        this.#applySettings();

    };

    /**
     * Disconnects and cleans up all audio nodes related to the equalizer.
     * Ensures that all gain nodes, filters, and input/output connections are properly removed.
     */
    #disconnectAudio() {

        this.#bypassGain.disconnect();
        this.#bypassGain = null;

        this.#eqInput.disconnect();
        this.#eqInput = null;

        this.#eqOutput.disconnect();
        this.#eqOutput = null;

        // eqBands etc. ...
        this.#eqBands.forEach(b => {
            b.gainNode.disconnect();
            b.filters.forEach(f => f.disconnect());
        });

        this.#eqBands = [];

        this.#input.disconnect();
        this.#input = null;

        this.#output.disconnect();
        this.#output = null;

    }

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        this.#dom.destroy();
        this.#player.audio.removeNode(this.#input, this.#output, this.#apiKey);
        this.#disconnectAudio();
        this.#player.unsubscribe(this.subscriptions);
        this.#player = this.#dom = this.#audioCtx = this.#apiKey = null;

    }

}
