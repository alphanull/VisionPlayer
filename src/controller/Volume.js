import DomSmith from '../../lib/dom/DomSmith.js';

/**
 * The Volume component allows the user to adjust the media volume and toggle mute/unmute.
 * It optionally includes a slider UI for fine-grained control, which can auto-hide based on configuration.
 * The component listens to player state and updates its icon and slider accordingly.
 * On touch devices, it features specific interaction behavior for first tap and slider visibility.
 * @exports module:src/controller/Volume
 * @requires lib/dom/DomSmith
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class Volume {

    /**
     * Holds the instance configuration for this component.
     * @type     {Object}
     * @property {boolean} [slider=true]          If enabled, a volume slider is shown. If disabled, only muting / unmuting would be possible.
     * @property {boolean} [sliderAutoHide=true]  If enabled, the slider is automatically hidden on `pointerout` after a short delay.
     */
    #config = {
        slider: true,
        sliderAutoHide: true
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
     * DomSmith Instance for the volume wrapper.
     * @type {module:lib/dom/DomSmith}
     */
    #dom;

    /**
     * Used to restore former volume when muting / unmuting.
     * @type {number}
     */
    #savedVolume = 0;

    /**
     * Helper variable used for touch interaction. Since in this case there is no mouseover,
     * the first tap enables the slider, and a second one mutes the media.
     * @type {boolean}
     */
    #firstTap = false;

    /**
     * Timeout ID for hiding the slider automatically.
     * @type {number|undefined}
     */
    #autoHideId;

    /**
     * Creates an instance of the Volume component.
     * @param {module:src/core/Player}           player  Reference to the VisionPlayer instance.
     * @param {module:src/controller/Controller} parent  Reference to the parent instance, in this case the controller.
     */
    constructor(player, parent) {

        this.#config = player.initConfig('volumeControl', this.#config);

        if (!this.#config) return [false];

        this.#player = player;

        const domConfig = {
            _ref: 'wrapper',
            className: `vip-volume-wrapper${this.#config.sliderAutoHide ? '' : ' is-visible'}`,
            'data-sort': 30,
            _nodes: [{
                _tag: 'button',
                _ref: 'volButton',
                className: 'volume icon',
                ariaLabel: this.#player.locale.t('misc.volume'),
                pointerup: this.#toggleMute,
                $tooltip: { player, text: this.#player.locale.t('misc.volume') }
            }]
        };

        if (this.#config.slider && !this.#player.getClient('iOS')) {

            domConfig._nodes.push({
                className: 'vip-volume-slider',
                _nodes: [{
                    _tag: 'input',
                    _ref: 'volSlider',
                    className: 'vip-volume-slider-input',
                    type: 'range',
                    min: 0,
                    max: 1,
                    step: 0.01,
                    'data-sort': 21,
                    ariaLabel: this.#player.locale.t('misc.volumeSlider'),
                    change: this.#setVolume,
                    input: this.#setVolume
                }]
            });

            if (this.#config.sliderAutoHide) {
                domConfig.pointerover = this.#showSlider;
                domConfig.pointerout = this.#hideSlider;
            }
        }

        this.#dom = new DomSmith(domConfig, parent.getElement('left'));

        this.#subscriptions = [
            ['media/volumechange', this.#onVolumeUpdate],
            ['data/ready', this.#onVolumeUpdate],
            ['data/nomedia', this.#disable],
            ['media/error', this.#disable],
            ['media/canplay', this.#enable]
        ].map(([event, handler]) => this.#player.subscribe(event, handler));

    }

    /**
     * Toggle mute state on click/tap:
     * - On touch devices: First tap -> reveal the volume slider / Second tap -> actually mute/unmute
     * - On desktop: single click -> toggle mute immediately.
     * @param {PointerEvent} [event]  The PointerEvent that triggered this call.
     */
    #toggleMute = ({ pointerType }) => {

        if (pointerType === 'touch' && this.#config.slider && !this.#player.getClient('iOS')) {
            if (this.#firstTap === false) {
                this.#firstTap = true;
                return;
            }
        }

        this.#player.media.mute(!this.#player.getState('media.muted'));
        if (this.#player.getState('media.muted')) this.#player.media.volume(this.#savedVolume || 1);

    };

    /**
     * Sets the volume of the media based on user input in this component.
     */
    #setVolume = () => {

        if (this.#player.getState('media.muted') && this.#dom.volSlider.value > 0) {
            this.#player.media.mute(false);
        } else if (this.#dom.volSlider.value === '0' && !this.#player.getState('media.muted')) {
            this.#player.media.mute(true);
        }

        this.#player.media.volume(this.#dom.volSlider.value);

    };

    /**
     * Updates slider values and also adapts the icon display based on the current volume.
     * @listens module:src/core/Data#data/ready
     * @listens module:src/core/Media#media/volumechange
     */
    #onVolumeUpdate = () => {

        const volume = this.#player.getState('media.volume'),
              muted = this.#player.getState('media.muted'),
              { volButton, volSlider } = this.#dom;

        if (volSlider) {
            volSlider.value = muted ? 0 : volume;
            volSlider.setAttribute('aria-valuetext', `${this.#player.locale.t('misc.volume')}: ${volSlider.value * 100}%`);
        }

        this.#savedVolume = volume;

        volButton.classList.toggle('is-half', volume <= 0.5);
        volButton.classList.toggle('is-muted', volume === 0 || muted);

    };

    /**
     * Shows the volume slider (if autohide is enabled).
     * @param   {PointerEvent}      [event]  The PointerEvent that triggered this call.
     * @returns {boolean|undefined}          Returns false when disabled.
     * @fires   module:src/controller/Volume#volume/slider/show
     */
    #showSlider = ({ pointerType, target } = {}) => {

        if (target?.disabled) return false;

        if (pointerType === 'touch') {
            clearTimeout(this.#autoHideId);
            this.#autoHideId = setTimeout(this.#hideSlider, 3000);
        }

        this.#dom.wrapper.classList.add('is-visible');

    };

    /**
     * Hides the volume slider (if autohide is enabled).
     * @param {PointerEvent} [event]  The PointerEvent that triggered this call.
     * @fires module:src/controller/Volume#volume/slider/hide
     */
    #hideSlider = ({ pointerType } = {}) => {

        if (pointerType === 'touch' || !this.#dom.wrapper.classList.contains('is-visible')) return;

        this.#dom.wrapper.classList.remove('is-visible');
        this.#dom.volButton.blur();
        this.#firstTap = false;

    };

    /**
     * Disables the volume component (e.g., no media, or an error).
     * @listens module:src/core/Data#data/nomedia
     * @listens module:src/core/Media#media/error
     */
    #disable = () => {

        this.#hideSlider();
        this.#dom.volButton.disabled = true;
        if (this.#dom.volSlider) this.#dom.volSlider.disabled = true;

    };

    /**
     * Enables the volume component (e.g., once media can play).
     * @listens module:src/core/Media#media/canplay
     */
    #enable = () => {

        if (!this.#config.sliderAutoHide && this.#config.slider) this.#showSlider();
        this.#dom.volButton.disabled = false;
        if (this.#dom.volSlider) this.#dom.volSlider.disabled = false;

    };

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        clearTimeout(this.#autoHideId);
        this.#dom.destroy();
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#dom = null;

    }

}
