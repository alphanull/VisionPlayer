import { isString, isNumber } from '../../lib/util/object.js';
import sortElements from '../../lib/dom/sortElements';

import DomSmith from '../../lib/dom/DomSmith.js';
import domSmithTooltip from '../util/domSmithTooltip.js';
import domSmithInputRange from '../../lib/dom/plugins/domSmithInputRange.js';
import domSmithSelect from '../../lib/dom/plugins/domSmithSelect.js';

// Register DomSmith plugins for enhanced UI handling (tooltips, input ranges, selects).
[domSmithTooltip, domSmithInputRange, domSmithSelect].forEach(plugin => DomSmith.registerPlugin(plugin));

/**
 * This component manages the root DOM structure of the player. It is responsible for injecting, replacing, or appending the root wrapper element, according to the configured `placement` mode.
 * All internal components depend on this element being mounted and available, as it acts as the main container and layout context for the entire player.
 * It also includes layout logic for aspect ratio handling and emits well-defined lifecycle events for DOM readiness.
 * Furthermore, this component also manages CSS styles and can insert it at different locations, with Vite HMR and Sourcemaps still intact while developing.
 * This also enables support for Shadow DOM, so the player can be completely shielded against outer DOM and style access.
 * @exports module:src/core/Dom
 * @requires lib/util/object
 * @requires lib/dom/sortElements
 * @requires lib/dom/DomSmith
 * @requires lib/dom/plugins/domSmithInputRange
 * @requires lib/dom/plugins/domSmithSelect
 * @requires src/util/domSmithTooltip
 * @author Frank Kudermann - alphanull
 * @version 1.0.0
 * @license MIT
 */
export default class Dom {

    /**
     * Holds the instance configuration for this component.
     * @type     {Object}
     * @property {'open'|'closed'|''}                 [shadow='']                     Shadow DOM mode: `'closed`', `'open'`, or `''` (no Shadow DOM). If enabled, all player UI is rendered inside a shadow root for encapsulation and style isolation.
     * @property {string}                             [className='']                  Sets a custom classname on the player instance.
     * @property {'auto'|'replace'|'append'|'before'} [insertMode='auto']             Where `insertMode` defines how the player is inserted into the DOM in conjunction with the `target` element. Can have the following values: `auto` generally appends to `target`, but replaces media elements and elements with a `vip-data-media attribute`, `append` treats the target element as parent to attach to, `replace` replaces the target element while `before` inserts the player before the target.
     * @property {'dark'|'light'|'auto'}              [darkMode='dark']               Sets the preferred visual mode for the player: `dark`, `light`, or `auto` for using system defaults.
     * @property {string}                             [layout='']                     Activates special layout modes. Currently supported: `controller-only`: Displays only the control interface (no video, canvas, or overlays). Used for audio playback.
     * @property {number|string}                      [aspectRatio=16/9]              Defines the aspect ratio of the player. Can be a numeric value like `16/9` or `1.777`, `'auto'` to automatically adapt to the current video, or `fill` to make layout depend on the container. Ignored when **both** `width` and `height` are defined.
     * @property {boolean}                            [aspectRatioTransitions=false]  If `true`, aspect ratio changes are animated (if supported by the browser).
     * @property {number|string}                      [width=100%]                    Optional fixed width. If set as a number, it will be interpreted as pixels. If set as a string, it will be passed as-is to the CSS (e.g. `80vw`).
     * @property {number|string}                      [height='']                     Optional fixed height. If set as a number, it will be interpreted as pixels. If set as a string, it will be passed as-is to the CSS (e.g. `80vh`).
     * @property {?HTMLElement}                       [_targetEle=null]               The original target element calculated or received from the first `new VisionPlayer` argument. INTERNAL USE ONLY, not part of the official config.
     */
    #config = {
        shadow: '',
        className: '',
        insertMode: 'auto',
        darkMode: 'dark',
        layout: '',
        aspectRatio: 16 / 9,
        aspectRatioTransitions: false,
        width: '100%',
        height: '',
        _targetEle: null // do not use this in configs!
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
     * Reference to the root element of the player.
     * @type {HTMLElement}
     */
    #dom;

