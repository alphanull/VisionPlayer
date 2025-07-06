import ExtendedMediaError from '../util/ExtendedMediaError.js';

let HlsJs;

/**
 * The Hls component integrates the [hls.js](https://github.com/video-dev/hls.js) library into the player for MPEG-HLS streaming, adding Widevine (and optional Fairplay) DRM support.
 * It allows adaptive streaming, real-time error handling, subtitle, language and quality control integration, and reacts to various stream metadata updates.
 * @exports module:src/streaming/Hls
 * @requires src/util/ExtendedMediaError
 * @author    Frank Kudermann - alphanull
 * @version   1.0.0
 * @license   MIT
 */
export default class Hls {

    /**
     * @type     {Object}
     * @property {boolean} [lazyLoadLib=true]  If `true`, the Hls.js library is only loaded when loading the first media item.
     * @property {string}  [libUrl]            Custom URL for the Hls.js library. Defaults to CDN URL if not specified.
     * @property {boolean} [debug=false]       Enables verbose logging from the HLS component.
     */
    #config = {
        lazyLoadLib: true,
        libUrl: 'https://cdn.jsdelivr.net/npm/hls.js@^1.5.19/dist/hls.min.js',
        debug: false
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
     * Reference to the Media instance.
     * @type {module:src/core/Media}
     */
    #mediaComponent;

    /**
     * Reference to the dash.js instance.
     * @type {Object}
     */
    #hls;

    /**
     * Reference to the Async Task instance. Used to handle async tasks, which can be cancelled, resolved or rejected.
     * @type {module:lib/util/AsyncTask}
     */
    #loadTask;

    /**
     * Holds metadata information provided by media.load and loaded metadata.
     * @type {module:src/core/Media~metaData}
     */
    #metaData = {};

    /**
     * Promise awaiting the loading of the dash lib.
     * @type {Promise}
     */
    #loadHlsPromise;

    /**
     * Creates an instance of the Hls plugin.
     * @param {module:src/core/Player} player          Reference to the player instance.
     * @param {module:src/core/Media}  mediaComponent  Reference to the engine (video) instance.
     * @param {symbol}                 apiKey          Token for extended access to the player API.
     */
    constructor(player, mediaComponent, { apiKey }) {

        this.#config = player.initConfig('hls', this.#config);

        if (!this.#config) return [false];

        HlsJs = window.Hls;

        if (!HlsJs && !this.#config.lazyLoadLib) this.#loadHlsJs();

        this.#player = player;
        this.#apiKey = apiKey;

        this.#player.constructor.addFormat({
            extensions: ['m3u8'],
            mimeTypeAudio: ['application/x-mpegURL'],
            mimeTypeVideo: ['application/x-mpegURL']
        });

        this.#subscriptions = [
            this.#player.subscribe('data/ready', this.#removeHls)
        ];

