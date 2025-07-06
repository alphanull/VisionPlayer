import DomSmith from '../../lib/dom/DomSmith.js';

/**
 * The Notifications component provides a centralized UI for showing messages triggered by the player or other components.
 * It supports different notification types (e.g., `info`, `warning`, `error` or `success`), custom content nodes, and optional auto-hide behavior.
 * @exports module:src/ui/Notifications
 * @requires lib/dom/DomSmith
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class Notifications {
    /**
     * Holds the *instance* configuration for this component.
     * @type     {Object}
     * @property {boolean} [showFileOnError=false]     Shows the media file name in errors.
     * @property {boolean} [showMessageOnError=false]  Show additional message in errors, useful for debugging.
     */
    #config = {
        showFileOnError: false,
        showMessageOnError: false
    };

    /**
     * Reference to the main player instance.
     * @type {module:src/core/Player}
     */
    #player;

    /**
     * The DomSmith instance used to create the notification UI.
     * @type {module:lib/dom/DomSmith}
     */
    #dom;

    /**
     * The DomSmith instance holding the actual notification content.
     * @type {module:lib/dom/DomSmith}
     */
    #contentDom;

    /**
     * Holds tokens of subscriptions to player events, for later unsubscribe.
     * @type {number[]}
     */
    #subscriptions;

    /**
     * Internal queue of notifications to show.
     * @type {module:src/ui/Notifications~notificationData[]}
     */
    #notifications = [];

    /**
     * The current state of the notification: "hidden", "visible", or "hiding".
     * @type {string}
     */
    #state = 'hidden';

    /**
     * Holds the ID of the timeout which causes the notification to autohide.
     * @type {number}
     */
    #timeOutId;

    /**
     * Creates a new instance of the Notifications component.
     * @param {module:src/core/Player} player  Reference to the VisionPlayer instance.
     * @param {module:src/ui/UI}       parent  Reference to the parent instance, in this case the UI.
     */
    constructor(player, parent) {

        this.#config = player.initConfig('notifications', this.#config);

        if (!this.#config) return [false];

        this.#player = player;

        this.#dom = new DomSmith({
            _ref: 'wrapper',
            className: 'vip-notification',
            'data-sort': 10,
            role: 'alert',
            _nodes: [{
                _ref: 'content'
            }]
        }, parent.getElement());

        this.#subscriptions = [
            ['data/error', this.#onDataError],
            ['media/error', this.#onMediaError],
            ['media/canplay', this.#hide],
            ['media/play', this.#hide],
            ['notification', this.#onNotification],
            ['notification/hide', this.#onNotification]
        ].map(([event, handler]) => this.#player.subscribe(event, handler));

    }

    /**
     * Shows a notification (or queues it if there is another active). If no argument is given, tries to show the first queued item.
     * @param {module:src/ui/Notifications~notificationData} [notifyDataArg]  The notification data to show.
     */
    #show(notifyDataArg) {

        let notifyData;

        if (!notifyDataArg && !this.#notifications.length) return;

        const nextQueue = () => {

            const currentNotification = this.#notifications[0];

            if (this.#notifications.length === 1) return currentNotification; // last one

            if (currentNotification?.options?.timeout) {
                return this.#state === 'visible' ? false : currentNotification;
            }

            this.#notifications.shift();
            return nextQueue();

        };

        if (notifyDataArg) {
            notifyData = notifyDataArg;
            this.#notifications.push(notifyData);
        } else {
            if (!this.#notifications.length) return;
            notifyData = nextQueue();
            if (!notifyData) return;
        }

        if (this.#state === 'hiding') return;

        if (this.#state === 'visible' && this.#notifications.length > 1) {
            const active = this.#notifications[0];
            if (!active?.options?.timeout) this.#hide();
            return;
        }

        const { type, title, message, messageSecondary, content, options } = notifyData;

        let className;

        switch (type) {
            case 'error':
                className = 'error';
                this.#dom.wrapper.setAttribute('aria-live', 'assertive');
                break;
            case 'warning':
                className = 'warning';
                this.#dom.wrapper.setAttribute('aria-live', 'assertive');
                break;
            case 'success':
                className = 'success';
                this.#dom.wrapper.setAttribute('aria-live', 'polite');
                break;
            case 'info':
            default:
                className = 'info';
                this.#dom.wrapper.setAttribute('aria-live', 'polite');
                break;
        }

        this.#dom.wrapper.className = `vip-notification ${className}`;

        this.#contentDom?.destroy();

        this.#contentDom = new DomSmith([{
            _ref: 'title',
            _tag: 'h3',
            className: title ? '' : 'is-hidden',
            _nodes: [{ _ref: 'titleText', _text: title }]
        }, {
            _ref: 'message',
            _tag: 'p',
            className: message ? '' : 'is-hidden',
            _nodes: [{ _ref: 'messageText', _text: message }]
        }, {
            _ref: 'messageSecondary',
            _tag: 'p',
            className: messageSecondary ? 'is-secondary' : 'is-hidden',
            _nodes: [{ _ref: 'messageSecondaryText', _text: messageSecondary }]
        }, {
            _ref: 'customContent'
        }], this.#dom.wrapper);

        if (content) this.#dom.customContent.appendChild(content); // TODO!!!!

        this.#state = 'visible';

        requestAnimationFrame(() => this.#dom.wrapper.classList.add('visible'));

        if (options?.timeout) {
            clearTimeout(this.#timeOutId);
            this.#timeOutId = setTimeout(this.#hide, options.timeout * 1000);
        }

    }

    /**
     * Hides the notification, usually after a certain timeout
     * Notifications might also be hidden if the players recovers from an error state,
     * for example by loading another media file or if the video is playable again.
     * @listens module:src/core/Media#media/canplay
     * @listens module:src/core/Media#media/play
     */
    #hide = () => {

        if (!this.#notifications.length) return;

        this.#state = 'hiding';

        // this.#player.unsubscribe('media/canplay', this.#hide);
        // this.#player.unsubscribe('media/play', this.#hide);
        this.#dom.wrapper.classList.remove('visible');
        this.#dom.wrapper.addEventListener('transitionend', this.#hidden);

    };

    /**
     * Triggered when the hide transition finishes. Removes the item from the queue
     * and if any are left, tries to show the next one.
     */
    #hidden = () => {

        if (this.#state !== 'hiding') return;

        this.#state = 'hidden';

        this.#dom.wrapper.removeEventListener('transitionend', this.#hidden);
        this.#notifications.shift();

        if (this.#notifications.length) this.#show();

    };

    /**
     * Handler for media/error events. This tries to map the error code to a more user-friendly message
     * and triggers a notification with the error details.
     * @param {Object} event        The error event object.
     * @param {Object} event.error  The underlying media error.
     * @listens module:src/core/Media#media/error
     */
    #onMediaError = event => {

        const src = this.#player.getState('media.src'),
              error = event.error || event.target.error;

        let translateKey = 'unknown';

        if (error.status) {

            if (error.status >= 500) translateKey = 'serverError';
            else if (error.status >= 400) translateKey = 'accessError';

        } else {

            switch (error.code) {

                case error.MEDIA_ERR_DRM:
                    translateKey = 'drmError';
                    break;
                case error.MEDIA_ERR_ABORTED:
                    translateKey = 'aborted';
                    break;
                case error.MEDIA_ERR_NETWORK:
                    translateKey = 'networkFailed';
                    break;
                case error.MEDIA_ERR_DECODE:
                    translateKey = 'decodingError';
                    break;
                case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    translateKey = 'unsupported';
                    break;
            }

        }

        const supportMessage = this.#player.locale.t('errors.supportMessage'),
              message = this.#player.locale.t(`errors.media.${translateKey}`) + (supportMessage === 'errors.supportMessage' ? '' : supportMessage);

        let messageSecondary = '';
        if (this.#config.showMessageOnError) messageSecondary += error.message;
        if (this.#config.showFileOnError) messageSecondary += `\n${this.#player.locale.t('errors.media.fileWithError')} ${src}`;

        this.#show({ type: 'error', title: this.#player.locale.t('errors.media.header'), message, messageSecondary });

    };

    /**
     * Handler listing to data errors, invokes the show() method to display an appropriate notification.
     * @param {Object} message          A message Object.
     * @param {string} message.code     The message code ('DATA_ERR').
     * @param {string} message.message  The message to display.
     * @listens module:src/core/Data#data/error
     */
    #onDataError = ({ code, message, messageSecondary }) => {

        this.#show({
            type: 'error',
            title: this.#player.locale.t?.('errors.data.header') ?? 'Data parse error',
            message: code === 'DATA_ERR' ? this.#player.locale.t('errors.data.unknown') : message,
            messageSecondary: this.#config.showMessageOnError ? messageSecondary || (code === 'DATA_ERR' ? message : null) : null
        });

    };

    /**
     * Handler listing to notification events, invokes the show() method to display an appropriate notification.
     * @param {module:src/ui/Notifications~notificationData} notifyData  The data and configuration Object.
     * @param {string}                                       topic       Publisher topic.
     * @listens module:src/ui/Notifications#notification
     */
    #onNotification = (notifyData, topic) => {

        if (topic.includes('notification/hide')) {
            this.#hide();
            return;
        }

        if (typeof notifyData === 'undefined') return;

        this.#show({
            type: notifyData.type,
            title: notifyData.title,
            message: notifyData.message,
            messageSecondary: notifyData.messageSecondary,
            content: notifyData.content,
            options: notifyData.options
        });

    };

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        clearTimeout(this.#timeOutId);
        this.#dom.wrapper.removeEventListener('transitionend', this.#hidden);
        this.#dom.destroy();
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#dom = null;

    }

}

/**
 * Represents the data used to show a notification in the UI.
 * @typedef  {Object} module:src/ui/Notifications~notificationData
 * @property {string}      [type]              The notification type (e.g., "error", "info", etc.).
 * @property {string}      [title]             The title of the notification.
 * @property {string}      [message]           The main message body of the notification.
 * @property {string}      [messageSecondary]  Additional / secondary message text.
 * @property {HTMLElement} [content]           Optional custom DOM node to display in the notification.
 * @property {Object}      [options]           Additional options.
 * @property {number}      [options.timeout]   Time (in seconds) after which the notification auto-hides.
 */

/**
 * This event triggeres a notification to be displayed.
 * @event module:src/ui/Notifications#notification
 * @param {module:src/ui/Notifications~notificationData} notificationData  Notification data to display.
 */
