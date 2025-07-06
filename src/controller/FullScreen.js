import DomSmith from '../../lib/dom/DomSmith.js';

/**
 * The FullScreen component manages entering and exiting fullscreen mode within the player.
 * It supports the standardized Fullscreen API, as well as iOS-specific handling.
 * A button in the controller area or the settings menu allows the user to toggle fullscreen.
 * @exports module:src/controller/FullScreen
 * @requires lib/dom/DomSmith
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class FullScreen {

    /**
     * Reference to the media player instance.
     * @type {module:src/core/Player}
     */
    #player;

    /**
     * Array of subscription callbacks for player events.
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
     * The fullscreen button icon, created by DomSmith.
     * @type {module:lib/dom/DomSmith}
     */
    #dom;

    /**
     * This object delivers an abstract interface to the browsers fullscreen API by mapping the standard method, event and property names to the ones the current browser actually understands.
     * It is necessary to use such an abstraction, because some older browsers use special vendor prefixed names.
     * @type {module:src/controller/FullScreen~fsApiNames}
     */
    #fsApi;

    /**
     * Flag indicating whether the player is in fullscreen mode.
     * @type {boolean}
     */
    #isFullScreen = false;

    /**
     * Flag indicating whether the player is currently playing (used for certain iOS handling).
     * @type {boolean}
     */
    #isPlaying = false;

    /**
     * Timer reference for delayed checks on iOS play/pause states.
     * @type {number}
     */
    #isPlayingDelay = -1;

    /**
     * Creates an instance of the FullScreen component.
     * @param {module:src/core/Player}           player            Reference to the VisionPlayer instance.
     * @param {module:src/controller/Controller} parent            Reference to the parent instance.
     * @param {Object}                           [options]         Additional options.
     * @param {symbol}                           [options.apiKey]  Token for extended access to the player API.
     */
    constructor(player, parent, { apiKey }) {

        this.#fsApi = this.#initFullScreenApi();

        if (!player.getClient('iOS') && !this.#fsApi || !player.initConfig('fullScreen', true)) {
            return [false];
        }

        this.#player = player;
        this.#apiKey = apiKey;

        this.#dom = new DomSmith({
            _tag: 'button',
            _ref: 'fsButton',
            className: 'fullscreen-enter icon',
            ariaLabel: this.#player.locale.t('misc.fullscreen'),
            click: this.#toggleFullScreen,
            'data-sort': 66,
            $tooltip: { player, text: this.#player.locale.t('misc.fullscreen') }
        }, parent.getElement('right'));

        const subs = [
            ['data/ready', this.#onDataReady],
            ['data/nomedia', this.#disable],
            ['media/error', this.#disable],
            ['media/canplay', this.#enable]
        ];

        // iOS-specific fullscreen toggles
        if (this.#player.getClient('iOS') && !this.#fsApi) {
            subs.push(
                ['media/play', this.#togglePlayPause],
                ['media/pause', this.#togglePlayPause],
                ['media/webkitbeginfullscreen', this.#enterFullScreen],
                ['media/webkitendfullscreen', this.#exitFullScreen]
            );
        } else {
            document.addEventListener(this.#fsApi.fullscreenchange, this.#onFullScreen);
        }

        this.#subscriptions = subs.map(([event, handler]) => this.#player.subscribe(event, handler));

    }

    /**
     * Initializes the Fullscreen API based on the browser's support.
     * @returns {module:src/controller/FullScreen~fsApiNames|false} Returns name map, or 'false' if no matches were found.
     */
    #initFullScreenApi() { // eslint-disable-line

        const map = [
            ['requestFullscreen', 'exitFullscreen', 'fullscreenElement', 'fullscreenEnabled', 'fullscreenchange', 'fullscreenerror'], // Standard
            ['webkitRequestFullscreen', 'webkitExitFullscreen', 'webkitFullscreenElement', 'webkitFullscreenEnabled', 'webkitfullscreenchange', 'webkitfullscreenerror'] // new WebKit
        ];

        const api = map.find(value => value && value[1] in document);

        return api
            ? api.reduce((acc, val, index) => {
                acc[map[0][index]] = val; return acc;
            }, {})
            : false;

    }

    /**
     * Sets up the component once the media data is available.
     * Disables fullscreen for iOS audio, otherwise enables the fullscreen button.
     * @param {module:src/core/Data~mediaItem} mediaItem            Object containing media type info.
     * @param {string}                         mediaItem.mediaType  Type of the media ('video' or 'audio').
     * @listens module:src/core/Data#data/ready
     */
    #onDataReady = ({ mediaType }) => {

        if (this.#player.getClient('iOS') && mediaType === 'audio') {
            this.#dom.fsButton.disabled = true; // on iOS, disable fullscreen button for audio
        } else {
            this.#dom.fsButton.disabled = false;
        }

    };

    /**
     * Toggles the internal `isPlaying` flag based on play/pause events.
     * On iOS, used to track whether the player was playing when fullscreen ended.
     * @param {null}  event  No Payload.
     * @param {Event} topic  The event topic ('media/play' or 'media/pause').
     * @listens module:src/core/Media#media/play
     * @listens module:src/core/Media#media/pause
     */
    #togglePlayPause = (event, topic) => {

        if (!this.#isFullScreen) return;

        clearTimeout(this.#isPlayingDelay);

        if (topic === 'media/pause' && this.#isPlayingDelay < 0) {

            this.#isPlayingDelay = setTimeout(() => {
                this.#isPlaying = false;
                this.#isPlayingDelay = -1;
            }, 500);

        } else {

            this.#isPlayingDelay = -1;
            this.#isPlaying = true;

        }

    };

    /**
     * Toggles fullscreen mode on or off.
     */
    #toggleFullScreen = () => {

        if (document[this.#fsApi.fullscreenElement]) {
            this.#cancelFullScreen();
        } else {
            this.#launchFullScreen();
        }

    };

    /**
     * Launches fullscreen mode using the fullscreen API or iOS-specific method.
     * @param  {HTMLElement} [element]  The element to enter fullscreen (defaults to player root if not provided).
     * @throws {Error}                  If fullscreen cannot be initiated.
     */
    #launchFullScreen(element = this.#player.dom.getElement(this.#apiKey)) {

        const request = this.#fsApi.requestFullscreen;

        if (this.#player.getClient('iOS') && !this.#fsApi) {
            this.#isPlaying = !this.#player.getState('media.paused');
            this.#player.media.getElement(this.#apiKey).webkitEnterFullscreen();
        } else {
            element[request]();
        }

    }

    /**
     * Handler for native fullscreen events.
     * @type {Function}
     */
    #onFullScreen = () => {

        if (document[this.#fsApi.fullscreenElement]) {
            this.#enterFullScreen();
        } else {
            this.#exitFullScreen();
        }

    };

    /**
     * Cancels fullscreen mode.
     * @throws {Error} If fullscreen cannot be exited.
     */
    #cancelFullScreen() {

        if (this.#player.getClient('iOS') && !this.#fsApi) {
            this.#player.media.getElement(this.#apiKey).webkitExitFullscreen();
        } else if (this.#isFullScreen) {
            document[this.#fsApi.exitFullscreen]();
        }

    }

    /**
     * Called when fullscreen mode is launched.
     * @fires   module:src/controller/FullScreen#fullscreen/enter
     * @listens module:src/core/Media#media/webkitbeginfullscreen
     */
    #enterFullScreen = () => {

        this.#dom.fsButton.classList.remove('fullscreen-enter');
        this.#dom.fsButton.classList.add('fullscreen-exit');
        this.#player.dom.getElement(this.#apiKey).classList.add('is-fullscreen');
        this.#isFullScreen = true;
        this.#player.publish('fullscreen/enter', this.#apiKey);

    };

    /**
     * Called when fullscreen mode is cancelled or exited.
     * Handles iOS quirks regarding playback resumption.
     * @fires module:src/controller/FullScreen#fullscreen/leave
     * @listens module:src/core/Media#media/webkitendfullscreen
     */
    #exitFullScreen = () => {

        if (this.#player.getClient('iOS')) {
            clearTimeout(this.#isPlayingDelay);
            if (this.#isPlaying) {
                this.#isPlayingDelay = setTimeout(() => this.#player.media.play(), 1000);
            }
        }

        this.#dom.fsButton.classList.add('fullscreen-enter');
        this.#dom.fsButton.classList.remove('fullscreen-exit');
        this.#player.dom.getElement(this.#apiKey).classList.remove('is-fullscreen');
        this.#isFullScreen = false;
        this.#player.publish('fullscreen/leave', this.#apiKey);

    };

    /**
     * Disables the fullscreen button in the UI.
     * @listens module:src/core/Media#media/error
     * @listens module:src/core/Data#data/nomedia
     */
    #disable = () => {

        this.#dom.fsButton.disabled = true;

    };

    /**
     * Enables the fullscreen button in the UI.
     * @listens module:src/core/Media#media/canplay
     */
    #enable = () => {

        this.#dom.fsButton.disabled = false;

    };

    /**
     * Removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        clearTimeout(this.#isPlayingDelay);
        document.removeEventListener(this.#fsApi.fullscreenchange, this.#onFullScreen);
        this.#dom.destroy();
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#dom = this.#apiKey = null;

    }
}

/**
 * The object used to map browser specific fullscreen API names to the 'official' ones.
 * @typedef  {Object<string>} module:src/controller/FullScreen~fsApiNames
 * @property {string} exitFullscreen     Name for the method which is used for exiting fullscreen mode.
 * @property {string} fullscreenElement  Returns the Element that is currently being presented in full-screen mode in this document, or null if full-screen mode is not currently in use.
 * @property {string} fullscreenEnabled  Name for the property which returns a Boolean that reports whether or not full-screen mode is available.
 * @property {string} fullscreenchange   Name for the onfullscreenchange event, which is fired when the browser is switched to/out-of fullscreen mode.
 * @property {string} fullscreenerror    Name for the fullscreenerror event, which is fired when the browser cannot switch to fullscreen mode.
 * @property {string} requestFullscreen  Name for the requestFullscreen method, which issues an asynchronous request to make the element be displayed full-screen.
 */

/**
 * Fired when the player enters fullscreen mode.
 * @event module:src/controller/FullScreen#fullscreen/enter
 */

/**
 * Fired when the player exits fullscreen mode.
 * @event module:src/controller/FullScreen#fullscreen/leave
 */
