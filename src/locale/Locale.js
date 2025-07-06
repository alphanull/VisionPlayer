import { isObject, extend } from '../../lib/util/object.js';
import langMap from './langMap.js';
import langTranslations from './langTranslations.js';
import convertTime from '../util/convertTime.js';

/**
 * The Locale component manages the player’s translation layer.
 * It stores and resolves locale data, enables the registration of custom locales before instance creation, and provides a runtime translation function.
 * This component does not affect UI layout directly but underpins all text translations in UI components.
 * @exports module:src/locale/Locale
 * @requires lib/util/object
 * @requires src/locale/langMap
 * @requires src/locale/langTranslations
 * @requires src/util/convertTime
 * @author  Frank Kudermann - alphanull
 * @version 1.0.0
 * @license MIT
 */
export default class Locale {

    /**
     * Holds the instance configuration for this component.
     * @type     {Object}
     * @property {string} [lang]  Sets the default UI language. Affects which locale is used for translation. If not present, the player tries to find the best suitable locale based on browser language, with a final fallback to `'en'`..
     */
    #config;

    /**
     * Reference to the main player instance.
     * @type {module:src/core/Player}
     */
    #player;

    /**
     * Secret key only known to the player instance and initialized components.
     * Used to be able to restrict access to API methods in conjunction with secure mode.
     * @type {symbol}
     */
    #apiKey;

    /**
     * Creates a new instance of the Locale component.
     * @param {module:src/core/Player} player            Reference to the VisionPlayer instance.
     * @param {module:src/core/Player} parent            Reference to the parent instance.
     * @param {Object}                 [options]         Additional options.
     * @param {symbol}                 [options.apiKey]  Token for extended access to the player API.
     */
    constructor(player, parent, { apiKey }) {

        const defaultLocale = Object.keys(Locale.#localeData).find(lang => lang === navigator.language || navigator.language.startsWith(`${lang}-`)) || Locale.#defaults.lang;

        this.#config = player.initConfig('locale', {
            lang: defaultLocale
        });

        if (!Locale.#localeData[this.#config.lang]) this.#config.lang = Locale.#defaults.lang;

        this.#player = player;

        this.#apiKey = apiKey;

        // add RTL support if necessary
        this.#player.dom.getElement(apiKey).classList.toggle('is-rtl', Boolean(Locale.#localeConfig[this.#config.lang]?.rtl));

        this.#player.setApi('locale.t', this.#translate, this.#apiKey);
        this.#player.setApi('locale.getLocalizedTime', this.#getLocalizedTime, this.#apiKey);
        this.#player.setApi('locale.getNativeLang', this.#getNativeLang, this.#apiKey);

    }

    /**
     * Returns a translation based on the delivered translation path.
     * @param   {string} translatePath  Path to the desired translation. Path segments are separated by ".", for example "tree.subtree.property".
     * @param   {Object} vars           Additional vars to translate.
     * @returns {string}                Returns the desired translation. If not found, the key itself is returned instead.
     * @throws  {Error}                 If type of vars data mismatches.
     */
    #translate = (translatePath, vars) => {

        const { lang } = this.#config;

        /**
         * Parses translated string, replaces template fragments with matching vars.
         * If nothing is found, the template fragment is left "as is".
         * @private
         * @memberof module:src/util/Locale
         * @inner
         * @param   {string} translation  The translated string to parse.
         * @param   {Object} variables    The vars to replace.
         * @returns {string}              Parsed string.
         */
        function parseVars(translation, variables) {

            const templateRegex = new RegExp('${(\\w*)}', "g"); // eslint-disable-line

            return translation.replace(
                templateRegex,
                (m, key) => Reflect.has(variables, key) ? variables[key] : m
            );

        }

        /**
         * Searches for a translation.
         * @private
         * @memberof module:src/util/Locale
         * @inner
         * @param   {string}           path  The path of the desired translation.
         * @returns {string | boolean}       Returns the translation string, or "false" if nothing was found.
         */
        function findTranslation(path = '') {

            const pathArray = path.split('.');

            let result = Locale.#localeData[lang];

            while (pathArray.length && (result = result[pathArray[0]])) {
                pathArray.shift();
            }

            return result && typeof result === 'string' || result === '' ? result : false;

        }

        let translated;

        if (vars) {

            if (!isObject(vars)) throw new Error('[Locale] Vars must be an object');

            // plurals? (uses fixed "count" var)
            if (typeof vars.count === 'undefined' || vars.count === null) {
                translated = findTranslation(translatePath);
            } else {
                if (isNaN(parseFloat(vars.count)) || !isFinite(vars.count)) throw new Error('[Locale] Count must be a number');
                translated = vars.count === 1 ? findTranslation(translatePath) : findTranslation(`${translatePath}_plural`);
            }

            // replace vars if translation was found
            if (translated !== false) translated = parseVars(translated, vars);

        } else translated = findTranslation(translatePath);

