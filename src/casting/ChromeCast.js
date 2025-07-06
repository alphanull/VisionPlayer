import DomSmith from '../../lib/dom/DomSmith.js';
import { isObject } from '../../lib/util/object.js';

let cast;

/**
 * The ChromeCast component for the Media Player enables casting of media content to Chromecast devices.
 * You can control the video either using the standard controls on the player UI or via the ChromeCast remote.
 * Supports Subtitles, as well as poster images & more on devices that support those features.
 * @exports  module:src/casting/ChromeCast
 * @requires lib/util/object
 * @requires lib/dom/DomSmith
 * @author   Frank Kudermann - alphanull
 * @author   Frank
 * @version  1.0.0
 * @license  MIT
 */
export default class ChromeCast {

    /**
     * Configuration for the ChromeCast component.
     * @type     {Object}
     * @property {boolean} [showControllerButton=true]  If `true`, a controller button is displayed.
     * @property {boolean} [showMenuButton=true]        If `true`, a button in the settings menu (if available) is displayed.
     * @property {boolean} [lazyLoadLib=true]           If `true`, the cast Library is only loaded after user interaction.
     */
    #config = {
        showControllerButton: true,
        showMenuButton: false,
        lazyLoadLib: true
    };

    /**
     * Reference to the main player instance.
     * @type {module:src/core/Player}
     */
    #player;

    /**
     * Reference to the settings menu element.
     * @type {module:src/ui/Popup}
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
     * DomSmith instance for the Cast backdrop.
     * @type {module:lib/dom/DomSmith}
     */
    #backdrop;

    /**
     * DomSmith instance for the menu button.
     * @type {module:lib/dom/DomSmith}
     */
    #buttonMenu;

    /**
     * DomSmith instance for the controller button.
     * @type {module:lib/dom/DomSmith}
     */
    #buttonController;

    /**
     * Status information of the remote cast device.
     * @type {Object}
     */
    #remote = {
        state: '',
        duration: 0,
        currentTime: 0,
        connected: false,
        paused: true,
        activeTextTrack: 0,
        seekTo: null
    };

    /**
     * Local copy of the player's functions for restoring after casting.
     * @type     {Object}
     * @property {Function} seek     Original media.seek function of the player.
     * @property {Function} play     Original media.play function of the player.
     * @property {Function} pause    Original media.pause function of the player.
     * @property {Function} volume   Original media.volume function of the player.
     * @property {Function} mute     Original media.mute function of the player.
     * @property {Function} load     Original media.load function of the player.
     * @property {string}   lastSrc  The last set media source.
     */
    #local;

    /**
     * Instance of the Cast context.
     * @type {Object}
     */
    #castContext;

    /**
     * RemotePlayer instance for controlling the Cast device.
     * @type {Object}
     */
    #castPlayer;

    /**
     * RemotePlayerController for monitoring changes to the RemotePlayer.
     * @type {Object}
     */
    #castPlayerController;

    /**
     * Cast session instance.
     */
    #castSession;

    /**
     * Time snapshot used for resuming playback.
     * @type {number}
     */
    #savedCurrentTime;

    /**
     * Volume state snapshot before casting.
     * @type {number}
     */
    #volumeState = -1;

    /**
     * Flag indicating if currently active media is supported for casting.
     * @type {boolean}
     */
    #isSupported;

    /**
     * Creates an instance of the ChromeCast component.
     * @param {module:src/core/Player}           player            Reference to the main VisionPlayer instance.
     * @param {module:src/controller/Controller} parent            Reference to the parent instance.
     * @param {Object}                           [options]         Additional options.
     * @param {symbol}                           [options.apiKey]  Token for extended access to the player API.
     */
    constructor(player, parent, { apiKey }) {

        this.#config = player.initConfig('chromeCast', this.#config);

        if (!this.#config || !window.chrome || this.#config.showControllerButton === false && this.#config.showMenuButton === false) return [false];

        this.#player = player;

        this.#parent = this.#player.getComponent('ui.controller.popupSettings', apiKey);

        this.#apiKey = apiKey;

        this.#backdrop = new DomSmith({
            _ref: 'wrapper',
            className: 'vip-chromecast',
            'data-sort': 60,
            _nodes: [{
                _ref: 'bg',
                className: 'vip-chromecast-bg',
                ariaHidden: true,
                _nodes: [{
                    _tag: 'p',
                    _nodes: [
                        this.#player.locale.t('chromecast.connected'),
                        { _tag: 'br' },
                        {
                            _ref: 'device',
                            _text: this.#player.locale.t('chromecast.device')
                        }
                    ]
                }]
            }, {
                _tag: 'menu',
                className: 'menu is-grouped',
                _nodes: [{
                    _tag: 'button',
                    _ref: 'play',
                    ariaHidden: true,
                    tabIndex: -1,
                    click: this.#onTogglePlay,
                    _nodes: [{
                        _ref: 'buttonText',
                        _text: this.#player.locale.t('chromecast.play')
                    }]
                }, {
                    _tag: 'button',
                    _ref: 'cancel',
                    ariaHidden: true,
                    tabIndex: -1,
                    click: this.#stopCasting,
                    _nodes: [this.#player.locale.t('chromecast.cancel')]
                }]
            }]
        }, this.#player.dom.getElement(apiKey));

        if (this.#parent && (this.#config === true || this.#config.showMenuButton !== false)) {

            const id = this.#player.getConfig('player.id');

            this.#buttonMenu = new DomSmith({
                _tag: 'label',
                for: `chromecast-control-${id}`,
                click: e => {
                    e.preventDefault(); this.#toggleCasting();
                },
                _nodes: [{
                    _ref: 'label',
                    _tag: 'span',
                    className: 'form-label-text',
                    _nodes: this.#player.locale.t('chromecast.available')
                }, {
                    _ref: 'input',
                    _tag: 'input',
                    id: `chromecast-control-${id}`,
                    name: `chromecast-control-${id}`,
                    type: 'checkbox',
                    className: 'is-toggle'
                }]
            }, this.#parent.getElement('top'));

        }

        if (this.#config === true || !this.#config.showControllerButton === false) {

            this.#buttonController = new DomSmith({
                _tag: 'button',
                _ref: 'button',
                className: 'icon chromecast',
                'data-sort': 52,
                ariaLabel: this.#player.locale.t('chromecast.chromecast'),
                click: this.#toggleCasting,
                $tooltip: { player, text: this.#player.locale.t('chromecast.chromecast') }
            }, this.#player.getComponent('ui.controller', apiKey).getElement('right'));
        }

        this.#subscriptions = [
            ['subtitles/selected', this.#onSubtitleChange],
            ['subtitles/fontsize', this.#onFontChange],
            ['data/nomedia', this.#disable],
            ['media/ratechange', this.#onPlaybackRateChange],
            ['media/ready', this.#onMediaReady],
            ['media/error', this.#disable],
            ['media/canplay', this.#enable]
        ].map(([event, handler]) => this.#player.subscribe(event, handler));

        // Also check session storage if we have any active session to resume
        if (!this.#config.lazyLoadLib || sessionStorage.getItem('vip-chrome-cast-active')) this.#addScripts();

    }

    /**
     * Load Cast API Scripts from Google. This is only done after the user clicks the cast button.
     */
    #addScripts() {

        const script = document.createElement('script');
        script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
        document.head.appendChild(script);
        window.__onGCastApiAvailable = isAvailable => { if (isAvailable) this.#onAvailable(); };

    }

    /**
     * Initializes the Cast context and sets up necessary event listeners.
     */
    #onAvailable = () => {

        cast = window.chrome.cast; // eslint-disable-line prefer-destructuring

        this.#castContext = window.cast.framework.CastContext.getInstance();
        this.#castContext.addEventListener(window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED, this.#onSessionEvent);
        this.#castContext.setOptions({
            receiverApplicationId: cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
            autoJoinPolicy: cast.AutoJoinPolicy.ORIGIN_SCOPED
        });

        this.#castPlayer = new window.cast.framework.RemotePlayer();

        this.#castPlayerController = new window.cast.framework.RemotePlayerController(this.#castPlayer);
        this.#castPlayerController.addEventListener(window.cast.framework.RemotePlayerEventType.ANY_CHANGE, this.#onCastEvent);

        if (this.#config.lazyLoadLib) this.#toggleCasting();

    };

    /**
     * Checks if the current media source is supported for casting and enables or disables buttons accordingly.
     * @param {string} src  The current media source.
     * @listens module:src/core/Media#media/ready
     */
    #onMediaReady = ({ src }) => {

        const allowed = ['mp2t', 'mp4', 'ogg', 'wav', 'webm', 'apng', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'webp'],
              ext = src.split(/[#?]/)[0].split('.').pop().trim().toLowerCase();

        this.#isSupported = allowed.includes(ext);

        this.#enable();

    };

    /**
     * Toggles casting on or off based on the current status.
     * In addition the google cast code is loaded if invoked for the first time.
     */
    #toggleCasting = () => {

        if (!window.chrome.cast) this.#addScripts(); // Load Cast API if not already available
        else if (this.#remote.connected) this.#stopCasting();
        else this.#startCasting();

    };

    /**
     * Toggles playback (play/pause).
     */
    #onTogglePlay = () => {

        if (this.#player.getState('media.paused')) {
            this.#player.media.play();
            this.#backdrop.buttonText.nodeValue = this.#player.locale.t('chromecast.pause');
        } else {
            this.#player.media.pause();
            this.#backdrop.buttonText.nodeValue = this.#player.locale.t('chromecast.play');
        }

    };

    /**
     * Starts casting to a Chromecast device.
     * @returns {void} Returns when cast session has failed.
     * @fires    module:src/ui/Notifications#notification
     */
    async #startCasting() {

        this.#volumeState = this.#volumeState > 0 ? this.#volumeState : this.#player.getState('media.volume');
        if (this.#buttonMenu) this.#buttonMenu.label.nodeValue = this.#player.locale.t('chromecast.choose');

        try {

            this.#castSession = this.#castContext.getCurrentSession();

            if (!this.#castSession) {
                try {
                    return await this.#castContext.requestSession(); // Initiated from button
                } catch (e) { // eslint-disable-line no-unused-vars
                    // user cancelled selection
                    this.#stopCasting();
                    this.#remote.connected = false;
                    sessionStorage.removeItem('vip-chrome-cast-active');
                    return;
                }
            }

            this.#remote.connected = true;

            if (this.#remote.sessionState !== 'SESSION_RESUMED') {
                this.#remote.seekTo = this.#savedCurrentTime;
                const request = this.#generateRequest();
                await this.#castSession.loadMedia(request);
            }

        } catch (error) {

            if (error === 'cancel') return;

            this.#player.publish('notification', {
                type: 'error',
                title: 'ChromeCast',
                message: this.#player.locale.t('chromecast.castError'),
                messageSecondary: error,
                options: { timeout: 6 }
            }, this.#apiKey);

            this.#player.media.volume(this.#volumeState);
            this.#remote.error = error;
            if (this.#buttonMenu) this.#buttonMenu.text.nodeValue = this.#player.locale.t('chromecast.available');
        }
    }

    /**
     * Generates a media load request for casting. Also tries to include title, poster image and subtitles, if available.
     * @param   {Object} [source]  The current media source.
     * @returns {Object}           The generated load request.
     */
    #generateRequest(source = {}) {

        const { title = '', titleSecondary = '', poster, overlays = [], text = [] } = this.#player.data.getMediaData(),
              { src: currentSrc = this.#player.media.getElement(this.#apiKey).src, mimeType, encodings } = source,
              aV1Type = /^video\/mp4;\s*codecs=av01/i.test(mimeType);

        let src = currentSrc;

        if (aV1Type && encodings) {
            // cant play av1 on most cast reveivcers, try to find alternate encoding
            const found = encodings.find(encoding => encoding && !/^video\/mp4;\s*codecs=av01/i.test(encoding.mimeType) && this.#player.media.canPlay(encoding));
            if (found) ({ src } = found);
        }

        const mediaInfo = new cast.media.MediaInfo(src, mimeType),
              lang = this.#player.getConfig('locale.lang'),
              titleTranslated = isObject(title) ? title[lang] || title[Object.keys(title)[0]] : title,
              titleSecondaryTranslated = isObject(titleSecondary) ? titleSecondary[lang] || titleSecondary[Object.keys(titleSecondary)[0]] : titleSecondary;

        mediaInfo.metadata = new cast.media.GenericMediaMetadata();
        mediaInfo.metadata.title = titleTranslated;
        mediaInfo.metadata.subtitle = titleSecondaryTranslated;

        if (poster) {
            mediaInfo.metadata.images = [new cast.Image(poster)];
        } else if (overlays.length) { // Search for poster image
            const findPoster = overlays.find(({ type }) => type === 'poster');
            if (findPoster && findPoster.src) mediaInfo.metadata.images = [new cast.Image(findPoster.src)];
        }

        if (text.length) {

            const subtitles = text.filter(({ type }) => type === 'subtitles' || type === 'captions');

            if (subtitles) {

                mediaInfo.tracks = subtitles.map((subtitle, index) => {
                    const track = new cast.media.Track(index, 'TEXT');
                    track.name = subtitle.language;
                    track.subtype = subtitle.type;
                    track.trackContentId = subtitle.src;
                    track.trackContentType = 'text/vtt';
                    track.trackId = parseInt(index, 10); // This bug made me question life for a while
                    return track;
                });

                mediaInfo.textTrackStyle = new cast.media.TextTrackStyle();
                mediaInfo.textTrackStyle.backgroundColor = '#11111166';
                mediaInfo.textTrackStyle.edgeColor = '#00000040';
                mediaInfo.textTrackStyle.edgeType = 'DROP_SHADOW';
                mediaInfo.textTrackStyle.fontFamily = 'SANS_SERIF';
                mediaInfo.textTrackStyle.fontScale = this.#remote.fontSize === 'small' ? 0.6 : this.#remote.fontSize === 'big' ? 1.1 : 0.8;
                mediaInfo.textTrackStyle.foregroundColor = '#FFFFFF';
            }
        }

        const request = new cast.media.LoadRequest(mediaInfo),
              activeTrack = this.#remote.activeTextTrack || this.#player.getState('media.activeTextTrack');

        request.activeTrackIds = activeTrack > -1 ? [activeTrack] : [];
        request.autoplay = true;
        request.playbackRate = this.#player.getState('media.playbackRate');

        return request;
    }

    /**
     * Switches the player's state and binds remote functions.
     */
    #switchState() {

        this.#savedCurrentTime = this.#player.getState('media.currentTime');
        this.#volumeState = this.#player.getState('media.volume');

        this.#player.setState('media.paused', { get: () => this.#castPlayer.isPaused }, this.#apiKey);
        this.#player.setState('media.currentTime', { get: () => this.#castPlayer.currentTime }, this.#apiKey);
        this.#player.setState('media.volume', { get: () => this.#castPlayer.volumeLevel }, this.#apiKey);

        this.#local = {
            api: {
                seek: this.#player.media.seek,
                play: this.#player.media.play,
                pause: this.#player.media.pause,
                volume: this.#player.media.volume,
                mute: this.#player.media.mute,
                load: this.#player.media.load
            },
            lastSrc: ''
        };

        // override player API

        this.#player.media.seek = val => {
            this.#castPlayer.currentTime = val;
            this.#castPlayerController.seek();
        };

        this.#player.media.play = () => {
            if (!this.#player.getState('media.paused')) return;
            this.#castPlayerController.playOrPause();
            this.#player.publish('media/play', this.#apiKey);
        };

        this.#player.media.pause = () => {
            if (this.#player.getState('media.paused')) return;
            this.#castPlayerController.playOrPause();
            this.#player.publish('media/pause', this.#apiKey);
        };

        this.#player.media.volume = val => {
            this.#castPlayer.volumeLevel = val;
            this.#castPlayerController.setVolumeLevel();
            this.#player.publish('media/volumechange', this.#apiKey);
        };

        this.#player.media.mute = val => {
            this.#castPlayerController.muteOrUnmute();
            this.#local.mute(val);
        };

        this.#player.media.load = async source => {
            try {
                const currentTime = this.#player.getState('media.currentTime'),
                      request = this.#generateRequest(source);

                this.#remote.noIdleEvent = true;
                await this.#castContext.getCurrentSession().loadMedia(request);
                this.#local.lastSrc = source.src;
                this.#remote.noIdleEvent = false;
                this.#player.media.seek(currentTime);

            } catch { }
        };
    }

    /**
     * Stops casting and restores the player to its original state.
     * @param {boolean} [endCastSession]  Indicates whether to also end the cast session.
     */
    #stopCasting = (endCastSession = true) => {

        this.#remote.connected = false;
        this.#castPlayerController.stop();
        this.#castContext.endCurrentSession(endCastSession);
        // Needs reinitialization for unknown reasons
        this.#castPlayer = new window.cast.framework.RemotePlayer();
        this.#castPlayerController.removeEventListener(window.cast.framework.RemotePlayerEventType.ANY_CHANGE, this.#onCastEvent);
        this.#castPlayerController = new window.cast.framework.RemotePlayerController(this.#castPlayer);
        this.#castPlayerController.addEventListener(window.cast.framework.RemotePlayerEventType.ANY_CHANGE, this.#onCastEvent);

    };

    /**
     * Handles the stopping of casting.
     * @fires module:src/core/Media#media/volumechange
     * @fires module:src/casting/ChromeCast#chromecast/stop
     */
    async #castStopped() {

        this.#player.publish('chromecast/stop', this.#apiKey);

        if (this.#remote.error) {
            // Do not restore if the connection was closed due to an error
            this.#remote.error = '';
            return;
        }

        // Restore old player functions
        Object.entries(this.#local.api).forEach(([key, value]) => {
            this.#player.media[key] = value;
        });

        // TODO: better encapsulation
        this.#player.getComponent('media', this.#apiKey).setupState();

        this.#backdrop.play.setAttribute('tabindex', '-1');
        this.#backdrop.play.setAttribute('aria-hidden', 'true');
        this.#backdrop.cancel.setAttribute('tabindex', '-1');
        this.#backdrop.cancel.setAttribute('aria-hidden', 'true');
        this.#backdrop.bg.setAttribute('aria-hidden', 'true');

        // Restore player state
        if (this.#local.lastSrc) await this.#player.media.load({ src: this.#local.lastSrc });
        this.#player.media.seek(this.#remote.currentTime);
        if (!this.#remote.paused) this.#player.media.play();
        this.#player.media.volume(this.#volumeState);
        this.#player.publish('media/volumechange', this.#apiKey);
        this.#volumeState = -1;

        this.#player.dom.getElement(this.#apiKey).classList.remove('is-casting');
        if (this.#buttonMenu) this.#buttonMenu.input.checked = false;

    }

    /**
     * Handles cast events.
     * @param {Object} event        The cast event from the google lib.
     * @param {string} event.field  The field that changed.
     * @param {*}      event.value  The new value of the field.
     * @fires module:src/casting/ChromeCast#chromecast/start
     * @fires module:src/core/Media#media/volumechange
     * @fires module:src/core/Media#media/timeupdate
     * @fires module:src/core/Media#media/pause
     * @fires module:src/core/Media#media/play
     */
    #onCastEvent = async({ field, value }) => {

        // if (field !== 'displayStatus') console.debug('onCastEvent: ', field, value);

        switch (field) {

            case 'isConnected':
                if (value) {
                    if (this.#parent) this.#parent.hidePopup();

                    this.#player.dom.getElement(this.#apiKey).classList.add('is-casting');
                    this.#player.publish('chromecast/start', this.#apiKey);
                    this.#player.media.pause();

                    this.#switchState();

                    const session = this.#castContext.getCurrentSession();
                    this.#backdrop.device.nodeValue = session.getCastDevice().friendlyName || this.#player.locale.t('chromecast.device');
                    this.#backdrop.play.removeAttribute('tabindex');
                    this.#backdrop.play.removeAttribute('aria-hidden');
                    this.#backdrop.cancel.removeAttribute('tabindex');
                    this.#backdrop.cancel.removeAttribute('aria-hidden');
                    this.#backdrop.bg.removeAttribute('aria-hidden');

                    if (this.#buttonMenu) this.#buttonMenu.input.checked = true;
                    sessionStorage.setItem('vip-chrome-cast-active', 'true');

                    this.#startCasting();
                } else {
                    sessionStorage.removeItem('vip-chrome-cast-active');
                    this.#castStopped();
                }
                break;

            case 'canSeek':
                if (value && this.#remote.seekTo !== null) {
                    this.#castPlayer.currentTime = this.#remote.seekTo;
                    this.#castPlayerController.seek();
                    this.#remote.seekTo = null;
                }
                break;

            case 'volumechange':
            case 'volumeLevel':
                this.#player.media.volume(value);
                this.#player.publish('media/volumechange', this.#apiKey);
                break;

            case 'isMuted':
                this.#local.mute(value);
                break;

            case 'duration':
                if (this.#remote.sessionState !== 'SESSION_ENDED') this.#remote.duration = value;
                break;

            case 'currentTime':
                if (this.#remote.sessionState === 'SESSION_ENDED') break;
                this.#remote.currentTime = value;
                this.#player.publish('media/timeupdate', this.#apiKey);
                break;

            case 'playerState':
                this.#remote.state = value;

                switch (value) {
                    case 'PAUSED':
                        this.#remote.paused = true;
                        this.#backdrop.bg.classList.remove('is-buffering');
                        this.#backdrop.buttonText.nodeValue = this.#player.locale.t('chromecast.play');
                        this.#player.publish('media/pause', this.#apiKey);
                        break;

                    case 'PLAYING':
                        this.#remote.paused = false;
                        this.#backdrop.bg.classList.remove('is-buffering');
                        this.#backdrop.buttonText.nodeValue = this.#player.locale.t('chromecast.pause');
                        this.#player.publish('media/play', this.#apiKey);
                        break;

                    case 'BUFFERING':
                        this.#backdrop.bg.classList.add('is-buffering');
                        break;

                    case 'IDLE':
                        if (this.#remote.connected && !this.#remote.noIdleEvent) {
                            if (this.#player.getState('media.loop')) {
                                const request = this.#generateRequest(),
                                      session = this.#castContext.getCurrentSession();
                                await session.loadMedia(request);
                            } else {
                                this.#player.publish('media/pause', this.#apiKey);
                                this.#remote.paused = true;
                                this.#stopCasting();
                            }
                        }
                        break;
                    default:
                }
                break;

            case 'savedPlayerState':
                if (value) this.#remote.currentTime = value.currentTime;
                break;

            default:
        }
    };

    /**
     * Handles session events from the Cast context.
     * @param {Object} event  Session event from the google lib.
     */
    #onSessionEvent = event => {

        switch (event.sessionState) {
            case window.cast.framework.SessionState.SESSION_STARTED:
                this.#remote.sessionState = 'SESSION_STARTED';
                break;
            case window.cast.framework.SessionState.SESSION_RESUMED:
                this.#remote.sessionState = 'SESSION_RESUMED';
                break;
            case window.cast.framework.SessionState.SESSION_ENDED:
                this.#remote.sessionState = 'SESSION_ENDED';
                break;
            default:
        }

    };

    /**
     * Handles changes to subtitles.
     * @param {Object} event        Subtitle change event info.
     * @param {number} event.index  Index of the selected subtitle track.
     * @listens module:src/text/Subtitles#subtitles/selected
     */
    #onSubtitleChange = ({ index }) => {

        this.#remote.activeTextTrack = index;

        if (!cast) return;

        const activeTrackId = index > -1 ? [index] : [],
              request = new cast.media.EditTracksInfoRequest(activeTrackId),
              session = this.#castContext.getCurrentSession(),
              media = session ? session.getMediaSession() : null;

        if (media) media.editTracksInfo(request);

    };

    /**
     * Handles changes to the subtitle font size.
     * @param {string} size  The new font size ('small', 'normal', 'big').
     * @listens module:src/text/Subtitles#subtitles/fontsize
     */
    #onFontChange = ({ fontSize }) => {

        this.#remote.fontSize = fontSize;

        if (!cast) return;

        const session = this.#castContext.getCurrentSession(),
              media = session ? session.getMediaSession() : null;

        if (!media) return;

        const fontScale = fontSize === 'small' ? 0.6 : this.#remote.fontSize === 'big' ? 1.1 : 0.8,
              request = new cast.media.EditTracksInfoRequest(null, { fontScale });

        media.editTracksInfo(request);

    };

    /**
     * Handles changes to the playback rate.
     * @listens module:src/core/Media#media/ratechange
     */
    #onPlaybackRateChange = () => {

        if (!cast) return;

        const session = this.#castContext.getCurrentSession(),
              media = session ? session.getMediaSession() : null;

        if (media) {
            // https://stackoverflow.com/questions/70205119/setting-playbackrate-from-a-chromecast-websender
            session.sendMessage('urn:x-cast:com.google.cast.media', {
                type: 'SET_PLAYBACK_RATE',
                playbackRate: this.#player.getState('media.playbackRate'),
                mediaSessionId: media.mediaSessionId,
                requestId: 0
            });
        }
    };

    /**
     * Enables the play button functionality. This method listens to canplay events in order to restore a usable state again
     * when the player recovered from a media error (for example by loading another file).
     * @listens module:src/core/Media#media/canplay
     */
    #enable = () => {

        if (this.#isSupported) {
            if (this.#buttonController) this.#buttonController.button.style.display = 'block';
            this.#buttonMenu?.mount();
        } else {
            this.#disable();
        }

    };

    /**
     * Disables the button functionality. This method listens to media error events which cause the button to be disabled.
     * @listens module:src/core/Media#media/error
     * @listens module:src/core/Data#data/nomedia
     */
    #disable = () => {

        if (this.#buttonController) this.#buttonController.button.style.display = 'none';
        this.#buttonMenu?.unmount();

    };

    /**
     * Removes all events, subscriptions, and DOM nodes created by this component.
     */
    destroy() {

        if (this.#castContext) {
            this.#castContext.removeEventListener(window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED, this.#onSessionEvent);
            this.#castPlayerController.removeEventListener(window.cast.framework.RemotePlayerEventType.ANY_CHANGE, this.#onCastEvent);
        }

        window.__onGCastApiAvailable = null;

        this.#buttonController?.destroy();
        this.#buttonMenu?.destroy();
        this.#backdrop.destroy();
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#parent = this.#backdrop = this.#buttonController = this.#buttonMenu = null;
        this.#castContext = this.#castPlayer = this.#castSession = this.#apiKey = null;

    }

}

/**
 * This event is fired when chromecast was started.
 * @event module:src/casting/ChromeCast#chromecast/start
 */

/**
 * This event is fired when chromecast was stopped.
 * @event module:src/casting/ChromeCast#chromecast/stop
 */
