/**
 * Utility module for object, type checking, and data manipulation functions.
 * Provides helper methods for working with objects, arrays, types, and cloning.
 * @module lib/util/object
 * @author Frank Kudermann - alphanull
 * @version 1.1.0
 * @license MIT
 */
export default {
    isObject,
    isArray,
    isNumber,
    isInteger,
    isString,
    isFunction,
    isElement,
    isDomFragment,
    isNode,
    isNodeList,
    isRegex,
    isDate,
    isBoolean,
    isEmpty,
    clone,
    extend
};

/**
 * Checks if the given value is an object.
 * @memberof module:lib/util/object
 * @param   {*}       obj  The value to check.
 * @returns {boolean}      True if the value is an object, false otherwise.
 */
export function isObject(obj) {
    return !Array.isArray(obj) && obj === Object(obj);
}

/**
 * Checks if the given value is an array.
 * @memberof module:lib/util/object
 * @param   {*}       obj  The value to check.
 * @returns {boolean}      True if the value is an array, false otherwise.
 */
export function isArray(obj) {
    return Array.isArray(obj);
}

/**
 * Checks if the given value is a number.
 * @memberof module:lib/util/object
 * @param   {*}       obj  The value to check.
 * @returns {boolean}      True if the value is a number, false otherwise.
 */
export function isNumber(obj) {
    return !isNaN(parseFloat(obj)) && isFinite(obj) && !isString(obj);
}

/**
 * Checks if the given value is an integer.
 * @memberof module:lib/util/object
 * @param   {*}       obj  The value to check.
 * @returns {boolean}      True if the value is an integer, false otherwise.
 */
export function isInteger(obj) {
    return !isNaN(parseFloat(obj)) && isFinite(obj) && obj === parseInt(obj, 10);
}

/**
 * Checks if the given value is a string.
 * @memberof module:lib/util/object
 * @param   {*}       obj  The value to check.
 * @returns {boolean}      True if the value is a string, false otherwise.
 */
export function isString(obj) {
    return typeof obj === 'string' || obj instanceof String;
}

/**
 * Checks if the given value is a function.
 * @memberof module:lib/util/object
 * @param   {*}       obj  The value to check.
 * @returns {boolean}      True if the value is a function, false otherwise.
 */
export function isFunction(obj) {
    const type = Object.prototype.toString.call(obj);
    return type === '[object Function]' || type === '[object AsyncFunction]';
}

/**
 * Checks if the given value is a symbol.
 * @memberof module:lib/util/object
 * @param   {*}       obj  The value to check.
 * @returns {boolean}      True if the value is a symbol, false otherwise.
 */
export function isSymbol(obj) {
    return typeof obj === 'symbol';
}

/**
 * Checks if the given value is a DOM element.
 * @memberof module:lib/util/object
 * @param   {*}       obj  The value to check.
 * @returns {boolean}      True if the value is a DOM element, false otherwise.
 */
export function isElement(obj) {
    return typeof HTMLElement === 'object'
        ? obj instanceof HTMLElement
        : obj && typeof obj === 'object' && obj.nodeType === 1 && typeof obj.nodeName === 'string';
}

/**
 * Checks if the given value is a DOM fragment.
 * @memberof module:lib/util/object
 * @param   {*}       obj  The value to check.
 * @returns {boolean}      True if the value is a DOM fragment, false otherwise.
 */
export function isDomFragment(obj) {
    return typeof HTMLElement === 'object'
        ? obj instanceof DocumentFragment
        : obj && typeof obj === 'object' && obj.nodeType === 11 && typeof obj.nodeName === 'string';
}

/**
 * Checks if the given value is a DOM node.
 * @memberof module:lib/util/object
 * @param   {*}       obj  The value to check.
 * @returns {boolean}      True if the value is a DOM node, false otherwise.
 */
export function isNode(obj) {
    return typeof Node === 'object'
        ? obj instanceof Node
        : obj && typeof obj === 'object' && typeof obj.nodeType === 'number' && typeof obj.nodeName === 'string';
}

/**
 * Checks if the given value is a NodeList.
 * @memberof module:lib/util/object
 * @param   {*}       obj  The value to check.
 * @returns {boolean}      True if the value is a NodeList, false otherwise.
 */
export function isNodeList(obj) {
    return {}.isPrototypeOf.call(NodeList.prototype, obj);
}

/**
 * Checks if the given value is a regular expression.
 * @memberof module:lib/util/object
 * @param   {*}       obj  The value to check.
 * @returns {boolean}      True if the value is a regex, false otherwise.
 */
export function isRegex(obj) {
    return Object.prototype.toString.call(obj) === '[object RegExp]';
}

/**
 * Checks if the given value is a Date.
 * @memberof module:lib/util/object
 * @param   {*}       obj  The value to check.
 * @returns {boolean}      True if the value is a valid Date, false otherwise.
 */
export function isDate(obj) {
    return Object.prototype.toString.call(obj) === '[object Date]'
        ? !isNaN(obj.getTime())
        : false;
}

/**
 * Checks if the given value is a boolean.
 * @memberof module:lib/util/object
 * @param   {*}       obj  The value to check.
 * @returns {boolean}      True if the value is a boolean, false otherwise.
 */
export function isBoolean(obj) {
    return obj === Boolean(obj);
}

/**
 * Checks if the given value is undefied.
 * @memberof module:lib/util/object
 * @param   {*}       obj  The value to check.
 * @returns {boolean}      True if the value is undefined, false otherwise.
 */
export function isUndefined(obj) {
    return typeof obj === 'undefined';
}

/**
 * Checks if the given value is empty.
 * @memberof module:lib/util/object
 * @param   {*}       obj                    The value to check.
 * @param   {boolean} [nonEnumerable=false]  If true, checks non-enumerable properties as well.
 * @returns {boolean}                        True if the value is empty, false otherwise.
 */