        return translated === false ? translatePath : translated;

    };

    /**
     * Returns a localized string representing a time duration in hours, minutes, and seconds.
     * This method takes a time value in seconds and converts it to a human-readable format,
     * applying language-specific singular or plural units for hours, minutes, and seconds,
     * depending on the current locale. If `null` or `undefined` is passed, an empty string is returned.
     * @param   {string|number|module:src/util/convertTime~smpteFormat} timeArg  The input value in one of the three accepted formats: seconds, a string or a module:src/core/Player~smpteFormat Object.
     * @returns {string}                                                         Localized time string.
     */
    #getLocalizedTime = timeArg => {

        if (typeof timeArg === 'undefined' || timeArg === null) return '';

        let timeLocalized = '';

        const time = convertTime(Number(timeArg)).smpte;

        if (time.h) timeLocalized += `${time.h} ${this.#player.locale.t('time.hour', { count: time.h })} `;
        timeLocalized += `${time.m} ${this.#player.locale.t('time.minute', { count: time.m })} `;
        timeLocalized += `${time.s} ${this.#player.locale.t('time.second', { count: time.s })}`;

        return timeLocalized;

    };

    /**
     * Translates a language identifier (ISO 639-3 or legacy code) to its native language name.
     * Accepts ISO 639-3 codes (e.g. `'deu'`), legacy codes (e.g. `'ger'`), or 2-letter codes (if present in `langMap`).
     * Returns the native name of the language as displayed in UI elements like language or subtitle menus.
     * If no translation is available, the original language code is returned.
     * @param   {string} lang  The language identifier to translate.
     * @returns {string}       The native name of the language, or the identifier itself if unknown.
     */
    #getNativeLang = lang => { // eslint-disable-line class-methods-use-this

        const translateKey = langMap[lang] || lang,
              translateLang = langTranslations[translateKey];

        return translateLang || lang;
    };

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        this.#player.removeApi(['locale.t', 'locale.getLocalizedTime', 'locale.getNativeLang'], this.#apiKey);
        this.#player = this.#apiKey = null;

    }

    /**
     * Holds the default locale information.
     * @private
     * @memberof module:src/util/Locale
     * @type {Object}
     */
    static #defaults = { lang: 'en' };

    /**
     * Holds the actual locale data.
     * @private
     * @memberof module:src/util/Locale
     * @type {Object}
     */
    static #localeData = {};

    /**
     * Holds additional global locale configuration.
     * @private
     * @memberof module:src/util/Locale
     * @type {Object}
     */
    static #localeConfig = {};

    /**
     * Component initializer, called by the player automatically when adding this component.
     * Exposes some API calls to the Player constructor.
     * @param {module:src/core/Player} Player  Reference to the player Constructor.
     */
    static initialize(Player) {

        Player.setApi('addLocale', Locale.#addLocale.bind(Locale));
        Player.setApi('setDefaultLocale', Locale.#setDefaultLocale.bind(Locale));
        Player.setApi('setLocaleConfig', Locale.#setLocaleConfig.bind(Locale));

    }

    /**
     * Adds another locale object. This can be a whole object, or just a fragment, specified by the langpath.
     * Note* This method has to be called on the player *constructor* (not the instance), and only has an effect *before* a VisionPlayer instance is created.
     * @param  {Object} translations  JSON like data structure with key / value pairs, extends the existing locale object. Make sure the language code is at the root level of the translations object, like this: `{ "de": { ... } }`.
     * @throws {Error}                Throws error when enountering invalid locale data.
     */
    static #addLocale(translations) {

        if (!isObject(translations)) throw new Error('Locale Data must be Javascript Object.');

        Locale.#localeData = extend(Locale.#localeData, translations);

    }

    /**
     * Sets the player locale.
     * Note* This method has to be called on the player *constructor* (not the instance), and only has an effect *before* a VisionPlayer instance is created.
     * @param {string} lang  The language to set, represented by a (known) language code.
     */
    static #setDefaultLocale(lang) {

        Locale.#defaults.lang = lang;

    }

    /**
     * Sets the config for a certain locale.
     * @param {string} lang    The language tied to the config.
     * @param {Object} config  Config object, currently, specifiying rtl languages is supported.
     */
    static #setLocaleConfig(lang, config) {

        Locale.#localeConfig[lang] = config;

    }

}
