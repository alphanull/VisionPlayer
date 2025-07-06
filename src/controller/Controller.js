import DomSmith from '../../lib/dom/DomSmith.js';
import sortElements from '../../lib/dom/sortElements';

/**
 * The controller component mainly acts as a container for other child components.
 * In addition it also reacts to 'ui/show' and 'ui/hide' events which are in turn used to hide and show the controller (and its children).
 * @exports module:src/controller/Controller
 * @requires lib/dom/DomSmith
 * @requires lib/dom/sortElements
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class Controller {

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
     * Reference to the DomSmith instance used to manage DOM elements.
     * @type {module:lib/dom/DomSmith}
     */
    #dom;

    /**
     * Reference to the root player element.
     * @type {HTMLElement}
     */
    #rootEle;

    /**
     * Timeout ID for debounced resize logic.
     * @type {number}
     */
    #resizeId;

    /**
     * Creates an instance of the Controller component.
     * @param {module:src/core/Player} player            Reference to the VisionPlayer instance.
     * @param {module:src/ui/UI}       parent            Reference to the parent instance.
     * @param {Object}                 [options]         Additional options.
     * @param {symbol}                 [options.apiKey]  Token for extended access to the player API.
     */
    constructor(player, parent, { apiKey }) {

        if (!player.initConfig('controller', true)) return [false];

        this.#player = player;
        this.#rootEle = this.#player.dom.getElement(apiKey);

        this.#dom = new DomSmith({
            _ref: 'controller',
            className: 'vip-controller is-hidden',
            'data-sort': 80,
            _events: { // Using _events because "onfocusin" is not a property on the element.
                focusin: () => {
                    if (this.#player.getState('ui.lastInput') === 'keyboard') {
                        this.#player.ui.disableAutoHide();
                        this.#player.ui.show();
                    }
                },
                focusout: () => {
                    const active = document.activeElement;
                    if (!this.#dom.controller.contains(active)) this.#player.ui.enableAutoHide();
                }
            },
            _nodes: [{
                className: 'vip-controller-inner',
                _nodes: [{
                    _ref: 'top',
                    className: 'vip-controller-top'
                }, {
                    _ref: 'buttons',
                    className: 'vip-controller-buttons',
                    _nodes: [{
                        _ref: 'left',
                        className: 'vip-controller-buttons-left'
                    }, {
                        _ref: 'center',
                        className: 'vip-controller-buttons-center'
                    }, {
                        _ref: 'right',
                        className: 'vip-controller-buttons-right'
                    }]
                }]
            }]
        }, parent.getElement());

        this.#subscriptions = [
            ['dom/beforemount', this.#sortButtons],
            ['ui/show', this.#show],
            ['ui/hide', this.#hide],
            ['ui/resize', this.resize],
            ['data/ready', this.resize]
        ].map(([event, handler]) => this.#player.subscribe(event, handler));
    }

    /**
     * Sorts child nodes of a container according to data-sort logic.
     * @listens module:src/core/Dom#dom/beforemount
     */
    #sortButtons = () => {

        sortElements(this.#dom.left);
        sortElements(this.#dom.center);
        sortElements(this.#dom.right, 'sorted-last');

    };

    /**
     * As soon as the UI is shown, show the controller as well.
     * @listens module:src/ui/UI#ui/show
     */
    #show = () => {

        this.#dom.controller.classList.remove('is-hidden');
        this.resize();

    };

    /**
     * As soon as the UI is hidden, hide the controller as well.
     * @listens module:src/ui/UI#ui/hide
     */
    #hide = () => {

        this.#dom.controller.classList.add('is-hidden');
        this.#rootEle.style.setProperty('--vip-ui-blocked-bottom', '-1px');

    };

    /**
     * On resize, update the space the controller blocks at the bottom of the player viewport.
     * @listens module:src/ui/UI#ui/resize
     */
    resize = () => {

        const doResize = () => {
            if (this.#dom.controller.classList.contains('is-hidden')) return;
            const height = this.#player.getState('ui.playerHeight') - this.#dom.controller.offsetTop;
            this.#rootEle.style.setProperty('--vip-ui-blocked-bottom', `${height}px`);
        };

        clearTimeout(this.#resizeId);
        this.#resizeId = setTimeout(doResize, 100);
    };

    /**
     * Used by child components to retrieve a container element they can attach.
     * @param   {'left'|'center'|'right'} area  Which logical area to retrieve.
     * @returns {HTMLElement}                   A reference to the container DOM node.
     */
    getElement(area) {

        return this.#dom[area] || this.#dom.controller;

    }

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        clearTimeout(this.#resizeId);
        this.#dom.destroy();
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#dom = null;

    }
}
