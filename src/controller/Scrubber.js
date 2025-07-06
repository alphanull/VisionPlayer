import DomSmith from '../../lib/dom/DomSmith.js';
import Looper from '../../lib/util/Looper.js';

/**
 * The Scrubber component provides interactive navigation through the media by allowing users to click or drag to seek.
 * It includes a visual representation of both the buffered and played media ranges.
 * The component adapts to live streams by hiding itself when seeking is not applicable.
 * @exports module:src/controller/Scrubber
 * @requires lib/dom/DomSmith
 * @requires lib/util/Looper
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class Scrubber {

    /**
     * Holds the instance configuration for this component.
     * @type     {Object}
     * @property {string}  [placement='top']            Where to place the scrubber, either on 'top' or centered in the 'buttons' bar. The latter results in a more compact layout.
     * @property {boolean} [continuousUpdate=false]     Enables continuous seeking while dragging. Since this can be quite laggy on network connections, this setting is more suitable for playing local files.
     * @property {boolean} [continuousUpdateBlob=true]  Enables continuous seeking while dragging for blob media sources, even if `continuousUpdate` is false.
     * @property {boolean} [showBuffered=true]          If set, shows buffered ranges on the scrubber.
     * @property {boolean} [showPlayed=true]            If set, shows played ranges on the scrubber.
     */
    #config = {
        placement: 'top',
        continuousUpdate: false,
        continuousUpdateBlob: true,
        showBuffered: true,
        showPlayed: true
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
     * Reference to the DomSmith Instance for the scrubber.
     * @type {module:lib/dom/DomSmith}
     */
    #dom;

    /**
     * Holds the canvas context of the buffered / played element.
     * @type {CanvasRenderingContext2D}
     */
    #canvasContext;

    /**
     * ResizeObserver instance used to track size changes of the scrubber element.
     * @type {ResizeObserver}
     */
    #resizeObserver;

    /**
     * Holds the actual width of the scrubber (in pixels).
     * @type {number}
     */
    #scrubberWidth = 0;

    /**
     * Holds the actual height of the scrubber (in pixels).
     * @type {number}
     */
    #scrubberHeight = 0;

    /**
     * Reference to the current media item.
     * @type {module:src/core/Media~metaData}
     */
    #current;

    /**
     * Indicates if active scrubbing takes place.
     * @type {boolean}
     */
    #isScrubbing = false;

    /**
     * Indicates if scrubber is disabled, if true no rendering takes place.
     * @type {boolean}
     */
    #isDisabled = false;

    /**
     * Render Loop Instance, used for updating the scrubber.
     * @type {module:lib/util/Looper}
     */
    #renderLoop;

    /**
     * Used to throttle seeking when seeking continuously, even with local files we don't want to seek 60x a second.
     * @type {number}
     */
    #lastSeekTime = 0;

    /**
     * Updated once when dragging starts, so we dont need to calculate this value again when moving the thumbnail.
     * @type {number}
     */
    #scrubOffsetLeft;

    /**
     * Saved thumbnail width for later positioning, updated when resize occurs.
     * @type {number}
     */
    #thumbWidth;

    /**
     * Holds the last saved time when user is navigating via keyboard.
     * Used for updateing the scrubber after the user has released the key,
     * and also prevwents event processing when the input just entered focus.
     * @type {number}
     */
    #keyDownBufferedTime = -1;

    /**
     * Creates an instance of the Scrubber component.
     * @param  {module:src/core/Player}           player            Reference to the VisionPlayer instance.
     * @param  {module:src/controller/Controller} parent            Reference to the parent instance, in this case the controller.
     * @param  {Object}                           [options]         Additional options.
     * @param  {symbol}                           [options.apiKey]  Token for extended access to the player API.
     * @throws {Error}                                              If trying to disable this component.
     */
    constructor(player, parent, { apiKey }) {

        this.#config = player.initConfig('scrubber', this.#config);

        if (!this.#config) return [false];

        this.#player = player;
        this.#parent = parent;
        this.#apiKey = apiKey;
        this.#renderLoop = new Looper(this.#render);

        this.#dom = new DomSmith({
            _ref: 'wrapper',
            className: 'vip-scrubber',
            pointerdown: this.#onScrubberStart,
            _nodes: [{
                _ref: 'position',
                className: 'vip-scrubber-position',
                _nodes: [{
                    className: 'vip-scrubber-position-inner'
                }]
            }, {
                _tag: 'input',
                _ref: 'input',
                className: 'vip-scrubber-input',
                ariaLabel: this.#player.locale.t('misc.scrubber'),
                'aria-valuetext': this.#player.locale.getLocalizedTime(0),
                type: 'range',
                $rangeFixDisable: true,
                min: 0,
                max: 1,
                step: 3,
                keydown: this.#onInputKeyDown,
                keyup: this.#onInputKeyUp
            }, {
                _ref: 'buffered',
                _tag: 'canvas',
                className: 'vip-scrubber-buffered',
                ariaHidden: true
            }]
        }, parent.getElement(this.#config.placement === 'buttons' ? 'center' : 'top'));

        this.#canvasContext = this.#dom.buffered.getContext('2d');

        this.#subscriptions = [
            ['data/nomedia', this.#disable],
            ['media/error', this.#disable],
            ['media/canplay', this.#enable],
            ['media/ready', this.#onMediaReady],
            ['media/play', this.#onUpdateStart],
            ['media/pause', this.#onUpdateStop],
            ['media/progress', this.#render],
            ['media/seeked', this.#render],
            ['media/timeupdate', this.#onTimeUpdate],
            ['dom/ready', this.#onDomReady],
            ['ui/show', this.#onUpdateStart],
            ['ui/hide', this.#onUpdateStop]
        ].map(([event, handler]) => this.#player.subscribe(event, handler));

    }

    /**
     * Called when the entire player is ready. Sets up colors and implements resize.
     * @listens module:src/core/Dom#dom/ready
     */
    #onDomReady = () => {

        // use Resize Oberserver, if supported
        if (typeof ResizeObserver === 'undefined') {
            this.#subscriptions.push(this.#player.subscribe('ui/resize', this.#resize));
            this.#resize();
        } else {
            this.#resizeObserver = new ResizeObserver(this.#resize);
            this.#resizeObserver.observe(this.#dom.wrapper);
        }

    };

    /**
     * Sets up the scrubber as soon as the meta data is available.
     * If the current media happens to be a live stream, the scrubber is being hidden.
     * @param {module:src/core/Media~metaData} metaData  The currently selected metaData.
     * @listens module:src/core/Media#media/ready
     */
    #onMediaReady = metaData => {

        this.#current = metaData;

        if (this.#player.getState('media.liveStream')) {
            this.#dom.unmount();
            this.#parent.resize(); // TODO: should be changed later to resize observer on the controller itself
            this.#disable();
        } else {
            this.#dom.input.setAttribute('max', this.#current.duration);
            this.#dom.mount();
            this.#parent.resize();
            this.#enable();
        }

    };

    /**
     * Begins updating/rendering as soon as the UI is shown or media is played.
     * @listens module:src/ui/UI#ui/show
     * @listens module:src/core/Media#media/play
     */
    #onUpdateStart = () => {

        this.#renderLoop.stop();
        if (this.#player.getState('media.paused') === false) this.#renderLoop.start();

    };

    /**
     * Stops updating/rendering as soon as the UI is hidden or media is paused.
     * @listens module:src/ui/UI#ui/hide
     * @listens module:src/core/Media#media/pause
     */
    #onUpdateStop = () => {

        this.#renderLoop.stop();

    };

    /**
     * Keydown handler on the input element, basically simulates keyboard interaction and updates the scubber thumbnail
     * as well as the input element itself, so screenreaders are updated. Does not do anything if any non matching key is pressed.
     * @param {KeyboardEvent} event  The originating keyup event.
     * @fires module:src/controller/Scrubber#scrubber/update
     */
    #onInputKeyDown = event => {

        const { duration } = this.#current,
              currentTime = this.#keyDownBufferedTime > -1 ? this.#keyDownBufferedTime : this.#player.getState('media.currentTime');

        let offset = 0;

        switch (event.code) {
            case 'ArrowDown':
            case 'ArrowLeft':
                offset = -3;
                break;
            case 'ArrowUp':
            case 'ArrowRight':
                offset = 3;
                break;
            case 'PageDown':
                offset = -10;
                break;
            case 'PageUp':
                offset = +10;
                break;
            case 'Home':
                offset = -currentTime;
                break;
            case 'End':
                offset = duration - currentTime;
                break;
        }

        if (!offset) return;

        // clamp values
        const newTime = Math.max(0, Math.min(duration, currentTime + offset)),
              percent = newTime / duration * 100;

        if (this.#keyDownBufferedTime > -1) this.#player.publish('scrubber/update', { percent }, { async: false }, this.#apiKey);

        this.#keyDownBufferedTime = newTime;

        if (this.#config.continuousUpdate || this.#current.src.startsWith('blob:') && !this.#current.src.includes('mediasource') && this.#config.continuousUpdateBlob) {
            this.#player.media.seek(percent * duration / 100);
        }

        this.#dom.input.value = newTime;
        this.#dom.input.setAttribute('aria-valuetext', this.#player.locale.getLocalizedTime(newTime));

        this.#renderLoop.stop();
        this.#drawPosition(percent);

    };

    /**
     * Keyup handler on the input element, seeks to the last buffered position.
     * @fires module:src/controller/Scrubber#scrubber/end
     */
    #onInputKeyUp = () => {

        if (this.#keyDownBufferedTime === -1) return;

        const { duration } = this.#current,
              percent = this.#keyDownBufferedTime / duration * 100;

        this.#keyDownBufferedTime = -1;

        this.#renderLoop.start();
        this.#player.media.seek(percent * duration / 100);
        this.#player.publish('scrubber/end', { percent }, { async: false }, this.#apiKey);

    };

    /**
     * Invoked when dragging starts. Can be either a pointerdown or keyboard event or when element has keyboard focus.
     * @param {KeyboardEvent|PointerEvent} event  The event that caused the drag start. Can be either a pointerdown or keyboard event.
     * @fires module:src/controller/Scrubber#scrubber/start
     */
    #onScrubberStart = ({ clientX, pointerId }) => {

        if (this.#isDisabled) return;

        this.#isScrubbing = true;
        this.#scrubOffsetLeft = this.#dom.wrapper.getBoundingClientRect().left;

        this.#dom.wrapper.setPointerCapture(pointerId);
        this.#dom.addEvent('wrapper', 'pointermove', this.#onScrubberUpdate);
        this.#dom.addEvent('wrapper', 'pointerup', this.#onScrubberEnd);

        const relativeX = clientX - this.#scrubOffsetLeft,
              percent = Math.max(0, Math.min(100, relativeX / this.#scrubberWidth * 100));

        this.#player.publish('scrubber/start', { percent }, { async: false }, this.#apiKey);

        this.#drawPosition(percent);

    };

    /**
     * Invoked by the scrubber range slider when dragging is in progress or scrubber is triggered by keyboard.
     * @param {InputEvent} event  The input event that caused the drag start.
     * @fires module:src/controller/Scrubber#scrubber/update
     */
    #onScrubberUpdate = ({ clientX }) => {

        const now = performance.now(),
              relativeX = clientX - this.#scrubOffsetLeft,
              percent = Math.max(0, Math.min(100, relativeX / this.#scrubberWidth * 100)),
              shouldSeek = this.#config.continuousUpdate || this.#config.continuousUpdateBlob && this.#current.src.startsWith('blob:') && !this.#current.src.includes('mediasource');

        // throttle continuous seeks to 100ms to avoid seek overload
        if (shouldSeek && now - this.#lastSeekTime > 30) {
            this.#player.media.seek(this.#current.duration * percent / 100);
            this.#lastSeekTime = now;
        }

        this.#player.publish('scrubber/update', { percent }, { async: false }, this.#apiKey);

        this.#drawPosition(percent);

    };

    /**
     * Invoked when dragging the scrubber ends or a keyup event occurs.
     * @param {KeyboardEvent|PointerEvent} event  The event that caused the drag end. Can be either a pointerup or keyboard event.
     * @fires module:src/controller/Scrubber#scrubber/end
     */
    #onScrubberEnd = ({ clientX, pointerId }) => {

        this.#isScrubbing = false;

        this.#dom.wrapper.releasePointerCapture(pointerId);
        this.#dom.removeEvent('wrapper', 'pointermove');
        this.#dom.removeEvent('wrapper', 'pointerup');

        const relativeX = clientX - this.#scrubOffsetLeft,
              percent = Math.max(0, Math.min(100, relativeX / this.#scrubberWidth * 100));

        this.#player.media.seek(this.#current.duration * percent / 100);
        this.#player.publish('scrubber/end', { percent }, { async: false }, this.#apiKey);

        this.#render();

    };

    /**
     * Just updates the aria valuetext, but only if in focus.
     * @listens module:src/core/Media#media/timeupdate
     */
    #onTimeUpdate = () => {

        this.#dom.input.value = this.#player.getState('media.currentTime');
        this.#dom.input.setAttribute('aria-valuetext', this.#player.locale.getLocalizedTime(this.#dom.input.value));

    };

    /**
     * Renders the scrubber progress by drawing the buffered/played ranges on the canvas.
     * @param {null}  event  No Payload.
     * @param {Event} topic  The event topic ('media/seeked' or 'media/progress').
     * @listens module:src/core/Media#media/progress
     * @listens module:src/core/Media#media/seeked
     */
    #render = (event, topic) => {

        if (this.#isScrubbing || this.#isDisabled || !this.#player.getState('ui.visible') || this.#player.getState('media.liveStream')) return;

        const played = this.#player.getState('media.played') ?? [],
              buffered = this.#player.getState('media.buffered') ?? [],
              paused = this.#player.getState('media.paused'),
              duration = this.#current?.duration ?? this.#player.getState('media.duration'),
              w = this.#scrubberWidth,
              h = this.#scrubberHeight;

        let x1, x2;

        if (this.#config.showPlayed || this.#config.showBuffered) this.#canvasContext.clearRect(0, 0, w, h);

        if (this.#config.showPlayed) {

            // show played ranges
            this.#canvasContext.fillStyle = 'rgba(150, 150, 150, 0.34)';

            let j = played.length;

            while ((j -= 1) > -1) {
                x1 = Math.round(played.start(j) / duration * w);
                x2 = Math.round(played.end(j) / duration * w);
                this.#canvasContext.fillRect(x1, 0, x2 - x1, h);
            }

        }

        if (this.#config.showBuffered) {

            // show buffered ranges
            this.#canvasContext.fillStyle = 'rgba(100, 100, 100, 0.25)';

            let i = buffered.length;

            while ((i -= 1) > -1) {
                x1 = Math.round(buffered.start(i) / duration * w);
                x2 = Math.round(buffered.end(i) / duration * w);
                this.#canvasContext.fillRect(x1, 0, x2 - x1, h);
            }

        }

        if (paused && topic !== 'media/seeked') return;

        this.#drawPosition();

    };

    /**
     * Positions the scrubber 'thumb' in the range input by setting the current time.
     * @param {number} [percent]  The scrubber position in percent. If not defined value will be calculated from currentTime and duration.
     */
    #drawPosition(percent) {

        const current = this.#player.getState('media.currentTime'),
              duration = this.#current?.duration ?? this.#player.getState('media.duration'),
              perc = typeof percent === 'undefined' ? current / duration : percent / 100;

        this.#dom.position.style.transform = `translateX(${(this.#scrubberWidth - this.#thumbWidth) * perc}px)`;

    }

    /**
     * Invoked when window resizes. Sets the scrubber width value accordingly.
     * @param {ResizeObserverEntry[]} [entries]  The entries if using ResizeObserver, otherwise `undefined`.
     */
    #resize = entries => {

        const rect = entries?.[0]?.contentRect ?? {},
              height = rect.height ?? this.#dom.wrapper.clientHeight,
              width = rect.width ?? this.#dom.wrapper.clientWidth;

        this.#thumbWidth = this.#dom.position.clientWidth;
        this.#dom.buffered.height = this.#scrubberHeight = height;
        this.#dom.buffered.width = this.#scrubberWidth = width;

        this.#render();

    };

    /**
     * This method enables the scrubber.
     * @listens module:src/core/Media#media/canplay
     */
    #enable = () => {

        this.#onUpdateStart();
        this.#dom.wrapper.classList.remove('is-disabled');
        this.#isDisabled = this.#dom.input.disabled = false;
        this.#drawPosition();

    };

    /**
     * This method disables the scrubber, for example after an error occurred.
     * @listens module:src/core/Media#media/error
     * @listens module:src/core/Data#data/nomedia
     */
    #disable = () => {

        this.#onUpdateStop();
        this.#dom.wrapper.classList.add('is-disabled');
        this.#isDisabled = this.#dom.input.disabled = true;

    };

    /**
     * Returns the wrapper element for the scrubber.
     * @returns {HTMLElement} The wrapper element of the scrubber.
     */
    getElement() {

        return this.#dom.wrapper;

    }

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        this.#renderLoop.destroy();
        this.#resizeObserver?.disconnect();
        this.#dom.destroy();
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#dom = this.#parent = this.#resizeObserver = this.#canvasContext = this.#apiKey = this.#renderLoop = null;

    }

}

/**
 * This event is fired when user starts scrubbing.
 * @event module:src/controller/Scrubber#scrubber/start
 * @param {Object} position  Scrubber Position.
 * @param {number} percent   Scrubber Position in percent, ranging from 0-100.
 */

/**
 * This event is fired while user is scrubbing.
 * @event module:src/controller/Scrubber#scrubber/update
 * @param {Object} position  Scrubber Position.
 * @param {number} percent   Scrubber Position in percent, ranging from 0-100.
 */

/**
 * This event is fired when user stops scrubbing.
 * @event module:src/controller/Scrubber#scrubber/end
 * @param {Object} position  Scrubber Position.
 * @param {number} percent   Scrubber Position in percent, ranging from 0-100.
 */
