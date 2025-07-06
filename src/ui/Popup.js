import DomSmith from '../../lib/dom/DomSmith.js';
import LibPopup from '../util/PopupWrapper.js';

/**
 * Configuration options for the Popup Component. Those options are set at build time, not runtime by adding them to the "addComponent" function.
 * @typedef {Object} module:src/ui/Popup~PopupConfig
 * @property {string} [buttonClass]          CSS class(es) for the popup button in the controller.
 * @property {string} [label]                Translate Path for the accessible label text for the button.
 * @property {string} [attach]               Where to attach the button in the parent's container (e.g., "right", "top", etc.).
 * @property {string} [viewClass=""]         Additional CSS class to apply to the popup container.
 * @property {string} [hideNoContent=false]  If `true` and no content is present after dynamic deletion hide the popup icon completely, otherwise set it to disabled.
 * @example Player.addComponent("ui.controller.popupControls", Popup, { buttonClass: "icon control", viewClass: "vip-control-popup", label: "components.pictureControls.header", attach: "right" });
 */

/**
 * The Popup component adds a customizable button to the controller that opens a layered popup panel.
 * It is designed to be reused by other components such as AirPlay, Quality, PlaybackRate, and Loop, which inject their UI into the popup dynamically.
 * The component supports flexible layout areas (`top`, `center`, `bottom`) and only reveals itself when actual content is detected.
 * @exports module:src/ui/Popup
 * @requires lib/dom/DomSmith
 * @requires lib/ui/Popup
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class Popup {

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
     * Secret key only known to the player instance and initialized components.
     * Used to be able to restrict access to API methods in conjunction with secure mode.
     * @type {symbol}
     */
    #apiKey;

    /**
     * A DomSmith instance to create a button in the controller or parent container.
     * This button is initially hidden until we detect content inside the popup.
     * @type {module:lib/dom/DomSmith}
     */
    #icon;

    /**
     * Reference to the popup instance.
     * @type {module:src/util/PopupWrapper}
     */
    #popup;

    /**
     * A DomSmith used as the content container within the popup.
     * Child components (AirPlay, Quality, etc.) attach their UI here.
     * @type {module:lib/dom/DomSmith}
     */
    #popupContent;

    /**
     * MutationObserver that reveals the popup button once content is added to the popup container.
     * Also tracks deletions of content nodes and automatically disables or hides the popup when no content is present.
     * @type {MutationObserver}
     */
    #mutationObserver;

    /**
     * If `true`
     * , popup icon is completely hidden instead of greyed our when popup content is empty.
     * @type {boolean}
     */
    #hideNoContent;

    /**
     * Creates an instance of the Popup component.
     * @param {module:src/core/Player}           player            Reference to the player instance.
     * @param {module:src/controller/Controller} parent            Reference to the parent instance, in this case the controller.
     * @param {module:src/ui/Popup~PopupConfig}  [options]         Additional configuration for the popup (defined at build time).
     * @param {symbol}                           [options.apiKey]  Token for extended access to the player API.
     */
    constructor(player, parent, options = {}) {

        const { buttonClass, label, attach, viewClass = '', sort = 0, hideNoContent = true } = options.config;

        this.#player = player;
        this.#hideNoContent = hideNoContent;

        if (options.apiKey) {
            this.#apiKey = options.apiKey;
            delete options.apiKey;
        }

        this.#icon = new DomSmith({
            _ref: 'button',
            _tag: 'button',
            className: buttonClass,
            'data-sort': sort || 0,
            ariaLabel: this.#player.locale.t(label),
            style: 'display: none;',
            click: this.showPopup,
            $tooltip: label ? { player, text: this.#player.locale.t(label) } : null
        }, parent.getElement(attach));

        this.#popup = new LibPopup(player, player.dom.getElement(this.#apiKey), {
            orientation: ['top', 'bottom'],
            margins: { top: 0, left: 20, right: 20, bottom: 0 },
            viewClass,
            targetHoverClass: 'is-hover',
            resize: false
        }, this.#apiKey);

        this.#popupContent = new DomSmith({
            _ref: 'wrapper',
            className: 'vip-popup-content',
            _nodes: [{
                _tag: 'span',
                class: 'is-invisible',
                id: 'pu-aria-label',
                _nodes: [this.#player.locale.t(label)]
            }, {
                _ref: 'top',
                className: 'vip-popup-content-top'
            }, {
                _ref: 'center',
                className: 'vip-popup-content-center'
            }, {
                _ref: 'bottom',
                className: 'vip-popup-content-bottom'
            }]
        });

        this.#subscriptions = [
            this.#player.subscribe('ui/hide', this.hidePopup),
            this.#player.subscribe('ui/resize', this.refreshPopup),
            this.#player.subscribe('media/ready', this.refreshPopup, { priority: -99 })
        ];

        this.#mutationObserver = new MutationObserver(this.#onMutation);
        this.#mutationObserver.observe(this.#popupContent.wrapper, { childList: true, subtree: true });

    }

    /**
     * Called by the mutation observer when popup content changes.
     * Hides or disables the popup icon if no content is present.
     * @param {Array} mutationList  [description].
     */
    #onMutation = mutationList => {
        let added = false,
            removed = false;

        for (const { type, addedNodes, removedNodes } of mutationList) {
            if (type === 'childList') {
                if (addedNodes.length) added = true;
                if (removedNodes.length) removed = true;
            }
        }

        if (added) {
            this.#icon.button.style.display = 'block';
            this.#icon.button.disabled = false;
        }

        const isContentEmpty = !this.#popupContent.top.hasChildNodes()
          && !this.#popupContent.center.hasChildNodes()
          && !this.#popupContent.bottom.hasChildNodes();

        if (removed && isContentEmpty) {
            this.hidePopup();
            if (this.#hideNoContent) this.#icon.button.style.display = 'none';
            else this.#icon.button.disabled = true;
        }
    };

    /**
     * Shows the popup when the user clicks the associated button.
     * @param {Event} event  The DOM event that triggered this method.
     */
    showPopup = event => {

        this.#popup.show(this.#popupContent.wrapper, event);

    };

    /**
     * Hides the popup, either because the UI hides or the user clicks away from the popup.
     * @listens module:src/ui/UI#ui/hide
     */
    hidePopup = () => {

        this.#popup.hide(null, { focus: false });

    };

    /**
     * Refreshes Popup (recalculates layout) on media/ready if open.
     * May be necessary because child components might alter popup content.
     * This handler is invoked with a very low priority to ensure it comes last.
     * @listens module:src/core/Media#media/ready
     */
    refreshPopup = () => {

        if (this.#popup.state === 'visible') this.#popup.layout();

    };

    /**
     * Provides container elements for child components that want to attach content to this popup.
     * "top", "center", and "bottom" can be used for layout areas, or fallback to the root wrapper.
     * @param   {string}      area  The desired area: "top", "center", "bottom".
     * @returns {HTMLElement}       The container element for that area.
     */
    getElement(area) {

        return this.#popupContent[area] ?? this.#popupContent.wrapper;

    }

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        this.#mutationObserver.disconnect(this.#popupContent.wrapper);
        this.#popup.remove();
        this.#icon.destroy();
        this.#popupContent.destroy();
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#icon = this.#popup = this.#popupContent = this.#mutationObserver = this.#apiKey = null;
    }

}
