import DomSmith from '../../lib/dom/DomSmith.js';

const testEle = document.createElement('video'),
      hasPiP = 'pictureInPictureEnabled' in document,
      needsPiPWebkit = !hasPiP && testEle.webkitSupportsPresentationMode && typeof testEle.webkitSetPresentationMode === 'function';

/**
 * The PictureInPicture component enables support for native Picture-in-Picture (PiP) mode on platforms that support the standardized or WebKit-specific API.
 * It provides a control button in the settings menu and backdrop UI.
 * @exports module:src/controller/PictureInPicture
 * @requires lib/dom/DomSmith
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class PictureInPicture {

    /**
     * Reference to the main player instance.
     * @type {module:src/core/Player}
     */
    #player;

    /**
     * Reference to the parent instance.
     * @type {module:src/controller/Controller}
     */
    #parent;

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
     * A DomSmith instance for the PiP toggle button placed in the top container.
     * @type {module:lib/dom/DomSmith}
     */
    #control;

    /**
     * A DomSmith instance for the PiP backdrop, used if the video is displayed as PiP and
     * the user wants to cancel PiP or see a placeholder.
     * @type {module:lib/dom/DomSmith}
     */
    #backdrop;

    /**
     * Type of the media ('video' or 'audio').
     * @type {string}
     */
    #mediaType = '';

    /**
     * Creates an instance of the PictureInPicture component.
     * @param {module:src/core/Player}           player            Reference to the VisionPlayer instance.
     * @param {module:src/controller/Controller} parent            Reference to the parent instance, in this case the controller component.
     * @param {Object}                           [options]         Additional options.
     * @param {symbol}                           [options.apiKey]  Token for extended access to the player API.
     */
    constructor(player, parent, { apiKey }) {

        if (player.getClient('iPhone') || !hasPiP && !needsPiPWebkit || !player.initConfig('pictureInPicture', true)) return [false];

        this.#player = player;
        this.#parent = parent;
        this.#apiKey = apiKey;

        const id = this.#player.getConfig('player.id');

        this.#control = new DomSmith({
            _tag: 'label',
            for: `pip-control-${id}`,
            _nodes: [{
                _tag: 'span',
                className: 'form-label-text',
                _nodes: this.#player.locale.t('pip.title')
            }, {
                _ref: 'input',
                _tag: 'input',
                id: `pip-control-${id}`,
                name: `pip-control-${id}`,
                type: 'checkbox',
                className: 'is-toggle',
                change: this.#togglePip
            }]
        });

        this.#backdrop = new DomSmith({
            _ref: 'wrapper',
            className: 'vip-pip',
            'data-sort': 70,
            ariaHidden: true,
            _nodes: [{
                className: 'vip-pip-bg',
                _nodes: [{
                    _tag: 'p',
                    _nodes: [this.#player.locale.t('pip.placeholder')]
                }]
            }, {
                _tag: 'button',
                _ref: 'button',
                tabIndex: -1,
                click: this.#togglePip,
                _nodes: [this.#player.locale.t('pip.cancel')]
            }]
        }, this.#player.dom.getElement(this.#apiKey));

        this.#subscriptions = [
            ['data/ready', this.#onDataReady],
            ['data/nomedia', this.#disable],
            ['chromecast/start', this.#disable],
            ['chromecast/stop', this.#enable],
            ['airplay/start', this.#disable],
            ['airplay/stop', this.#enable],
            ['media/enterpictureinpicture', this.#onPipEnter],
            ['media/leavepictureinpicture', this.#onPipExit],
            ['media/error', this.#disable],
            ['media/canplay', this.#enable]
        ].map(([event, handler]) => this.#player.subscribe(event, handler));

    }

    /**
     * Called when media data is ready. Enables or disables PiP if the media is video or not.
     * @param {module:src/core/Data~mediaItem} mediaItem            Object containing media type info.
     * @param {string}                         mediaItem.mediaType  Type of the media ('video' or 'audio').
     * @listens module:src/core/Data#data/ready
     */
    #onDataReady = ({ mediaType }) => {

        this.#mediaType = mediaType;
        if (mediaType === 'audio') this.#disable(); else this.#enable();

    };

    /**
     * Toggles PiP status. If PiP is active, exit; otherwise enter PiP mode.
     */
    #togglePip = () => {

        if (!needsPiPWebkit && document.pictureInPictureElement
          || needsPiPWebkit && this.#player.media.getElement(this.#apiKey).webkitPresentationMode === 'picture-in-picture') {
            this.#pipExit();
        } else {
            this.#pipEnter();
        }

    };

    /**
     * Enters Picture-in-Picture mode via the appropriate API (standard or webkit).
     * @returns {Promise<void>}
     */
    async #pipEnter() {

        try {
            if (needsPiPWebkit) {
                this.#player.media.getElement(this.#apiKey).webkitSetPresentationMode('picture-in-picture');
            } else {
                await this.#player.media.getElement(this.#apiKey).requestPictureInPicture();
            }
        } catch {}

    }

    /**
     * Exits Picture-in-Picture mode via the appropriate API (standard or webkit).
     * @returns {Promise<void>}
     */
    async #pipExit() {

        try {
            if (needsPiPWebkit) {
                this.#player.media.getElement(this.#apiKey).webkitSetPresentationMode('inline');
            } else {
                await document.exitPictureInPicture();
            }
        } catch {}

    }

    /**
     * Handler for the 'media/enterpictureinpicture' event. Adjusts UI/state accordingly by displaying the PiP backdrop.
     * @listens module:src/core/Media#media/enterpictureinpicture
     */
    #onPipEnter = () => {

        this.#player.dom.getElement(this.#apiKey).classList.add('is-pip');
        // this.#control.button.classList.add('is-active');
        // this.#control.button.setAttribute('aria-pressed', 'true');
        this.#control.input.checked = true;
        this.#backdrop.button.removeAttribute('tabindex');
        this.#backdrop.wrapper.removeAttribute('aria-hidden');

    };

    /**
     * Handler for the 'media/leavepictureinpicture' event. Adjusts UI/state accordingly.
     * @listens module:src/core/Media#media/leavepictureinpicture
     */
    #onPipExit = () => {

        this.#player.dom.getElement(this.#apiKey).classList.remove('is-pip');
        // this.#control.button.classList.remove('is-active');
        // this.#control.button.setAttribute('aria-pressed', 'false');
        this.#control.input.checked = false;
        this.#backdrop.button.setAttribute('tabindex', '-1');
        this.#backdrop.wrapper.setAttribute('aria-hidden', 'true');

    };

    /**
     * Enables the PiP button if conditions allow it.
     * @listens module:src/casting/ChromeCast#chromecast/stop
     * @listens module:src/casting/AirPlay#airplay/stop
     * @listens module:src/core/Media#media/canplay
     */
    #enable = () => {

        if (this.#mediaType !== 'audio') this.#control.mount(this.#parent.getElement('top'));

    };

    /**
     * Disables the PiP button, and exits PiP if currently active.
     * @listens module:src/casting/ChromeCast#chromecast/start
     * @listens module:src/casting/AirPlay#airplay/start
     * @listens module:src/core/Data#data/nomedia
     * @listens module:src/core/Media#media/error
     */
    #disable = () => {

        this.#control.unmount();
        if (this.#player.dom.getElement(this.#apiKey).classList.contains('is-pip')) this.#pipExit();

    };

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        this.#backdrop.destroy();
        this.#control.destroy();
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#control = this.#player = this.#backdrop = this.#apiKey = null;

    }
}
