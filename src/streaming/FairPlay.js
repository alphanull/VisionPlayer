import ExtendedMediaError from '../util/ExtendedMediaError.js';

/**
 * Converts a string to a Uint16Array.
 * @private
 * @memberof module:src/streaming/FairPlay
 * @param   {string}      string  Input string.
 * @returns {Uint16Array}         Converted array.
 */
const stringToUint16Array = string => new Uint16Array(new ArrayBuffer(string.length * 2)).map((entry, index) => string.charCodeAt(index));

/**
 * Converts a Uint16Array to a string.
 * @private
 * @memberof module:src/streaming/FairPlay
 * @param   {Uint16Array} array  Input array.
 * @returns {string}             Converted string.
 */
const uInt16arrayToString = array => String.fromCharCode.apply(null, new Uint16Array(array.buffer));

/**
 * Converts a Uint8Array to a string.
 * @private
 * @memberof module:src/streaming/FairPlay
 * @param   {Uint8Array} array  Input array.
 * @returns {string}            Converted string.
 */
const uInt8ArrayToString = array => String.fromCharCode.apply(null, array);

/**
 * Decodes a base64-encoded string into a Uint8Array.
 * @private
 * @memberof module:src/streaming/FairPlay
 * @param   {string}     input  Input string.
 * @returns {Uint8Array}        Converted array.
 */
const base64DecodeUint8Array = input => Uint8Array.from(atob(input), c => c.charCodeAt(0));

/**
 * Encodes a Uint8Array into base64 string.
 * @private
 * @memberof module:src/streaming/FairPlay
 * @param   {Uint8Array} input  Input array.
 * @returns {string}            Converted string.
 */
const base64EncodeUint8Array = input => btoa(uInt8ArrayToString(input));

/**
 * The FairPlay component handles Apple FairPlay DRM for HLS streams on Safari browsers.
 * It works by setting up a WebKit key session using the `webkitneedkey` API, obtaining a DRM certificate,
 * creating the SPC message, retrieving the license, and initializing secure playback.
 * The plugin only activates on Safari browsers and registers itself during initialization.
 * @exports module:src/streaming/FairPlay
 * @requires src/util/ExtendedMediaError
 * @author Frank Kudermann - alphanull
 * @version 1.0.0
 * @license MIT
 */
export default class FairPlay {

    /**
     * Reference to the main player instance.
     * @type {module:src/core/Player}
     */
    #player;

    /**
     * Reference to the video Element.
     * @type {HTMLVideoElement}
     */
    #videoEle;

    /**
     * Secret key only known to the player instance and initialized components.
     * Used to be able to restrict access to API methods in conjunction with secure mode.
     * @type {symbol}
     */
    #apiKey;

    /**
     * License server URL.
     * @type {string}
     */
    #licenseUrl = '';

    /**
     * License request headers.
     * @type {Object<string, string>}
     */
    #headers = {};

    /**
     * The current MediaKeySession instance.
     * @type {MediaKeySession}
     */
    #keySession;

    /**
     * The resolve callback to unblock media.load().
     * @type {Function}
     */
    #resolve;

