import { clone, extend, isObject, isArray, isString, isNumber, isUndefined } from '../../lib/util/object.js';
import AsyncTask from '../../lib/util/AsyncTask.js';
import DataError from '../util/DataError.js';

/**
 * The `Data` component is responsible for managing, parsing, and validating the media metadata used by the player.
 * It supports single media items as well as complex playlist structures, including multiple quality levels, encodings, subtitle tracks, and overlays.
 * It exposes an API for dynamic switching of variants or media entries, integrates MIME-type and capability checks, and handles fallback scenarios for unplayable or malformed data.
 * This component ensures that only valid and playable streams are used, while offering flexibility through configuration options such as lenient parsing or skipping invalid entries.
 * Additionally, it dispatches lifecycle events to signal when media is ready, parsed, or in case of errors.
 * **Note:** this component is **mandatory** and required for normal player operations, so it cannot be switched off.
 * @exports module:src/core/Data
 * @requires lib/util/object
 * @requires lib/util/AsyncTask
 * @requires src/util/DataError
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class Data {

    /**
     * Contains configuration options for how the media is parsed and validated.
     * @type     {Object}
     * @property {boolean}               [skipInvalidItems=false]           Ignore (skip) invalid media items rather than throwing an error.
     * @property {boolean}               [skipInvalidRepresentations=true]  Ignore invalid representations instead of throwing errors for them.
     * @property {boolean}               [skipEmptyData=false]              Ignore empty media data (eg is `null` or `undefined`) and do not throw an error. Useful if you want to assign mediaData not immediatly on player instantiation.
     * @property {boolean}               [disablePlayCheck=false]           Skip any play checks and trust the source to be playable.
     * @property {boolean}               [lenientPlayCheck=false]           Check only file extensions, but do not use `canPlay`.
     * @property {boolean}               [lenientPlayCheckBlob=true]        Assume blob: URLs are valid without checking.
     * @property {number|string|boolean} [preferredQuality]                 Quality setting that should be preferred when loading new media, or `false` to not set such a preference and use autoselect instead.
     * @property {string|boolean}        [preferredLanguage]                Language that should be preferred when loading new media, `true` to use the player locale as preferred default or `false` to not set any preference at all.
     */
    #config = {
        skipInvalidItems: true,
        skipInvalidRepresentations: false,
        skipEmptyData: false,
        disablePlayCheck: false,
        lenientPlayCheck: false,
        lenientPlayCheckBlob: true,
        preferredQuality: false,
        preferredLanguage: true
    };

    /**
     * Reference to the player instance.
     * @type {module:src/core/Player}
     */
    #player;

    /**
     * Contains the players' mediaData.
     * @type     {Object}
     * @property {module:src/core/Data~mediaItem[]} media              Array of media items.
     * @property {number}                           currentMediaIndex  Index of the currently active media item.
     * @property {string|Object<string, string>}    [title]            Title of the playlist.
     * @property {string|Object<string, string>}    [titleSecondary]   Secondary title of the playlist.
     */
    #data = {
        media: [],
        currentMediaIndex: 0,
        title: '',
        titleSecondary: ''
    };

    /**
     * Reference to the root DOM element.
     * @type {HTMLElement}
     */
    #rootEle;

    /**
     * Secret key only known to the player instance and initialized components.
     * Used to be able to restrict access to API methods in conjunction with secure mode.
     * @type {symbol}
     */
    #apiKey;

    /**
     * Reference to the Async Task instance. Used to handle async tasks, which can be cancelled, resolved or rejected.
     * @type {module:lib/util/AsyncTask}
     */
    #setMediaDataTask;

    /**
     * Timeout ID for data error publishing. Used to prevent race conditions when component is destroyed.
     * @type {number}
     */
    #dataErrorTimeoutId;

    /**
     * The previous mediaData argument. Used for handling repeated calls to setMediaData.
     * If two calls have the same mediaData, both will get the same promise. If the new call is different, the old one is cancelled.
     */
    #previousDataArg;

    /**
     * Creates an instance of the Data component.
     * @param  {module:src/core/Player} player            Reference to the VisionPlayer instance.
     * @param  {module:src/core/Player} parent            Reference to the parent instance.
     * @param  {Object}                 [options]         Additional options.
     * @param  {symbol}                 [options.apiKey]  Token for extended access to the player API.
     * @throws {Error}                                    If trying to disable this component.
     */
    constructor(player, parent, { apiKey }) {

        this.#config = player.initConfig('data', this.#config);

        if (!this.#config) throw new Error('[Visionplayer] Cannot disable the Data component by configuration.');

        if (this.#config.preferredLanguage === true) this.#config.preferredLanguage = player.getConfig('locale.lang');

        this.#rootEle = player.dom.getElement(apiKey);
        this.#apiKey = apiKey;
        this.#player = player;

        // Expose relevant methods via the player's API.
        this.#player.setApi('data.getMediaData', this.#getMediaData, this.#apiKey);
        this.#player.setApi('data.setMediaData', this.#setMediaData, this.#apiKey);
        this.#player.setApi('data.setMediaIndex', this.#setMediaIndex, this.#apiKey);
        this.#player.setApi('data.getPreferredMetaData', this.#getPreferredMetaData, this.#apiKey);
        this.#player.setApi('data.error', this.#dataError, this.#apiKey);

    }

    /**
     * Depending on the selector, returns a specific media item (selector is a number representing the index in the media playlist), the entire data object (selector = 'all'), the current media item (selector = 'current') or the currently active index (selector = 'index').
     * @param   {number|'all'|'index'}                                   [selector]  Either a media based on numerical index, 'all' for all data, or 'index' for the current media index.
     * @returns {module:src/core/Data~mediaItem|Object|number|undefined}             Returns one media item, the entire data object, the current media item, or the current numerical index, depending on the selector.
     */
    #getMediaData = (selector = this.#data.currentMediaIndex) => {

        if (isNumber(selector) && selector >= 0 && selector < this.#data.media.length) {
            return clone(this.#data.media[selector]);
        }

        if (selector === 'all') return clone(this.#data);
        if (selector === 'index') return clone(this.#data.currentMediaIndex);

        this.#dataError(`getMediaData: invalid selector: ${selector}`);

    };

    /**
     * Assigns media data to the player instance. `mediaData` can be a valid data object or a string, in this case the player will either
     * - try to to load it as a media resource directly (if the extension matches a known type) or
     * - try to load it as a mediaData object in JSON format.
     * @param   {module:src/core/Data~mediaItem|string} mediaData  Can be either a string representing an url or a media object.
     * @param   {number}                                [index=0]  The index of the media item to switch to.
     * @returns {Promise}                                          A promise that resolves with the loaded and parsed data or rejects when loading or parsing failed.
     * @fires module:src/core/Data#data/parsed
     * @fires module:src/core/Data#data/nomedia
     */
    #setMediaData = async(mediaData, index = 0) => {

        const prevTask = this.#setMediaDataTask;

        if (mediaData && mediaData === this.#previousDataArg && prevTask?.status === 'pending') return prevTask.promise;
        if (prevTask?.status === 'pending') await prevTask.cancel().catch(() => {});
        if (this.#config.skipEmptyData && !mediaData) return clone(this.#data.media);

        this.#setMediaDataTask = new AsyncTask();

        let mData = this.#previousDataArg = mediaData;

        this.#data = {
            media: [],
            currentMediaIndex: 0,
            title: '',
            titleSecondary: ''
        };

        if (isString(mData) && !this.#addPlayableMetaData({ src: mData })) {
            // presumably no media file, so lets try to load as data
            try {
                mData = await this.#loadMediaData(mData);
            } catch (error) {
                this.#rootEle.classList.add('has-no-media');
                this.#dataError('DATA_ERR_MEDIA_DATA_DENIED', error);
                this.#player.publish('data/nomedia', this.#apiKey);
                this.#setMediaDataTask.reject(new DataError(error.message, { code: 'DATA_ERR_MEDIA_DATA_DENIED', cause: error }));
                return this.#setMediaDataTask.promise;
            }
        }

        const isPlaylist = isArray(mData?.media),
              mediaDataArray = isPlaylist ? mData.media : Array.isArray(mData) ? mData : [mData],
              parsed = [];

        let loadError = {};

        for (const nextID of mediaDataArray) {
            try {
                const mediaItem = await this.#parseMediaDataItem(nextID);
                if (mediaItem) parsed.push(mediaItem);
            } catch (error) {
                /* if (!this.#config.skipInvalidItems || mData.media.length < 2) */ loadError = error;
            }
        }

        if (parsed.length) {

            if ((loadError.code || loadError.message) && !this.#config.skipInvalidItems) this.#dataError('DATA_ERR_INVALID_PLAYLIST_ITEM', loadError);

            this.#data = isPlaylist ? mData : {};
            this.#data.currentMediaIndex = 0;
            this.#data.media = parsed;

            this.#setMediaDataTask.resolve(clone(parsed));
            this.#player.publish('data/parsed', this.#data, { async: false }, this.#apiKey);

            this.#setMediaIndex(index).catch(error => {
                if (error.name !== 'AbortError' && !(error instanceof MediaError || error.name === 'ExtendedMediaError')) throw error;
            });

        } else {

            this.#setMediaDataTask.reject(loadError);
            this.#rootEle.classList.remove('is-audio', 'is-video');

            if (loadError.code || loadError.message) this.#dataError(loadError.code, loadError);

            if (!this.#data.media.length) {
                this.#rootEle.classList.add('has-no-media');
                this.#player.publish('data/nomedia', this.#apiKey);
            }

        }

        return this.#setMediaDataTask.promise;

    };

    /**
     * Switches playback to another media item, with `index` representing the position of the media to switch to in the internal playlist.
     * Additional options can influence switching behavior in the `Media` component, like trying to restore the previous seek position (`rememberState`)
     * or controlling if and how the media is played after switching (`ignoreAutoplay`, `play`).
     * @param   {number}                                  index      The index of the media item to switch to.
     * @param   {module:src/core/Media~media.loadOptions} [options]  Optional config to set switch behavior.
     * @returns {Promise}                                            A promise that resolves with the loaded metadata of the switched item data or rejects when loading failed.
     * @fires    module:src/core/Data#data/ready
     */
    #setMediaIndex = async(index, options = {}) => {

        if (!isNumber(index) || index < 0 || index >= this.#data.media.length) {
            this.#dataError('DATA_ERR_INVALID_INDEX', { code: 'DATA_ERR_INVALID_INDEX', message: `setMediaIndex: invalid index: ${index}` });
            throw new DataError(`setMediaIndex: invalid index: ${index}`, { code: 'DATA_ERR_INVALID_INDEX' });
        }

        const { preferredQuality, preferredLanguage } = this.#player.getConfig('data'), // live update instead local config
              autoLang = preferredLanguage === true ? this.#player.getConfig('locale.lang') : false,
              mediaSource = this.#getPreferredMetaData({
                  preferredQuality,
                  preferredLanguage: autoLang || preferredLanguage
              }, this.#data.media[index]);

        if (mediaSource) {

            const selectedMedia = this.#data.media[index];
            this.#data.currentMediaIndex = index;

            this.#rootEle.classList.remove('has-no-media', 'is-audio', 'is-video');
            this.#rootEle.classList.add(selectedMedia.mediaType === 'audio' ? 'is-audio' : 'is-video');

            this.#player.publish('data/source', clone(mediaSource), { async: false }, this.#apiKey);
            this.#player.publish('data/ready', clone(selectedMedia), { async: false }, this.#apiKey);

            return await this.#player.media.load(mediaSource, options);

        } this.#dataError('DATA_ERR_STREAM_NOT_FOUND');

    };

    /**
     * Returns the best matching media variant, considering the user's language and quality preferences.
     * Falls back to the closest possible match if an exact match isn't found.
     * In this case, language preferences have priority over quality preferences.
     * @param   {Object}                         [options]                    Optional preferences.
     * @param   {string}                         [options.preferredLanguage]  The language which is preferred.
     * @param   {string}                         [options.preferredQuality]   The quality setting which is preferred.
     * @param   {module:src/core/Data~mediaItem} [mediaItem]                  Media item to search for, defaults to current active item.
     * @returns {module:src/core/Media~metaData}                              Metadata for a matching media object, or 'false' if nothing suitable was found.
     */
    #getPreferredMetaData = (
        { preferredQuality, preferredLanguage } = {},
        mediaItem = this.#data.media[this.#data.currentMediaIndex]) => {

        const currentMetaData = this.#player.media.getMetaData(),
              prefQuality = isUndefined(preferredQuality) ? currentMetaData?.quality : preferredQuality,
              prefLanguage = isUndefined(preferredLanguage) ? currentMetaData?.language : preferredLanguage,
              matchedQualities = [],
              matchedLanguages = [];

        if (!mediaItem?.variants?.length) return false; // nothing there to find

        let result, perfectMatch,
            defaultItem = {};

        const matchHeight = arr => {
            const playerHeight = this.#player.getState('ui.playerHeight') * (window.devicePixelRatio ?? 1),
                  sorted = arr.sort((a, b) => a.height - b.height);
            result = sorted.find(({ height }) => height * 1.2 > playerHeight);
            return result || arr[arr.length - 1]; // still nothing, so just return the last entry (presumable highest qual below player size)
        };

        // spread out array so that each representation is a separate item
        // a bit slower, but easier to parse
        const searchItems = mediaItem.variants.flatMap(variant => {
            if (variant.representations) {
                return variant.representations.map(source => {
                    const { representations, ...base } = variant; // eslint-disable-line no-unused-vars
                    return { ...base, ...source };
                });
            } else if (variant.src) {
                const { representations, ...base } = variant; // eslint-disable-line no-unused-vars
                return [base];
            }
            return [];
        });

        for (const searchItem of searchItems) {
            if (prefQuality && prefQuality === searchItem.quality && prefLanguage === searchItem.language) {
                perfectMatch = searchItem;
                break;
            }
            // add to list of preferred languages or qualities
            if (prefLanguage && prefLanguage === searchItem.language) matchedLanguages.push(searchItem);
            if (prefQuality && prefQuality === searchItem.quality) matchedQualities.push(searchItem);
            // determine default variant if multiple video are supplied
            if (searchItem.default) defaultItem = searchItem;
        }

        if (perfectMatch) {

            result = perfectMatch; // found a perfect match, fine!

        } else if (matchedLanguages.length) {

            if (defaultItem.language === prefLanguage) {
                // found preferredLanguage, but not the quality, so lets see if there was a default set
                result = defaultItem;
            } else {
                // OK, so maybe we can try to match height information with player height
                result = matchHeight(matchedLanguages);
            }

        } else if (matchedQualities.length) {
            // found preferred quality, but no language information, so use default if available or just first entry
            result = defaultItem.quality && defaultItem.quality === prefQuality ? defaultItem : matchedQualities[0];
        } else if (defaultItem.default) {
            // no preferred matches, but at least a default
            result = defaultItem;
        } else {
            // found no directly preferred quality nor language, we can try to find a matching source based on height
            const hasHeight = searchItems.find(searchItem => searchItem.height);
            result = hasHeight ? matchHeight(searchItems) : searchItems[0];
        }

        if (result) result.mediaType = mediaItem.mediaType;

        return result;

    };

    /**
     * Loads media data definition from a given URL into the player.
     * @param   {string}                                  url  The URL pointing to a JSON file describing the media data.
     * @returns {Promise<module:src/core/Data~mediaItem>}      A promise that resolves to the loaded media data.
     */
    async #loadMediaData(url) { // eslint-disable-line class-methods-use-this

        const res = await fetch(url);

        if (!res.ok) {
            const message = `Data could not be loaded due to network error: ${res.status}`;
            throw new DataError(message, { code: `HTTP_ERROR_${res.status}` });
        }

        const mediaData = await res.json();

        return mediaData;

    }

    /**
     * Parses a single media item (either as URL or object) and returns a normalized media data structure.
     * This includes resolving variants & representations, validating MIME types, applying quality/height heuristics,
     * and optionally loading remote JSON if the input is a URL pointing to a JSON file.
     * This method is used internally by `#setMediaData()` and supports both individual items and full playlists.
     * @param   {string|module:src/core/Data~mediaItem}   mediaItem  The media data to parse, either as object or URL string.
     * @returns {Promise<module:src/core/Data~mediaItem>}            A Promise resolving to a valid mediaItem structure.
     * @throws  {Error}                                              If parsing fails or no playable source is found.
     */
    async #parseMediaDataItem(mediaItem) {

        let parsed = {},
            variants;

        if (isString(mediaItem)) {

            const mData = this.#addPlayableMetaData({ src: mediaItem }, [], parsed);

            if (mData) {
                parsed.variants = [mData];
                return parsed;
            }

            if (mediaItem.startsWith('blob:')) {
                return {
                    variants: [{ src: mediaItem }]
                };
            }

            // safe to mutate!
            parsed = await this.#loadMediaData(mediaItem); // eslint-disable-line require-atomic-updates

        } else if (isObject(mediaItem)) {

            parsed = mediaItem;

        } else throw new DataError('Media data item must be an Object or a String', { code: 'DATA_ERR_INVALID_TYPE' });

        const { src, mimeType, encodings, representations } = parsed;

        if (src) {
            if (!isString(src)) throw new DataError('Src must be a String', { code: 'DATA_ERR_INVALID_TYPE' });
            const parsedVariant = { src };
            if (mimeType) parsedVariant.mimeType = mimeType;
            parsed.variants = [parsedVariant];
            delete parsed.src;
            delete parsed.mimeType;
        }

        if (encodings) {
            if (!isArray(encodings)) throw new DataError('Encodings must be an Array', { code: 'DATA_ERR_INVALID_TYPE' });
            parsed.variants = [{ encodings }];
            delete parsed.encodings;
        }

        if (representations) {
            if (!isArray(representations)) throw new DataError('Representations must be an Array', { code: 'DATA_ERR_INVALID_TYPE' });
            parsed.variants = [{ representations }];
            delete parsed.representations;
        }

        if (parsed.variants) ({ variants } = parsed); else throw new DataError('No variants found in media data', { code: 'DATA_ERR_NO_VARIANTS' });

        // check what type of data variants is -> if it's a string or an object, convert to array
        if (isString(variants)) variants = [{ src: variants }];
        else if (isObject(variants)) variants = [variants];
        else if (!isArray(variants)) throw new DataError('Variants must be a string, object or array', { code: 'DATA_ERR_INVALID_TYPE' });

        // if it's an empty array, throw an error
        if (!variants.length) throw new DataError('Variants array is empty', { code: 'DATA_ERR_NO_VARIANTS' });

        // reduces source array by only including representations being actually playable
        // also convert representations to coherent full format
        variants = variants.reduce((parsedArray, variant) => {

            const isValidObject = Boolean(isObject(variant) && (variant.src || variant.encodings || variant.representations));

            if (isString(variant)) {

                if (variant.startsWith('blob:')) {
                    return {
                        variants: [{ src: mediaItem }]
                    };
                }

                this.#addPlayableMetaData({ src: variant }, parsedArray, parsed);

            } else if (isValidObject && !isArray(variant.representations)) {

                this.#addPlayableMetaData(variant, parsedArray, parsed);

                if (variant.height && !variant.quality) variant.quality = variant.height;

            } else if (isValidObject && isArray(variant.representations)) {

                if (!variant.representations.length) throw new DataError('Representations array is empty', { code: 'DATA_ERR_NO_REPRESENTATIONS' });

                // validate each variant object and add a media type
                variant.representations = variant.representations.reduce((reps, source) => {

                    let checkedSource;
                    if (isString(source)) checkedSource = this.#addPlayableMetaData({ src: source }, reps, parsed);
                    else if (isObject(source)) checkedSource = this.#addPlayableMetaData(source, reps, parsed);
                    else throw new DataError('Object source must be object or string', { code: 'DATA_ERR_INVALID_TYPE' });

                    if (checkedSource.height && !checkedSource.quality) checkedSource.quality = checkedSource.height;

                    return reps;

                }, []);

                if (variant.representations.length) {

                    if (variant.representations.length === 1) {
                        const extended = extend(variant, variant.representations[0]);
                        delete extended.representations;
                        if (extended.height && !extended.quality) extended.quality = extended.height;
                        parsedArray.push(extended);
                    } else {
                        parsedArray.push(variant);
                    }

                } else if (!this.#config.skipInvalidRepresentations) throw new DataError('Invalid Representations found', { code: 'DATA_ERR_STREAM_NOT_PLAYABLE' });

            } else {

                if (isObject(variant) && !variant.src) throw new DataError('Variant src is missing', { code: 'DATA_ERR_NO_SRC' });
                throw new DataError('Variant src must be a string or array', { code: 'DATA_ERR_INVALID_TYPE' });

            }

            return parsedArray;

        }, []);

        if (!variants.length) throw new DataError('No playable stream found', { code: 'DATA_ERR_STREAM_NOT_PLAYABLE' });

        parsed.variants = variants;

        return parsed;

    }

    /**
     * This helper function searches a source object for a playable source, i.e. A source which has a mime type which *at least*
     * results in a 'maybe' using the engines 'canPlay' test method. Representations which return a 'probably' are preferred.
     * If no mime type is provided, the method tries to guess it from the source path file ext.
     * @param   {module:src/core/Media~metaData}       metaDataArg  The metaData object to search.
     * @param   {module:src/core/Media~metaData[]}     [pushArray]  If provided, the playable metaData item is pushed there on success.
     * @param   {module:src/core/Data~mediaItem}       [mediaItem]  If provided, the detected mediaType is assigned to it.
     * @returns {module:src/core/Media~metaData|false}              The playable metaData if found, otherwise false.
     * @throws  {Error}                                             Throws various Errors when parsing fails.
     */
    #addPlayableMetaData(metaDataArg, pushArray, mediaItem) {

        let mediaType = mediaItem?.mediaType,
            metaData = metaDataArg,
            mimeType, canPlay;

        /**
         * Small helper function to extract the suffix from any given url.
         * @param   {string} url  The url to parse.
         * @returns {string}      The Suffix (excluding the '.').
         */
        const getSuffix = url => {
            const path = url.split(/[?#]/)[0],
                  idx = path.lastIndexOf('.');
            return idx > -1 ? path.slice(idx + 1).toLowerCase() : '';
        };

        const checkPlayable = ({ src, mimeType: type, drmSystem }) => {

            const ext = getSuffix(src),
                  formats = this.#player.constructor.getFormats(),
                  format = type
                      ? formats.find(fmt => fmt.mimeTypeVideo?.includes(type.split(';')[0]) || fmt.mimeTypeAudio?.includes(type.split(';')[0]))
                      : formats.find(fmt => fmt.extensions.includes(ext)),
                  mimeAudio = format?.mimeTypeAudio?.[0],
                  mimeVideo = format?.mimeTypeVideo?.[0];

            if (this.#config.disablePlayCheck && ext !== 'json') {
                mediaType = 'video'; // just assume it is a video
                return 'couldbe';
            }

            if (format) {
                if (!mediaType) mediaType = mimeAudio && !mimeVideo ? 'audio' : 'video';
                mimeType = mediaType === 'video' ? mimeVideo : mimeAudio;
                if (this.#config.lenientPlayCheck || this.#config.lenientPlayCheckBlob && src.startsWith('blob:')) return 'couldbe';
            }

            if (mediaType === 'audio' && (type || format.mimeTypeAudio)) {
                return this.#player.media.canPlay({ mimeType: type || mimeAudio, drmSystem });
            }

            if (mediaType === 'video' && (type || format.mimeTypeVideo)) {
                return this.#player.media.canPlay({ mimeType: type || mimeVideo, drmSystem });
            }

            return false;

        };

        const { src, encodings } = metaData;

        if (encodings) {

            if (!isArray(metaData.encodings)) throw new DataError('Encodings must be an array', { code: 'DATA_ERR_INVALID_TYPE' });

            let found;

            for (const encoding of encodings) {

                if (!encoding.src) throw new DataError('Encodings must contain at least a src (and preferably a type).', { code: 'DATA_ERR_NO_SRC' });

                const checkPlay = checkPlayable(encoding); // try to guess from url ext

                if (checkPlay === 'probably' || (checkPlay === 'maybe' || checkPlay === 'couldbe') && !found) {
                    found = metaData;
                    canPlay = checkPlay;
                    metaData.mimeType = mimeType;
                    metaData = extend(metaData, encoding);
                }

                if (checkPlay === 'probably' || checkPlay === 'maybe') break; // perfect, use that
            }

        } else if (src) {

            if (!isString(src)) throw new DataError('Object src must be a string', { code: 'DATA_ERR_INVALID_TYPE' });

            canPlay = checkPlayable(metaData);
            metaData.mimeType = mimeType;

        } else throw new DataError('Object metadata has no src or encodings', { code: 'DATA_ERR_NO_SRC' });

        if (!canPlay) return false;

        if (pushArray) pushArray.push(metaData);
        if (mediaItem) mediaItem.mediaType = mediaType;

        return metaData;

    }

    /**
     * This method should be called when a 'data error' occurs. In contrast to a 'media error' which usually indicates problems
     * with playing back certain media (for example, due to network problems or decoding errors),
     * a data error usually means that the player - or some component - wasn't able to correctly and completely parse the data
     * it was provided. A typical case would be some essential things missing from the media data, like no src.
     * Also publishes an appropriate event, so other components can for example display an error message to the user.
     * @param {string} messageOrKey  The message text or translate key.
     * @param {Error}  [error]       Optional error object.
     * @fires module:src/core/Data#data/error
     */
    #dataError = (messageOrKey, error) => {

        const translatePath = `errors.data.${messageOrKey}`,
              translated = this.#player.locale.t ? this.#player.locale.t(translatePath) : translatePath,
              translationFound = this.#player.locale.t && translated !== translatePath;

        // Clear any existing timeout to prevent race conditions
        clearTimeout(this.#dataErrorTimeoutId);

        this.#dataErrorTimeoutId = setTimeout(() => {

            this.#player.publish('data/error', {
                code: error?.code ?? (translationFound ? messageOrKey : 'DATA_ERR'),
                message: translationFound ? translated : this.#player.locale.t('errors.data.unknown'),
                messageSecondary: error ? error.message || error.code : null
            }, this.#apiKey);

        }, 250);

    };

    /**
     * This is the cleanup method which should be called when removing the player.
     * It is strongly recommended to do so to prevent memory leaks and possible other unwanted side effects.
     */
    destroy() {

        this.#setMediaDataTask?.cancel();
        clearTimeout(this.#dataErrorTimeoutId);
        this.#player.removeApi(['data.getMediaData', 'data.setMediaData', 'data.setMediaIndex', 'data.getPreferredMetaData', 'data.error'], this.#apiKey);
        this.#data = this.#player = this.#apiKey = this.#setMediaDataTask = null;

    }
}

