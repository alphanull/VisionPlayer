/**
 * DataError class, extending the native Error object.
 * Used to distinguish if an Error was a data error.
 * @exports module:src/util/DataError
 * @augments Error
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class DataError extends Error {

    #code;

    /**
     * Creates an instance of ExtendedMediaError.
     * @param {string} message        Custom Error message.
     * @param {Object} options        Additional options.
     * @param {number} options.cause  Optional error cause.
     * @param {string} options.code   The error code for the simulated media error.
     */
    constructor(message, { code, cause } = {}) {

        super(message, { cause });

        this.#code = code;

        this.name = 'DataError';

    }

    /**
     * Returns the media error code.
     * @returns {number} Error code (1,2,3,4 or 99).
     */
    get code() { return this.#code; }

}
