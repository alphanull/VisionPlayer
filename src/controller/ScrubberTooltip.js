import DomSmith from '../../lib/dom/DomSmith.js';
import Tooltip from '../../lib/ui/Tooltip.js';
import convertTime from '../util/convertTime.js';

/**
 * The ScrubberTooltip component provides a tooltip when hovering over the scrubber.
 * Tooltip shows the time indicated by the hover position, but also can act as a container
 * for other modules, like chapter or thumbnails.
 * @exports module:src/controller/ScrubberTooltip
 * @requires lib/dom/DomSmith
 * @requires lib/ui/Tooltip
 * @requires src/util/convertTime
 * @author   Frank Kudermann - alphanull
 * @version  1.0.1
 * @license  MIT
 */
export default class ScrubberTooltip {

    /**
     * Holds the instance configuration for this component.
     * @type     {Object}
     * @property {boolean} [showFrames=false]  If „true“, the tooltip also shows frames in addition (only works if frameRate information is available).
     * @property {boolean} [showTime=true]     If „true“, the tooltip shows the time at the current scrubber position.
     */
    #config = {
        showFrames: false,
        showTime: true
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
     * Secret key only known to the player instance and initialized components.
     * Used to be able to restrict access to API methods in conjunction with secure mode.
     * @type {symbol}
     */
    #apiKey;

    /**
     * Reference to the DomSmith instance for the tooltip container.
     * @type {module:lib/dom/DomSmith}
     */
    #dom;

    /**
     * Reference to the scrubber's root DOM element.
     * @type {HTMLElement}
     */
    #parentEle;

    /**
     * Tooltip instance used to display time/frame info.
     * @type {module:lib/ui/Tooltip}
     */
    #tooltip;

    /**
     * Creates an instance of the ScrubberTooltip component.
     * @param {module:src/core/Player}         player            Reference to the VisionPlayer instance.
     * @param {module:src/controller/Scrubber} parent            Reference to the parent instance, in this case the scrubber.
     * @param {Object}                         [options]         Additional options.
     * @param {symbol}                         [options.apiKey]  Token for extended access to the player API.
     */
    constructor(player, parent, { apiKey }) {

        this.#config = player.initConfig('scrubberTooltip', this.#config);

        if (!this.#config || !this.#config.showTime) return [false];

        this.#player = player;
        this.#apiKey = apiKey;

        this.#tooltip = new Tooltip({
            viewClass: 'vip-scrubber-tooltip',
            display: 'flex',
            touchMove: true,
            touchEnd: true,
            neverHideWhenPressed: true,
            limitLayout: player.getConfig('dom').layout !== 'controller-only',
            parentElement: this.#player.dom.getElement(apiKey),
            hideOnClick: false,
            constrainMoveY: true,
            delay: 250,
            onMove: this.#onTooltipMove,
            onShow: this.#onTooltipVisible,
            orientation: ['top', 'bottom']
        });

