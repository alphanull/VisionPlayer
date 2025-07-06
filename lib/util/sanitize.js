/**
 * Various utility function for sanitizing subtitles or other html.
 * @module lib/util/sanitize
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default {
    sanitizeHTML,
    stripTags,
    htmlspecialchars
};

/**
 * This is the JS equivalent of the PHP htmlspecialchars function.
 * It is used to sanitize HTML formatted subtitles as a security measure.
 * @memberof module:lib/util/sanitize
 * @param   {string}  string               The string being converted.
 * @param   {number}  [quoteStyle]         Determines how quotes are handled. For more information, consult the inline doc.
 * @param   {string}  [charset]            Not supported and therefore ignored.
 * @param   {boolean} [doubleEncode=true]  When doubleEncode is turned off the method will not encode existing html entities, the default is to convert everything.
 * @returns {string}                       The encoded string.
 * @author  Mirek Slugen
 * @see {@link http://php.net/manual/en/function.htmlspecialchars.php}
 * @see {@link http://phpjs.org/functions/htmlspecialchars/}
 */
export function htmlspecialchars(string, quoteStyle, charset, doubleEncode) {
    // discuss at: http://phpjs.org/functions/htmlspecialchars/
    /* eslint-disable no-param-reassign, no-bitwise */
    let optTemp = 0,
        noquotes = false;

    if (typeof quoteStyle === 'undefined' || quoteStyle === null) {
        quoteStyle = 2;
    }

    string = string.toString();

    if (doubleEncode !== false) string = string.replace(/&/g, '&amp;'); // Put this first to avoid double-encoding

    string = string.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const OPTS = {
        ENT_NOQUOTES: 0,
        ENT_HTML_QUOTE_SINGLE: 1,
        ENT_HTML_QUOTE_DOUBLE: 2,
        ENT_COMPAT: 2,
        ENT_QUOTES: 3,
        ENT_IGNORE: 4
    };

    if (quoteStyle === 0) noquotes = true;

    if (typeof quoteStyle !== 'number') {
        // Allow for a single string or an array of string flags
        quoteStyle = [].concat(quoteStyle);
        for (let i = 0; i < quoteStyle.length; i += 1) {
            // Resolve string input to bitwise e.g. "ENT_IGNORE" becomes 4
            if (OPTS[quoteStyle[i]] === 0) {
                noquotes = true;
            } else if (OPTS[quoteStyle[i]]) {
                optTemp |= OPTS[quoteStyle[i]];
            }
        }
        quoteStyle = optTemp;
    }

    if (quoteStyle & OPTS.ENT_HTML_QUOTE_SINGLE) string = string.replace(/"/g, '&#039;');
    if (!noquotes) string = string.replace(/"/g, '&quot;');

    return string;

}

/**
 * This is the JS equivalent of the PHP striptags function.
 * It is used to sanitize HTML formatted subtitles by removing all tags (except the allowed ones).
 * @memberof module:lib/util/sanitize
 * @param   {string} input      The string being converted.
 * @param   {string} [allowed]  List of allowed tags in this format: "<tag1><tag2>...".
 * @returns {string}            The stripped output string.
 * @author Kevin van Zonneveld
 * @see {@link http://locutus.io/php/strings/strip_tags/}
 */
export function stripTags(input, allowed) {

    // making sure the allowed arg is a string containing only tags in lowercase (<a><b><c>)
    allowed = (String(allowed || '').toLowerCase().match(/<[a-z][a-z0-9]*>/g) || []).join('');

    const tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
    const commentsAndPhpTags = /<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>/gi;

    return input.replace(commentsAndPhpTags, '').replace(tags, ($0, $1) => allowed.indexOf(`<${$1.toLowerCase()}>`) > -1 ? $0 : '');

}

/**
 * Sanitizes an HTML string by removing unsafe elements and attributes.
 * The function strips any tags and attributes that are not explicitly allowed.
 * It also ensures that dangerous URLs (e.g. Javascript:, data:) are removed.
 * This implementation now includes specific handling for <c> tags, transforming
 * them into <span> tags with extracted class names before DOM parsing..
 * @memberof module:lib/util/sanitize
 * @param   {string} input  The HTML string to sanitize.
 * @returns {string}        - Sanitized HTML string.
 */
export function sanitizeHTML(input) {

    // Allowed tags and attributes
    const allowedTags = [
        'b',
        'i',
        'u',
        'v',
        'em',
        'strong',
        'a',
        'p',
        'br',
        'ul',
        'ol',
        'li',
        'img',
        'svg',
        'ruby',
        'rt',
        'lang',
        'span'
    ];

    const allowedAttributes = {
        a: ['href', 'title', 'target'],
        img: ['src', 'alt', 'width', 'height'],
        svg: ['xmlns', 'viewBox', 'width', 'height'],
        span: ['class']
    };

    const dangerousAttributes = [
        'onclick',
        'onload',
        'onerror',
        'onmouseover',
        'onmouseout',
        'onfocus',
        'onblur',
        'style',
        'script',
        'iframe',
        'formaction',
        'background',
        'srcdoc',
        'xmlns'
    ];

    const allowedStyles = ['color', 'font-size', 'background-color'];

    let decodedInput = decodeMultipleEncodings(input);
    decodedInput = decodeHtmlEntities(decodedInput);
    decodedInput = decodeBase64(decodedInput);

    // Apply the <c> tag transformation
    decodedInput = transformCTags(decodedInput);

    // Step 3: Parse and sanitize the HTML
    const doc = new DOMParser().parseFromString(decodedInput, 'text/html');
    const elements = doc.body.querySelectorAll('*');

    elements.forEach(element => {
        const tagName = element.nodeName.toLowerCase();

        if (allowedTags.includes(tagName)) {
            [...element.attributes].forEach(attr => {
                const attrName = attr.name.toLowerCase();

                if (!allowedAttributes[tagName] || !allowedAttributes[tagName].includes(attrName) || dangerousAttributes.includes(attrName)) {
                    element.removeAttribute(attr.name);
                } else if (['href', 'src'].includes(attrName)) {
                    const decodedValue = decodeURIComponent(attr.value);
                    if (/^(javascript|data):/i.test(decodedValue)) {
                        element.removeAttribute(attr.name);
                    }
                }
            });

            if (element.hasAttribute('style')) {
                const styles = element.getAttribute('style').split(';');
                const safeStyles = styles.filter(style => {
                    const [property] = style.split(':');
                    return allowedStyles.includes(property && property.trim());
                }).join(';');
                element.setAttribute('style', safeStyles);
            }

            if (tagName === 'svg') element.querySelectorAll('script').forEach(script => script.remove());

            if (tagName === 'a' && element.hasAttribute('href')) {
                const href = element.getAttribute('href');
                const hashIndex = href.indexOf('#');
                if (hashIndex !== -1) {
                    const fragment = href.substring(hashIndex + 1);
                    if (/<script.*?>.*?<\/script>/i.test(fragment) || /javascript:/i.test(fragment)) {
                        element.removeAttribute('href');
                    }
                }
            }
        } else element.remove();

    });

    return doc.body.innerHTML;
}

// Helper functions

/**
 * Transforms `<c.class>` tags into `<span class="class">` before parsing.
 * Removes `<c>` tags without valid class names.
 * Only allows alphanumeric characters, hyphens, and underscores in class names.
 * @private
 * @memberof module:lib/util/sanitize
 * @param   {string} inputStr  Input string possibly containing <c> tags.
 * @returns {string}           Transformed string with valid <span> tags.
 */
function transformCTags(inputStr) {
    return inputStr.replace(/<c(?:\.([a-zA-Z0-9_\-.]+))?>/g, (match, classNames) => {
        if (!classNames) return ''; // Remove <c> tags without classes
        // Validate class names: allow only alphanumeric, hyphens, underscores, and dots
        const sanitizedClassNames = classNames
            .split('.')
            .map(cls => cls.trim())
            .filter(cls => /^[a-zA-Z0-9_-]+$/.test(cls))
            .join(' ');

        if (sanitizedClassNames) return `<span class="${sanitizedClassNames}">`;
        return ''; // Remove invalid or empty class names

    }).replace(/<\/c>/g, '</span>'); // Close <c> tags
}

/**
 * Recursively decodes URL-encoded sequences (e.g. %20, %3C) until stable.
 * @private
 * @memberof module:lib/util/sanitize
 * @param   {string} inputStr  Possibly encoded input string.
 * @returns {string}           Decoded output string.
 */
function decodeMultipleEncodings(inputStr) {
    let decodedInput = inputStr;
    let previousDecodedInput;
    do {
        previousDecodedInput = decodedInput;
        try {
            decodedInput = decodeURIComponent(decodedInput);
        } catch (e) { // eslint-disable-line no-unused-vars
            break;
        }
    } while (previousDecodedInput !== decodedInput);

    return decodedInput;
}

/**
 * Decodes HTML entities using a temporary `<textarea>` element.
 * Converts e.g. `&lt;`, `&amp;`, `&#039;` into their character equivalents.
 * @private
 * @memberof module:lib/util/sanitize
 * @param   {string} inputStr  String containing HTML entities.
 * @returns {string}           Decoded output string.
 */
function decodeHtmlEntities(inputStr) {
    const textArea = document.createElement('textarea');
    textArea.innerHTML = inputStr;
    return textArea.value;
}

/**
 * Tries to decode base64-encoded strings.
 * Recognizes and strips data URIs for common image formats.
 * Returns original input if decoding fails.
 * @private
 * @memberof module:lib/util/sanitize
 * @param   {string} inputStr  Base64 or plain input string.
 * @returns {string}           Decoded string or original if decoding fails.
 */
function decodeBase64(inputStr) {
    try {
        const base64Str = inputStr.replace(/^data:image\/(png|jpg|jpeg|svg\+xml|gif);base64,/, '');
        return atob(base64Str);
    } catch (e) { // eslint-disable-line no-unused-vars
        return inputStr;
    }
}
