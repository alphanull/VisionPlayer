import DomSmith from '../../lib/dom/DomSmith.js';

/**
 * The PlayOverlay component displays a large play button centered in the viewport, allowing the user to toggle media playback.
 * It dynamically hides or shows itself in response to player events and can optionally dim the background when paused.
 * The overlay can also be shown only once after media load, based on configuration.
 * @exports module:src/controller/PlayOverlay
 * @requires lib/dom/DomSmith
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class PlayOverlay {

    /**
     * Holds the instance configuration for this component.
     * @type     {Object}
     * @property {boolean} [dimmer=false]    If enabled, dims the viewport background when media is paused.
     * @property {boolean} [showOnce=false]  If enabled, shows the overlay only once after the media has loaded.
     */
    #config = {
        dimmer: false,
        showOnce: false
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
     * Reference to the DomSmith Instance for the UI element.
     * @type {module:lib/dom/DomSmith}
     */
    #overlay;

    /**
     * Internal disabled flag to track whether the overlay is currently active.
     * @type {boolean}
     */
    #isDisabled = false;

    /**
     * Creates an instance of the PlayOverlay component.
     * @param {module:src/core/Player} player  Reference to the VisionPlayer instance.
     * @param {module:src/ui/UI}       parent  Reference to the parent instance, in this case the UI component.
     */
    constructor(player, parent) {

        this.#config = player.initConfig('playOverlay', this.#config);

        if (!this.#config) return [false];

        this.#player = player;

        const domConfig = {
            _ref: 'wrapper',
            className: 'vip-play-overlay is-hidden',
            'data-sort': 50,
            _nodes: []
        };

        if (!this.#player.getConfig('media.autoPlay') || !this.#config.showOnce) {
            domConfig._nodes.push({
                className: 'icon-bg',
                _nodes: [{
                    _ref: 'button',
                    _tag: 'button',
                    className: 'play icon',
                    ariaLabel: this.#player.locale.t('commands.play'),
                    pointerup: this.#togglePlay
                }]
            });
        }

        if (this.#config.dimmer) domConfig._nodes.push({ className: 'vip-play-overlay-dimmer' });

        this.#overlay = new DomSmith(domConfig, parent.getElement());

        this.#subscriptions = [
            ['media/ready', this.#onMediaReady],
            ['media/play', this.#onPlay],
            ['media/pause', this.#onPause],
            ['media/canplay', this.#enable],
            ['media/error', this.#disable],
            ['data/nomedia', this.#disable]
        ].map(([event, handler]) => this.#player.subscribe(event, handler));

    }

    /**
     * Invoked when the media has loaded and metadata is available.
     * @listens module:src/core/Media#media/ready
     */
    #onMediaReady = () => {

        this.#isDisabled = false;

        if (this.#player.getState('media.paused')) this.#onPause();
        else this.#onPlay();

    };

    /**
     * This method toggles play / pause.
     */
    #togglePlay = () => {

        if (this.#isDisabled) return;

        if (this.#player.getState('media.paused')) this.#player.media.play();
        else this.#player.media.pause();

    };

    /**
     * This method switches the appearance of the play button to the 'play' state.
     * @listens module:src/core/Media#media/play
     */
    #onPlay = () => {

        if (this.#isDisabled) return;

        if (this.#config.showOnce) this.#isDisabled = true;
        this.#overlay.wrapper.classList.add('is-hidden');

    };

    /**
     * This method switches the appearance of the play button to the 'pause' state.
     * @listens module:src/core/Media#media/pause
     */
    #onPause = () => {

        if (this.#isDisabled) return;

        this.#overlay.wrapper.classList.remove('is-hidden');

    };

    /**
     * This method enables the play button.
     * @listens module:src/core/Media#media/canplay
     */
    #enable = () => {

        if (this.#isDisabled && this.#config.showOnce) return;

        this.#isDisabled = false;
        if (this.#overlay.button) this.#overlay.button.disabled = false;
        this.#overlay.wrapper.classList.remove('is-disabled');

    };

    /**
     * This method disables the play button, for example after an error occurred.
     * @listens module:src/core/Media#media/error
     * @listens module:src/core/Data#data/nomedia
     */
    #disable = () => {

        this.#isDisabled = true;
        if (this.#overlay.button) this.#overlay.button.disabled = true;
        this.#overlay.wrapper.classList.add('is-disabled');

    };

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        this.#overlay.destroy();
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#overlay = null;

    }

}
