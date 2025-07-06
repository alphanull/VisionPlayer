import DomSmith from '../../lib/dom/DomSmith.js';

/**
 * The Loop component provides a simple button that allows the user to toggle the media's loop state in the settings menu.
 * It listens to the player's loop events and updates its visual state accordingly. If the media is a live stream, the component disables itself.
 * @exports module:src/controller/Loop
 * @requires lib/dom/DomSmith
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class Loop {

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
     * DomSmith Instance representing the toggle button.
     * @type {module:lib/dom/DomSmith}
     */
    #dom;

    /**
     * Creates an instance of the Loop component.
     * @param {module:src/core/Player}           player  Reference to the VisionPlayer instance.
     * @param {module:src/controller/Controller} parent  The parent container to which the fullscreen button will be appended.
     */
    constructor(player, parent) {

        if (!player.initConfig('loopControl', true)) return [false];

        this.#player = player;
        this.#parent = parent;

        const id = this.#player.getConfig('player.id');

        this.#dom = new DomSmith({
            _tag: 'label',
            for: `loop-control-${id}`,
            _nodes: [{
                _tag: 'span',
                className: 'form-label-text',
                _nodes: this.#player.locale.t('misc.loop')
            }, {
                _ref: 'input',
                _tag: 'input',
                id: `loop-control-${id}`,
                name: `loop-control-${id}`,
                type: 'checkbox',
                className: 'is-toggle',
                change: this.#toggleLoop
            }]
        });

        this.#subscriptions = [
            ['media/ready', this.#onMediaReady],
            ['media/loop', this.#onLoopChange],
            ['media/canplay', this.#enable],
            ['media/error', this.#disable],
            ['data/nomedia', this.#disable]
        ].map(([event, handler]) => this.#player.subscribe(event, handler));

    }

    /**
     * Sets up the component as soon as the media is available. Disables display if media is a live stream.
     * @listens module:src/core/Media#media/ready
     */
    #onMediaReady = () => {

        if (this.#player.getState('media.liveStream')) this.#disable();
        else this.#enable();

    };

    /**
     * Handler which updates the loop control when the media loop state changes.
     * @listens module:src/core/Media#media/loop
     */
    #onLoopChange = () => {

        this.#dom.input.checked = this.#player.getState('media.loop');

    };

    /**
     * Invoked when the user clicks on the checkbox, toggles loop state between 'on' and 'off'.
     */
    #toggleLoop = () => {

        this.#player.media.loop(!this.#player.getState('media.loop'));

    };

    /**
     * Enables the loop button functionality. This method listens to canplay events in order to restore a usable state again
     * when the player recovered from a media error (for example by loading another file).
     * @listens module:src/core/Media#media/canplay
     */
    #enable = () => {

        if (!this.#player.getState('media.liveStream')) this.#dom.mount({ ele: this.#parent.getElement('top'), insertMode: 'top' });

    };

    /**
     * Disables the button functionality. This method listens to media error events which cause the button to be disabled.
     * @listens module:src/core/Media#media/error
     * @listens module:src/core/Data#data/nomedia
     */
    #disable = () => {

        this.#dom.unmount();

    };

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        this.#dom.destroy();
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#dom = null;

    }
}
