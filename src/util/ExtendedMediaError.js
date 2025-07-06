/**
 * ExtendedMediaError class, simulating an HTML5 MediaError.
 * Provides error codes aligned with the HTML5 specification and includes a custom DRM error code.
 * @exports module:src/util/ExtendedMediaError
 * @augments Error
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class ExtendedMediaError extends Error {

    #code;

    #status;

    // Indicates that the fetching of the media resource was aborted by the user.
    static MEDIA_ERR_ABORTED = 1;

    MEDIA_ERR_ABORTED = 1;

    // Indicates a network error occurred.
    static MEDIA_ERR_NETWORK = 2;

    MEDIA_ERR_NETWORK = 2;

    // Indicates that an error occurred while decoding the media resource.
    static MEDIA_ERR_DECODE = 3;

    MEDIA_ERR_DECODE = 3;

    // Indicates that the media resource format is not supported.
    static MEDIA_ERR_SRC_NOT_SUPPORTED = 4;

    MEDIA_ERR_SRC_NOT_SUPPORTED = 4;

    // Custom error code for DRM-related issues. Note: This code is out of the official HTML5 specification.
    static MEDIA_ERR_DRM = 99;

    MEDIA_ERR_DRM = 99;

    /**
     * Creates an instance of ExtendedMediaError.
     * @param {string} code             The error code for the simulated media error.
     * @param {Object} options          Additional options.
     * @param {number} options.cause    Optional error cause.
     * @param {number} options.status   HTTP status code.
     * @param {string} options.message  Custom Error message.
     */
    constructor(code, { status, message, cause } = {}) {

        super(message || code, { cause });

        this.name = 'ExtendedMediaError';
        this.#code = code;
        this.#status = status;

    }

    /**
     * Returns the media error code.
     * @returns {number} Error code (1,2,3,4 or 99).
     */
    get code() { return this.#code; }

    /**
     * Returns the status code.
     * @returns {number} Status code (e.g. 404 etc).
     */
    get status() { return this.#status; }

}