    /**
     * Reference to the original target Element.
     * @type {HTMLElement}
     */
    #targetEle;

    /**
     * Reference to the ShadowRoot instance (if enabled).
     * @type {ShadowRoot}
     */
    #shadow;

    /**
     * Reference to the top-level wrapper node, which will be used when shado wmode is active.
     * @type {HTMLElement}
     */
    #wrapper;

    /**
     * Map holding all style elements for live updates (key: style id/url, value: \<style\> node).
     * @type {Map<string, HTMLStyleElement>}
     */
    #styleEles = new Map();

    /**
     * Creates an instance of the Dom component.
     * Also prepares the root dom element based on the player config.
     * @param  {module:src/core/Player} player            Reference to the VisionPlayer instance.
     * @param  {module:src/core/Player} parent            Reference to the parent instance.
     * @param  {Object}                 [options]         Additional options.
     * @param  {symbol}                 [options.apiKey]  Token for extended access to the player API.
     * @throws {Error}                                    If trying to disable this component.
     */
    constructor(player, parent, { apiKey }) {

        const shadowDefault = this.#config.shadow;

        this.#config = player.initConfig('dom', this.#config);
        if (!this.#config) throw new Error('[Visionplayer] Cannot disable the Dom component by configuration.');

        // if shadow defaults are already set, prevent further change
        if (shadowDefault && !this.#config.shadow) this.#config.shadow = shadowDefault;

        this.#apiKey = apiKey;

        Dom.#instances.add(this);

        this.#player = player;
        this.#player.setApi('refreshDom', this.#refresh, true, apiKey);
        this.#player.setApi('mountDom', this.#mount, true, apiKey);
        this.#player.setApi('dom.getElement', this.#getElement, apiKey);
        this.#player.setApi('dom.updateStyles', this.updateStyles, apiKey);

        const hasCSSAspect = CSS.supports('aspect-ratio', '1/1'),
              playerId = this.#player.getConfig('player.id');

        this.#dom = new DomSmith({
            _ref: 'root',
            _tag: 'vision-player',
            id: playerId,
            className: `${this.#config.className || ''}${hasCSSAspect ? '' : ' has-aspect-patch'}`,
            tabIndex: -1,
            'data-useragent': navigator.userAgent,
            _nodes: hasCSSAspect ? null
                : [{
                    _ref: 'aspectHelper',
                    className: 'vip-aspect-helper'
                }]
        });

        if (this.#config.shadow) {

            this.#wrapper = new DomSmith({
                _ref: 'wrapper',
                _tag: 'vision-player',
                id: playerId,
                className: this.#dom.root.className
            });

