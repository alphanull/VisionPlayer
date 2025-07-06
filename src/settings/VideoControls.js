import { convertRange } from '../../lib/util/math.js';
import DomSmith from '../../lib/dom/DomSmith.js';

/**
 * The VideoControls component provides UI controls in the controls popup menu to adjust various visual properties of the video output in real time.
 * It includes sliders for brightness, contrast, saturation, sharpening, and hue-rotation.
 * These settings are mapped to CSS filters or SVG-based filters and applied live to the video element.
 * The component is disabled automatically for audio-only media.
 * @exports module:src/settings/VideoControls
 * @requires lib/dom/DomSmith
 * @requires lib/util/math
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class VideoControls {

    /**
     * @type     {Object}
     * @property {number} [brightness=1]  Enables brightness control and sets initial level (0..2 range).
     * @property {number} [contrast=1]    Enables contrast control and sets initial level (0..2 range).
     * @property {number} [sharpen=1]     Enables sharpen control and sets initial level (0..2 range).
     * @property {number} [saturate=1]    Enables saturation control and sets initial level (0..2 range).
     * @property {number} [rotateHue=1]   Enables hue-rotation control and sets initial factor (0..2 range).
     */
    #config = {
        brightness: 1,
        contrast: 1,
        sharpen: 1,
        saturate: 1,
        hue: 1
    };

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
     * Reference to the DomSmith Instance.
     * @type {module:lib/dom/DomSmith}
     */
    #dom;

    /**
     * SVG used for the unsharp mask-based sharpening effect (applies feGaussianBlur and feComposite).
     * @type {module:lib/dom/DomSmith}
     */
    #svg;

    /**
     * Holds the current control values for brightness, contrast, etc. Initialized from this.#config.
     * @type {Object<string, number>}
     */
    #controls;

    /**
     * Unique svg filter id.
     */
    #filterId;

    /**
     * Creates an instance of the VideoControls Component.
     * @param {module:src/core/Player} player            Reference to the media player instance.
     * @param {module:src/ui/Popup}    parent            Reference to the parent instance (In this case the settings popup).
     * @param {Object}                 [options]         Additional options.
     * @param {symbol}                 [options.apiKey]  Token for extended access to the player API.
     */
    constructor(player, parent, { apiKey }) {

        this.#config = player.initConfig('videoControls', this.#config);

        if (!this.#config) return [false];

        this.#player = player;
        this.#apiKey = apiKey;

        this.#controls = { ...this.#config };

        const isSafari = player.getClient('safari');
        if (isSafari) delete this.#controls.sharpen; // only real browsers support this ....

        this.#dom = new DomSmith({
            _ref: 'wrapper',
            className: 'vip-picture-controls',
            _nodes: [{
                _tag: 'h3',
                _nodes: [
                    this.#player.locale.t('misc.video'),
                    {
                        _tag: 'button',
                        _ref: 'reset',
                        className: 'icon reset',
                        ariaLabel: this.#player.locale.t('commands.reset'),
                        click: this.#resetFilter,
                        $tooltip: { player, text: this.#player.locale.t('commands.reset') }
                    }
                ]
            }, {
                className: 'vip-picture-controls-wrapper',
                _nodes: Object.entries(this.#controls).map(([control, value]) => ({
                    _tag: 'div',
                    className: 'vip-picture-control-wrapper',
                    _nodes: [{
                        _tag: 'span',
                        className: `vip-picture-control-label is-${control}-min`
                    }, {
                        _tag: 'input',
                        _ref: control,
                        'data-ref': control,
                        className: `vip-picture-control  has-center-line is-${control}`,
                        type: 'range',
                        min: 0,
                        max: 2,
                        step: 0.01,
                        value,
                        defaultValue: value,
                        ariaLabel: this.#player.locale.t(`videoControls.${control}`),
                        change: this.#updateFilter,
                        input: this.#updateFilter/* ,
                        $tooltip: { player, text: this.#player.locale.t(`videoControls.${control}`) } */
                    }, {
                        _tag: 'span',
                        className: `vip-picture-control-label is-${control}-max`
                    }]

                }))
            }]
        }, parent.getElement('top'));

        this.#filterId = `sharpness-filter-${this.#player.getConfig('player.id')}`;

        this.#svg = new DomSmith({
            _tag: 'svg',
            class: 'vip-sharpness-filter',
            _nodes: [{
                _tag: 'filter',
                id: this.#filterId,
                _nodes: [{
                    _ref: 'blurFilter',
                    _tag: 'feGaussianBlur',
                    in: 'SourceGraphic',
                    stdDeviation: 1,
                    result: 'blurred'
                }, {
                    _tag: 'feComposite',
                    in: 'SourceGraphic',
                    operator: 'arithmetic',
                    result: 'sharpened',
                    k1: 0,
                    k2: 3,
                    k3: -2,
                    k4: 0
                }]
            }]
        }, this.#player.dom.getElement(apiKey));

        this.#subscriptions = [this.#player.subscribe('media/ready', this.#onMediaReady)];

    }

    /**
     * Handler for "media/ready". If media is audio, disable controls; otherwise enable and apply them.
     * @param {module:src/core/Data~mediaItem} mediaItem            Object containing media type info.
     * @param {string}                         mediaItem.mediaType  Type of the media ('video' or 'audio').
     * @listens module:src/core/Data#data/ready
     */
    #onMediaReady = ({ mediaType }) => {

        if (mediaType === 'audio') {
            this.#hide();
            this.#disable();
            return;
        }

        this.#show();
        this.#enable();
        this.#updateFilter();

    };

    /**
     * Applies the current filter settings to the video element. Called on user input or onMediaReady.
     * @param {Event} [event]  The input/change event if triggered by user interaction.
     */
    #updateFilter = ({ target } = {}) => {

        if (target) {
            const value = Number(target.value),
                  ref = target.getAttribute('data-ref');
            this.#controls[ref] = value;
        }

        const controls = Object.entries(this.#controls);

        if (controls.every(([, value]) => value === 1)) {
            this.#player.media.getElement(this.#apiKey).style.filter = '';
            return;
        }

        const filter = controls.reduce((acc, [name, value]) => {

            let val;
            // map normalized slider values to sensible control ranges
            // so we can manipulate the video, but not too funky ...
            switch (name) {
                case 'hue':
                    val = `hue-rotate(${(value - 1) * 0.2}turn)`;
                    break;
                case 'brightness':
                    val = value > 1 ? `${name}(${convertRange(value, [1, 2], [1, 3])})` : `${name}(${value})`;
                    break;
                case 'saturate':
                    val = value > 1 ? `${name}(${convertRange(value, [1, 2], [1, 3])})` : `${name}(${value})`;
                    break;
                case 'sharpen':
                    if (value > 1) this.#svg.blurFilter.setAttribute('stdDeviation', (value - 1) * 2);
                    val = value > 1 ? ` url(#${this.#filterId})` : ` blur(${(1 - this.#controls.sharpen) * 3}px)`;
                    break;
                default:
                    val = value > 1 ? `${name}(${convertRange(value, [1, 2], [1, 3])})` : `${name}(${value})`;
                    break;
            }

            return `${acc} ${val}`;

        }, '');

        this.#player.media.getElement(this.#apiKey).style.filter = filter;

    };

    /**
     * Resets all picture controls to their default values, and re-renders the filter.
     */
    #resetFilter = () => {

        Object.entries(this.#controls).forEach(([name]) => {
            this.#dom[name].value = this.#controls[name] = this.#dom[name].defaultValue;
        });

        this.#updateFilter();

    };

    /**
     * Shows the controls.
     */
    #show() {

        this.#dom.wrapper.parentNode.style.display = 'flex';

    }

    /**
     * Completely hides the controls.
     */
    #hide() {

        this.#dom.wrapper.parentNode.style.display = 'none';
    }

    /**
     * Enables the UI controls.
     */
    #enable() {

        this.#dom.reset.disabled = false;
        Object.keys(this.#controls).forEach(key => {
            this.#dom[key].disabled = false;
        });

    }

    /**
     * Disables the UI controls, eg when the media is audio-only.
     */
    #disable() {

        this.#dom.reset.disabled = true;
        Object.keys(this.#controls).forEach(key => {
            this.#dom[key].disabled = true;
        });

    }

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        this.#dom.destroy();
        this.#svg.destroy();
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#dom = this.#svg = this.#apiKey = null;

    }

}
