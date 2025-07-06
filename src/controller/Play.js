import DomSmith from '../../lib/dom/DomSmith.js';

/**
 * The Play component shows a button which is used to start and pause playing the media.
 * Also listens to the appropriate events should the media be paused or played by other means,
 * and adapts the play button state accordingly (i.e. Showing the 'play' or 'pause' icon).
 * @exports module:src/controller/Play
 * @requires lib/dom/DomSmith
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class Play {

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
     * Reference to the DomSmith instance of the play button.
     * @type {module:lib/dom/DomSmith}
     */
    #dom;

    /**
     * Creates an instance of the Play component.
     * @param {module:src/core/Player}           player  Reference to the VisionPlayer instance.
     * @param {module:src/controller/Controller} parent  Reference to the parent instance, in this case the controller component.
     */
    constructor(player, parent) {

        if (!player.initConfig('playControl', true)) return [false];

        this.#player = player;

        const playText = this.#player.locale.t('commands.play'),
              pauseText = this.#player.locale.t('commands.pause');

        this.#dom = new DomSmith({
            _tag: 'button',
            _ref: 'playButton',
            className: 'play icon',
            disabled: true,
            'data-sort': 10,
            ariaLabel: playText,
            click: this.#togglePlay,
            $tooltip: { player, text: () => this.#player.getState('media.paused') ? playText : pauseText }
        }, parent.getElement('left'));

        this.#subscriptions = [
            ['data/ready', this.#onDataReady],
            ['media/pause', this.#onPause],
            ['media/play', this.#onPlay],
            ['data/nomedia', this.#disable],
            ['media/error', this.#disable],
            ['media/canplay', this.#enable]
        ].map(([event, handler]) => this.#player.subscribe(event, handler));

    }

    /**
     * Sets up the component as soon as the media data is available.
     * @listens module:src/core/Data#data/ready
     */
    #onDataReady = () => {

        this.#enable();

        if (this.#player.getState('media.paused') === false) this.#onPlay();
        else this.#onPause();

    };

    /**
     * Invoked when the user presses the play button. Toggles between 'play' and 'pause'.
     */
    #togglePlay = () => {

        // this.#dom.playButton.blur();

        if (this.#player.getState('media.paused')) this.#player.media.play();
        else this.#player.media.pause();

    };

    /**
     * This method switches the appearance of the play button to the play state.
     * @listens module:src/core/Media#media/play
     */
    #onPlay = () => {

        this.#dom.playButton.classList.remove('play');
        this.#dom.playButton.classList.add('pause');
        this.#dom.playButton.setAttribute('aria-pressed', 'true');
        this.#dom.playButton.setAttribute('aria-label', this.#player.locale.t('commands.pause'));

    };

    /**
     * This method switches the appearance of the play button to the pause state.
     * @listens module:src/core/Media#media/pause
     */
    #onPause = () => {

        this.#dom.playButton.classList.add('play');
        this.#dom.playButton.classList.remove('pause');
        this.#dom.playButton.setAttribute('aria-pressed', 'false');
        this.#dom.playButton.setAttribute('aria-label', this.#player.locale.t('commands.play'));

    };

    /**
     * Disables the button functionality. This method listens to media error events which cause the button to be disabled.
     * @listens module:src/core/Media#media/error
     * @listens module:src/core/Data#data/nomedia
     */
    #disable = () => {

        this.#dom.playButton.disabled = true;

    };

    /**
     * Enables the play button functionality. This method listens to canplay events in order to restore a usable state again
     * when the player recovered from a media error (for example by loading another file).
     * @listens module:src/core/Media#media/canplay
     */
    #enable = () => {

        this.#dom.playButton.disabled = false;

    };

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        this.#dom.destroy();
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#dom = null;

    }

}
