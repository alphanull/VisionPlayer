import DomSmith from '../../lib/dom/DomSmith.js';
import { clamp, convertRange } from '../../lib/util/math.js';

/**
 * The Keyboard component enables keyboard shortcuts for common media controls such as play/pause, seek, and volume adjustments.
 * It also displays a contextual overlay when configured to do so.
 * This component improves accessibility and enhances usability for keyboard-centric interactions.
 * @exports module:src/controller/Keyboard
 * @requires module:lib/dom/DomSmith
 * @requires module:lib/util/math
 * @author   Frank Kudermann - alphanull
 * @version  1.0.1
 * @license  MIT
 */
export default class Keyboard {

    /**
     * Holds the instance configuration for this component.
     * @type     {Object}
     * @property {string|number} [keyPlay='Space']              Key to toggle play/pause. Can be either a string 'key' value (recommended) or the numerical 'key' value.
     * @property {string|number} [keySeekBack='ArrowLeft']      Key to seek backward. Can be either a string 'key' value (recommended) or the numerical 'key' value.
     * @property {string|number} [keySeekForward='ArrowRight']  Key to seek forward. Can be either a string 'key' value (recommended) or the numerical 'key' value.
     * @property {string|number} [keyVolumeUp='ArrowUp']        Key to increase volume. Can be either a string 'key' value (recommended) or the numerical 'key' value.
     * @property {string|number} [keyVolumeDown='ArrowDown']    Key to decrease volume. Can be either a string 'key' value (recommended) or the numerical 'key' value.
     * @property {number}        [seekStep=10]                  Number of seconds to seek.
     * @property {number}        [volumeStep=10]                Volume adjustment step in percent.
     * @property {boolean}       [overlay=true]                 Whether to show a visual overlay when pressing a matching key.
     * @property {number}        [overlayDelay=1]               Delay (in seconds) before hiding the overlay after a key is released.
     */
    #config = {
        keyPlay: 'Space',
        keySeekBack: 'ArrowLeft',
        keySeekForward: 'ArrowRight',
        keyVolumeUp: 'ArrowUp',
        keyVolumeDown: 'ArrowDown',
        seekStep: 10,
        volumeStep: 10,
        overlay: true,
        overlayDelay: 1
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
     * Reference to the player's root element.
     * @type {HTMLElement}
     */
    #rootEle;

    /**
     * DomSmith Instance representing the keyboard overlay.
     * @type {module:lib/dom/DomSmith}
     */
    #overlay;

    /**
     * Timeout ID used for hiding the overlay after a short delay.
     * @type {number}
     */
    #delayId = -1;

    /**
     * Creates an instance of the Keyboard component.
     * @param {module:src/core/Player} player            Reference to the VisionPlayer instance.
     * @param {module:src/ui/UI}       parent            Reference to the parent instance.
     * @param {Object}                 [options]         Additional options.
     * @param {symbol}                 [options.apiKey]  Token for extended access to the player API.
     */
    constructor(player, parent, { apiKey }) {

        this.#config = player.initConfig('keyboard', this.#config);

        if (!this.#config) return [false];

        this.#player = player;

        this.#rootEle = player.dom.getElement(apiKey);

        this.#overlay = new DomSmith({
            _ref: 'wrapper',
            className: 'vip-keyboard-overlay',
            ariaHidden: true,
            'aria-role': 'presentation',
            _nodes: [{
                className: 'icon-bg rewind',
                _nodes: [{ className: 'rewind icon' }]
            }, {
                className: 'icon-bg volume',
                _nodes: [{
                    _ref: 'volume1',
                    className: 'volume icon'
                }, {
                    _ref: 'volume2',
                    className: 'volume icon is-transparent'
                }]
            }, {
                className: 'icon-bg play',
                _nodes: [{
                    _ref: 'play',
                    className: 'play icon'
                }]
            }, {
                className: 'icon-bg forward',
                _nodes: [{ className: 'forward icon' }]
            }]
        }, player.dom.getElement(apiKey));

