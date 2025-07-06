import DomSmith from '../../lib/dom/DomSmith.js';

/**
 * The Title component displays the primary and secondary media titles (if available) above the player viewport.
 * It remains hidden when no title data is present or when the feature is disabled.
 * The component automatically updates based on media data and playback language.
 * @exports module:src/ui/Title
 * @requires lib/dom/DomSmith
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class Title {

    /**
     * Configuration options for the Title component.
     * @type     {Object}
     * @property {boolean} [showSecondary=true]  Shows the secondary title.
     */
    #config = {
        showSecondary: true
    };

    /**
     * Reference to the main player instance.
     * @type {module:src/core/Player}
     */
    #player;

    /**
     * Holds tokens of subscriptions to player events, for later unsubscribe.
     * @type {number[]}
     */
    #subscriptions;

    /**
     * Holds tokens of additional subscriptions.
     * @type {number[]}
     */
    #subSecondary;

    /**
     * Secret key only known to the player instance and initialized components.
     * Used to be able to restrict access to API methods in conjunction with secure mode.
     * @type {symbol}
     */
    #apiKey;

    /**
     * DomSmith for the title container.
     * @type {module:lib/dom/DomSmith}
     */
    #dom;

    /**
     * Current media title.
     * @type {string}
     */
    #title;

    /**
     * Current secondary media title.
     */
    #titleSecondary;

    /**
     * Timeout id for resize debouncing.
     * @type {number}
     */
    #resizeId;

    /**
     * Creates an instance of the Title component.
     * @param {module:src/core/Player}           player            Reference to the VisionPlayer instance.
     * @param {module:src/controller/Controller} parent            Reference to the parent instance.
     * @param {Object}                           [options]         Additional options.
     * @param {symbol}                           [options.apiKey]  Token for extended access to the player API.
     */
    constructor(player, parent, { apiKey }) {

        this.#config = player.initConfig('title', this.#config);

        if (!this.#config) return [false];

        this.#player = player;
        this.#apiKey = apiKey;

        this.#dom = new DomSmith({
            _ref: 'wrapper',
            className: 'vip-title is-hidden',
            'data-sort': 20,
            _nodes: [{
                className: 'vip-title-inner',
                _nodes: [{
                    _tag: 'h2',
                    _nodes: [{
                        _ref: 'titlePrimaryText',
                        _text: ''
                    }]
                }, this.#config.showSecondary ? {
                    _tag: 'h3',
                    _nodes: [{
                        _ref: 'titleSecondaryText',
                        _text: ''
                    }]
                } : null]
            }]
        }, player.dom.getElement(apiKey));

        this.#subscriptions = [
            this.#player.subscribe('media/ready', this.#onMediaReady),
            this.#player.subscribe('data/ready', this.#onDataReady),
            this.#player.subscribe('data/nomedia', () => {
                this.#dom.titlePrimaryText.nodeValue = this.#player.locale.t('errors.data.header');
                this.#dom.titleSecondaryText.nodeValue = '';
            })
        ];

    }

    /**
     * Called once the media data is available. Extracts title and secondary title, and sets up UI show/hide if needed.
     * @param {module:src/core/Data~mediaItem} mediaItem                   Object containing media info.
     * @param {string|Object<string,string>}   [mediaItem.title]           The primary title (may be multilingual).
     * @param {string|Object<string,string>}   [mediaItem.titleSecondary]  The secondary title (multilingual).
     * @listens module:src/core/Data#data/ready
     */
    #onDataReady = ({ title, titleSecondary }) => {

        this.#player.unsubscribe(this.#subSecondary);

        if (title) {

            this.#title = title;
            this.#titleSecondary = titleSecondary;

            if (this.#player.getState('ui.visible')) this.#show();

            this.#subSecondary = [
                this.#player.subscribe('ui/show', this.#show),
                this.#player.subscribe('ui/hide', this.#hide),
                this.#player.subscribe('ui/resize', this.#resize)
            ];

        } else this.#hide();

    };

    /**
     * Called when the media is ready for playback. Translates and displays the title if not hidden.
     * @listens module:src/core/Media#media/ready
     */
    #onMediaReady = () => {

        const lang = this.#player.getConfig('locale.lang'),
              resolve = data => (typeof data === 'object' ? data[lang] ?? Object.values(data)[0] : data);

        this.#dom.titlePrimaryText.nodeValue = resolve(this.#title);

        if (this.#config.showSecondary) {
            this.#dom.titleSecondaryText.nodeValue = resolve(this.#titleSecondary) ?? '';
        }
    };

    /**
     * Hides the title.
     * @listens module:src/ui/UI#ui/show
     */
    #show = () => {

        this.#dom.wrapper.classList.remove('is-hidden');
        this.#resize();

    };

    /**
     * Shows the title.
     * @listens module:src/ui/UI#ui/hide
     */
    #hide = () => {

        this.#dom.wrapper.classList.add('is-hidden');
        this.#player.dom.getElement(this.#apiKey).style.setProperty('--vip-ui-blocked-top', '-1px');

    };

    /**
     * Called on UI resize events. Adjusts a CSS variable to place other UI elements below the title.
     * @listens module:src/ui/UI#ui/resize
     */
    #resize = () => {

        const doResize = () => {
            if (this.#dom.wrapper.classList.contains('is-hidden')) return;
            const blockedTop = this.#dom.wrapper.clientHeight + this.#dom.wrapper.offsetTop;
            this.#player.dom.getElement(this.#apiKey).style.setProperty('--vip-ui-blocked-top', `${blockedTop}px`);
        };

        clearTimeout(this.#resizeId);
        this.#resizeId = setTimeout(doResize, 100);

    };

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        clearTimeout(this.#resizeId);
        this.#dom.destroy();
        this.#player.unsubscribe(this.#subscriptions);
        this.#player.unsubscribe(this.#subSecondary);
        this.#player = this.#dom = this.#apiKey = null;

    }

}
