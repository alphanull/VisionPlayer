import DomSmith from '../../lib/dom/DomSmith.js';
import { isString, isObject } from '../../lib/util/object.js';

/**
 * The Thumbnails component displays preview images while scrubbing and hovering on the timeline.
 * It uses a sprite sheet or grid-based image layout to show frame-accurate thumbnails in the scrubber tooltip and a larger preview above the player if enabled.
 * The component dynamically adapts its layout and supports language-specific thumbnails when defined.
 * @exports module:src/ui/Thumbnails
 * @requires lib/dom/DomSmith
 * @requires lib/util/object
 * @author   Frank Kudermann - alphanull
 * @version  1.0.1
 * @license  MIT
 */
export default class Thumbnails {
    /**
     * Configuration options for the Thumbnails component.
     * @type     {Object}
     * @property {boolean} [showInScrubber=true]  Displays a thumbnail inside the scrubber tooltip.
     * @property {boolean} [showPreview=true]     Displays a larger preview overlay while scrubbing.
     */
    #config = {
        showInScrubber: true,
        showPreview: true
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
     * Additional subscriptions once we confirm we have thumbnails data.
     * @type {number[]}
     */
    #subs = [];

    /**
     * Secret key only known to the player instance and initialized components.
     * Used to be able to restrict access to API methods in conjunction with secure mode.
     * @type {symbol}
     */
    #apiKey;

    /**
     * If enabled, holds a DOM node for the scrubber tooltip.
     * @type {module:lib/dom/DomSmith|undefined}
     */
    #scrubber;

    /**
     * If enabled, holds a DOM node for a bigger preview while scrubbing.
     * @type {module:lib/dom/DomSmith|undefined}
     */
    #preview;

    /**
     * Holds a copy of the media data thumbnail section.
     * @type {Object}
     */
    #data;

    /**
     * Internal object storing current thumbnail info (src, dimensions, etc.).
     * @type {module:src/core/Data~mediaItem_thumbnail}
     */
    #thumb = {};

    /**
     * Reference to the tooltip component.
     * @type {module:src/controller/ScrubberTooltip}
     */
    #tooltipComp;

    /**
     * Creates an instance of the  component.
     * @param {module:src/core/Player}           player            Reference to the VisionPlayer instance.
     * @param {module:src/controller/Controller} parent            Reference to the parent instance.
     * @param {Object}                           [options]         Additional options.
     * @param {symbol}                           [options.apiKey]  Token for extended access to the player API.
     */
    constructor(player, parent, { apiKey }) {

        this.#config = player.initConfig('thumbnails', this.#config);
        this.#tooltipComp = player.getComponent('ui.controller.scrubber.tooltip', apiKey);

        if (this.#config.showInScrubber) this.#config.showInScrubber = Boolean(this.#tooltipComp);

        if (!this.#config || !this.#config.showInScrubber && !this.#config.showPreview) return [false];

        this.#player = player;
        this.#apiKey = apiKey;

        if (this.#config.showInScrubber) {
            this.#scrubber = new DomSmith({
                _ref: 'thumbWrapper',
                className: 'vip-scrubber-tooltip-thumb',
                _nodes: [{
                    _ref: 'thumbImg',
                    _tag: 'img',
                    alt: 'Thumbnail',
                    className: 'vip-scrubber-tooltip-thumb-img',
                    load: this.#onThumbLoaded,
                    error: this.#onThumbError
                }]
            });
        }

        if (this.#config.showPreview && !this.#player.getConfig('scrubber.continuousUpdate')) {
            this.#preview = new DomSmith({
                _ref: 'backdrop',
                className: 'vip-scrubber-thumb-preview is-hidden'
            }, this.#player.dom.getElement(apiKey));
        }

