import ExtendedMediaError from '../util/ExtendedMediaError.js';

let DashJs = window.dashjs,
    dash5 = DashJs?.Version.startsWith('5.');

/**
 * The Dash component integrates dash.js into the player's plugin architecture, allowing DASH streaming with optional DRM (Widevine/PlayReady).
 * Supports Subtitles, Quality and Language selection.
 * @exports module:src/streaming/Dash
 * @requires src/util/ExtendedMediaError
 * @author Frank Kudermann - alphanull
 * @version 1.0.0
 * @license MIT
 */
export default class Dash {

    /**
     * The dash configuration, containing debug and optional DRM details.
     * @type     {Object}
     * @property {boolean}        [lazyLoadLib=true]  If `true`, the Dash.js library is only loaded when loading the first media item.
     * @property {string}         [libUrl]            Custom URL for the Dash.js library. Defaults to CDN URL if not specified.
     * @property {Object|boolean} [debug=false]       Debug settings or boolean to enable debug logs.
     * @property {boolean}        [debug.enabled]     Whether debugging is enabled.
     * @property {boolean}        [debug.drm]         Whether to log DRM-specific events if dash protection is present.
     * @property {string}         [debug.level]       DashJs debug level (e.g., LOG_LEVEL_WARNING).
     */
    #config = {
        lazyLoadLib: true,
        libUrl: 'https://cdn.jsdelivr.net/npm/dashjs@4.7.4/dist/dash.all.min.js',
        debug: {
            enabled: false,
            drm: false,
            level: 'LOG_LEVEL_WARNING'
        }
    };

    /**
     * Reference to the main player instance.
     * @type {module:src/core/Player}
     */
    #player;

    /**
     * Subscriptions to various player events that we handle specifically for dash.
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
     * Reference to the engine (Video) instance.
     * @type {module:src/core/Media}
     */
    #mediaComponent;

    /**
     * Reference to the Dash MediaPlayer Instance.
     * @type {Object}
     */
    #dash;

    /**
     * Holds currently available audio and video tracks.
     * @type {Object}
     */
    #availableTracks;

    /**
     * Reference to the Async Task instance. Used to handle async tasks, which can be cancelled, resolved or rejected.
     * @type {module:lib/util/AsyncTask}
     */
    #loadTask;

    /**
     * Holds metadata information provided by media.load and loaded metadata.
     * @type {module:src/core/Media~metaData}
     */
    #metaData;

    /**
     * Promise awaiting the loading of the dash lib.
     * @type {Promise}
     */
    #loadDashPromise;

    /**
     * Creates an instance of the Dash plugin.
     * @param {module:src/core/Player} player          Reference to the player instance.
     * @param {module:src/core/Media}  mediaComponent  Reference to the engine (video) instance.
     * @param {symbol}                 apiKey          Token for extended access to the player API.
     */
    constructor(player, mediaComponent, { apiKey }) {

        this.#config = player.initConfig('dash', this.#config);

        if (!this.#config) return [false];

        this.#player = player;
        this.#apiKey = apiKey;

        DashJs = window.dashjs;

        if (!DashJs && !this.#config.lazyLoadLib) this.#loadDashJs();

        // Add 'mpd' format to the recognized formats list
        this.#player.constructor.addFormat({
            extensions: ['mpd'],
            mimeTypeAudio: ['application/dash+xml'],
            mimeTypeVideo: ['application/dash+xml']
        });

        this.#player.subscribe('data/ready', this.#removeDash);

        this.#mediaComponent = mediaComponent;
        this.#mediaComponent.registerPlugin(this); // Register dash plugin to the video component

    }

    /**
     * Tells whether this plugin can handle the given mimeType and optional DRM system.
     * @param   {module:src/core/Media~metaData} metaData              The data to test.
     * @param   {string}                         metaData.mimeType     The mime type to test.
     * @param   {string}                         [metaData.drmSystem]  Optional DRM system info.
     * @returns {'probably'|'maybe'|''}                                Indicates if stream can be played.
     */
    canPlay({ mimeType, drmSystem } = {}) {

        const result = mimeType === 'application/dash+xml' ? 'maybe' : '';

        switch (drmSystem) {
            case 'Widevine':
                return !(this.#player.getClient('edge') || this.#player.getClient('safari')) && result ? result : '';
            case 'PlayReady':
                return this.#player.getClient('edge') ? result : '';
            default:
                return result;
        }

    }

    /**
     * Initializes the dash.js MediaPlayer with the given source.
     * @param   {module:src/core/Media~metaData} metaData            Source Object (currentSource).
     * @param   {string}                         metaData.src        Actual HLS URL to load.
     * @param   {Object}                         [options]           Additional options.
     * @param   {module:lib/util/AsyncTask}      [options.loadTask]  If a source task instance is provided, handle errors using this object.
     * @returns {Promise|undefined}                                  If a source task instance is provided, returns a promise that rejects with a resulting media error.
     * @throws  {Error}                                              If drm scheme is unknown.
     */
    async load({ src }, options = {}) {

        if (!DashJs) {
            await this.#loadDashJs();
            if (!DashJs) DashJs = window.dashjs;
            dash5 = DashJs?.Version.startsWith('5.');
        }

        this.#dash = DashJs.MediaPlayer().create();

        this.#dash.updateSettings({
            streaming: {
                abr: {
                    autoSwitchBitrate: { audio: true, video: true },
                    limitBitrateByPortal: true,
                    usePixelRatioInLimitBitrateByPortal: true
                },
                text: {
                    defaultEnabled: true,
                    dispatchForManualRendering: true
                },
                buffer: {
                    fastSwitchEnabled: true
                }
            }
        });

        this.#dash.initialize(this.#player.media.getElement(this.#apiKey), src, this.#player.getConfig('media.autoPlay'));

        if (this.#config.debug === true || this.#config.debug?.enabled) {
            // If debug is enabled, attach all dash events for logging
            if (this.#config.debug.level) {
                this.#dash.updateSettings({
                    debug: {
                        // LOG_LEVEL_NONE, LOG_LEVEL_FATAL, LOG_LEVEL_ERROR, LOG_LEVEL_WARNING, LOG_LEVEL_INFO or LOG_LEVEL_DEBUG
                        logLevel: DashJs.Debug[this.#config.debug.level]
                    }
                });
            }

            Object.values(DashJs.MediaPlayer.events).forEach(value => this.#dash.on(value, this.#onDashEvent));

            if (DashJs.Protection) {
                Dash.#dashProtectionEventNames.forEach(name => this.#dash.on(DashJs.Protection.events[name], this.#onProtectionEvent));
            }
        }

        const { drm } = this.#player.data.getMediaData();

        if (DashJs.Protection && drm && (drm.Widevine || drm.PlayReady)) {

            this.#dash.on(DashJs.Protection.events.INTERNAL_KEY_STATUS_CHANGED, this.#onDrmKeyStatus);

            const drmConfig = {};

            if (drm.Widevine && !this.#player.getClient('edge')) {
                drmConfig['com.widevine.alpha'] = {
                    serverURL: drm.Widevine.licenseUrl,
                    httpRequestHeaders: drm.Widevine.header,
                    priority: 0
                };
            }

            if (drm.PlayReady && this.#player.getClient('edge')) {
                drmConfig['com.microsoft.playready'] = {
                    serverURL: drm.PlayReady.licenseUrl,
                    httpRequestHeaders: drm.PlayReady.header,
                    priority: 1
                };
            }

            this.#dash.setProtectionData(drmConfig);
            this.#dash.getProtectionController().setRobustnessLevel('SW_SECURE_CRYPTO');

        }

        this.#dash.on(DashJs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, this.#onQualityChangeRendered);
        this.#dash.on(DashJs.MediaPlayer.events.TRACK_CHANGE_RENDERED, this.#onTrackChangeRendered);
        this.#dash.on(DashJs.MediaPlayer.events.PLAYBACK_METADATA_LOADED, this.#onMetaDataLoaded);
        this.#dash.on(DashJs.MediaPlayer.events.ERROR, this.#onDashError);

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
    #loadDashJs() {

        if (window.dashjs) return Promise.resolve();

        if (this.#loadDashPromise) return this.#loadDashPromise;

        this.#loadDashPromise = new Promise((resolve, reject) => {

            // Falls schon ein Script-Tag existiert (z.B. durch anderen Player), warte auf dessen Load
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
                this.#loadDashPromise = null;
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

        return this.#loadDashPromise;
    }

    /**
     * Called by the media component when metadata has loaded, but before the `media/ready` event has been sent.
     * Allows the plugin to add additional metadata to the mediaSource object.
     * @param {module:src/core/Media~metaData} metaData  The updated meta data object.
     */
    onLoaded(metaData) {

        this.#metaData = metaData;

        this.#availableTracks = {
            audio: this.#dash.getTracksFor('audio'),
            video: this.#dash.getTracksFor('video')
        };

        const idx = this.#dash.getQualityFor(metaData.mediaType), // current video index
              qualities = dash5 ? this.#dash?.getRepresentationsByType(metaData.mediaType) : this.#dash?.getBitrateInfoListFor(metaData.mediaType),
              currentQuality = qualities[idx], // current representations object
              currentAudioTrack = this.#dash.getCurrentTrackFor('audio'),
              qualityDataRaw = qualities.map(bitRate => bitRate.height),
              qualityData = [...new Set(qualityDataRaw)], // filter duplicates
              currentHeight = dash5 ? this.#dash.getCurrentRepresentationForType('video').height : this.#dash.getVideoElement().videoHeight,
              languagesRaw = this.#availableTracks.audio.map(track => ({ language: track.lang })), // get available languages
              uniqueLanguages = [],
              seen = new Set();

        qualityData.unshift(null);

        this.#player.publish('quality/update', {
            qualityData,
            current: {
                value: currentHeight
            }
        }, this.#apiKey);

        for (const entry of languagesRaw) {
            if (!seen.has(entry.language)) {
                seen.add(entry.language);
                uniqueLanguages.push(entry);
            }
        }

        if (uniqueLanguages.length) {
            this.#player.publish('language/update', {
                languages: uniqueLanguages,
                current: { value: currentAudioTrack.lang }
            }, this.#apiKey);
        }

        const duration = this.#dash.duration(),
              isLive = this.#dash.isDynamic();

        this.#player.media.getElement(this.#apiKey).dataset.isLive = isLive ? 'true' : 'false';

        metaData.isLive = isLive;
        metaData.frameRate = currentQuality.frameRate;
        metaData.bitRate = currentQuality.bitrate;
        metaData.language = currentAudioTrack.lang;
        metaData.duration = duration === Infinity ? 0 : duration;

    }

    /**
     * Handler for dash.js PLAYBACK_METADATA_LOADED event. Sets up track lists, languages, qualities.
     * @fires   module:src/settings/Quality#quality/update
     * @fires   module:src/settings/Language#language/update
     * @fires   module:src/text/Subtitles#subtitles/update
     * @listens dashjs.MediaPlayer.events.PLAYBACK_METADATA_LOADED
     */
    #onMetaDataLoaded = () => {

        this.#player.publish('subtitles/update', this.#apiKey);

        this.#subscriptions = [
            this.#player.subscribe('subtitles/selected', this.#onSubtitlesSelected),
            this.#player.subscribe('language/selected', this.#onLanguageSelected),
            this.#player.subscribe('quality/selected', this.#onQualitySelected),
            this.#player.subscribe('quality/resize', this.#onQualityResize)
        ];

    };

    /**
     * Handler for 'subtitles/selected' event. Matches the track to dash, calls dash.setTextTrack.
     * @param {Object} selected           Object containing information about the selected Subtitle.
     * @param {string} selected.language  The newly selected subtitle language code.
     * @listens module:src/text/Subtitles#subtitles/selected
     */
    #onSubtitlesSelected = selected => {

        // find matching subtitle
        const trackList = Array.from(this.#player.media.getElement(this.#apiKey).textTracks),
              trackIndex = trackList.findIndex(track => track.language === selected.language);

        this.#dash.setTextTrack(trackIndex);

    };

    /**
     * Handler for 'language/selected' event. Chooses the matching audio track in dash.
     * @param {module:src/settings/Language~langObj} langObj       Object containing selected language information.
     * @param {string}                               langObj.lang  The newly selected audio language code.
     * @listens module:src/settings/Language#language/selected
     */
    #onLanguageSelected = langObj => {

        const allAudioTracks = this.#dash.getTracksFor('audio') || [],
              candidates = allAudioTracks.filter(track => track && track.lang === langObj.value),
              currentTrack = this.#dash.getCurrentTrackFor('audio');

        if (!candidates.length) return;

        // Try to determine the current bitrate using the current audio track's bitrateList
        let currentBitrate = null;

        if (currentTrack && Array.isArray(currentTrack.bitrateList)) {
            const currentQualityIdx = this.#dash.getQualityFor('audio');
            if (typeof currentQualityIdx === 'number' && currentTrack.bitrateList[currentQualityIdx]) {
                currentBitrate = currentTrack.bitrateList[currentQualityIdx].bandwidth;
            }
        }

        if (typeof currentBitrate !== 'number') return;

        // Find the candidate track and bitrate index with the closest bandwidth to the current bitrate
        let best = { track: candidates[0], bitrateIdx: 0, diff: Infinity };

        candidates.forEach(track => {
            if (!Array.isArray(track.bitrateList) || !track.bitrateList.length) return;
            track.bitrateList.forEach((b, idx) => {
                if (typeof b.bandwidth !== 'number') return;
                const diff = Math.abs(b.bandwidth - currentBitrate);
                if (diff < best.diff) {
                    best = { track, bitrateIdx: idx, diff };
                }
            });
        });

        this.#metaData.language = langObj.value;
        this.#metaData.langId = langObj.langId;
        this.#metaData.langName = langObj.langName;

        // Umschalten auf bestes Matching
        // this.#dash.setQualityFor('audio', best.bitrateIdx);
        this.#dash.setCurrentTrack(best.track);

    };

    /**
     * Handler for 'quality/selected' event. If the user picks a specific resolution, use it; else 'auto'.
     * @param {string} selected  The chosen resolution in the format '<height>p', or unknown => auto.
     * @listens module:src/settings/Quality#quality/selected
     */
    #onQualitySelected = ({ quality }) => {

        const representations = dash5 ? this.#dash?.getRepresentationsByType('video') : this.#dash?.getBitrateInfoListFor('video'),
              newRep = representations.find(rep => rep.height === quality);

        this.#dash.updateSettings({
            streaming: {
                abr: {
                    maxBitrate: { video: -1 },
                    autoSwitchBitrate: {
                        video: typeof newRep === 'undefined'
                    }
                }
            }
        });

        if (newRep) {
            if (dash5 && typeof newRep.index !== 'undefined') {
                this.#dash.setRepresentationForTypeByIndex('video', newRep.index, true);
            } else if (typeof newRep.qualityIndex !== 'undefined') {
                this.#dash.setQualityFor('video', newRep.qualityIndex, true);
            }
        }
    };

    /**
     * Handler for 'quality/resize' event. Caps the max bitrate if display size is small.
     * @param {Object} size         Object containing size information.
     * @param {number} size.height  The new container height in px.
     * @listens module:src/settings/Quality#quality/resize
     */
    #onQualityResize = ({ height }) => {

        // this.#dash.updatePortalSize(); -> seems to do nothing, so we have to use another way
        // we need to find a suitable size and set the max bitrate to cap dash
        // sort by height, then bitrate

        const bitRates = dash5 ? this.#dash?.getRepresentationsByType('video') : this.#dash?.getBitrateInfoListFor('video');

        const newCap = bitRates
            .sort((a, b) => a.height - b.height || a.bitrate - b.bitrate)
            .reduce((acc, rate) => rate.height < height * 1.2 ? rate : acc, {});

        this.#dash.updateSettings({
            streaming: {
                abr: {
                    maxBitrate: { video: newCap.bitrate }
                }
            }
        });

    };

    /**
     * Handler for dash.js TRACK_CHANGE_RENDERED event. If it's audio, update the player's language state.
     * @param {Object} mediaInfo               The media info object with the changed settings.
     * @param {string} mediaInfo.mediaType     The media type of the changed object.
     * @param {Object} mediaInfo.newMediaInfo  The new media info with language information.
     * @fires module:src/settings/Language#language/active
     * @listens dashjs.MediaPlayer.events.TRACK_CHANGE_RENDERED
     */
    #onTrackChangeRendered = ({ mediaType, newMediaInfo }) => {

        if (mediaType !== 'audio') return;
        if (newMediaInfo.lang) this.#player.publish('language/active', { language: newMediaInfo.lang, langId: newMediaInfo.index }, this.#apiKey);

    };

    /**
     * Handler for dash.js QUALITY_CHANGE_RENDERED event. Publishes 'quality/active' with the current resolution.
     * @param {Object} mediaInfo  The media info object with the changed settings.
     * @fires module:src/settings/Quality#quality/active
     * @listens dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED
     */
    #onQualityChangeRendered = mediaInfo => {

        if (mediaInfo.mediaType !== 'video') return;

        const idx = this.#dash.getQualityFor('video'), // current video index
              qualities = dash5 ? this.#dash?.getRepresentationsByType('video') : this.#dash?.getBitrateInfoListFor('video'),
              currentQuality = qualities[idx], // current representations object
              width = dash5 ? mediaInfo.newRepresentation.width : this.#dash.getBitrateInfoListFor('video')[mediaInfo.newQuality].width,
              height = dash5 ? mediaInfo.newRepresentation.height : this.#dash.getBitrateInfoListFor('video')[mediaInfo.newQuality].height;

        const duration = this.#dash.duration(),
              isLive = this.#dash.isDynamic();

        this.#metaData.duration = duration === Infinity ? 0 : duration;
        this.#metaData.isLive = isLive;
        this.#metaData.frameRate = currentQuality.frameRate;
        this.#metaData.bitRate = currentQuality.bitrate;
        this.#metaData.width = width;
        this.#metaData.height = height;

        this.#player.media.getElement(this.#apiKey).dataset.isLive = isLive ? 'true' : 'false';
        this.#player.publish('quality/active', { value: height }, this.#apiKey);

    };

    /**
     * Handler for dash.js 'INTERNAL_KEY_STATUS_CHANGED' event. If a key is restricted or expired, send a media error.
     * @param {Object} event  The event coming from dash.
     * @listens dashjs.MediaPlayer.events.INTERNAL_KEY_STATUS_CHANGED
     */
    #onDrmKeyStatus = event => {

        if (event.type === 'internalkeyStatusChanged' && ['output-restricted', 'internal-error', 'expired'].includes(event.status)) {
            this.#player.publish('media/error', { error: new ExtendedMediaError(99) }, this.#apiKey);
        }

    };

    /**
     * Handler for dash.js ERROR event. Maps dash error codes to simulated media errors, publishes 'media/error'.
     * @param {Object} event        The dahs event object.
     * @param {Object} event.error  The event error code.
     * @fires module:src/core/Media#media/error
     */
    #onDashError = event => {

        let { error } = event;
        const { message } = error;

        switch (error.code) {

            case DashJs.MediaPlayer.errors.MANIFEST_LOADER_LOADING_FAILURE_ERROR_CODE:
            case DashJs.MediaPlayer.errors.DOWNLOAD_ERROR_ID_MANIFEST_CODE:
            case DashJs.MediaPlayer.errors.DOWNLOAD_ERROR_ID_SIDX_CODE:
            case DashJs.MediaPlayer.errors.DOWNLOAD_ERROR_ID_CONTENT_CODE:
            case DashJs.MediaPlayer.errors.DOWNLOAD_ERROR_ID_INITIALIZATION_CODE:
            case DashJs.MediaPlayer.errors.DOWNLOAD_ERROR_ID_XLINK_CODE:
                error = new ExtendedMediaError(2);
                break;

            case DashJs.MediaPlayer.errors.MANIFEST_LOADER_PARSING_FAILURE_ERROR_CODE:
            case DashJs.MediaPlayer.errors.MANIFEST_ERROR_ID_NOSTREAMS_CODE:
            case DashJs.MediaPlayer.errors.TIMED_TEXT_ERROR_ID_PARSE_CODE:
                error = new ExtendedMediaError(3);
                break;

            case DashJs.MediaPlayer.errors.CAPABILITY_MEDIASOURCE_ERROR_CODE:
            case DashJs.MediaPlayer.errors.MANIFEST_ERROR_ID_MULTIPLEXED_CODE:
            case DashJs.MediaPlayer.errors.MEDIASOURCE_TYPE_UNSUPPORTED_CODE:
                error = new ExtendedMediaError(4);
                break;

            case DashJs.MediaPlayer.errors.MEDIA_KEYERR_CODE:
            case DashJs.MediaPlayer.errors.KEY_SESSION_CREATED_ERROR_CODE:
            case DashJs.MediaPlayer.errors.KEY_STATUS_CHANGED_EXPIRED_ERROR_CODE:
            case DashJs.MediaPlayer.errors.KEY_SYSTEM_ACCESS_DENIED_ERROR_CODE:
            case DashJs.MediaPlayer.errors.MEDIA_KEY_MESSAGE_ERROR_CODE:
            case DashJs.MediaPlayer.errors.MEDIA_KEY_MESSAGE_ERROR_MESSAGE:
            case DashJs.MediaPlayer.errors.MEDIA_KEY_MESSAGE_LICENSER_ERROR_CODE:
            case DashJs.MediaPlayer.errors.MEDIA_KEY_MESSAGE_LICENSER_ERROR_MESSAGE:
            case DashJs.MediaPlayer.errors.MEDIA_KEY_MESSAGE_NO_CHALLENGE_ERROR_CODE:
            case DashJs.MediaPlayer.errors.MEDIA_KEY_MESSAGE_NO_CHALLENGE_ERROR_MESSAGE:
            case DashJs.MediaPlayer.errors.MEDIA_KEY_MESSAGE_NO_LICENSE_SERVER_URL_ERROR_CODE:
            case DashJs.MediaPlayer.errors.MEDIA_KEY_MESSAGE_NO_LICENSE_SERVER_URL_ERROR_MESSAGE:
                error = new ExtendedMediaError(99);
                break;

            // no default
            default:
                error = new ExtendedMediaError(error.code);

        }

        error.message = message;

        this.#loadTask.reject(error);
        this.#player.media.pause();
        this.#player.publish('media/error', { error }, this.#apiKey);

    };

    /**
     * Handler for dash protection events if debug is enabled.
     * @param {Object} event  Event data from dash.js protection.
     */
    #onProtectionEvent = event => { // eslint-disable-line class-methods-use-this

        console.log(`[DRM]   Event received: ${event.type}`, event); // eslint-disable-line no-console

    };

    /**
     * Generic handler for dash.js events when debug mode is enabled.
     * Filters out noisy or frequent events and logs others to the console.
     * This helps with development and troubleshooting by surfacing meaningful events only.
     * @param {Object} event       The event object emitted by dash.js.
     * @param {string} event.type  The type name of the dash event.
     */
    #onDashEvent = event => { // eslint-disable-line class-methods-use-this

        if (['fragmentLoading', 'playbackTimeUpdated', 'bufferLevelUpdated', 'throughputMeasurementStored', 'playbackProgress'].includes(event.type)
          || event.type.startsWith('metric') || event.type.startsWith('fragment')) return;

        console.log(`[Dash]  Event received: ${event.type}`, event); // eslint-disable-line no-console
    };

    /**
     * Handler for removing dash when 'data/ready' triggers a new media load. Cleans up subscriptions and dash instance.
     * @listens module:src/core/Data#data/ready
     */
    #removeDash = () => {

        if (this.#dash) {

            if (this.#config.debug === true || this.#config.debug?.enabled) {
                Object.values(DashJs.MediaPlayer.events).forEach(value => { this.#dash.off(value, this.#onDashEvent); });
                if (DashJs.Protection) {
                    Dash.#dashProtectionEventNames.forEach(name => {
                        this.#dash.off(DashJs.Protection.events[name], this.#onProtectionEvent);
                    });
                }

            }

            const { drm } = this.#player.data.getMediaData();

            if (DashJs.Protection && drm && (drm.Widevine || drm.PlayReady)) {
                this.#dash.off(DashJs.Protection.events.INTERNAL_KEY_STATUS_CHANGED, this.#onDrmKeyStatus);
            }

            this.#dash.off(DashJs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, this.#onQualityChangeRendered);
            this.#dash.off(DashJs.MediaPlayer.events.TRACK_CHANGE_RENDERED, this.#onTrackChangeRendered);
            this.#dash.off(DashJs.MediaPlayer.events.PLAYBACK_METADATA_LOADED, this.#onMetaDataLoaded);
            this.#dash.off(DashJs.MediaPlayer.events.ERROR, this.#onDashError);
            this.#dash.destroy();
            this.#dash = null;

            this.#player.unsubscribe(this.#subscriptions);
        }
    };

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        this.#mediaComponent.unregisterPlugin(this);
        this.#player.unsubscribe('data/ready', this.#removeDash);
        this.#removeDash();
        this.#loadDashPromise = null;
        this.#player = this.#dash = this.#mediaComponent = this.#apiKey = null;

    }

    /**
     * The list of protection events from dash.js (v5 or vX).
     * @private
     * @memberof module:src/streaming/Dash
     * @type {string[]}
     */
    static #dashProtectionEventNames = [
        'INTERNAL_KEY_MESSAGE',
        'INTERNAL_KEY_STATUS_CHANGED',
        'KEY_ADDED',
        'KEY_ERROR',
        'KEY_MESSAGE',
        'KEY_SESSION_CLOSED',
        'KEY_SESSION_CREATED',
        'KEY_SESSION_REMOVED',
        'KEY_STATUSES_CHANGED',
        'KEY_SYSTEM_ACCESS_COMPLETE',
        'KEY_SYSTEM_SELECTED',
        'LICENSE_REQUEST_COMPLETE',
        'LICENSE_REQUEST_SENDING',
        'NEED_KEY',
        'PROTECTION_CREATED',
        'PROTECTION_DESTROYED',
        'SERVER_CERTIFICATE_UPDATED',
        'TEARDOWN_COMPLETE',
        'VIDEO_ELEMENT_SELECTED',
        'KEY_SESSION_UPDATED'
    ];
}