/**
 * The mediaItem is a representation of a single media data item.
 * @typedef  {Object} module:src/core/Data~mediaItem
 * @property {string|Object<string, string>}             [title]           Title of the media item (can be multilingual).
 * @property {string|Object<string, string>}             [titleSecondary]  Secondary title of the media player in multiple languages.
 * @property {module:src/core/Data~mediaItem_variants[]} variants          List of available video variants.
 * @property {module:src/core/Data~mediaItem_text[]}     [text]            List of subtitle tracks.
 * @property {module:src/core/Data~mediaItem_overlay[]}  [overlays]        List of  overlays displayed in the player.
 * @property {module:src/core/Data~mediaItem_chapter[]}  [chapters]        List of video chapters.
 * @property {module:src/core/Data~mediaItem_thumbnail}  [thumbnails]      The thumbnail representation of this media item.
 */

/**
 * The variants item is a representation of a single variant data item.
 * @typedef  {Object} module:src/core/Data~mediaItem_variants
 * @property {string}        language                              Language of the variant.
 * @property {boolean}       [default]                             Whether this variant is marked as default.
 * @property {Object[]}      representations                       Available  representations for this variant.
 * @property {number}        [representations.height]              Video height in pixels.
 * @property {number}        [representations.width]               Video width in pixels (optional).
 * @property {number|string} [representations.quality]             Quality designation (if available).
 * @property {Object[]}      [representations.encodings]           List of encodings available for this resolution.
 * @property {string}        [representations.encodings.mimeType]  The MIME type of the video encoding.
 * @property {string}        [representations.encodings.src]       Source URL of the encoded video.
 */

