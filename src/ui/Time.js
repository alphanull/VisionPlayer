import DomSmith from '../../lib/dom/DomSmith.js';
import Looper from '../../lib/util/Looper.js';
import convertTime from '../util/convertTime.js';

/**
 * The Time component displays the current, remaining, and total media time.
 * Users can click the time element to toggle between representations, including optional frame display and prefix indicators.
 * It dynamically updates based on playback state and disables itself during live streams or playback errors.
 * @exports module:src/ui/Time
 * @requires lib/dom/DomSmith
 * @requires lib/util/Looper
 * @requires src/util/convertTime
 * @author    Frank Kudermann - alphanull
 * @version   1.0.0
 * @license   MIT
 */
export default class Time {

    /**
     * Holds the *instance* configuration for this component.
     * @type     {Object}
     * @property {string}  [display="current"]  Initial time display mode, either "current" or "remaining".
     * @property {boolean} [showFrames=false]   Whether to display frames in the time string.
     */
    #config = {
        display: 'current',
        showFrames: false
    };

    /**
     * Reference to the main player instance.
     * @type {module:src/core/Player}
     */
    #player;

    /**
     * Reference to the DomSmith Instance for the time display.
     * @type {module:lib/dom/DomSmith}
     */
    #dom;

    /**
     * Render Loop Instance, used for updating the scrubber.
     * @type {module:lib/util/Looper}
     */
    #renderLoop;

    /**
     * Creates an instance of the Time component.
     * @param {module:src/core/Player}           player  Reference to the Visi#onPlayer instance.
     * @param {module:src/controller/Controller} parent  The parent container, in this case the controller.
     */
    constructor(player, parent) {

        this.#config = player.initConfig('time', this.#config);

        if (!this.#config) return [false];

        this.#player = player;
        this.#renderLoop = new Looper(this.#onTimeUpdate);

        this.#dom = new DomSmith({
            _ref: 'timeButton',
            _tag: 'button',
            className: `vip-controller-time ${this.#config.showFrames ? ' has-frames' : ''}`,
            'data-sort': 35,
            click: this.#onToggleTime,
            ariaLabel: `${this.#player.locale.t('misc.time')}: ${this.#player.locale.getLocalizedTime(0)}`,
            transitionend: e => {
                if (e.target === this.#dom.timeButton && !this.#dom.timeButton.classList.contains('hidden') && this.#dom.timeButton.style.cssText !== '') {
                    this.#dom.timeButton.style.cssText = '';
                }
            },
            _nodes: [{
                _tag: 'span',
                _ref: 'timePrimary',
                className: 'primary',
                ariaHidden: true,
                _nodes: [{
                    _ref: 'timePrimaryText',
                    _text: '00:00'
                }]
            }, {
                _tag: 'span',
                _ref: 'timeSeparator',
                className: 'separator',
                ariaHidden: true,
                _nodes: ['/']
            }, {
                _tag: 'span',
                _ref: 'timeSecondary',
                className: 'secondary',
                ariaHidden: true,
                _nodes: [{
                    _ref: 'timeSecondaryText',
                    _text: '00:00'
                }]
            }]
        }, parent.getElement('left'));

        this.#player.subscribe('media/ready', this.#onMediaReady);
        this.#player.subscribe('media/error', this.#disable);
        this.#player.subscribe('data/nomedia', this.#disable);

    }

    /**
     * Sets up the component as soon as the media is available. Uses a placeholder text if the stream is a Live Stream.
     * @listens module:src/core/Media#media/ready
     */
    #onMediaReady = () => {

        this.#player.unsubscribe('media/timeupdate', this.#onTimeUpdate);
        this.#player.unsubscribe('media/play', this.#onPlay);
        this.#player.unsubscribe('media/pause', this.#onPause);

        if (this.#player.getState('media.liveStream')) {
            this.#dom.timeButton.disabled = true;
            this.#dom.timeSeparator.textContent = '';
            this.#dom.timePrimaryText.nodeValue = this.#player.locale.t('misc.isLive');
            this.#dom.timeSecondaryText.nodeValue = '';
            return;
        }

        this.#player.subscribe('media/timeupdate', this.#onTimeUpdate);
        this.#dom.timeSeparator.textContent = '/';
        this.#dom.timeButton.disabled = false;

        const { h } = convertTime(this.#player.getState('media.duration'), this.#config.showFrames ? this.#player.getState('media.frameRate') : 0).smpte;

        this.#dom.timeButton.classList.toggle('has-hours', h > 0);
        this.#dom.timeButton.classList.toggle('has-hours-x2', h > 9);

        if (this.#config.showFrames) {
            // higher update frequency if frames should be displayed
            // timeupdate does not fire often enough for smooth display
            this.#player.subscribe('media/play', this.#onPlay);
            this.#player.subscribe('media/pause', this.#onPause);
        }

        this.#onTimeUpdate();

    };

    /**
     * Immediately updates time display when playback starts (and frames are shown).
     * @listens module:src/core/Media#media/play
     */
    #onPlay = () => {

        this.#renderLoop.start();

    };

    /**
     * Cancels frame-based updates when paused.
     * @listens module:src/core/Media#media/pause
     */
    #onPause = () => {

        this.#renderLoop.stop();

    };

    /**
     * Updates the time display based on the timeupdate event, or by using a requestAnimationFrame
     * if frames should be displayed as well (to get more smooth updates in this case).
     * @listens module:src/core/Media#media/timeupdate
     */
    #onTimeUpdate = () => {

        const timeText = this.#player.locale.t('misc.time'),
              remainingTime = this.#player.getState('media.remainingTime'),
              currentTime = this.#player.getState('media.currentTime'),
              duration = this.#player.getState('media.duration');

        const format = convTime => {
            const converted = convertTime(convTime, this.#config.showFrames ? this.#player.getState('media.frameRate') : 0),
                  hours = Math.round(duration / 3600),
                  hoursIndex = hours > 0 ? hours >= 10 ? 0 : 1 : 3,
                  lastIndex = this.#config.showFrames ? converted.string.length : converted.string.lastIndexOf(':');
            return converted.string.substr(hoursIndex, lastIndex - hoursIndex);
        };

        switch (this.#config.display) {
            case 'remaining':
                this.#dom.timePrimaryText.nodeValue = isNaN(remainingTime) ? '---' : format(remainingTime);
                this.#dom.timeButton.setAttribute('aria-label', `${timeText}: ${this.#player.locale.getLocalizedTime(remainingTime)}`);
                break;
            case 'current':
            default:
                this.#dom.timePrimaryText.nodeValue = isNaN(currentTime) ? '---' : format(currentTime);
                this.#dom.timeButton.setAttribute('aria-label', `${timeText}: ${this.#player.locale.getLocalizedTime(currentTime)}`);
                break;
        }

        this.#dom.timeSecondaryText.nodeValue = duration === Infinity || isNaN(duration) ? '---' : format(duration);

        if (this.#config.showFrames && !this.#player.getState('media.paused')) {
            this.#renderLoop.start();
        }

    };

    /**
     * Toggles time display mode between "current" and "remaining" after user klicked on the time display.
     */
    #onToggleTime = () => {

        this.#config.display = this.#config.display === 'remaining' ? 'current' : 'remaining';
        this.#onTimeUpdate();

    };

    /**
     * Enables the play time display. This method listens to canplay events in order to restore a usable state again
     * when the player recovered from a media error (for example by loading another file).
     * @listens module:src/core/Media#media/canplay
     */
    #enable = () => {

        this.#dom.timeButton.disabled = false;

    };

    /**
     * Disables the time display. This method listens to media error events which cause the time display to be disabled.
     * @listens module:src/core/Media#media/error
     * @listens module:src/core/Data#data/nomedia
     */
    #disable = () => {

        this.#dom.timeButton.disabled = true;

    };

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        this.#dom.destroy();
        this.#renderLoop.destroy();

        this.#player.unsubscribe('data/ready', this.onDataReady);
        this.#player.unsubscribe('data/error', this.#disable);
        this.#player.unsubscribe('media/ready', this.#onMediaReady);
        this.#player.unsubscribe('media/error', this.#disable);
        this.#player.unsubscribe('media/canplay', this.#enable);
        this.#player.unsubscribe('media/timeupdate', this.#onTimeUpdate);
        this.#player.unsubscribe('media/play', this.#onPlay);
        this.#player = this.#dom = null;

    }

}
