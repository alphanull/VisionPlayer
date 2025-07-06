import DomSmith from '../../lib/dom/DomSmith.js';

/**
 * The Spinner component displays a "busy" animation when the player stalls—typically due to an empty buffer or network-related delay.
 * It appears with a configurable delay to avoid flickering during short interruptions.
 * The spinner listens to player stall events as well as manually published control events.
 * @exports module:src/ui/Spinner
 * @requires lib/dom/DomSmith
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class Spinner {

    /**
     * Holds the instance configuration for this component.
     * @type     {Object}
     * @property {number} [delay=1]  Delay (in seconds) after which the spinner animation is shown. Used to prevent superfluous showing when the stall period is very short.
     */
    #config = {
        delay: 1
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
     * A DomSmith instance used to create the spinner DOM.
     * @type {module:lib/dom/DomSmith}
     */
    #dom;

    /**
     * Spinner state (i.e. "visible" or "hidden") is stored here. Used to prevent double triggering hide() or show().
     * @type {string}
     */
    #state;

    /**
     * Holds the setTimeout id.
     * @type {number}
     */
    #timeOutId;

    /**
     * Creates an instance of the Spinner component.
     * @param {module:src/core/Player} player  Reference to the VisionPlayer instance.
     * @param {module:src/ui/UI}       parent  Reference to the parent instance, in this case the UI.
     */
    constructor(player, parent) {

        this.#config = player.initConfig('spinner', this.#config);

        if (!this.#config) return [false];

        this.#player = player;
        this.#state = '';

        this.#dom = new DomSmith({
            _ref: 'wrapper',
            className: 'vip-spinner is-hidden',
            ariaHidden: true,
            'aria-role': 'presentation',
            _nodes: [{
                className: 'vip-spinner-wrapper',
                _nodes: [
                    { className: 'vip-spinner-item vip-spinner-item-1' },
                    { className: 'vip-spinner-item vip-spinner-item-2' }
                ]
            }]

        }, parent.getElement());

        this.#subscriptions = [
            ['media/stall/begin', this.#show],
            ['media/stall/end', this.#hide],
            ['spinner/show', this.#show],
            ['spinner/hide', this.#hide]
        ].map(([event, handler]) => this.#player.subscribe(event, handler));

    }

    /**
     * Shows the spinner after the configured delay, if not already visible.
     * @listens module:src/core/Media#media/stall/begin
     * @listens module:src/ui/Spinner#spinner/show
     */
    #show = () => {

        if (this.#state === 'visible') return;

        this.#state = 'visible';

        const doShow = () => this.#dom.wrapper.classList.remove('is-hidden');

        if (this.#config.delay) {
            clearTimeout(this.#timeOutId);
            this.#timeOutId = setTimeout(doShow, this.#config.delay * 1000);
        } else doShow();

    };

    /**
     * Hides the spinner, if not already hidden.
     * @listens module:src/core/Media#media/stall/end
     * @listens module:src/ui/Spinner#spinner/hide
     */
    #hide = () => {

        if (this.#state === 'hidden') return;

        this.#state = 'hidden';

        const doHide = () => this.#dom.wrapper.classList.add('is-hidden');

        if (this.#config.delay) {
            clearTimeout(this.#timeOutId);
            this.#timeOutId = setTimeout(doHide, this.#config.delay * 1000);
        } else doHide();

    };

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        clearTimeout(this.#timeOutId);
        this.#dom.destroy();
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#dom = null;

    }

}

/**
 * The Spinner component listens for this event to show the spinner.
 * @event module:src/ui/Spinner#spinner/show
 */

/**
 * The Spinner component listens for this event to hide the spinner.
 * @event module:src/ui/Spinner#spinner/hide
 */