        this.#mediaComponent = mediaComponent;
        this.#mediaComponent.registerPlugin(this);

    }

    /**
     * Checks if hls.js can handle the given mimeType and optional DRM system. ('Widevine').
     * @param   {module:src/core/Media~metaData} metaData              The data to test.
     * @param   {string}                         metaData.mimeType     The mime type to test.
     * @param   {string}                         [metaData.drmSystem]  Optional DRM system info.
     * @returns {string}                                               'maybe' or '' (empty).
     */
    canPlay({ mimeType, drmSystem } = {}) { // eslint-disable-line

        return mimeType === 'application/x-mpegURL' && (HlsJs ? HlsJs.isSupported() : true) && (!drmSystem || drmSystem === 'Widevine') ? 'maybe' : '';

    }

    /**
     * Initializes the hls.js library for a given source. Sets up the config (DRM if needed), attaches to the video stream, loads the HLS source.
     * @param   {module:src/core/Media~metaData} metaData            Source Object (currentSource).
     * @param   {string}                         metaData.src        Actual HLS URL to load.
     * @param   {Object}                         [options]           Additional options.
     * @param   {module:lib/util/AsyncTask}      [options.loadTask]  If a source task instance is provided, handle errors using this object.
     * @returns {Promise|undefined}                                  If a source task instance is provided, returns a promise that rejects with a resulting media error.
     * @throws  {Error}                                              If drm scheme is unknown.
     */
    async load({ src }, options = {}) {

        if (!HlsJs) {
            await this.#loadHlsJs();
            if (!HlsJs) HlsJs = window.Hls;
        }

        this.#subscriptions = [
            this.#player.subscribe('language/selected', this.#onLanguageSelected),
            this.#player.subscribe('quality/selected', this.#onQualitySelected),
            this.#player.subscribe('media/ready', this.#onMediaReady, { priority: 99 }),
            this.#player.subscribe('airplay/start', () => {
                // stop loading when AirPlay starts
                const videoEle = this.#player.media.getElement(this.#apiKey);
                this.#hls.stopLoad();
                if (!videoEle.src) { // <-- must be first load!!!
                    videoEle.src = this.#player.media.getMetaData().src;
                    videoEle.load();
                }
            })
        ];

        const qualityConfig = this.#player.getConfig('quality'),
              { drm } = this.#player.data.getMediaData(),
              config = {
                  enableWorker: true,
                  lowLatencyMode: true,
                  backBufferLength: 90,
                  capLevelToPlayerSize: qualityConfig.adaptToSize,
                  ignoreDevicePixelRatio: !qualityConfig.useDeviceRatio
              };

        if (drm) {

            if (drm.Widevine) {

                config.emeEnabled = true;
                config.widevineLicenseUrl = drm.Widevine.licenseUrl;
                config.drmSystemOptions = {
                    audioRobustness: 'SW_SECURE_CRYPTO',
                    videoRobustness: 'SW_SECURE_CRYPTO'
                };
                config.licenseXhrSetup = xhr => {
                    if (drm.Widevine.header) {
                        Object.entries(drm.Widevine.header).forEach(([key, value]) => {
                            xhr.setRequestHeader(key, value);
                        });
                    }
                };

            } else throw new Error('[Hls] Unknown DRM Scheme');
        }

        this.#hls = new HlsJs(config);
        this.#hls.on(HlsJs.Events.ERROR, this.#onHlsError);
        this.#hls.on(HlsJs.Events.AUDIO_TRACK_SWITCHED, this.#onHlsAudioSwitch);
        this.#hls.on(HlsJs.Events.LEVEL_SWITCHED, this.#onHlsQualitySwitch);
        this.#hls.on(HlsJs.Events.LEVEL_LOADED, this.#onHlsLevelLoaded);

        this.#hls.subtitleDisplay = false;
        this.#hls.attachMedia(this.#player.media.getElement(this.#apiKey));
        this.#hls.loadSource(src);

        if (this.#config.debug) {
            Object.keys(HlsJs.Events).forEach(key => this.#hls.on(HlsJs.Events[key], this.#onLogEvent));
        }

        if (options.loadTask) {
            this.#loadTask = options.loadTask;
            return options.loadTask.promise;
        }
    }

    /**
     * Loads dash.js via CDN if not present.
     * Ensures only one load attempt per instance.
     * @returns {Promise<void>}
     */
    #loadHlsJs() {

        if (window.Hls) return Promise.resolve();

        if (this.#loadHlsPromise) return this.#loadHlsPromise;

        this.#loadHlsPromise = new Promise((resolve, reject) => {

            const existing = document.querySelector(`script[src="${this.#config.libUrl}"]`);
            if (existing) {
                if (existing.dataset.loaded) {
                    resolve();
                } else {
                    existing.addEventListener('load', resolve, { once: true });
                    existing.addEventListener('error', reject, { once: true });
                }
                return;
            }

            const script = document.createElement('script');
            script.src = this.#config.libUrl;
            script.async = true;
            script.dataset.loaded = '';

            script.onload = () => {
                script.dataset.loaded = '1';
                resolve();
            };

            script.onerror = error => {
                this.#loadHlsPromise = null;
                script.remove();
                this.#player.dom.getElement(this.#apiKey).classList.add('has-no-media');
                this.#player.publish('data/nomedia', this.#apiKey);
                this.#player.publish('notification', {
                    type: 'error',
                    title: this.#player.locale.t('errors.library.header'),
                    message: this.#player.locale.t('errors.library.dashLoadError')
                }, this.#apiKey);
                reject(new Error('[VisionPlayer] Failed to load dash.js', { cause: error }));
            };

            document.head.appendChild(script);
        });

        return this.#loadHlsPromise;

    }

    /**
     * Called by the media component when metadata has loaded, but before the `media/reafy` event has been sent.
     * Allows the plugin to add additional metadata to the mediaSource object.
     * @param {module:src/core/Media~metaData} metaData  The source to load.
     */
    onLoaded(metaData) {

        const loadLevel = this.#hls.levels?.[this.#hls.loadLevel],
              audioTrack = this.#hls.audioTracks[this.#hls.audioTrack];

        this.#metaData = metaData;

        metaData.isLive = loadLevel?.details?.live === true;
        metaData.frameRate = loadLevel.frameRate;
        metaData.bitRate = loadLevel.bitrate;
        metaData.language = audioTrack?.lang;
        metaData.langName = audioTrack?.name;
        metaData.langId = audioTrack?.id;

    }

    /**
     * Called when a new Hls level is loaded. Updates 'islive' data attribute on the video element accordingly.
     * @param {string} event  The HLS LEVEL_LOADED event.
     * @param {Object} data   Video data.
     */
    #onHlsLevelLoaded = (event, data) => {

        const isLive = Boolean(data?.details?.live);

        this.#metaData.isLive = isLive;
        this.#metaData.frameRate = data?.levelInfo.frameRate;
        this.#metaData.bitRate = data?.levelInfo.bitrate;
        this.#metaData.width = data?.levelInfo.width;
        this.#metaData.height = data?.levelInfo.height;

        this.#player.media.getElement(this.#apiKey).dataset.isLive = isLive ? 'true' : 'false';

    };

    /**
     * Called when the media metadata is loaded to initialize languages/qualities if needed.
     * @listens module:src/core/Media#media/ready
     */
    #onMediaReady = () => {

        const { levels, audioTracks, currentLevel, autoLevelEnabled, nextAutoLevel } = this.#hls,
              qualityData = Array.from(levels.reduce((acc, { height }) => acc.add(height), new Set([null]))), // filter duplicates
              autoLevel = currentLevel === -1 && autoLevelEnabled,
              currentHeight = autoLevel ? levels[nextAutoLevel].height : levels[currentLevel].height;

        if (qualityData.length) {
            this.#player.publish('quality/update', {
                qualityData,
                current: { value: currentHeight }
            }, { async: false }, this.#apiKey);
        }

        this.#player.publish('subtitles/update', null, { async: false }, this.#apiKey);

        if (audioTracks.length > 1) {

            this.#player.publish('language/update', {
                languages: audioTracks.map(track => ({
                    language: track.lang,
                    langId: track.id,
                    langName: track.name })),
                current: {
                    language: audioTracks[this.#hls.audioTrack].lang,
                    langId: audioTracks[this.#hls.audioTrack].id,
                    langName: audioTracks[this.#hls.audioTrack].name
                }
            }, { async: false }, this.#apiKey);
        }
    };

    /**
     * Called when a language is selected in the language menu. Switches the HLS audio track accordingly.
     * @param {module:src/settings/Language~langObj} langObj       Object with selected language information.
     * @param {string}                               langObj.lang  Language code.
     * @param {number}                               langObj.id    Contains language ID.
     * @listens module:src/settings/Language#language/selected
     */
    #onLanguageSelected = langObj => {

        this.#hls.audioTrack = langObj.langId;

        this.#metaData.language = langObj.value;
        this.#metaData.langId = langObj.langId;
        this.#metaData.langName = langObj.langName;

    };

    /**
     * Called when a quality is selected in the quality menu. Finds the matching level and sets it, or 'auto' if not found.
     * @param {string} quality  The chosen resolution, e.g. '720p'.
     * @listens module:src/settings/Quality#quality/selected
     */
    #onQualitySelected = ({ quality }) => {

        const selected = this.#hls.levels.findIndex(level => level.height === quality);

        if (this.#hls.autoLevelEnabled && selected === this.#hls.currentLevel) {
            const { height } = this.#hls.levels[selected];
            this.#player.publish('quality/active', { value: height }, this.#apiKey);
        }

        this.#hls.currentLevel = selected;

    };

    /**
     * Handler for the hls 'AUDIO_TRACK_SWITCHED' event. Publishes 'language/active' to sync the internal track with the player's language state.
     * @param {string} event  The HLS AUDIO_TRACK_SWITCHED event.
     * @param {Object} data   Newly selected audio track.
     * @fires module:src/settings/Language#language/active
     */
    #onHlsAudioSwitch = (event, data) => {

        this.#player.publish('language/active', {
            language: data.lang,
            langId: data.id,
            langName: data.name
        }, this.#apiKey);

    };

    /**
     * Handler for the hls 'LEVEL_SWITCHED' event. Publishes 'quality/active' to sync the internal track with the player's language state.
     * @param {string} event  The HLS LEVEL_SWITCHED event.
     * @param {Object} data   Newly selected level.
     * @fires module:src/settings/Language#language/active
     */
    #onHlsQualitySwitch = (event, data) => {

        const { height } = this.#hls.levels[data.level];
        this.#player.publish('quality/active', { value: height }, this.#apiKey);

    };

    /**
     * Logs Hls.js events if debug is enabled.
     * @param {string} event  The hls debug event.
     * @param {Object} data   The original event data.
     */
    #onLogEvent = (event, data) => { // eslint-disable-line class-methods-use-this
        console.log('[hls]', event, data); // eslint-disable-line no-console
    };

    /**
     * This method is responsible for translating errors coming from the HLS library, so that they can be handled like errors coming from the standard engine
     * This is done by listening to selected events coming from the HLS library, and sending out errors via pubsub with the closest approximation to the standard HTML5 media error codes.
     * In addition, the media error object is simulated by using a customized subclass of the standard error object.
     * @param {Event}   event           The event coming from the HLS library.
     * @param {Object}  data            HLS Library event data.
     * @param {boolean} data.fatal      Indicates a fatal error.
     * @param {string}  data.type       The HLS error type from the lib.
     * @param {string}  [data.details]  Additional error Details.
     * @param {string}  [data.reason]   Reason for error.
     * @fires module:src/core/Media#media/error
     */
    #onHlsError = (event, data) => {

        if (!data.fatal) return;

        let error;

        switch (data.type) {

            case HlsJs.ErrorTypes.NETWORK_ERROR:

                switch (data.details) {
                    case HlsJs.ErrorDetails.LEVEL_LOAD_TIMEOUT:
                    case HlsJs.ErrorDetails.MANIFEST_LOAD_TIMEOUT:
                    case HlsJs.ErrorDetails.FRAG_LOAD_TIMEOUT:
                        error = new ExtendedMediaError(1);
                        break;
                    case HlsJs.ErrorDetails.FRAG_PARSING_ERROR:
                    case HlsJs.ErrorDetails.MANIFEST_PARSING_ERROR:
                        error = new ExtendedMediaError(4);
                        break;
                    default:
                        error = new ExtendedMediaError(2);
                }

                // try to recover network error
                // console.log('fatal network error encountered, try to recover');
                // this.#hls.startLoad();
                break;

            case HlsJs.ErrorTypes.MEDIA_ERROR:

                switch (data.details) {
                    case HlsJs.ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR:
                        error = new ExtendedMediaError(3);
                        break;
                    default:
                        error = new ExtendedMediaError(4);
                }

                // console.log('fatal media error encountered, try to recover');
                // this.#hls.recoverMediaError();
                break;

            case HlsJs.ErrorTypes.KEY_SYSTEM_ERROR:
                /* KEY_LOAD_ERROR: 'keyLoadError'
                KEY_LOAD_TIMEOUT: 'keyLoadTimeOut'
                KEY_SYSTEM_LICENSE_REQUEST_FAILED: 'keySystemLicenseRequestFailed'
                KEY_SYSTEM_NO_ACCESS: 'keySystemNoAccess'
                KEY_SYSTEM_NO_INIT_DATA: 'keySystemNoInitData'
                KEY_SYSTEM_NO_KEYS: 'keySystemNoKeys'
                KEY_SYSTEM_NO_SESSION: 'keySystemNoSession' */
                error = new ExtendedMediaError(3);
                break;

            default:
                error = new ExtendedMediaError(4);
                break;
        }

        if (data.details || data.reason) {
            error.message = '';
            if (data.details) error.message += `Details: ${data.details}`;
            if (data.details && data.reason) error.message += ' / ';
            if (data.reason) error.message += `Reason: ${data.reason}`;
        }

        this.#loadTask.reject(error);
        this.#player.media.pause();
        this.#player.publish('media/error', { error }, this.#apiKey);

    };

    /**
     * Removes the current HLS instance if present, unsubscribes from events, etc.
     * @listens module:src/core/Data#data/ready
     */
    #removeHls = () => {

        if (this.#hls) {
            if (this.#config.debug) Object.keys(HlsJs.Events).forEach(key => this.#hls.off(HlsJs.Events[key], this.#onLogEvent));
            this.#hls.off(HlsJs.Events.ERROR, this.#onHlsError);
            this.#hls.off(HlsJs.Events.AUDIO_TRACK_SWITCHED, this.#onHlsAudioSwitch);
            this.#hls.off(HlsJs.Events.LEVEL_SWITCHED, this.#onHlsQualitySwitch);
            this.#hls.destroy();
            this.#hls = null;
            this.#player.unsubscribe(this.#subscriptions);
        }

    };

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        this.#removeHls();
        this.#mediaComponent.unregisterPlugin(this);
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#hls = this.#mediaComponent = this.#apiKey = null;

    }

}