/**
 * The overlaysItem is a representation of a single overlay data item.
 * @typedef  {Object} module:src/core/Data~mediaItem_overlay
 * @property {string} type         Type of overlay (e.g., 'poster', 'image').
 * @property {string} src          Source URL of the overlay.
 * @property {string} [className]  Optional CSS class for styling the overlay.
 * @property {string} [alt]        Alternative text for the overlay image.
 * @property {string} [placement]  Placement of the overlay on the screen.
 * @property {number} [margin]     Margin around the overlay.
 * @property {number} [cueIn]      Timestamp (in seconds) when the overlay appears.
 * @property {number} [cueOut]     Timestamp (in seconds) when the overlay disappears.
 */

/**
 * The textItem is a representation of a single text data item.
 * @typedef  {Object} module:src/core/Data~mediaItem_text
 * @property {string}  [type='subtitles']  Type of subtitle track (e.g., 'subtitles', 'captions' etc).
 * @property {string}  language            Language of the subtitle track.
 * @property {string}  src                 Source URL of the subtitle file.
 * @property {boolean} [default]           Whether this is the default subtitle track.
 */

/**
 * The chapterItem is a representation of a single chapter data item.
 * @typedef  {Object} module:src/core/Data~mediaItem_chapter
 * @property {string|Object<string, string>} title  Chapter title (can be multilingual).
 * @property {number}                        start  Start time of the chapter in seconds.
 */

