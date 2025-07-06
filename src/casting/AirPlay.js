import DomSmith from '../../lib/dom/DomSmith.js';

/**
 * The AirPlay component enables AirPlay functionality on compatible browsers such as Safari macOS and Safari iOS. When a compatible streaming device is found (e.g., Apple TV or AirPlay Server Software on macOS),
 * the user can stream the current video to this device. This component **also works with HLS streams** provided the video element exposes a regular `https://...m3u8` URL.
 * Blob-based MediaSource playback is not supported by AirPlay receivers. There is a heuristic **that falls back to** an MP4 rendition whenever both AV1 and MP4 are present, because AirPlay devices cannot decode AV1 (as of 2025).
 * @exports module:src/casting/AirPlay
 * @requires lib/dom/DomSmith
 * @author    Frank Kudermann - alphanull
 * @version   1.0.0
 * @license   MIT
 */
export default class AirPlay {

    /**
     * Configuration options for the AirPlay component.
     * @type     {Object}
     * @property {boolean} [showControllerButton=true]  Shows or hides the controller button.
     * @property {boolean} [showMenuButton=true]        Shows or hides the menu button.
     */
    #config = {
        showControllerButton: true,
        showMenuButton: false
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
     * DomSmith instance for the AirPlay menu button.
     * @type {module:lib/dom/DomSmith}
     */
    #buttonMenu;

    /**
     * DomSmith instance for the AirPlay controller button.
     * @type {module:lib/dom/DomSmith}
     */
    #buttonController;

    /**
     * Stores the currently active stream object used for AirPlay.
     * @type {module:src/core/Media~metaData}
     */
    #currentSource;

    /**
     * Reference to the native RemotePlayback API interface provided by the video element.
     * @type {RemotePlayback}
     */
    #remote;

    /**
     * Saved stream source when replacing streams for restoring later.
     * @type {string}
     */
    #savedSrc;

    /**
     * Stores the callback identifier used by RemotePlayback API to manage availability watches.
     * @type {number}
     */
    #callbackId = -1;

    /**
     * Creates an instance of the AirPlay component.
     * @param {module:src/core/Player}           player            Reference to the VisionPlayer instance.
     * @param {module:src/controller/Controller} parent            Reference to the parent instance.
     * @param {Object}                           [options]         Additional options.
     * @param {symbol}                           [options.apiKey]  Token for extended access to the player API.
     */
    constructor(player, parent, { apiKey }) {

        this.#config = player.initConfig('airPlay', this.#config);

        if (!this.#config || !window.WebKitPlaybackTargetAvailabilityEvent
          || this.#config.showControllerButton === false && this.#config.showMenuButton === false) return [false];

        this.#player = player;
        this.#apiKey = apiKey;

        const settingsPopup = this.#player.getComponent('ui.controller.popupSettings', apiKey);

        if (settingsPopup && this.#config.showMenuButton !== false) {

            const id = this.#player.getConfig('player.id');

            this.#buttonMenu = new DomSmith({
                _tag: 'label',
                for: `airplay-control-${id}`,
                click: e => {
                    e.preventDefault();
                    this.#showAirPlayMenu();
                },
                _nodes: [{
                    _ref: 'label',
                    _tag: 'span',
                    className: 'form-label-text',
                    _nodes: [{
                        _ref: 'text',
                        _text: this.#player.locale.t('airplay.available')
                    }]
                }, {
                    _ref: 'input',
                    _tag: 'input',
                    id: `airplay-control-${id}`,
                    name: `airplay-control-${id}`,
                    type: 'checkbox',
                    className: 'is-toggle'
                }]
            }, settingsPopup.getElement('top'));
        }

        const buttonContainer = this.#player.getComponent('ui.controller', apiKey);

