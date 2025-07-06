import DomSmith from '../../lib/dom/DomSmith.js';

/**
 * The UI component serves as the parent container for all UI-related elements within the video player.
 * It manages the display of the interface by providing auto-hide and show functionality based on user interactions and timeouts.
 * Additionally, it implements basic responsive design features, allowing CSS and other components to adapt the layout based on viewport size changes.
 * @exports module:src/ui/UI
 * @requires lib/dom/DomSmith
 * @author  Frank Kudermann - alphanull
 * @version 1.0.0
 * @license MIT
 */
export default class UI {

    /**
     * Holds the instance configuration for this component.
     * @type     {Object}
     * @property {boolean} [alwaysVisible=false]   If `true`, the UI never auto-hides.
     * @property {number}  [autoHide=5]            Time (in seconds) after which the UI auto-hides (0 disables).
     * @property {boolean} [clickToPlay=true]      If `true`, clicking on the video element toggles play/pause.
     * @property {boolean} [showScaleSlider=true]  If `true`, the UI scale slider is shown in the settings popup.
     * @property {number}  [uiScale=1]             Initial scale factor for the UI.
     */
    #config = {
        alwaysVisible: false,
        autoHide: 5,
        clickToPlay: true,
        showScaleSlider: true,
        uiScale: 1
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
     * The root element in which the UI is placed.
     * @type {HTMLElement}
     */
    #rootEle;

    /**
     * DomSmith instance for the settings menu slider.
     * @type {module:lib/dom/DomSmith|undefined}
     */
    #menu;

    /**
     * Reference to the settings popup component.
     * @type {module:lib/dom/DomSmith|undefined}
     */
    #settingsPopup;