/**
 * The thumbnailsItem is a representation of a single thumbnail data item.
 * @typedef  {Object} module:src/core/Data~mediaItem_thumbnail
 * @property {string|Object} src              Thumbnail image source(s), either direct src or object for multiple languages.
 * @property {number}        gridX            Number of thumbnail columns.
 * @property {number}        gridY            Number of thumbnail rows.
 * @property {number}        timeDelta        Time difference between thumbnails.
 * @property {number}        [timeDeltaHigh]  High-resolution thumbnail time difference.
 */

/**
 * Fired when the player data was parsed and is available for further consumption.
 * @event module:src/core/Data#data/parsed
 * @param {Object}                           data                    Reference to the data store.
 * @param {module:src/core/Data~mediaItem[]} data.media              Array of media items.
 * @param {number}                           data.currentMediaIndex  Index of the currently active media item.
 * @param {string|Object<string, string>}    [data.title]            Title of the playlist.
 * @param {string|Object<string, string>}    [data.titleSecondary]   Secondary title of the playlist.
 */

/**
 * Fired when a media item has been assigned (but media is not fully loaded yet).
 * @event module:src/core/Data#data/ready
 * @param {module:src/core/Data~mediaItem} mediaItem  The new media item data.
 */

/**
 * Fired when a media source has been selected, but before the actual load.
 * @event module:src/core/Data#data/source
 * @param {module:src/core/Media~metaData} metaData  The new media metadata.
 */

/**
 * Fired when a data related error occurs (for example a parsing error due to wrong media data format).
 * @event  module:src/core/Data#data/error
 * @param {Object} msgObj                   The data error message object.
 * @param {string} msgObj.code              The error code.
 * @param {string} msgObj.message           The error message.
 * @param {string} msgObj.messageSecondary  Optional error message from original error.
 */

/**
 * Fired when no usable media data is found.
 * @event module:src/core/Data#data/nomedia
 */
