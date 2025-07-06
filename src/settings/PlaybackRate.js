import DomSmith from '../../lib/dom/DomSmith.js';

/**
 * The PlaybackRate component shows the current playback speed and also provides a UI to change it.
 * @exports module:src/settings/PlaybackRate
 * @requires lib/dom/DomSmith
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class PlaybackRate {

    /**
     * Holds the instance configuration for this component.
     * @type     {Object}
     * @property {number[]} [allowedValues=[0.25, 0.5, 1, 2, 4]]  This configures which playback rate speeds appear in the menu.
     * @property {number}   [speed=1]                             The initial playback speed.
     */
    #config = {
        speed: 1,
        allowedValues: [0.25, 0.5, 0.75, 0.85, 1, 1.25, 1.5, 2, 4]
    };

    /**
     * Reference to the main player instance.
     * @type {module:src/core/Player}
     */
    #player;

    /**
     * Reference to the quality menu.
     * @type {module:src/util/Menu}
     */
    #menu;

    /**
     * Holds tokens of subscriptions to player events, for later unsubscribe.
     * @type {number[]}
     */
    #subscriptions;

    /**
     * Creates an instance of the PlaybackRate component.
     * @param {module:src/core/Player} player  Reference to the media player instance.
     * @param {module:src/ui/Popup}    parent  Reference to the parent instance (In this case the settings popup).
     */
    constructor(player, parent) {

        this.#config = player.initConfig('playbackRate', this.#config);

        if (!this.#config || !this.#config.allowedValues.includes(this.#config.speed)) return [false];

        this.#player = player;

        this.#menu = new DomSmith({
            _ref: 'menu',
            className: 'vip-menu playbackrate-menu',
            _nodes: [{
                _tag: 'label',
                _nodes: [
                    {
                        _tag: 'span',
                        className: 'form-label-text',
                        _nodes: [
                            this.#player.locale.t('misc.playbackrate'),
                            {
                                _ref: 'speedLabel',
                                _text: ''
                            }
                        ]
                    }, {
                        _tag: 'input',
                        _ref: 'slider',
                        type: 'range',
                        min: 0,
                        max: this.#config.allowedValues.length - 1,
                        step: 1,
                        value: this.#config.opacity,
                        ariaLabel: this.#player.locale.t('misc.playbackrate'),
                        className: 'has-center-line',
                        change: ({ target }) => { this.#toggleSpeed(this.#config.allowedValues[target.value]); },
                        input: ({ target }) => { this.#toggleSpeed(this.#config.allowedValues[target.value]); }
                    }
                ]
            }]
        }, parent.getElement('center'));

        this.#subscriptions = [
            ['media/ready', this.#onMediaReady],
            ['media/ratechange', this.#onRateChange],
            ['data/nomedia', this.#disable],
            ['media/error', this.#disable],
            ['media/canplay', this.#enable]
        ].map(([event, handler]) => this.#player.subscribe(event, handler));

    }

    /**
     * Sets up the component as soon as the media is playable.
     * @listens module:src/core/Media#media/ready
     */
    #onMediaReady = () => {

        const liveStream = this.#player.getState('media.liveStream');

        if (liveStream && (this.#config.speed > 1 || this.#player.getState('media.playbackRate') > 1)) {
            this.#config.speed = 1;
        }

        this.#toggleSpeed(this.#config.speed);
        this.#onRateChange();

    };

    /**
     * Changes playback speed.
     * @param {number} value  The desired speed (1 is normal speed).
     */
    #toggleSpeed(value) {

        this.#config.speed = value;
        if (this.#player.getState('media.playbackRate') !== value) this.#player.media.playbackRate(value);

    }

    /**
     * This handler is called if playback speed is changed (either by this component or otherwise).
     * Updates the menus' "is-active" state accordingly.
     * @listens module:src/core/Media#media/ratechange
     */
    #onRateChange = () => {

        const playerRate = this.#player.getState('media.playbackRate');

        this.#menu.speedLabel.nodeValue = ` (x${playerRate})`;
        this.#menu.slider.setAttribute('aria-valuetext', `${playerRate}`);
        this.#menu.slider.value = this.#config.allowedValues.findIndex(val => val === playerRate);

    };

    /**
     * Enables the menu functionality. This method listens to canplay events in order to restore a usable state again
     * when the player recovered from a media error (for example by loading another file).
     * @listens module:src/core/Media#media/canplay
     */
    #enable = () => {

        this.#menu.slider.disabled = false;

    };

    /**
     * Disables the menu functionality. This method listens to media error events which cause the button to be disabled.
     * @listens module:src/core/Media#media/error
     * @listens module:src/core/Data#data/nomedia
     */
    #disable = () => {

        this.#menu.slider.disabled = true;

    };

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        this.#menu.destroy();
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#menu = null;

    }

}
