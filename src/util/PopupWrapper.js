import Popup from '../../lib/ui/Popup.js';

/**
 * Extended wrapper for the internal Popup class that adapts behavior based on the player layout.
 * If the layout is set to 'controller-only', the popup will not apply layout-limiting behavior, so that the popup can be outside of the players viewport.
 * It also adds or removes a CSS class on the player's container to allow further layout adaptations.
 * @exports module:src/util/PopupWrapper
 * @requires lib/ui/Popup
 * @augments module:lib/ui/Popup
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class PopupWrapper extends Popup {

    /**
     * Reference to the main player instance.
     * @type {module:src/core/Player}
     */
    #player;

    /**
     * Reference to the player's root element.
     * @type {HTMLElement}
     */
    #rootEle;

    /**
     * Secret key only known to the player instance and initialized components.
     * Used to be able to restrict access to API methods in conjunction with secure mode.
     * @type {symbol}
     */
    #apiKey;

    /**
     * Creates a new PopupWrapper instance.
     * @param {module:src/core/Player} player    Reference to the VisionPlayer instance.
     * @param {HTMLElement}            rootEle   Reference to the parent root element.
     * @param {Object}                 options   Additional options.
     * @param {symbol}                 [apiKey]  Token for extended access to the player API.
     */
    constructor(player, rootEle, options = {}, apiKey) {

        const { layout } = player.getConfig('dom');
        if (layout === 'controller-only') options.limitLayout = false;
        super(options);

        this.#player = player;
        this.#rootEle = rootEle;
        this.#apiKey = apiKey;

    }

    /**
     * Shows the popup with specified content and alignment target.
     * Adds a CSS class to the player container for visual indication.
     * @param {string|HTMLElement|DocumentFragment} content        The content to display in the popup.
     * @param {Event|HTMLElement|DocumentFragment}  eventOrTarget  The event or element that triggered the popup.
     * @param {module:lib/ui/Popup~options}         [options]      Configuration overrides for this invocation.
     */
    show(content, eventOrTarget, options = {}) {

        options.parentElement = this.#rootEle;
        this.#rootEle.classList.add('has-popup');
        this.#player.publish('popup/show', this.#apiKey);
        super.show(content, eventOrTarget, options);

    }

    /**
     * Called when showing is completed (ie transition has ended).
     */
    onVisible() {

        this.#player?.ui.disableAutoHide();
        super.onVisible();

    }

    /**
     * Called when hiding is completed (ie transition has ended).
     * Removes the CSS class from the player container.
     */
    onHidden() {

        this.#rootEle.classList.remove('has-popup');
        this.#player.publish('popup/hidden', this.#apiKey);
        this.#player?.ui.enableAutoHide();
        super.onHidden();

    }

}

/**
 * This event is fired when the Popup is shown.
 * @event module:src/util/PopupWrapper#popup/show
 */

/**
 * This event is fired when the Popup is hidden.
 * @event module:src/util/PopupWrapper#popup/hidden
 */