        if (buttonContainer && this.#config.showControllerButton !== false) {

            this.#buttonController = new DomSmith({
                _tag: 'button',
                _ref: 'button',
                disabled: true,
                className: 'icon airplay',
                'data-sort': 52,
                ariaLabel: this.#player.locale.t('airplay.airplay'),
                click: this.#showAirPlayMenu,
                $tooltip: { player, text: this.#player.locale.t('airplay.airplay') }
            }, buttonContainer.getElement('right'));
        }

        if (typeof RemotePlayback === 'undefined' || this.#player.getClient('iOS')) {
            const videoEle = this.#player.media.getElement(apiKey);
            videoEle.addEventListener('webkitcurrentplaybacktargetiswirelesschanged', this.#onAirPlayStatusChanged);
            videoEle.addEventListener('webkitplaybacktargetavailabilitychanged', this.#onAvailability);
        } else {
            this.#subscriptions = [this.#player.subscribe('media/ready', this.#onMediaReady)];
        }

        this.#player.setState('media.airPlayActive', {
            get: () => this.#remote
                ? this.#remote.state === 'connecting' || this.#remote.state === 'connected'
                : this.#player.media.getElement(this.#apiKey).webkitCurrentPlaybackTargetIsWireless
        }, this.#apiKey);

    }

    /**
     * Called when Video is ready for playback. Sets up the remote (if available).
     * @param {module:src/core/Media~metaData} metaData  The currently selected metaData.
     * @listens module:src/core/Media#media/ready
     */
    #onMediaReady = metaData => {

        this.#currentSource = metaData;

        const allowed = ['m3u8', 'm3u', 'mp4', 'm4v', 'mov', 'm4a', 'aac', 'mp3'],
              ext = metaData.src.split(/[#?]/)[0].split('.').pop().trim().toLowerCase(),
              isSupported = allowed.includes(ext);

        if (this.#remote) {

            this.#remote.cancelWatchAvailability(this.#callbackId).catch(() => { });
            this.#remote.removeEventListener('connect', this.#updateRemoteState);
            this.#remote.removeEventListener('connecting', this.#updateRemoteState);
            this.#remote.removeEventListener('disconnect', this.#updateRemoteState);
            this.#callbackId = -1;

        }

        if (!isSupported || metaData.src.startsWith('blob:')) {

            this.#onAvailability({ availability: 'not available' });

        } else {

            // HACK: Force hls.js to make stream available for streaming
            this.#player.media.getElement(this.#apiKey).disableRemotePlayback = false;

            this.#remote = this.#player.media.getElement(this.#apiKey).remote;
            this.#remote.addEventListener('connect', this.#updateRemoteState);
            this.#remote.addEventListener('connecting', this.#updateRemoteState);
            this.#remote.addEventListener('disconnect', this.#updateRemoteState);

            this.#updateRemoteState();

        }
    };

    /**
     * Called whenever the RemotePlayback state changes.
     */
    #updateRemoteState = async() => {

        if (this.#remote.state === 'connecting') {

            this.#onAvailability({ availability: 'available' });
            this.#onAirPlayStatusChanged();

        } else if (this.#remote.state === 'disconnected') {

            if (this.#savedSrc) {
                // restore stream if we switched before
                this.#player.media.load({ src: this.#savedSrc }, { rememberState: true });
                this.#savedSrc = '';
            }

            try {
                // Let's watch remote device availability when there's no connected remote device.
                this.#callbackId = await this.#remote.watchAvailability(availability => {
                    this.#onAvailability({ availability: availability ? 'available' : 'not available' });
                });

            } catch (error) {
                this.#onAvailability({ availability: 'not available' });
                console.error(error); // eslint-disable-line no-console
            }

            this.#onAirPlayStatusChanged();

        } else if (this.#callbackId !== -1) {
            try {
                // If remote device is connecting or connected, we should stop watching remote device availability to save power.
                await this.#remote.cancelWatchAvailability(this.#callbackId);
                this.#callbackId = -1;
            } catch (error) {
                console.error(error); // eslint-disable-line no-console
            }
        }
    };

    /**
     * Shows the AirPlay menu (natively rendered by the OS). Tries to use the remote API if possible.
     * If connected via the remote API, tries to switch to a non-AV1 stream if possible.
     * @param {Event} event  The original click event.
     */
    #showAirPlayMenu = async event => {

        if (this.#remote) {
            // use remote API if possible. So we have better control
            // and are actually to switch streams, in case there is AV1 with a mp4 alternative
            // most of AirPlay Clients are unable to handle AVi (yet)
            try {

                await this.#remote.prompt();

                if (this.#remote.state === 'connecting') {

                    const { src, mimeType, encodings } = this.#currentSource,
                          aV1Type = /^video\/mp4;\s*codecs=av01/i.test(mimeType); // 'video/mp4; codecs=av01.0.05M.08';

                    if (aV1Type && encodings) {

                        // cant play av1 on most cast reveivers, try to find alternate mp4
                        const found = encodings.find(encoding => encoding && !/^video\/mp4;\s*codecs=av01/i.test(encoding.mimeType) && this.#player.media.canPlay(encoding));

                        if (found) {
                            this.#player.media.load({ src: found.src }, { rememberState: true });
                            this.#savedSrc = src; // remember actual stream for later
                        }
                    } else {

                        this.#player.media.load({ src }, { rememberState: true });
                    }
                }

            } catch (error) {
                console.error(error); // eslint-disable-line no-console
            }

        } else {

            this.#player.media.getElement(this.#apiKey).webkitShowPlaybackTargetPicker();
            event.preventDefault();

        }

    };

    /**
     * Invoked when AirPlay availability changes.
     * @param {Event} event  The original WebKitPlaybackTargetAvailabilityEvent.
     * @listens webkitplaybacktargetavailabilitychanged
     */
    #onAvailability = (event = {}) => {

        if (event.availability === 'available') {

            if (this.#buttonMenu) {
                this.#buttonMenu.label.disabled = false;
                this.#buttonMenu.text.nodeValue = this.#player.locale.t('airplay.available');
            }

            if (this.#buttonController) this.#buttonController.button.disabled = false;

        } else {

            if (this.#buttonMenu) {
                this.#buttonMenu.label.disabled = true;
                this.#buttonMenu.text.nodeValue = this.#player.locale.t('airplay.unavailable');
            }

            if (this.#buttonController) this.#buttonController.button.disabled = true;

        }

    };

    /**
     * Invoked when AirPlay status changes, i.e., the user has activated or deactivated AirPlay.
     * @fires   module:src/casting/AirPlay#airplay/start
     * @fires   module:src/casting/AirPlay#airplay/stop
     */
    #onAirPlayStatusChanged = () => {

        const airPlayActive = this.#player.getState('media.airPlayActive'),
              rootEle = this.#player.dom.getElement(this.#apiKey);

        if (this.#buttonMenu) this.#buttonMenu.input.checked = airPlayActive;
        rootEle.classList.toggle('is-airplay', airPlayActive);
        this.#player.publish(`airplay/${airPlayActive ? 'start' : 'stop'}`, this.#apiKey);

    };

    /**
     * Removes all events, subscriptions, and DOM nodes created by this component.
     */
    destroy() {

        if (this.#remote) {
            this.#remote.cancelWatchAvailability(this.#callbackId).catch(() => {}); // TODO: should actually be awaited, but destroy() is not async (yet)
            this.#remote.removeEventListener('connect', this.#updateRemoteState);
            this.#remote.removeEventListener('connecting', this.#updateRemoteState);
            this.#remote.removeEventListener('disconnect', this.#updateRemoteState);
            this.#remote = null;
        } else {
            const videoEle = this.#player.media.getElement(this.#apiKey);
            videoEle.removeEventListener('webkitcurrentplaybacktargetiswirelesschanged', this.#onAirPlayStatusChanged);
            videoEle.removeEventListener('webkitplaybacktargetavailabilitychanged', this.#onAvailability);
        }

        this.#buttonMenu?.destroy();
        this.#buttonController?.destroy();
        this.#player.removeState('media.airPlayActive', this.#apiKey);
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#buttonMenu = this.#buttonController = this.#currentSource = this.#apiKey = null;

    }

}

/**
 * This event is fired when AirPlay was started.
 * @event  module:src/casting/AirPlay#airplay/start
 */

/**
 * This event is fired when AirPlay was stopped.
 * @event  module:src/casting/AirPlay#airplay/stop
 */
