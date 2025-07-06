import { isUndefined, isNumber, isString } from '../../lib/util/object.js';

/**
 * Converts time from seconds, SMPTE string or SMPTE Object. Returns an object containing all three representations.
 * @module   src/util/convertTime
 * @requires lib/util/object
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */

/**
 * Converts time from seconds, SMPTE string or SMPTE Object. Returns an object containing all three representations.
 * @memberof module:src/util/convertTime
 * @param   {string|number|module:src/util/convertTime~smpteFormat} value        The input value in one of the three accepted formats: seconds, a string or a module:src/util/convertTime~smpteFormat Object.
 * @param   {number}                                                [frameRate]  If frameRate is specified, adapt the conversion accordingly.
 * @returns {module:src/util/convertTime~smpteConversion|undefined}              The converted value in three representations, or undefined if an error occurred.
 * @throws  {Error}                                                              If conversion fails due to type errors etc.
 */
const convertTime = (value, frameRate) => {

    const pad = val => (val < 10 ? `0${val}` : val);

    let val = value,
        h,
        m,
        s,
        f;

    if (isString(val)) {

        // its a string
        const split = val.split(':');

        h = Number(split[0]);
        m = Number(split[1]);
        s = Number(split[2]);
        f = Number(split[3]);

        if (split.length !== 4 || isNaN(h) || isNaN(m) || isNaN(s) || isNaN(f)) {
            throw new Error('[VisionPlayer] Invalid string format for time conversion');
        }

        return {
            smpte: { h, m, s, f },
            seconds: h * 3600 + m * 60 + s + (frameRate ? f / frameRate : 0),
            string: val
        };

    } else if (isNumber(val)) {

        // its a number
        if (val < 0) throw new Error('[VisionPlayer] Invalid number format for time conversion');

        if (frameRate) val = Math.round(val * frameRate) / frameRate; // correct rounding errors if frameRate is present
        else val = Math.round(val); // just round if no frameRate is present

        if (frameRate) f = Math.round(val % 1 * frameRate);
        s = Math.floor(val);
        m = Math.floor(s / 60);
        h = Math.floor(m / 60);

        m %= 60;
        s %= 60;

        return {
            smpte: { h, m, s, f },
            seconds: val,
            string: `${pad(h)}:${pad(m)}:${pad(s)}${isUndefined(f) ? ':00' : `:${pad(f)}`}`
        };

    } else if (val && !isUndefined(val.h) && !isUndefined(val.m) && !isUndefined(val.s)) {

        // its an object
        return {
            smpte: val,
            seconds: val.h * 3600 + val.m * 60 + val.s + (!frameRate || isUndefined(val.f) ? 0 : val.f / frameRate),
            string: `${pad(val.h)}:${pad(val.m)}:${pad(val.s)}${isUndefined(val.f) ? ':00' : `:${pad(val.f)}`}`
        };

    }

    throw new Error('[VisionPlayer] Invalid object format for time conversion');

};

export default convertTime;

/**
 * @typedef {Object} module:src/util/convertTime~smpteConversion
 * @property {module:src/util/convertTime~smpteFormat} smpte    An object containing SMPTE values as properties.
 * @property {string}                                  string   A string in the "hh:mm:ss:ff" format.
 * @property {number}                                  seconds  Time in seconds.
 */

/**
 * @typedef  {Object} module:src/util/convertTime~smpteFormat  Structure of the SMPTE Object
 * @property {number} h  Hours.
 * @property {number} m  Minutes.
 * @property {number} s  Seconds.
 * @property {number} f  Frames.
 */