    /**
     * Reflects the state of the UI.
     * @type     {Object}
     * @property {string}         state         The UI's current state: 'visible' or 'hidden'.
     * @property {boolean|string} hasFocus      Reflects whether the video player currently has focus and which type of element has focus.
     * @property {number}         playerWidth   Current known width of the player's container.
     * @property {number}         playerHeight  Current known height of the player's container.
     * @property {string}         lastInput     Type of last user interaction: `mouse`or `touch`.
     */
    #state = {
        visibility: '',
        hasFocus: true,
        playerWidth: 0,
        playerHeight: 0,
        lastInput: ''
    };

    /**
     * Resize Observer, used for resize functionality (uses standard resize event if API not available).
     * @type {ResizeObserver}
     */
    #resizeObserver;

    /**
     * Flag indicating that the next tap is only meant to reveal the UI.
     * @type {boolean}
     */
    #suppressNextTouch = false;

    /**
     * The ID for a pending hide timer.
     * @type {number}
     */
    #hideTimeOutId;

    /**
     * Flag indicating if the UI is initialized.
     * @type {boolean}
     */
    #initialized = false;

    /**
     * Creates an instance of the UI component.
     * @param {module:src/core/Player} player            Reference to the VisionPlayer instance.
     * @param {module:src/core/Player} parent            Reference to the parent instance.
     * @param {Object}                 [options]         Additional options.
     * @param {symbol}                 [options.apiKey]  Token for extended access to the player API.
     */
    constructor(player, parent, { apiKey }) {

        this.#config = player.initConfig('ui', this.#config);

        if (!this.#config) return [false];

        this.#apiKey = apiKey;

        this.#player = player;

        this.#player.setState('ui.visible', { get: () => this.#state.visibility === 'visible' }, this.#apiKey);
        this.#player.setState('ui.hasFocus', { get: () => this.#state.hasFocus }, this.#apiKey);
        this.#player.setState('ui.lastInput', { get: () => this.#state.lastInput }, this.#apiKey);
        this.#player.setState('ui.playerWidth', { get: () => this.#state.playerWidth }, this.#apiKey);
        this.#player.setState('ui.playerHeight', { get: () => this.#state.playerHeight }, this.#apiKey);

        this.#player.setApi('ui.hide', this.#hide, this.#apiKey);
        this.#player.setApi('ui.show', this.#show, this.#apiKey);
        this.#player.setApi('ui.disableAutoHide', this.#disableAutoHide, this.#apiKey);
        this.#player.setApi('ui.enableAutoHide', this.#enableAutoHide, this.#apiKey);

        this.#rootEle = player.dom.getElement(apiKey);
        this.#rootEle.addEventListener('keydown', this.#onInput);
        this.#rootEle.addEventListener('pointerdown', this.#onInput);

        // focus helper to determine if player is in focus
        // (for example, could be used it with keyboard navigation)
        this.#rootEle.addEventListener('focus', this.#onFocus, true);
        document.addEventListener('focus', this.#onFocus, true);

        this.#subscriptions = [
            this.#player.subscribe('dom/ready', this.#onDomReady),
            this.#player.subscribe('data/ready', this.#onDataReady),
            this.#player.subscribe('popup/show', this.#disableAutoHide),
            this.#player.subscribe('popup/hidden', this.#enableAutoHide)
        ];

        // use ResizeObserver, if supported
        if (typeof ResizeObserver === 'undefined') window.addEventListener('resize', this.#resize);
        else {
            this.#resizeObserver = new ResizeObserver(this.#resize);
            this.#resizeObserver.observe(this.#rootEle);
        }

    }

    /**
     * Called when the player has fully initialized to set up UI.
     * @listens module:src/core/Dom#dom/ready
     */
    #onDomReady = () => {

        // check if we have the settings menu available for additional UI
        this.#settingsPopup = this.#player.getComponent('ui.controller.popupSettings', this.#apiKey);

        if (this.#config.showScaleSlider && this.#settingsPopup) {
            this.#menu = new DomSmith({
                _ref: 'menu',
                className: 'vip-menu',
                _nodes: [{
                    _tag: 'label',
                    _nodes: [
                        {
                            _tag: 'span',
                            className: 'form-label-text',
                            _nodes: [
                                this.#player.locale.t('misc.uiScale'),
                                {
                                    _ref: 'scaleLabel',
                                    _text: ` (x${this.#config.uiScale})`
                                }
                            ]
                        }, {
                            _tag: 'input',
                            _ref: 'slider',
                            type: 'range',
                            min: 0,
                            max: 2,
                            step: 0.1,
                            value: this.#config.uiScale >= 1 ? this.#config.uiScale : 0.5 + this.#config.uiScale / 2,
                            ariaLabel: this.#player.locale.t('misc.uiScale'),
                            className: 'has-center-line',
                            change: this.#setUiScale
                        }
                    ]
                }]
            }, { ele: this.#settingsPopup.getElement('bottom'), insertMode: 'top' });
        }
    };

    /**
     * Called when the data is ready to set up UI.
     * @listens module:src/core/Data#data/ready
     */
    #onDataReady = () => {

        if (!this.#initialized) {
            this.#enable();
            if (!this.#resizeObserver) this.#resize();
            this.#initialized = true;
        }

    };

    /**
     * Sets the UI scale.
     * @param {InputEvent} event  The input event which called this handler.
     */
    #setUiScale = ({ target }) => {

        let value = Number(target.value);
        value = value >= 1 ? value : 0.5 + value / 2;
        this.#menu.scaleLabel.textContent = ` (x${value})`;
        this.#menu.slider.setAttribute('aria-valuetext', `x${value}`);
        this.#rootEle.style.setProperty('--vip-ui-scale', value);
        this.#player.publish('ui/resize', { width: this.#state.playerWidth, height: this.#state.playerHeight }, this.#apiKey);

    };

    /**
     * Handles toggle between play and pause when the user interacts with the UI.
     * On touch devices, the first tap reveals the UI without toggling playback.
     * The second tap (while UI is visible) will then toggle play/pause as expected.
     * @param {PointerEvent} event  The pointerdown event that triggered the handler.
     */
    #onTogglePlay = ({ pointerType, target }) => {

        if (pointerType === 'touch' && this.#suppressNextTouch) {
            this.#suppressNextTouch = false;
            return;
        }

        this.#suppressNextTouch = false;

        if (target !== this.#rootEle && !target.classList.contains('click-through')) return;

        if (this.#player.getState('media.paused')) this.#player.media.play();
        else this.#player.media.pause();

    };

    /**
     * Fires "ui/show" event, and removes the "hidden" class from the UI wrapper element.
     * @param {Event} event  The event which called this handler.
     * @fires module:src/ui/UI#ui/show
     */
    #show = event => {

        if (event && event.pointerType === 'touch' && this.#state.visibility !== 'visible') {
            this.#suppressNextTouch = true;
        }

        this.#state.visibility = 'visible';
        this.#rootEle.classList.remove('ui-hidden');
        this.#player.publish('ui/show', this.#apiKey);

    };

    /**
     * Fires "ui/hide" event, and adds a "hidden" class to the UI wrapper element.
     * @param {Event} event  The event which called this handler.
     * @fires module:src/ui/UI#ui/hide
     */
    #hide = ({ relatedTarget } = {}) => {

        if (typeof relatedTarget !== 'undefined' && (relatedTarget === null || relatedTarget.tagName === 'SELECT')) return;

        if (this.#state.visibility === 'visible') {
            this.#state.visibility = 'hidden';
            this.#rootEle.classList.add('ui-hidden');
            this.#player.publish('ui/hide', this.#apiKey);
        }
    };

    /**
     * Enables "autohide" funtionality. Might be called via the player API, for example to enable autohiding again when a popup is closed.
     * @listens module:src/util/PopupWrapper#popup/hide
     */
    #enableAutoHide = () => {

        if (this.#config.alwaysVisible || this.#config.autoHide <= 0) return;

        this.#rootEle.addEventListener('pointerdown', this.#onRefreshTimer);
        this.#rootEle.addEventListener('pointermove', this.#onRefreshTimer);
        clearTimeout(this.#hideTimeOutId);
        this.#hideTimeOutId = setTimeout(this.#hide, this.#config.autoHide * 1000);

    };

    /**
     * Disables "autohide" funtionality. Might be called via the player API, for example to prevent autohiding when a popup is open.
     * @listens module:src/util/PopupWrapper#popup/show
     */
    #disableAutoHide = () => {

        if (this.#config.alwaysVisible || this.#config.autoHide <= 0) return;

        this.#rootEle.removeEventListener('pointerdown', this.#onRefreshTimer);
        this.#rootEle.removeEventListener('pointermove', this.#onRefreshTimer);
        clearTimeout(this.#hideTimeOutId);

    };

    /**
     * Enables (auto)hiding and clickToPlay.
     * @fires module:src/ui/UI#ui/enabled
     */
    #enable() {

        this.#enableClickPlay();

        if (!this.#config.alwaysVisible) {

            if (this.#config.autoHide > 0) this.#enableAutoHide();

            this.#rootEle.addEventListener('pointerdown', this.#show);
            this.#rootEle.addEventListener('pointerenter', this.#show);
            this.#rootEle.addEventListener('pointerleave', this.#hide);

        } else if (!this.#player.getConfig('media.autoPlay') || this.#config.alwaysVisible) {

            this.#show();

        }

        this.#rootEle.classList.remove('is-disabled');
        this.#player.publish('ui/enabled', this.#apiKey);

    }

    /**
     * Disables (auto)hiding and clickToPlay.
     * @fires module:src/ui/UI#ui/disabled
     */
    #disable() {

        clearTimeout(this.#hideTimeOutId);

        this.#hide();
        this.#disableClickPlay();
        this.#disableAutoHide();

        this.#rootEle.removeEventListener('pointerdown', this.#show);
        this.#rootEle.removeEventListener('pointerenter', this.#show);
        this.#rootEle.removeEventListener('pointerleave', this.#hide);
        this.#rootEle.classList.add('is-disabled');

        this.#player.unsubscribe('media/canplay', this.#enableClickPlay);
        this.#player.publish('ui/disabled', this.#apiKey);

    }

    /**
     * Enables the "click to play" functionality. This method listens to canplay events inorder to restore a usable state again
     * when the player recovered from a media error (for example by loading another file).
     * @listens module:src/core/Media#media/canplay
     */
    #enableClickPlay = () => {

        if (!this.#config.clickToPlay) return;

        this.#rootEle.classList.add('is-clickable');
        this.#rootEle.addEventListener('pointerup', this.#onTogglePlay, { capture: true });

        this.#player.unsubscribe('media/canplay', this.#enableClickPlay);
        this.#player.subscribe('media/error', this.#disableClickPlay);

    };

    /**
     * Disables "click to play" funtionality.
     * @listens module:src/core/Media#media/error
     */
    #disableClickPlay = () => {

        if (!this.#config.clickToPlay) return;

        this.#rootEle.classList.remove('is-clickable');
        this.#rootEle.removeEventListener('pointerup', this.#onTogglePlay, { capture: true });

        this.#player.unsubscribe('media/error', this.#disableClickPlay);
        this.#player.subscribe('media/canplay', this.#enableClickPlay);

    };

    /**
     * Resets the UI auto-hide timer on pointer interactions.
     */
    #onRefreshTimer = () => {

        clearTimeout(this.#hideTimeOutId);
        this.#hideTimeOutId = setTimeout(this.#hide, this.#config.autoHide * 1000);
        if (this.#state.visibility !== 'visible') this.#show();

    };

    /**
     * Helper function called when the videoplayer has focus. Used mainly for determining if the playerr should process keyboard events.
     */
    #onFocus = () => {

        const isShadow = this.#player.getConfig('dom.shadow'),
              target = isShadow ? this.#rootEle.parentNode.activeElement : document.activeElement;

        this.#state.hasFocus = false;

        if (this.#rootEle.contains(target)) {
            this.#state.hasFocus = true;
            if (target.tagName === 'SELECT') this.#state.hasFocus = 'select';
            else if (target.tagName === 'BUTTON') this.#state.hasFocus = 'button';
            else if (target.tagName === 'INPUT') this.#state.hasFocus = target.type === 'range' ? 'slider' : 'input';
        }

    };

    /**
     * Reacts to pointerdown and keyboard events to determine
     * the last input method, which is exposed on the players state.
     * @param {PointerEvent|KeyboardEvent} event  The pointer or keyboard event.
     */
    #onInput = event => {

        if (event.type === 'pointerdown') this.#state.lastInput = event.pointerType;
        else if (['Tab', 'ArrowLeft', 'ArrowRight'].includes(event.key)) this.#state.lastInput = 'keyboard';

    };

    /**
     * The resize handler provides basic "responsive design" functionality.
     * As the player might be a widget in a surrounding layout, the typical CSS media queries
     * don't work here. Instead, the resize method checks if the width / height of the player
     * reaches certain breakpoints, and adds appropriate classes accordingly, which in turn might be used
     * to control layout / appearance in CSS.
     * @param {ResizeObserverEntry[]} [entries]  The entries if using ResizeObserver, otherwise `undefined`.
     * @fires module:src/ui/UI#ui/resize
     */
    #resize = entries => {

        const rect = entries?.[0]?.contentRect;

        this.#state.playerWidth = rect ? rect.width : this.#rootEle.clientWidth;
        this.#state.playerHeight = rect ? rect.height : this.#rootEle.clientHeight;

        const width = this.#state.playerWidth,
              height = this.#state.playerHeight;

        const scaleMinWidth = 480,
              scaleMaxWidth = 1400;

        const isShadow = this.#player.getConfig('dom.shadow'),
              rootEle = isShadow ? this.#rootEle.parentNode.host : this.#rootEle;

        rootEle.style.setProperty('--vip-width-scale', Math.max(0, Math.min(1, (width - scaleMinWidth) / (scaleMaxWidth - scaleMinWidth))));

        this.#rootEle.classList.toggle('width-low', width < 480);
        this.#rootEle.classList.toggle('width-med', width < 600 && width >= 480);

        if (!height) return;

        this.#player.publish('ui/resize', { width, height }, this.#apiKey);

    };

    /**
     * Used by child components to retrieve a container element they can attach.
     * @returns {HTMLElement} The element designated by the component as attachable container.
     */
    getElement() {

        return this.#rootEle;

    }

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        this.#disable();

        if (this.#resizeObserver) {
            this.#resizeObserver.disconnect();
            this.#resizeObserver = null;
        } else window.removeEventListener('resize', this.#resize);

        document.removeEventListener('focus', this.#onFocus, true);
        this.#rootEle.removeEventListener('focus', this.#onFocus, true);
        this.#player.dom.getElement(this.#apiKey).removeEventListener('keydown', this.#onInput);
        this.#player.dom.getElement(this.#apiKey).removeEventListener('pointerdown', this.#onInput);
        this.#player.unsubscribe(this.#subscriptions);
        this.#player.removeApi(['ui.hide', 'ui.show', 'ui.disableAutoHide', 'ui.enableAutoHide'], this.#apiKey);
        this.#player.removeState(['ui'], this.#apiKey);
        this.#player = this.#rootEle = this.#apiKey = null;

    }

}

/**
 * This event is fired when the UI is shown.
 * @event module:src/ui/UI#ui/show
 */

/**
 * This event is fired when the UI is hidden.
 * @event module:src/ui/UI#ui/hide
 */

/**
 * This event is fired when the UI is enabled.
 * @event module:src/ui/UI#ui/enabled
 */

/**
 * This event is fired when the UI is disabled.
 * @event module:src/ui/UI#ui/disabled
 */

/**
 * Fired when the player viewport resizes, and also once when viewport is inserted in the dom.
 * @event module:src/ui/UI#ui/resize
 * @param {Object} size         New size of the player viewport.
 * @param {number} size.width   New width of the player viewport.
 * @param {number} size.height  New height of the player viewport.
 */
