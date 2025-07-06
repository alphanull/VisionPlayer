import DomSmith from '../../lib/dom/DomSmith.js';
import convertTime from '../util/convertTime.js';

/**
 * The Overlays component displays layered visual elements—such as logos or posters—on top of the player viewport.
 * It supports various positioning, scaling and timing modes.
 * Overlays can be added dynamically or defined as part of the media data.
 * An Overlay could be any DOM construct, but for now, only images are supported.
 * @exports module:src/ui/Overlays
 * @requires lib/dom/DomSmith
 * @requires src/util/convertTime
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class Overlays {

    /**
     * Holds the instance configuration for this component.
     * @type     {Object}
     * @property {boolean} [adaptLayout=true]  Aligns overlay positioning with controller and title visibility state.
     */
    #config = {
        adaptLayout: true
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
     * A DomSmith instance containing the overlay containers.
     * @type {module:lib/dom/DomSmith}
     */
    #dom;

    /**
     * This array contains overlay data and elements.
     * @type {module:src/Overlays~overlayItem[]}
     */
    #overlays = [];

    /**
     * Creates an instance of the Overlays component.
     * @param {module:src/core/Player}           player            Reference to the VisionPlayer instance.
     * @param {module:src/controller/Controller} parent            Reference to the parent instance.
     * @param {Object}                           [options]         Additional options.
     * @param {symbol}                           [options.apiKey]  Token for extended access to the player API.
     */
    constructor(player, parent, { apiKey }) {

        this.#config = player.initConfig('overlays', this.#config);

        if (!this.#config) return [false];

        this.#player = player;

        this.#dom = new DomSmith({
            _ref: 'root',
            className: `vip-overlays${this.#config.adaptLayout ? ' adapt-layout' : ''}`,
            'data-sort': 55,
            ariaHidden: true,
            _nodes: [{
                _ref: 'adaptive',
                className: 'vip-overlays-wrapper vip-overlays-adaptive'
            }, {
                _ref: 'scaled',
                className: 'vip-overlays-wrapper vip-overlays-scaled'
            }]
        }, this.#player.dom.getElement(apiKey));

        this.#subscriptions = [
            ['data/ready', this.#onDataReady],
            ['media/timeupdate', this.#update],
            ['media/seeked', this.#update],
            ['media/ended', this.#update],
            ['data/nomedia', this.#disable],
            ['media/error', this.#disable],
            ['media/canplay', this.#enable]
        ].map(([event, handler]) => this.#player.subscribe(event, handler));

    }

    /**
     * Called when the media data is ready. Extracts overlay definitions and sets them up.
     * @param {module:src/core/Data~mediaItem}           mediaItem             Object containing media type info.
     * @param {module:src/core/Data~mediaItem_overlay[]} [mediaItem.overlays]  The array of overlays from the media data.
     * @listens module:src/core/Data#data/ready
     */
    #onDataReady = ({ overlays = [], poster }) => {

        this.#removeOverlays();
        this.#overlays = [];

        if (poster) this.addOverlay({ type: 'poster', src: poster });

        if (overlays?.length) {
            // iterate backwards, to preserve layer stacking
            for (let i = overlays.length; i > -1; i -= 1) {
                this.addOverlay(overlays[i]);
            }
        }

        this.#update();

    };

    /**
     * Creates and adds a single overlay item to the DOM.
     * @param {module:src/core/Data~mediaItem_overlay} overlay  The overlay definition from the media data.
     */
    addOverlay(overlay) {

        if (!overlay) return;

        const {
            type,
            src,
            className = '',
            alt = 'VisionPlayer Overlay Image',
            scale = false,
            placement = 'center',
            margin = 0,
            cueIn,
            cueOut
        } = overlay;

        const ovItem = {
            type,
            src,
            className,
            scale,
            placement,
            margin,
            cueIn: typeof cueIn === 'undefined' ? 0 : convertTime(cueIn).seconds,
            cueOut: typeof cueOut === 'undefined' ? Infinity : convertTime(cueOut).seconds,
            visible: false
        };

        if (ovItem.cueIn > ovItem.cueOut) {
            console.error("[Mediaplayer Overlay] 'cueIn' cannot be bigger than 'cueOut', ignoring cuePoint"); // eslint-disable-line
            return;
        }

        if (type.includes('poster')) {
            ovItem.isPoster = true;
            ovItem.scale = ovItem.scale || 'contain';
            ovItem.background = true;
            ovItem.opaque = true;
            ovItem.cueIn = null;
            ovItem.cueOut = null;
            if (type === 'poster') ovItem.visible = true;
        }

        switch (type) {

            case 'poster':
            case 'poster-end':
            case 'image':
                if (ovItem.scale === 'cover' || ovItem.scale === 'contain') {
                    ovItem.ele = document.createElement('div');
                    ovItem.img = document.createElement('img');
                    ovItem.img.src = src;
                    ovItem.img.alt = alt;
                    ovItem.img.addEventListener('load', this.#onLoad);
                    ovItem.img.setAttribute('data-index', this.#overlays.length);
                } else {
                    ovItem.ele = document.createElement('img');
                    ovItem.ele.src = src;
                    ovItem.ele.alt = alt;
                    ovItem.ele.addEventListener('load', this.#onLoad);
                    ovItem.ele.setAttribute('data-index', this.#overlays.length);
                }
                break;

            case 'dom':
                ovItem.ele = document.createElement('div');
                ovItem.ele.appendChild(overlay.ele);
                ovItem.loaded = true;
                break;

            case 'html':
                this.#player.data.error('Only image overlays are supported at this time.');
                return;

            default:
                this.#player.data.error(`Unknown overlay type: ${type}`);
                return;

        }

        ovItem.ele.style.padding = `${ovItem.margin}px`;
        ovItem.ele.className = `vip-overlay-item
            ${type === 'poster' ? 'is-poster ' : 'is-hidden '}
            ${ovItem.placement.replace('-', ' ')}
            ${ovItem.scale ? ` scale-${ovItem.scale.toLowerCase()}` : ''}
            ${ovItem.background ? ' has-bg' : ''}
            ${ovItem.opaque ? ' bg-is-opaque' : ''}
            ${ovItem.className ? ` ${ovItem.className}` : ''}`;

        this.#overlays.push(ovItem);

        if (ovItem.scale) this.#dom.scaled.appendChild(ovItem.ele);
        else this.#dom.adaptive.appendChild(ovItem.ele);

    }

    /**
     * Called when an overlay image loads successfully.
     * @param {Event} event  Original onload event.
     */
    #onLoad = event => {

        const index = event.target.getAttribute('data-index'),
              overlay = this.#overlays[Number(index)];

        overlay.loaded = true;

        if (overlay.scale === 'cover' || overlay.scale === 'contain') {
            overlay.img.removeEventListener('load', this.#onLoad);
            overlay.img = null;
            overlay.ele.style.backgroundImage = `url(${overlay.src})`;
        } else {
            if (overlay.cueOut === Infinity && overlay.cueIn === 0) {
                overlay.ele.classList.remove('is-hidden');
            }
            overlay.ele.removeEventListener('load', this.#onLoad);
        }

    };

    /**
     * Updates the visibility of overlays based on the current playback time and status.
     * @param {Object} data   Event data (unused).
     * @param {string} topic  Event topic (checks for "ended" to handle "poster-end" posters).
     * @listens module:src/core/Media#media/timeupdate
     * @listens module:src/core/Media#media/seeked
     * @listens module:src/core/Media#media/ended
     */
    #update = (data, topic) => {

        const currentTime = this.#player.getState('media.currentTime'),
              duration = this.#player.getState('media.duration'),
              isPaused = this.#player.getState('media.paused') || topic?.includes('/ended');

        this.#overlays.forEach(overlay => {

            const { type, cueIn, cueOut, loaded, ele, visible } = overlay;

            if (type === 'poster' && isPaused && currentTime < 0.1
              || type === 'poster-end' && isPaused && currentTime > duration - 0.1
              || cueIn <= currentTime && cueOut >= currentTime
              || cueOut === Infinity) {

                if (visible === false && loaded === true) {
                    ele.classList.remove('is-hidden');
                    overlay.visible = true;
                }

            } else if (visible === true) {
                ele.classList.add('is-hidden');
                overlay.visible = false;
            }

        });

    };

    /**
     * Enables the next / prev button functionality. This method listens to canplay events in order to restore a usable state again
     * when the player recovered from a media error (for example by loading another file).
     * @listens module:src/core/Media#media/canplay
     */
    #enable = () => {

        this.#dom.root.classList.remove('is-disabled');

    };

    /**
     * Disables the next / prev button functionality. This method listens to media error events which cause the button to be disabled.
     * @listens module:src/core/Media#media/error
     * @listens module:src/core/Data#data/nomedia
     */
    #disable = () => {

        this.#dom.root.classList.add('is-disabled');

    };

    /**
     * Helper function which removes all overlays.
     */
    #removeOverlays() {

        this.#overlays.forEach(overlay => {
            overlay.img?.removeEventListener('load', this.#onLoad);
            overlay.ele.removeEventListener('load', this.#onLoad);
            overlay.ele.remove();
        });

    }

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        this.#removeOverlays();
        this.#dom.destroy();
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#dom = this.#overlays = null;

    }

}

/**
 * Represents a single overlay item with its own DOM element and display rules.
 * @typedef   {Object} module:src/Overlays~overlayItem
 * @property {HTMLElement}      ele                   The DOM element containing the overlay.
 * @property {string}           type                  Overlay type (e.g. 'image', 'poster', 'poster-end').
 * @property {string}           src                   Source URL of the overlay image (if applicable).
 * @property {string}           [className=""]        Additional CSS classes to apply to the overlay element.
 * @property {string}           [scale]               Determines how to scale the overlay, e.g. 'cover" or 'contain'. If undefined, no scaling is applied.
 * @property {string}           [placement='center']  Controls overlay placement, e.g. 'top', 'bottom-right', etc.
 * @property {number}           [margin=0]            Margin (in px) around the overlay content.
 * @property {number}           [cueIn=0]             Start time in seconds when this overlay should appear.
 * @property {number}           [cueOut=Infinity]     End time in seconds when this overlay should disappear.
 * @property {boolean}          visible               Whether the overlay is currently visible or not.
 * @property {boolean}          [isPoster]            True if this overlay is a poster overlay (special case).
 * @property {boolean}          [background]          True if the overlay uses a background image (for 'cover' / 'contain' scaling).
 * @property {boolean}          [opaque]              True if the overlay background is opaque (e.g. For a poster).
 * @property {boolean}          [loaded]              True if the overlay image has finished loading.
 * @property {HTMLImageElement} [img]                 The underlying <img> element if used for 'cover' / 'contain'.
 */
