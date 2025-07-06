/**
 * Conversion factor for degrees to radians.
 * @constant {number}
 * @memberof module:lib/util/math
 * @default
 */
export const deg2rad = Math.PI / 180;

/**
 * Conversion factor for radians to degrees.
 * @constant {number}
 * @memberof module:lib/util/math
 * @default
 */
export const rad2deg = 180 / Math.PI;

/**
 * Utility module for common mathematical operations.
 * Includes functions for clamping, linear interpolation, damping, and range conversions.
 * @module lib/util/math
 * @author Frank Kudermann - alphanull
 * @version 1.0.0
 * @license MIT
 */

/**
 * Clamps a number between a minimum and maximum value.
 * @memberof module:lib/util/math
 * @param   {number} num  The number to clamp.
 * @param   {number} min  The minimum value.
 * @param   {number} max  The maximum value.
 * @returns {number}      The clamped number.
 */
export function clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
}

/**
 * Linearly interpolates between two values.
 * @memberof module:lib/util/math
 * @param   {number} start  The starting value.
 * @param   {number} end    The ending value.
 * @param   {number} amt    The interpolation factor (0-1).
 * @returns {number}        The interpolated value.
 */
export function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

/**
 * Exponentially damps a value towards a target over time.
 * @memberof module:lib/util/math
 * @param   {number} x       The current value.
 * @param   {number} y       The target value.
 * @param   {number} lambda  The damping factor.
 * @param   {number} dt      The time delta.
 * @returns {number}         The damped value.
 */
export function damp(x, y, lambda, dt) {
    return lerp(x, y, 1 - Math.exp(-lambda * dt));
}

/**
 * Converts a value from one range to another.
 * @memberof module:lib/util/math
 * @param   {number}   value  The value to convert.
 * @param   {number[]} r1     The source range [min, max].
 * @param   {number[]} r2     The target range [min, max].
 * @returns {number}          The converted value in the target range.
 */
export function convertRange(value, r1, r2) {
    return (value - r1[0]) * (r2[1] - r2[0]) / (r1[1] - r1[0]) + r2[0];
}

/**
 * Converts a value from one range to another, clamping the result.
 * @memberof module:lib/util/math
 * @param   {number}   value  The value to convert.
 * @param   {number[]} r1     The source range [min, max].
 * @param   {number[]} r2     The target range [min, max].
 * @returns {number}          The clamped value in the target range.
 */
export function convertRangeClamp(value, r1, r2) {
    return clamp((value - r1[0]) * (r2[1] - r2[0]) / (r1[1] - r1[0]) + r2[0], r2[0], r2[1]);
}