        this.#dom = new DomSmith({
            _ref: 'tooltip',
            className: 'vip-scrubber-tooltip-wrapper',
            ariaHidden: true,
            _nodes: [
                this.#config.showTime
                    ? {
                        _ref: 'time',
                        className: 'vip-scrubber-tooltip-time',
                        _nodes: ['00:00:00']
                    } : null
            ]
        }, parent.getElement());

        this.#parentEle = parent.getElement();

        this.#subscriptions = [
            this.#player.subscribe('media/ready', this.#onMediaReady)
        ];

    }

    /**
     * Sets up the scrubber as soon as the meta data is available.
     * If the current media happens to be a live stream, the scrubber is being hidden.
     * @listens module:src/core/Media#media/ready
     */
    #onMediaReady = () => {

        if (this.#player.getState('media.liveStream')) this.#disable();
        else this.#enable();

    };

    /**
     * Called when the pointer enters the scrubber area, showing the tooltip.
     * @param   {PointerEvent}      event  The pointer event that triggers showing the tooltip.
     * @returns {boolean|undefined}        Returns false if no finite duration.
     * @fires   module:src/controller/ScrubberTooltip#scrubber/tooltip/show
     */
    #onTooltipShow = event => {

        if (!isFinite(this.#player.getState('media.duration'))) return false;

        this.#player.publish('scrubber/tooltip/show', {}, { async: false }, this.#apiKey);
        this.#tooltip.show(this.#dom.tooltip, event);

    };

    /**
     * Called when the pointer leaves the scrubber area, hiding the tooltip.
     * @param {PointerEvent} event  The pointer event that triggers hiding the tooltip.
     */
    #onTooltipHidden = event => {

        this.#tooltip.hide(event);

    };

    /**
     * Called once the tooltip is fully shown, updates the time for the initial position.
     * @param {PointerEvent}         event  The originating pointer event.
     * @param {module:lib/uiTooltip} tt     The Tooltip instance.
     * @fires module:src/controller/ScrubberTooltip#scrubber/tooltip/visible
     */
    #onTooltipVisible = (event, tt) => {

        const range = (event.clientX - tt.oTargetPos.left - tt.viewPortPos.left) / tt.oTargetPos.width;
        this.#setToolTipTime(range);
        this.#player.publish('scrubber/tooltip/visible', { percent: range * 100 }, { async: false }, this.#apiKey);

    };

    /**
     * Callback, invoked by the tooltip module when it is being moved. Used to update the time display based on the tooltip position.
     * @param {PointerEvent}         event  The originating pointer event.
     * @param {module:lib/uiTooltip} tt     The Tooltip instance.
     * @fires module:src/controller/ScrubberTooltip#scrubber/tooltip/move
     */
    #onTooltipMove = (event, tt) => {

        const range = (event.clientX - tt.oTargetPos.left - tt.viewPortPos.left) / tt.oTargetPos.width;
        this.#setToolTipTime(range);
        this.#player.publish('scrubber/tooltip/move', { percent: range * 100 }, { async: false }, this.#apiKey);

    };

    /**
     * Sets the tooltip text to the correct time (or frames) based on the given fraction of duration.
     * @param {number} range  A value from 0 to 1, fraction of total duration.
     */
    #setToolTipTime = range => {

        const duration = this.#player.getState('media.duration');

        if (!this.#config.showTime || !isFinite(duration)) return;

        const seekTime = duration * Math.min(Math.max(range, 0), 1);
        this.#dom.time.textContent = convertTime(seekTime).string.substr(0, this.#config.showFrames ? 13 : 8);

    };

    /**
     * Enables the tooltip, attaching the pointerenter listener.
     */
    #enable = () => {

        this.#parentEle.addEventListener('pointerenter', this.#onTooltipShow);
        this.#parentEle.addEventListener('pointerleave', this.#onTooltipHidden);

    };

    /**
     * Disables the tooltip, removing the pointerenter listener.
     */
    #disable = () => {

        this.#parentEle.removeEventListener('pointerenter', this.#onTooltipShow);
        this.#parentEle.removeEventListener('pointerleave', this.#onTooltipHidden);

    };

    /**
     * Returns the tooltip's main container element.
     * @returns {HTMLElement} The tooltip wrapper element.
     */
    getElement() {

        return this.#dom.tooltip;

    }

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        this.#disable();
        this.#tooltip?.remove();
        this.#dom.destroy();
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#dom = this.#tooltip = this.#parentEle = this.#apiKey = null;

    }

}

/**
 * This event is fired when the tooltip is abpout being shown.
 * @event module:src/controller/ScrubberTooltip#scrubber/tooltip/show
 */

/**
 * This event is fired when the tooltip is visible.
 * @event module:src/controller/ScrubberTooltip#scrubber/tooltip/visible
 * @param {Object} position  Tooltip Position relative to scrubber.
 * @param {number} percent   Tooltip position (in percent).
 */

/**
 * This event is fired when the tooltip is moving.
 * @event module:src/controller/ScrubberTooltip#scrubber/tooltip/move
 * @param {Object} position  Tooltip Position relative to scrubber.
 * @param {number} percent   Tooltip position (in percent).
 */