            this.#dom.root.classList.add('is-shadow');
            this.#shadow = this.#wrapper.wrapper.attachShadow({ mode: this.#config.shadow });
            this.#shadow.appendChild(this.#dom.root);

        } else this.#wrapper = this.#dom;

        domSmithTooltip.setParent(this.#dom.root);

        const { layout, aspectRatio, aspectRatioTransitions, width, height, darkMode, _targetEle } = this.#config;

        this.#targetEle = _targetEle;

        if (this.#config.insertMode === 'auto') {
            const isMediaElement = _targetEle instanceof HTMLVideoElement || _targetEle instanceof HTMLAudioElement,
                  hasData = _targetEle.getAttribute('data-vip-media');
            this.#config.insertMode = isMediaElement || hasData ? 'replace' : 'append';
        }

        // handle custom width and height
        if (width && aspectRatio !== 'fill') this.#dom.root.style.width = isNaN(width) ? width : `${Number(width)}px`;
        if (height && aspectRatio !== 'fill') this.#dom.root.style.height = isNaN(height) ? height : `${Number(height)}px`;

        this.#dom.root.classList.toggle('has-ar-transitions', aspectRatioTransitions);
        this.#dom.root.classList.toggle('is-light', darkMode === 'light');
        this.#dom.root.classList.toggle('is-dark', darkMode === 'dark');

        if (this.#config.shadow) {
            this.#dom.root.parentNode.host.classList.toggle('is-light', darkMode === 'light');
            this.#dom.root.parentNode.host.classList.toggle('is-dark', darkMode === 'dark');
        }

        if (aspectRatio && !layout && (!width || !height)) {
            let currentAr;

            /**
             * Updates the aspect ratio and UI state (portrait/landscape).
             * @param {number} ratio  The aspect ratio to set.
             */
            const setAspectRatio = ratio => {
                const ar = isNaN(ratio) ? 16 / 9 : ratio;
                if (currentAr === ar) return;
                currentAr = ar;
                this.#dom.root.classList.toggle('is-portrait', ar < 1);
                if (this.#config.shadow) this.#dom.root.parentNode.host.classList.toggle('is-portrait', ar < 1);
                this.#dom.aspectHelper?.style.setProperty('padding-bottom', `${1 / ar * 100}%`);
                if (hasCSSAspect) this.#dom.root.style.aspectRatio = ar;
                if (hasCSSAspect && this.#config.shadow) this.#dom.root.parentNode.host.style.aspectRatio = ar;
            };

            if (aspectRatio === 'auto') {

                if (this.#targetEle?.videoHeight > 0) setAspectRatio(this.#targetEle.videoWidth / this.#targetEle.videoHeight);
                // wait for media loaded to resize
                this.#subscriptions = this.#player.subscribe('media/loadeddata', () => {
                    const w = this.#player.getState('media.videoWidth'),
                          h = this.#player.getState('media.videoHeight');
                    setAspectRatio(w / h);
                });

            } else if (aspectRatio === 'fill') {
                this.#dom.root.classList.add('has-layout-filled');
            } else if (isNumber(aspectRatio)) {
                if (!width && height) this.#dom.root.style.width = 'auto';
                setAspectRatio(aspectRatio);
            }
        }

        if (layout) {
            if (isString(layout)) this.#dom.root.classList.add(`layout-${layout}`);

            if (layout === 'controller-only') {
                // adapt player config to controller only layout
                // force disable almost any UI related components, TODO: is hardcoded, has to know about components
                const { ui } = this.#player.getConfig(),
                      overrideConfig = {
                          subtitles: false,
                          pictureInPicture: false,
                          overlays: false,
                          file: false,
                          playOverlay: false,
                          chromeCast: false,
                          airPlay: false,
                          notifications: false,
                          title: false,
                          thumbnails: false,
                          keyboard: false,
                          fullScreen: false,
                          videoControls: false,
                          visualizerAmbient: false,
                          visualizerBar: false,
                          ui: ui === false ? false : { alwaysVisible: true },
                          spinner: false,
                          scrubber: { placement: 'buttons' }
                      };

                overrideConfig.scrubber = { placement: 'buttons' };
                this.#player.setConfig(overrideConfig);
            }

        }

        this.#initStyles();

    }

    /**
     * Injects all global stylesheets into the current scope (head or Shadow DOM).
     */
    #initStyles() {

        const container = this.#shadow || document.head,
              styleSheets = document.querySelectorAll('head > style');

        const isStyleDuplicate = key => {
            if (container === document.head) {
                for (const style of styleSheets) {
                    if (style.getAttribute('data-vip-style') === key) return true;
                }
            }
            return false;
        };

        const createEle = (key, value) => {
            const styleEle = document.createElement('style');
            styleEle.type = 'text/css';
            styleEle.textContent = value;
            styleEle.setAttribute('data-vip-style', key);
            container.appendChild(styleEle);
            this.#styleEles.set(key, styleEle);
        };

        if (import.meta.env.DEV) {
            // Dev mode: insert all styles in separate tags (so HMR still works)
            Dom.#styles.forEach((value, key) => {
                // prevent duplicate styles in head
                if (isStyleDuplicate(key)) return;
                createEle(key, value);
            });
        } else {
            // Build Mode: concatenate all css and use single tag
            if (isStyleDuplicate('vip-main-css')) return;
            let css = '';
            Dom.#styles.forEach(value => { css += value; });
            createEle('vip-main-css', css);
        }
    }

    /**
     * Called - via private API - from the player class if all components have been reloaded due to a config change.
     * Resorts the root Dom and fires events again so components can catch up.
     * @fires module:src/core/Dom#dom/ready
     * @fires module:src/core/Dom#dom/beforemount
     */
    #refresh = () => {

        sortElements(this.#dom.root);

        this.#player.publish('dom/beforemount', null, { async: false }, this.#apiKey);
        this.#player.publish('dom/ready', null, { async: false }, this.#apiKey);

    };

    /**
     * Inserts the root dom element into the host document.
     * @fires module:src/core/Dom#dom/ready
     * @fires module:src/core/Dom#dom/beforemount
     */
    #mount = () => {

        sortElements(this.#dom.root);

        this.#player.publish('dom/beforemount', null, { async: false }, this.#apiKey);

        this.#wrapper.mount({
            ele: this.#targetEle,
            insertMode: this.#config.insertMode
        });

        this.#player.publish('dom/ready', null, { async: false }, this.#apiKey);

    };

    /**
     * Used by child components to retrieve the player root element.
     * Access is restricted by apiKey if secure mode is enabled.
     * @param   {symbol}      apiKey  Token needed to grant access in secure mode.
     * @returns {HTMLElement}         The player root element.
     * @throws  {Error}               If called in secure mode without valid key.
     */
    #getElement = apiKey => {

        if (this.#apiKey && this.#apiKey !== apiKey) {
            throw new Error('[Visionplayer] Secure mode: access denied.');
        }

        return this.#dom.root;

    };

    /**
     * Updates the content of all style elements in this instance using the provided array of style objects. Used for live HMR updates.
     * @param {Array<{key: string, css: string}>} styles  Array of style updates (key: style id/url, css: new content).
     */
    updateStyles = styles => {

        styles.forEach(({ key, css }) => {
            this.#styleEles.get(key).textContent = css;
        });

    };

    /**
     * Cleans up the Dom component by unsubscribing from events and removing style elements.
     */
    destroy() {

        Dom.#instances.delete(this);

        domSmithTooltip.removeParent();

        // TODO: this wont work correctly in the edge case when there are several mixed shadow / non shadow instances
        // and the last one to be cleared is a shadow, while the second last is not. Needs additional state
        // maybe implement #instances as a Map with "isShadow" as the value?
        if (this.#shadow || Dom.#instances.size === 0) {
            this.#styleEles.forEach(ele => ele.remove());
        }

        this.#styleEles.clear();
        this.#wrapper.destroy();
        this.#player.removeApi(['refreshDom', 'mountDom', 'dom.getElement', 'dom.updateStyles'], this.#apiKey);
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#dom = this.#targetEle = this.#styleEles = this.#apiKey = null;

    }

    /**
     * Global map holding all loaded style contents (key: absolute style path, value: CSS).
     * @type {Map<string, string>}
     */
    static #styles = new Map();

    /**
     * Set of all current Dom component instances.
     * @type {Set<module:src/core/Dom>}
     */
    static #instances = new Set();

    /**
     * Registers API hooks on the Player class for style injection and HMR update.
     * @param {module:src/core/Player} Player  Reference to the Player constructor.
     */
    static initialize(Player) {

        Player.setApi('addStyles', Dom.#addStyles);
        Player.setApi('updateStyles', Dom.#updateStyles);

    }

    /**
     * Adds a style sheet to the global styles map (used by all player instances).
     * @param {string} path  Relative or absolute style path (e.g., `'assets/scss/core/player.scss'`).
     * @param {string} css   Raw CSS string (usually imported with ?inline).
     */
    static #addStyles = (path, css) => {

        const absolutePath = `/${path.replace(/^([./])+/, '')}`;
        Dom.#styles.set(absolutePath, css);

    };

    /**
     * Triggers an updateStyles call on all Dom instances, used for HMR.
     * @param {Array<{key: string, css: string}>} styles  Array of updated styles (key/url, css string).
     */
    static #updateStyles = styles => {

        for (const instance of this.#instances) {
            instance.updateStyles(styles);
        }

    };

}

/**
 * This event is fired when the player has initialized all components, but is not added to the DOM yet.
 * @event module:src/core/Dom#dom/beforemount
 */

/**
 * This event is fired when the player was just added to the target DOM.
 * @event module:src/core/Dom#dom/ready
 */