        this.#subscriptions = [
            this.#player.subscribe('data/ready', this.#onDataReady),
            this.#player.subscribe('media/ready', this.#onMediaReady)
        ];

    }

    /**
     * Called when the media data is ready, checks for "thumbnails" in the data, sets up events if found.
     * @param {module:src/core/Data~mediaItem}           mediaItem               Object containing media data.
     * @param {module:src/core/Data~mediaItem_thumbnail} [mediaItem.thumbnails]  The thumbnail configuration from the media data.
     * @listens module:src/core/Data#data/ready
     */
    #onDataReady = ({ thumbnails }) => {

        this.#player.unsubscribe(this.#subs);
        this.#scrubber?.thumbWrapper.classList.remove('is-visible');

        if (!thumbnails) return;

        this.#scrubber?.thumbWrapper.classList.add('is-visible');

        this.#data = thumbnails;
        this.#subs = [];

        if (this.#config.showInScrubber) {
            this.#subs.push(
                this.#player.subscribe('scrubber/tooltip/visible', this.#onThumbRender),
                this.#player.subscribe('scrubber/tooltip/move', this.#onThumbRender)
            );
        }

        if (this.#config.showPreview && !this.#player.getConfig('scrubber.continuousUpdate')) {
            this.#subs.push(
                this.#player.subscribe('scrubber/update', this.#onScrubberUpdate),
                this.#player.subscribe('scrubber/end', this.#onScrubberEnd),
                this.#player.subscribe('ui/resize', this.#resize)
            );
        }
    };

    /**
     * Called when the media is ready. If we have thumbnail data, we load the thumbnail image(s).
     * @param  {module:src/core/Media~metaData} metaData           The currently selected meta data.
     * @param  {string|Object<string,string>}   metaData.language  Possibly used if there are multiple language keys in "thumbnails.src".
     * @throws {Error}                                             If thumbnail format is invalid.
     * @listens module:src/core/Media#media/ready
     */
    #onMediaReady = ({ language, width, height }) => {

        const { thumbnails } = this.#player.data.getMediaData();

        if (!this.#config.showInScrubber || !thumbnails) return;

        if (isString(thumbnails.src)) {

            if (this.#thumb.src === thumbnails.src) return; // dont load same img twice

            this.#thumb = { src: thumbnails.src };
            this.#scrubber.thumbImg.src = thumbnails.src;

            if (this.#config.showPreview) {
                this.#preview.backdrop.style.backgroundImage = `url(${thumbnails.src})`;
            }

        } else if (isObject(thumbnails.src)) {

            if (thumbnails.src[language]) {

                if (this.#thumb.src === thumbnails.src[language]) return;

                this.#thumb = { src: thumbnails.src[language] };
                this.#scrubber.thumbImg.src = thumbnails.src[language];

                if (this.#config.showPreview) {
                    this.#preview.backdrop.style.backgroundImage = `url(${thumbnails.src[language]})`;
                }

            } else {
                this.#scrubber.thumbWrapper.classList.add('has-error');
                return;
            }

        } else throw new Error('[VisionPlayer] Invalid thumbnail format');

        this.#scrubber.thumbWrapper.classList.remove('has-error');
        this.#scrubber.thumbWrapper.classList.add('is-loading');

        this.#thumb.ar = height / width;

        if (this.#config.showPreview) {
            this.#preview.backdrop.style.backgroundSize = `${100 * this.#data.gridX}%`;
        }

    };

    /**
     * Called when the thumbnail image is loaded. Computes scaling and updates the layout.
     */
    #onThumbLoaded = () => {

        this.#scrubber.unmount();
        this.#scrubber.mount(this.#player.dom.getElement(this.#apiKey));

        const { width } = this.#scrubber.thumbImg,
              thumbWidth = this.#scrubber.thumbWrapper.offsetWidth;

        this.#thumb.width = thumbWidth;
        this.#thumb.height = Math.round(thumbWidth * this.#thumb.ar);
        this.#thumb.scale = thumbWidth / (width / this.#data.gridX);

        this.#player.dom.getElement(this.#apiKey).style.setProperty('--vip-scrubber-thumbnail-height', `${this.#thumb.height - 2}px`);

        this.#scrubber.thumbWrapper.classList.remove('is-loading');

        this.#resize(); // TODO: prevent loading more than once later

        this.#scrubber.unmount();
        this.#scrubber.mount(this.#tooltipComp.getElement());

    };

    /**
     * Called if the thumbnail image fails to load, showing an error style.
     */
    #onThumbError = () => {

        this.#scrubber.thumbWrapper.classList.remove('is-loading');
        this.#scrubber.thumbWrapper.classList.add('has-error');

    };

    /**
     * Renders a portion of the thumbnail for the given scrubber tooltip position.
     * @param {number} percent  The fraction of the media timeline (0..1).
     * @listens module:src/controller/ScrubberTooltip#scrubber/tooltip/visible
     * @listens module:src/controller/ScrubberTooltip#scrubber/tooltip/move
     */
    #onThumbRender = ({ percent }) => {

        if (!this.#config.showInScrubber || !this.#thumb.width) return;

        const currentTime = this.#player.getState('media.duration') * Math.min(Math.max(percent / 100, 0), 1),
              frame = Math.floor(currentTime * 1 / this.#data.timeDelta),
              frameY = Math.floor(frame / this.#data.gridX),
              frameX = frame % this.#data.gridX;

        this.#scrubber.thumbImg.style.transform = `
            translateX(${-frameX * this.#thumb.width - 1}px)
            translateY(${-frameY * this.#thumb.height - 1}px)
            scale(${this.#thumb.scale})`;

    };

    /**
     * Handles scrubber moves to show a bigger preview (if enabled).
     * @param {number} percent  The fraction of the media timeline (0..1).
     * @listens module:src/controller/Scrubber#scrubber/update
     */
    #onScrubberUpdate = ({ percent }) => {

        this.#preview.backdrop.classList.remove('is-hidden');

        const currentTime = this.#player.getState('media.duration') * Math.min(Math.max(percent / 100, 0), 1),
              frame = Math.floor(currentTime * 1 / this.#data.timeDelta),
              frameY = Math.floor(frame / this.#data.gridX),
              frameX = frame % this.#data.gridX;

        this.#preview.backdrop.style.backgroundPosition = `
            ${100 * (frameX / (this.#data.gridX - 1))}%
            ${100 * (frameY / (this.#data.gridY - 1))}%`;

    };

    /**
     * Called when scrubbing ends, hides the bigger preview.
     * @listens module:src/controller/Scrubber#scrubber/end
     */
    #onScrubberEnd = () => {

        this.#preview.backdrop.classList.add('is-hidden');

    };

    /**
     * Called on UI resize, adjusts the bigger preview's aspect ratio scaling to match the viewport.
     * @param {Object} size           Object containing the new size information.
     * @param {number} [size.width]   The new player width.
     * @param {number} [size.height]  The new player height.
     * @listens module:src/ui/UI#ui/resize
     */
    #resize = ({ width = this.#player.getState('ui.playerWidth'), height = this.#player.getState('ui.playerHeight') } = {}) => {

        const arViewport = height / width,
              arImg = this.#thumb.height / this.#thumb.width,
              scaleWidth = arViewport > arImg,
              scalePercent = scaleWidth ? `${Math.round(arImg / arViewport * 100)}%` : `${Math.round(arViewport / arImg * 100)}%`;

        this.#preview.backdrop.style.width = scaleWidth ? '100%' : scalePercent;
        this.#preview.backdrop.style.height = scaleWidth ? scalePercent : '100%';

    };

    /**
     * Returns the container element for this component, if needed.
     * @returns {HTMLElement|undefined} The Tooltip Element.
     */
    getElement() {

        return this.#scrubber?.tooltip;

    }

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        this.#scrubber?.destroy();
        this.#preview?.destroy();
        this.#player.unsubscribe(this.#subscriptions);
        this.#player.unsubscribe(this.#subs);
        this.#player = this.#scrubber = this.#preview = this.#apiKey = null;

    }

}