        this.#subscriptions = [
            this.#player.subscribe('media/canplay', this.#enable),
            this.#player.subscribe('media/error', this.#disable),
            this.#player.subscribe('data/nomedia', this.#disable)
        ];

        this.#enable();

    }

    /**
     * Handles the `keydown` event, mapping keys to player actions (play, pause, seek, volume).
     * @function
     * @param {KeyboardEvent} event  The native `keydown` event.
     */
    #onKeyDown = event => {

        const { code, keyCode } = event,
              hasFocus = this.#player.getState('ui.hasFocus'),
              action = Object.entries(this.#config).find(([key, value]) => key.startsWith('key') && (value === code || value === keyCode))?.[0];

        // allow space in sliders otherwise do not process key events when focus is on input or select
        if (hasFocus !== true && !(hasFocus === 'slider' && action === 'keyPlay')) return;

        const volume = this.#player.getState('media.volume'),
              liveStream = this.#player.getState('media.liveStream'),
              paused = this.#player.getState('media.paused'),
              currentTime = this.#player.getState('media.currentTime'),
              duration = this.#player.getState('media.duration');

        if (!action || liveStream && action.startsWith('keySeek')) return; // abort when no matching key found

        event.preventDefault();
        event.stopPropagation();

        let newVolume, newSeek;

        switch (action) {
            case 'keyPlay':
                if (paused) this.#player.media.play(); else this.#player.media.pause();
                break;

            case 'keySeekForward':
                newSeek = clamp(currentTime + this.#config.seekStep, 0, duration);
                this.#player.media.seek(newSeek);
                break;

            case 'keySeekBack':
                newSeek = clamp(currentTime - this.#config.seekStep, 0, duration);
                this.#player.media.seek(newSeek);
                break;

            case 'keyVolumeUp':
                newVolume = clamp(volume + this.#config.volumeStep / 100, 0, 1);
                this.#player.media.volume(newVolume);
                break;

            case 'keyVolumeDown':
                newVolume = clamp(volume - this.#config.volumeStep / 100, 0, 1);
                this.#player.media.volume(newVolume);
                break;
        }

        this.#showOverlay(action);

    };

    /**
     * Handles the `keyup` event, used primarily to trigger hiding the overlay.
     * @function
     */
    #onKeyUp = () => {

        this.#hideOverlay();

    };

    /**
     * Displays the overlay (play, volume, etc.) and updates its visuals depending on the action.
     * @param {string} action  The key action name (e.g., 'keyPlay', 'keyVolumeUp').
     */
    #showOverlay(action) {

        if (!this.#config.overlay) return;

        clearTimeout(this.#delayId);

        if (action === 'keyPlay') {
            this.#overlay.play.classList.toggle('pause', this.#player.getState('media.paused'));
            this.#overlay.play.classList.toggle('play', !this.#player.getState('media.paused'));
        }

        if (action === 'keyVolumeDown' || action === 'keyVolumeUp') {
            const vol = this.#player.getState('media.volume');
            // Maps volume [0–1] to CSS rect [90–10]%
            this.#overlay.volume1.style.clipPath = `rect(${convertRange(vol, [0, 1], [90, 10])}% 100% 100% 0)`;
            this.#overlay.volume1.classList.toggle('is-half', vol > 0 && vol <= 0.5);
            this.#overlay.volume2.classList.toggle('is-half', vol > 0 && vol <= 0.5);
            this.#overlay.volume1.classList.toggle('is-muted', vol === 0);
            this.#overlay.volume2.classList.toggle('is-muted', vol === 0);
        }

        this.#overlay.wrapper.className = `vip-keyboard-overlay is-visible ${action}`;

    }

    /**
     * Hides the overlay after the configured delay.
     */
    #hideOverlay() {

        clearTimeout(this.#delayId);
        this.#delayId = setTimeout(() => this.#overlay.wrapper.classList.remove('is-visible'), this.#config.overlayDelay * 1000);

    }

    /**
     * Enables the keyboard listeners.
     * @listens module:src/core/Media#media/canplay
     */
    #enable = () => {

        this.#disable(); // prevent adding listener twice
        this.#rootEle.addEventListener('keydown', this.#onKeyDown);
        this.#rootEle.addEventListener('keyup', this.#onKeyUp);

    };

    /**
     * Disables the keyboard listeners.
     * @listens module:src/core/Media#media/error
     * @listens module:src/core/Data#data/nomedia
     */
    #disable = () => {

        this.#rootEle.removeEventListener('keydown', this.#onKeyDown);
        this.#rootEle.removeEventListener('keyup', this.#onKeyUp);

    };

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        clearTimeout(this.#delayId);
        this.#disable();
        this.#overlay.destroy();
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#overlay = null;

    }

}