export function isEmpty(obj, nonEnumerable = false) {
    if (isObject(obj)) {
        return nonEnumerable ? Object.getOwnPropertyNames(obj).length === 0 : Object.keys(obj).length === 0;
    } else if (isArray(obj)) {
        return obj.length === 0;
    } else if (isString(obj)) {
        return obj === '';
    }
    return false;
}

/**
 * Deeply clones an object with optional support for tracking references to prevent cyclic references.
 * @memberof module:lib/util/object
 * @param   {*}       obj   The object to clone.
 * @param   {WeakMap} [wm]  A WeakMap to track references and prevent cyclic references.
 * @returns {*}             A deeply cloned copy of the input object.
 */
export function clone(obj, wm) {
    return _extend(null, obj, wm);
}

/**
 * Extends a target object with properties from one or more source objects.
 * Supports deep cloning and cyclic reference tracking using a WeakMap.
 * @memberof module:lib/util/object
 * @param   {...Object} sources  The source objects from which to copy properties.
 * @returns {Object}             The extended target object.
 */
export function extend(...sources) {

    let undef;

    const refMap = sources.slice(-1)[0] instanceof WeakMap ? sources.pop() : undef,
          onlyPrimitives = sources.every(src => src === null || typeof src !== 'object');

    if (onlyPrimitives) {
        for (let i = sources.length - 1; i >= 0; i -= 1) {
            const val = sources[i];
            if (val !== undef) return val;
        }
        return undef;
    }

    let result;

    for (const src of sources) {
        if (src && typeof src === 'object') {
            result = _extend(result, src, refMap);
        }
    }

    return result;
}

/**
 * Internal helper function to recursively extend objects.
 * Handles various data types and prevents cyclic references using a WeakMap.
 * @private
 * @memberof module:lib/util/object
 * @param   {*}       target    The target object to extend.
 * @param   {*}       source    The source object providing properties.
 * @param   {WeakMap} [refMap]  A WeakMap to track references and handle cyclic structures.
 * @returns {*}                 The extended or cloned target.
 * @throws  {Error}             If the constructor of the source object is invalid.
 */
function _extend(target, source, refMap) {

    if (source === null || typeof source === 'undefined' || typeof source !== 'object' && typeof source !== 'symbol') {
        return source;
    }

    if (refMap && refMap.has(source)) {
        return refMap.get(source); // Cyclic reference
    }

    const Constructor = source.constructor;

    if (typeof Constructor !== 'function') {
        throw new Error('[Extend] Invalid constructor for source object');
    }

    if (target && target.constructor !== source.constructor) {
        throw new Error(`[Extend] Cannot merge incompatible types: ${target.constructor.name} and ${source.constructor.name}`);
    }

    switch (Constructor) {

        case Date:
        case String:
        case Number:
        case Boolean:
        case URL:

            return new Constructor(source);

        case Array: {

            const newTarget = [];

            if (refMap) { refMap.set(source, newTarget); }

            for (let i = 0, len = source.length; i < len; i += 1) {
                const src = source[i];
                if (src === null || typeof src === 'undefined' || typeof src !== 'object' && typeof src !== 'symbol') {
                    newTarget[i] = src;
                } else {
                    newTarget[i] = _extend(null, src, refMap);
                }
            }

            return newTarget;
        }

        case Object: {

            const newTarget = target || {};

            if (refMap) { refMap.set(source, newTarget); }

            const keys = Object.keys(source);

            for (const key of keys) {
                const src = source[key]; // actually faster this way than using Object.entries
                if (src === null || typeof src === 'undefined' || typeof src !== 'object' && typeof src !== 'symbol') {
                    newTarget[key] = src;
                } else {
                    newTarget[key] = _extend(newTarget[key], src, refMap);
                }
            }

            return newTarget;
        }

        case Set:
        case Map: {

            if (target && target.constructor !== Map && target.constructor !== Set) {
                throw new Error('[Extend] Cannot extend Maps or Sets with other source type');
            }

            const newTarget = target || new Constructor();

            if (refMap) { refMap.set(source, newTarget); }

            for (const [key, value] of source.entries()) {
                if (Constructor === Map) {
                    newTarget.set(_extend(null, key, refMap), _extend(null, value, refMap));
                } else {
                    newTarget.add(_extend(null, key, refMap));
                }
            }

            return newTarget;
        }

        case RegExp: {

            const flags = [];

            if (source.global) { flags.push('g'); }
            if (source.multiline) { flags.push('m'); }
            if (source.ignoreCase) { flags.push('i'); }
            if (source.dotAll) { flags.push('s'); }
            if (source.unicode) { flags.push('u'); }
            if (source.sticky) { flags.push('y'); }

            const result = new RegExp(source.source, flags.join(''));

            if (typeof source.lastIndex === 'number') result.lastIndex = source.lastIndex;

            return result;

        }

        case ArrayBuffer: {

            const result = new Constructor(source.byteLength);
            new Uint8Array(result).set(new Uint8Array(source));
            return result;

        }

        case Int8Array:
        case Uint8Array:
        case Uint8ClampedArray:
        case Uint16Array:
        case Int32Array:
        case Uint32Array:
        case Float32Array:
        case Float64Array:
        case BigInt64Array:
        case BigUint64Array:
        {
            return new Constructor(_extend(null, source.buffer), source.byteOffset, source.length);
        }

        case DataView: {
            return new Constructor(_extend(null, source.buffer), source.byteOffset, source.byteLength);
        }

        case Symbol:
            return Symbol.prototype.valueOf.call(source);

        case File:
            return new File([source], source.name, { type: source.type });

        default:
            return source;

    }

}
