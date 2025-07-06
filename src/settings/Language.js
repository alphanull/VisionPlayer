import Menu from '../util/Menu.js';

/**
 * The Language component provides a UI that displays the current media (audio) language, and allows the user to change the language using a menu.
 * @exports module:src/settings/Language
 * @requires lib/util/Menu
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class Language {

    /**
     * Holds the configuration options for the Language component.
     * @type     {Object}
     * @property {boolean} [showPlaceholder=false]  If enabled, display a 'not available' placeholder text if no languages are available, otherwise completely hide the menu.
     */
    #config = {
        showPlaceholder: false
    };

    /**
     * Reference to the main player instance.
     * @type {module:src/core/Player}
     */
    #player;

    /**
     * Reference to the parent instance.
     * @type {module:src/controller/Controller}
     */
    #parent;

    /**
     * Holds tokens of subscriptions to player events, for later unsubscribe.
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
     * Reference to the language menu.
     * @type {module:src/util/Menu}
     */
    #menu;

    /**
     * Array of available language objects.
     * @type {module:src/settings/Language~langObj[]}
     */
    #languages = [];

    /**
     * The currently selected language.
     * @type {module:src/settings/Language~langObj}
     */
    #current = {};

    /**
     * Flag indicating if an external update (e.g. From another component) triggered the language change.
     * @type {boolean}
     */
    #isExternalUpdate = false;

    /**
     * Creates an instance of the Language component.
     * @param {module:src/core/Player} player            Reference to the media player instance.
     * @param {module:src/ui/Popup}    parent            Reference to the parent instance (In this case the language popup).
     * @param {Object}                 [options]         Additional options.
     * @param {symbol}                 [options.apiKey]  Token for extended access to the player API.
     */
    constructor(player, parent, { apiKey }) {

        this.#config = player.initConfig('languageMenu', this.#config);

        if (!this.#config) return [false];

        this.#player = player;
        this.#parent = parent;
        this.#apiKey = apiKey;

        this.#menu = new Menu(
            this.#player,
            {
                target: this.#parent.getElement('top'),
                id: 'language',
                header: this.#player.locale.t('misc.language'),
                showPlaceholder: this.#config.showPlaceholder,
                verticalMenuThreshold: 2,
                selectMenuThreshold: 3,
                onSelected: sel => { this.#toggleLanguage(this.#languages[sel]); }
            }
        );

        this.#subscriptions = [
            ['data/source', this.#onDataSource],
            ['data/ready', this.#onDataReady],
            ['data/nomedia', () => { this.#menu.create([]); }],
            ['media/ready', this.#updateMenu],
            ['language/active', this.#updateMenu],
            ['language/update', this.#onLanguageUpdate]
        ].map(([event, handler]) => this.#player.subscribe(event, handler));

    }

    /**
     * Called when a media source has been selected.
     * @param {module:src/core/Media~metaData} metaData  The new media item data.
     * @listens module:src/core/Data#data/source
     */
    #onDataSource = metaData => {

        this.#current = metaData;

    };

    /**
     * Sets up the component as soon as the media data is available.
     * @param {Object} mediaData           The data object containing media variants.
     * @param {Array}  mediaData.variants  Array of variants.
     * @listens module:src/core/Data#data/ready
     */
    #onDataReady = ({ variants }) => {

        const languages = variants.reduce((acc, variant) => {
            if (variant.language && !acc.includes(variant.language)) {
                acc.push({ language: variant.language });
            }
            return acc;
        }, []);

        this.#isExternalUpdate = false;
        this.#languages = this.#mapLanguages(languages);
        this.#menu.create(this.#languages);

    };

    /**
     * Handles the "language/update" event. Used by Dash and Hls to update the menu with information gathered from the manifests
     * In this case, "externalUpdate" is set to `true`,
     * so a selection of the language will not use the internal data, but rather delegated to the respective (streaming) component.
     * @param {Object}                                 data            Object containing updated language information.
     * @param {module:src/settings/Language~langObj[]} data.languages  Array of language objects, containing language code, id and name (optional).
     * @param {module:src/settings/Language~langObj}   data.current    The currently selected language, containing language code and id (optional).
     * @listens module:src/settings/Language#language/update
     */
    #onLanguageUpdate = ({ languages, current }) => {

        this.#isExternalUpdate = true;
        this.#languages = this.#mapLanguages(languages);
        this.#menu.create(this.#languages);

        if (current) this.#updateMenu(current);

    };

    /**
     * Maps languages array to internal format, adding localized labels.
     * @param   {string[]}                               languages  Array with language codes to map.
     * @returns {module:src/settings/Language~langObj[]}            The mapped array.
     */
    #mapLanguages(languages) {

        return languages.map(langObj => {
            let nativeLang = this.#player.locale.getNativeLang(langObj.language);
            if (nativeLang === langObj.language) {
                nativeLang = this.#player.locale.getNativeLang(langObj.language.split('-')[0].toLowerCase());
                if (!langObj.langName) langObj.langName = langObj.language;
            }
            return {
                value: langObj.language,
                langId: langObj.langId,
                label: nativeLang + (langObj.langName && langObj.langName !== nativeLang ? ` (${langObj.langName})` : '')
            };
        });

    }

    /**
     * Updates the language menu to reflect the current language selection.
     * @param {module:src/core/Media~metaData} metaData  The updated stream object.
     * @listens module:src/settings/Language#language/active
     * @listens module:src/core/Media#media/ready
     */
    #updateMenu = ({ value, language, langId }) => {

        const langVal = value || language,
              selectedIndex = this.#languages.findIndex(lang => (typeof lang.langId === 'undefined' ? lang.value === langVal : lang.langId === langId));

        this.#current.language = langVal;
        this.#current.langId = langId;

        if (selectedIndex > -1) this.#menu.setIndex(selectedIndex);

    };

    /**
     * Handler called when the user changes language in the menu.
     * @param {module:src/settings/Language~langObj} langObj  The language code to set.
     * @fires  module:src/settings/Language#language/selected
     * @fires  module:src/settings/Quality#quality/language/refresh
     */
    #toggleLanguage(langObj) {

        const { value, langId } = langObj;

        if (value === this.#current.language && langId === this.#current.langId) return;

        this.#player.publish('language/selected', langObj, this.#apiKey);

        if (this.#isExternalUpdate) return;

        this.#player.publish('quality/language/refresh', langObj, this.#apiKey);

        const { quality } = this.#player.media.getMetaData(),
              result = this.#player.data.getPreferredMetaData({ preferredQuality: quality, preferredLanguage: value });

        if (!result) this.#player.data.error('[Language] Did not find language in media data');

        this.#player.setConfig({ data: { preferredLanguage: value } });
        this.#player.media.load(result, { rememberState: true, ignoreAutoplay: true, play: !this.#player.getState('media.paused') });

    }

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        this.#menu.destroy();
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#parent = this.#menu = this.#apiKey = null;

    }

}

/**
 * This event is fired when the media (audio) language is changed by the user.
 * @event module:src/settings/Language#language/selected
 * @param {module:src/settings/Language~langObj} langObj  The selected language.
 */

/**
 * The Language component listens for this event to react to outside changes to the current lang.
 * Updates the menu accordingly. Used mainly for external control by components as dash and hls.
 * @event module:src/settings/Language#language/active
 * @param {module:src/settings/Language~langObj} langObj  The selected language.
 */

/**
 * The Language component listens for this event to react to outside changes to the available languages.
 * Rebuilds the menu accordingly. Used mainly for external control by components as dash and hls.
 * @event module:src/settings/Language#language/update
 * @param {Array<module:src/settings/Language~langObj>} languages  Array with available languages.
 */

/**
 * A single language data object.
 * @typedef  {Object}  module:src/settings/Language~langObj
 * @property {string} language    The language code.
 * @property {string} [langId]    The language id (used with Dash and Hls to switch streams correctly).
 * @property {string} [langName]  The language name (used for getting additional labelling information).
 */