    /**
     * Creates an instance of the FairPlay plugin.
     * @param {module:src/core/Player} player          Reference to the player instance.
     * @param {module:src/core/Media}  mediaComponent  Reference to the engine (video) instance.
     * @param {symbol}                 apiKey          Token for extended access to the player API.
     */
    constructor(player, mediaComponent, { apiKey }) {

        if (!player.getClient('safari')) return [false];

        this.#player = player;
        this.#apiKey = apiKey;

        mediaComponent.registerPlugin(this);

        this.#player.constructor.addFormat({
            extensions: ['m3u8'],
            mimeTypeAudio: ['audio/mpegurl'],
            mimeTypeVideo: ['application/x-mpegURL']
        });

    }

    /**
     * Checks if this plugin can handle a given MIME type and DRM system.
     * @param   {module:src/core/Media~metaData} metaData              The data to test.
     * @param   {string}                         metaData.mimeType     The mime type to test.
     * @param   {string}                         [metaData.drmSystem]  Optional DRM system info.
     * @returns {string}                                               "maybe" if playable, otherwise an empty string.
     */
    canPlay({ mimeType, drmSystem } = {}) {

        return this.#player.getClient('safari') && mimeType === 'application/x-mpegURL' && drmSystem === 'FairPlay'/* ) */ ? 'maybe' : '';

    }

    /**
     * Initializes the FairPlay session if the source is HLS and has FairPlay DRM. Loads the certificate if not provided inline,
     * sets up the video src, and waits for "webkitneedkey" event to start encryption handling.
     * @param  {module:src/core/Media~metaData} metaData      metaData to load.
     * @param  {string}                         metaData.src  The HLS URL to load.
     * @throws {Error}                                        If not Safari or .m3u8 or lacking 'drm.FairPlay'.
     */
    async load({ src }) {

        const { drm } = this.#player.data.getMediaData(),
              path = src.split(/[?#]/)[0],
              suffix = path.slice((path.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase(); // eslint-disable-line

        if (!this.#player.getClient('safari') || suffix !== 'm3u8' || !drm || !drm.FairPlay) {
            throw new Error('[FairPlay] Cannot handle request');
        }

        const { certificateUrl, certificate, licenseUrl, header } = drm.FairPlay;

        this.#licenseUrl = licenseUrl;
        this.#headers = header || {};
        this.#headers['Content-type'] = 'application/x-www-form-urlencoded';

        this.#videoEle = this.#player.media.getElement(this.#apiKey);

        try {

            const waitFor = (target, type) => new Promise(resolve => {
                target.addEventListener(type, resolve, { once: true });
            });

            const cert = certificate ? base64DecodeUint8Array(certificate) : await FairPlay.#loadCertificate(certificateUrl);
            this.#videoEle.src = src;
            const event = await waitFor(this.#videoEle, 'webkitneedkey');
            await this.#encrypted(event, cert);

        } catch (e) {

            this.#player.publish('media/error', { error: new ExtendedMediaError(99, e.message) }, this.#apiKey);
            throw e;

        }

    }

    /**
     * Initializes and prepares the FairPlay key session.
     * @param   {Event}         event        The "webkitneedkey" event.
     * @param   {Uint8Array}    certificate  The DRM certificate.
     * @returns {Promise<void>}
     * @throws  {Error}                      If creating mediaKeys or the key sessions fails for any reason.
     */
    async #encrypted(event, certificate) {

        this.destroy();

        const initData = new Uint8Array(event.initData);
        let contentId = uInt16arrayToString(initData);
        contentId = contentId.substring(contentId.indexOf('skd://') + 6);

        if (!this.#videoEle.webkitKeys) {
            try {
                await this.#videoEle.webkitSetMediaKeys(new window.WebKitMediaKeys('com.apple.fps.1_0'));
            } catch (e) {
                throw new Error('[FairPlay Plugin] Could not create MediaKeys', { cause: e });
            }
        }

        return new Promise(resolve => {

            this.#resolve = resolve;

            try {
                this.#keySession = this.#videoEle.webkitKeys.createSession('video/mp4', FairPlay.#createSpc(contentId, event.initData, certificate));
                this.#keySession.addEventListener('webkitkeymessage', this.#keyMessage);
                this.#keySession.addEventListener('webkitkeyadded', this.#keyAdded);
                this.#keySession.addEventListener('webkitkeyerror', this.#keyError); // for testing purposes, adding webkitkeyerror must be the last item in this method
            } catch (e) { // eslint-disable-line no-unused-vars
                throw new Error('[FairPlay Plugin] Could not create key session');
            }
        });

    }

    /**
     * Handles license requests when "webkitkeymessage" event is fired.
     * @param {Event} event  Event containing the license challenge.
     */
    #keyMessage = async event => {

        try {
            const response = await FairPlay.#getLicense(event, this.#licenseUrl, this.#headers);
            this.#keySession.update(new Uint8Array(response));
        } catch (e) { // eslint-disable-line no-unused-vars
            this.#player.publish('media/error', { error: new ExtendedMediaError(99, '[FairPlay Plugin] Error loading license') }, this.#apiKey);
        }

    };

    /**
     * Called when "webkitkeyadded" fires, meaning the DRM session is successfully set up.
     */
    #keyAdded = () => {

        this.#resolve();

    };

    /**
     * Called when "webkitkeyerror" fires, meaning the DRM session encountered an error.
     * @throws {Error} If a key session error code is found.
     */
    #keyError = () => {

        const { error } = this.#keySession;
        throw new Error(`[FairPlay Plugin] KeySession error: code ${error.code}, systemCode ${error.systemCode}`);

    };

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        if (this.#keySession) {
            this.#keySession.removeEventListener('webkitkeymessage', this.#keyMessage);
            this.#keySession.addEventListener('webkitkeyadded', this.#keyAdded);
            this.#keySession.removeEventListener('webkitkeyerror', this.#keyError);
        }

        this.#player = this.#videoEle = this.#apiKey = null;

    }

    /**
     * Loads the FairPlay DRM certificate from the specified URL.
     * @param   {string}              certificateUrl  URL to the DRM certificate.
     * @returns {Promise<Uint8Array>}                 The fetched certificate as Uint8Array.
     */
    static async #loadCertificate(certificateUrl) {

        try {
            const response = await fetch(certificateUrl, { mode: 'cors' });
            const text = await response.text();
            return base64DecodeUint8Array(text); // apparently we need to base64DecodeUint8Array this
        } catch (e) {
            throw new Error(`[FairPlay Plugin] Could not load certificate at ${certificateUrl}`, { cause: e });
        }
    }

    /**
     * Creates the FairPlay "SPC" message to request a license.
     * @param   {string}     contentId  Content identifier (from SKD URL).
     * @param   {Uint8Array} initData   Initialization data.
     * @param   {Uint8Array} cert       DRM certificate.
     * @returns {Uint8Array}            SPC request message.
     */
    static #createSpc(contentId, initData, cert) {

        // layout:
        //   [initData]
        //   [4 byte: idLength]
        //   [idLength byte: id]
        //   [4 byte:certLength]
        //   [certLength byte: cert]

        let offset = 0;

        const id = typeof contentId === 'string' ? stringToUint16Array(contentId) : contentId,
              buffer = new ArrayBuffer(initData.byteLength + 4 + id.byteLength + 4 + cert.byteLength),
              dataView = new DataView(buffer),
              initDataArray = new Uint8Array(buffer, offset, initData.byteLength);

        initDataArray.set(initData);
        offset += initData.byteLength;
        dataView.setUint32(offset, id.byteLength, true);
        offset += 4;

        const idArray = new Uint16Array(buffer, offset, id.length);
        idArray.set(id);
        offset += idArray.byteLength;
        dataView.setUint32(offset, cert.byteLength, true);
        offset += 4;

        const certArray = new Uint8Array(buffer, offset, cert.byteLength);
        certArray.set(cert);

        return new Uint8Array(buffer, 0, buffer.byteLength);

    }

    /**
     * Fetches the license by sending the SPC message to the DRM license server. Expects a base64-encoded response.
     * @param   {Event}                  event    The webkitkeymessage event containing the message.
     * @param   {string}                 spcPath  The license server url.
     * @param   {Object<string, string>} headers  HTTP headers for the license request.
     * @returns {Promise<Uint8Array>}             The license data.
     */
    static async #getLicense(event, spcPath, headers) {

        const licenseResponse = await fetch(spcPath, {
            method: 'POST',
            headers: new Headers(headers),
            body: `spc=${base64EncodeUint8Array(new Uint8Array(event.message))}`
        });

        const license = await licenseResponse.text();
        return base64DecodeUint8Array(license);

    }

}
