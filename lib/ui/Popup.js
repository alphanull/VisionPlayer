import { publish, subscribe, unsubscribe } from '../util/publisher.js';

/**
 * The popup module. Helper view to display any content in an "popup" style overlay, with a pointer to a certain element on the screen.
 * The popup has "auto" Layout, ie it can adapt to the screen itself, seeking for the optimal placement.
 * @exports  module:lib/ui/Popup
 * @requires lib/util/publisher
 * @author   Frank Kudermann - alphanull
 * @version  1.5.0
 * @license  MIT
 * @example
 * popup.show(myContentNode);
 * popup.show("<h1>Content as string</h1>"); // <- this updates the opened overlay
 * popup.hide();
 */
export default class Popup {

    /**
     * Creates a new Popup instance.
     * @param {module:lib/ui/Popup~options} [options]  Configuration settings for this popup instance.
     */
    constructor(options = {}) { // eslint-disable-line max-lines-per-function

        if (options.ignore) { return; }

        /**
         * Holds the *active* configuration that applies to the current action.
         * @private
         * @type {Object<module:lib/ui/Popup~options>}
         */
        this.aConf = {};

        /**
         * Holds the *instance* configuration for each instance.
         * @private
         * @type {Object<module:lib/ui/Popup~options>}
         */
        this.iConf = this.extend(Popup.defaults, options, true);

        // prepare View

        /**
         * All references to Dom nodes are stored here.
         * @private
         * @type     {Object<HTMLElement>}
         * @property {HTMLElement}         target      The "target" of the Popup, ie the Element the Popup points to. Based on this Element, also the layout is calculated.
         * @property {HTMLElement}         root        The root element of this widget (i.e. The outermost layer).
         * @property {HTMLElement}         bg          The "background" layer, which is displayed underneath the popup. Can be used to create a "dim" effect when styled appropriately, and has also an event that closes the popup when the user clicks in this area.
         * @property {HTMLElement}         box         The popup element.
         * @property {HTMLElement}         pointer     The pointer element.
         * @property {HTMLElement}         cntWrapper  The outer content element. Just needed to have some extra margin around the scrollbars, if needed.
         * @property {HTMLElement}         cnt         The inner content element, which holds popup content injected later on.
         */
        this.els = {
            target: null,
            root: document.createElement('div'),
            bg: document.createElement('div'),
            cntWrapper: document.createElement('div'),
            cnt: document.createElement('div'),
            box: document.createElement('div'),
            pointer: document.createElement('div'),
            pointers: {
                top: { ele: document.createElement('div') },
                right: { ele: document.createElement('div') },
                bottom: { ele: document.createElement('div') },
                left: { ele: document.createElement('div') }
            }
        };

        // add classes
        this.els.cntWrapper.className = 'pu-cnt';
        this.els.cnt.className = 'pu-cnt-inner';
        this.els.bg.className = 'pu-bg';
        this.els.pointer.className = this.iConf.pointerViewClass;
        this.els.pointers.top.ele.className = 'pu-pointer top';
        this.els.pointers.right.ele.className = 'pu-pointer right';
        this.els.pointers.bottom.ele.className = 'pu-pointer bottom';
        this.els.pointers.left.ele.className = 'pu-pointer left';
        this.els.box.className = 'pu-box';

        this.els.cnt.setAttribute('role', 'dialog');
        this.els.cnt.setAttribute('aria-modal', 'true');
        this.els.cnt.setAttribute('aria-labelledby', 'pu-aria-label');

        this.els.root.className = `${this.iConf.baseViewClass} ${this.iConf.viewClass}`;
        this.els.root.setAttribute('data-lenis-prevent', '');
        this.els.bg.setAttribute('data-lenis-prevent', '');
        // build View
        this.els.cntWrapper.appendChild(this.els.cnt);
        this.els.box.appendChild(this.els.cntWrapper);
        this.els.box.appendChild(this.els.pointer);
        this.els.root.appendChild(this.els.bg);
        this.els.root.appendChild(this.els.box);

        /**
         * References to the various handlers, all bound (to "this").
         * @private
         * @type     {Object<Function>}
         * @property {Function}         hide     Handler for the "hide" event.
         * @property {Function}         resize   Handler for resize events.
         * @property {Function}         key      Handler for keyboard events.
         * @property {Function}         visible  Handler for the show transition event.
         * @property {Function}         hidden   Handler for the hide transition event.
         */
        this.handlers = {
            hide: this.hide.bind(this),
            resize: this.resize.bind(this),
            key: this.onKey.bind(this),
            visible: this.onVisible.bind(this),
            hidden: this.onHidden.bind(this),
            onFocus: this.onFocus.bind(this)
        };

        /**
         * Holds all relevant positioning values for calculating the layout.
         * @private
         * @type     {Object}
         * @property {number} scrollTop       Scrolling posiiton from the top.
         * @property {number} scrollLeft      Scrolling posiiton from the left.
         * @property {number} viewportWidth   Width of viewport in pixels.
         * @property {number} viewportHeight  Height of viewport in pixels.
         * @property {number} targetWidth     Width of target in pixels.
         * @property {number} targetHeight    Height of target in pixels.
         * @property {number} targetTop       Target top position in pixels.
         * @property {number} targetLeft      Target left position in pixels.
         * @property {number} popupWidth      Width of popup in pixels.
         * @property {number} popupHeight     Height of popup in pixels.
         * @property {number} pointerWidth    Width of pointer in pixels.
         * @property {number} pointerHeight   Height of pointer in pixels.
         */
        this.measurements = {
            viewportWidth: null,
            viewportHeight: null,
            popupWidth: null,
            popupHeight: null,
            cntDeltaWidth: null,
            cntDeltaHeight: null,
            target: {
                top: null,
                bottom: null,
                left: null,
                right: null
            },
            deltas: {
                top: null,
                bottom: null,
                left: null,
                right: null
            }
        };

        /**
         * Holds all calculated Layouts.
         * @private
         * @type {module:lib/ui/Popup~layoutObject}
         */
        this.layouts = [];

        /**
         * Determines if the client has CSS transitions.
         * @private
         * @type {boolean}
         */
        this.hasTransitions = 'transition' in document.documentElement.style || 'WebkitTransition' in document.documentElement.style;

        /**
         * Determines which transition event name the client needs. Only useful for older Safaris.
         * @private
         * @type {string}
         */
        this.transitionend = 'WebkitTransition' in document.documentElement.style ? 'webkitTransitionEnd' : 'transitionend';

        const ua = navigator.userAgent;

        const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 4 && typeof window.DeviceMotionEvent !== 'undefined' && typeof window.DeviceOrientationEvent !== 'undefined';
        this.iOS = (/iPhone/i.test(ua) || /iPad/i.test(ua) || /iPod/i.test(ua)) && !/Windows Phone/i.test(ua) || iPadOS;

        /**
         * The current state of the Popup.
         * @private
         * @enum {string}
         */
        this.state = 'initialised';

        subscribe('location/changed', this.handlers.hide, { topicArg: true });

    }

    /**
     * Sets various options for the popup. Called by the "show" Function.
     * @param {module:lib/ui/Popup~options} [options]  Various options for the popup, see also {@link module:ui/Popup.show}.
     */
    configure(options) {

        // create configuration object based on defaults (or existing configuration)
        if (options) {
            this.extend(this.iConf, options);
            this.extend(this.aConf, options);
        }

    }

    /**
     * Shows the popup with specified content and alignment target.
     * @param {string|HTMLElement|DocumentFragment} content        The content to display in the popup.
     * @param {Event|HTMLElement|DocumentFragment}  eventOrTarget  The event or element that triggered the popup.
     * @param {module:lib/ui/Popup~options}         [options]      Configuration overrides for this invocation.
     */
    show(content, eventOrTarget, options) {

        if (this.state === 'showing' || this.state === 'visible') { return; } // TODO better call update here?

        this.aConf = this.extend(this.iConf, options, true);

        if (this.aConf.onShow && this.aConf.onShow() === false) return;

        if (options && options.parentElement) {
            this.aConf.fixedPos = false;
            this.iConf.parentElement = options.parentElement;
        } else {
            this.iConf.parentElement = null;
        }

        this.attachContent(content);
        this.els.root.style.visibility = 'hidden';

        const attachEl = this.aConf.parentElement || document.body;
        attachEl.appendChild(this.els.root);

        function isDomNode(obj) { // eslint-disable-line jsdoc/require-jsdoc
            return typeof HTMLElement === 'object'
                ? obj instanceof HTMLElement
                : obj && typeof obj === 'object' && obj.nodeType === 1 && typeof obj.nodeName === 'string';
        }

        if (typeof eventOrTarget.detail !== 'undefined' && eventOrTarget.detail === 0 && this.aConf.focusTrap) this.aConf.restoreFocus = true;

        this.els.target = isDomNode(eventOrTarget) ? eventOrTarget : eventOrTarget.currentTarget || eventOrTarget.target;
        if (this.aConf.targetHoverClass) this.els.target.classList.add(this.aConf.targetHoverClass);
        this.state = 'showing';
        this.layout();
        this.els.root.style.visibility = 'visible';
        this.els.root.style.position = this.els.bg.style.position = this.aConf.fixedPos === true || !this.aConf.parentElement ? 'fixed' : 'absolute';

        if (this.hasTransitions && this.aConf.animate) {

            const viewClass = this.els.root.className;
            this.els.box.removeEventListener(this.transitionend, this.handlers.hidden);
            // this.els.box.removeEventListener(this.transitionend, this.handlers.onUpdateComplete);
            this.els.box.addEventListener(this.transitionend, this.handlers.visible);
            this.els.root.className = viewClass + (this.state === 'updating' ? '' : ' showing');
            this.els.root.clientHeight; // eslint-disable-line no-unused-expressions
            this.els.root.className = viewClass;

        } else {

            this.handlers.visible();

        }

    }

    /**
     * Hides the popup.
     * @param {?Event}                      [event]    The event that triggered the hide action.
     * @param {module:lib/ui/Popup~options} [options]  Additional options.
     */
    hide(event, options) {

        if (event && event.target !== this.els.bg && event !== 'location/changed' || this.state !== 'showing' && this.state !== 'visible') {
            return;
        }

        if (options) this.aConf = this.extend(this.iConf, options, true);

        if (this.aConf.onHide && this.aConf.onHide() === false) return;

        if (this.aConf.targetHoverClass) this.els.target.classList.remove(this.aConf.targetHoverClass);

        if (this.hasTransitions && this.aConf.animate) {

            this.state = 'hiding';
            const viewClass = this.els.root.className;
            // this.els.box.removeEventListener(this.transitionend, this.handlers.onUpdateComplete);
            this.els.box.removeEventListener(this.transitionend, this.handlers.visible);
            this.els.box.addEventListener(this.transitionend, this.handlers.hidden);
            this.els.root.clientHeight; // eslint-disable-line no-unused-expressions
            this.els.root.className = `${viewClass} hiding`;

        } else {

            this.onHidden();

        }

    }

    /**
     * Called when showing is completed (ie when transition ends).
     * @private
     */
    onVisible() {

        if (this.hasTransitions && this.aConf.animate) {
            this.els.box.removeEventListener(this.transitionend, this.handlers.visible);
        }

        this.els.bg.addEventListener('click', this.handlers.hide, false);
        if (this.aConf.resize) window.addEventListener('resize', this.handlers.resize);

        if (this.aConf.handleEscKey) {
            document.addEventListener('keydown', this.handlers.key);
        }

        if (this.aConf.fixedPos === true) {
            if (this.iOS) { publish('locklayer', this.els.bg, { async: false }); }
            publish('locklayer', this.els.cnt, { async: false });
        }

        if (this.aConf.focus) {
            this.els.cnt.tabIndex = '-1';
            this.els.cnt.focus();
        }

        if (this.aConf.onVisible) this.aConf.onVisible();

        if (this.aConf.focusTrap) {

            /**
             * A list of all tabbable/focusable elements inside the popup. Used to trap focus when `focusTrap` is enabled.
             * @private
             * @type {HTMLElement[]}
             */
            this.focusables = Array.from(
                this.els.cnt.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])')
            );

            if (this.focusables.length > 1) this.els.cnt.addEventListener('keydown', this.handlers.onFocus);

        }

        this.state = 'visible';

    }

    /**
     * Called when hiding is completed (ie transition has ended).
     * @private
     */
    onHidden() {

        if (this.hasTransitions && this.aConf.animate) { this.els.box.removeEventListener(this.transitionend, this.handlers.hidden); }

        this.detachContent();
        window.removeEventListener('resize', this.handlers.resize);
        this.els.bg.removeEventListener('click', this.handlers.hide);

        if (this.aConf.handleEscKey) { document.removeEventListener('keydown', this.handlers.key); }
        if (this.aConf.fixedPos === true) {
            if (this.iOS) { publish('unlocklayer', this.els.bg, { async: false }); }
            publish('unlocklayer', this.els.cnt, { async: false });
        }

        const attachEl = this.aConf.parentElement || document.body;
        attachEl.removeChild(this.els.root);
        this.state = 'hidden';

        if (this.aConf.focus) {
            this.els.cnt.tabIndex = null;
            this.els.target.focus();
            if (!this.aConf.restoreFocus) this.els.target.blur();
        }

        if (this.aConf.focusTrap) {
            this.els.cnt.removeEventListener('keydown', this.handlers.onFocus);
        }

        if (this.aConf.onHidden) this.aConf.onHidden();

    }

    /**
     * Calculates and applies the layout based on the best orientation and dimensions.
     * @private
     */
    layout() { // eslint-disable-line max-lines-per-function

        // if (this.state !== "showing" && this.state !== "hiding" && this.state !== "visible") { return; }
        if (!this.els.target) return;

        // reset Classes
        this.els.pointer.className = this.aConf.pointerViewClass;
        this.els.root.className = `${this.aConf.baseViewClass} ${this.aConf.viewClass}`;

        this.measureLayout(); //  calculate dimensions and everything else needed for Layout
        this.layouts = []; // reset layouts array

        const { measurements } = this,
              { margins } = this.aConf,
              { pointers } = this.els; // shortcuts

        /**
         * Calculates how far the popup must be moved left or right to fit into the viewport.
         * @member {Function} calculateMove
         * @memberof module:lib/ui/Popup#layout
         * @param   {number} viewportTotal  Total width or height of the viewport.
         * @param   {number} popupTotal     Total width or height of the popup layer.
         * @param   {number} targetOffset   [description].
         * @param   {number} margin         Minimum margin relative top the viewport.
         * @returns {number}                Amount (in pixels) the popup should be moved.
         */
        const calculateMove = function(viewportTotal, popupTotal, targetOffset, margin) {

            const popupAdapted = viewportTotal - popupTotal < 0 ? viewportTotal : popupTotal,
                  offset1 = viewportTotal + margin - (popupAdapted / 2 + targetOffset),
                  offset2 = targetOffset - popupAdapted / 2 - margin;

            return offset1 < 0 ? offset1 : offset2 < 0 ? -offset2 : 0;

        };

        /**
         * Calculates various Layout params, like area, deltaWidth and Height (checks if Popup fits into free area) and if the popup needs to be moved to fit.
         * @param   {string}                           o  Desired orientation.
         * @returns {module:lib/ui/Popup~layoutObject}    Layout object.
         */
        const calculateLayout = function(o) {

            switch (o) {
                case 'top':
                    return {
                        o,
                        area: measurements.deltas.top * measurements.viewportWidth,
                        deltaHeight: measurements.deltas.top - measurements.popupHeight - pointers.top.height,
                        deltaWidth: measurements.viewportWidth - measurements.popupWidth,
                        moveX: calculateMove(measurements.viewportWidth, measurements.popupWidth, measurements.target.top.x, margins.left),
                        moveY: 0
                    };
                case 'bottom':
                    return {
                        o,
                        area: measurements.deltas.bottom * measurements.viewportWidth,
                        deltaHeight: measurements.deltas.bottom - measurements.popupHeight - pointers.bottom.height,
                        deltaWidth: measurements.viewportWidth - measurements.popupWidth,
                        moveX: calculateMove(measurements.viewportWidth, measurements.popupWidth, measurements.target.bottom.x, margins.left),
                        moveY: 0
                    };
                case 'right':
                    return {
                        o,
                        area: measurements.deltas.right * measurements.viewportHeight,
                        deltaHeight: measurements.viewportHeight - measurements.popupHeight,
                        deltaWidth: measurements.deltas.right - measurements.popupWidth - pointers.right.width,
                        moveX: 0,
                        moveY: calculateMove(measurements.viewportHeight, measurements.popupHeight, measurements.target.right.y, margins.top)
                    };
                case 'left':
                    return {
                        o,
                        area: measurements.deltas.left * measurements.viewportHeight,
                        deltaHeight: measurements.viewportHeight - measurements.popupHeight,
                        deltaWidth: measurements.deltas.left - measurements.popupWidth - pointers.left.width,
                        moveX: 0,
                        moveY: calculateMove(measurements.viewportHeight, measurements.popupHeight, measurements.target.left.y, margins.top)
                    };
                // no default
            }

        };

        let layout;

        const orients = this.aConf.orientation === 'auto' ? ['top', 'right', 'bottom', 'left'] : this.aConf.orientation;

        // first of all, measure layouts
        for (let i = 0, l = orients.length; i < l; i += 1) {
            layout = calculateLayout(orients[i]);
            this.layouts.push(layout);
            if (this.aConf.orientation !== 'auto' && layout.deltaWidth >= 0 && layout.deltaHeight >= 0) break;
        }

        // then, sort by total free area
        this.layouts.sort((v1, v2) => v2.area - v1.area);

        // map index on first sort to work around unstable sorting engines
        this.layouts = this.layouts.map((val, index) => {
            val.index = index;
            return val;
        });

        // then, sort by deltaWidth and Height (but only if deltas are < 0)
        this.layouts.sort((v1, v2) => {

            const v1t = (v1.deltaWidth >= 0 ? 0 : v1.deltaWidth * -1) + (v1.deltaHeight >= 0 ? 0 : v1.deltaHeight * -1),
                  v2t = (v2.deltaWidth >= 0 ? 0 : v2.deltaWidth * -1) + (v2.deltaHeight >= 0 ? 0 : v2.deltaHeight * -1);

            if (v1t === v2t) return v1.index - v2.index;
            return v1t - v2t;

        });

        // now we should have the optimal layout
        let bestFit = this.layouts[0];

        // check if popup width needs to be limited
        if (bestFit.deltaWidth < 0 && this.aConf.limitLayout !== false) {

            let newWidth;

            switch (bestFit.o) {
                case 'left':
                    newWidth = measurements.deltas.left - pointers.left.width;
                    break;
                case 'right':
                    newWidth = measurements.deltas.right - pointers.right.width;
                    break;
                case 'top':
                case 'bottom':
                    newWidth = measurements.viewportWidth;
                    break;
                // no default
            }

            measurements.popupWidth = newWidth;
            this.els.cnt.style.width = `${newWidth - measurements.cntDeltaWidth}px`;
            measurements.popupHeight = this.els.box.offsetHeight; // must recalculate new Height when changing width
            bestFit = calculateLayout(bestFit.o);

        }

        // check if popup height needs to be limited
        if (bestFit.deltaHeight < 0 && this.aConf.limitLayout !== false) {

            let newHeight;

            switch (bestFit.o) {
                case 'left':
                case 'right':
                    newHeight = measurements.viewportHeight;
                    break;
                case 'top':
                    newHeight = measurements.deltas.top - pointers.top.height;
                    break;
                case 'bottom':
                    newHeight = measurements.deltas.bottom - pointers.bottom.height;
                    break;
                // no default
            }

            measurements.popupHeight = newHeight;
            this.els.cnt.style.height = `${newHeight - measurements.cntDeltaHeight}px`;

        }

        // now on to the actual positioning

        let viewTop, viewLeft, viewBottom, pointerTop, pointerLeft, pointerHeight, pointerWidth;

        this.els.pointer.className = `${this.aConf.pointerViewClass} ${bestFit.o}`;
        this.els.root.className = `${this.aConf.baseViewClass} ${this.aConf.viewClass} ${bestFit.o}`;

        switch (bestFit.o) {

            case 'top':
                viewLeft = measurements.target.top.x - measurements.popupWidth / 2 + bestFit.moveX;
                // viewTop = measurements.target.top.y - measurements.popupHeight - pointers.top.height / 2;
                viewBottom = measurements.viewportPos.height - measurements.target.top.y;
                pointerLeft = measurements.popupWidth / 2 - pointers.top.width / 2 - bestFit.moveX;
                pointerWidth = pointers.top.width;
                pointerTop = null;
                break;

            case 'bottom':
                viewLeft = measurements.target.bottom.x - measurements.popupWidth / 2 + bestFit.moveX;
                viewTop = measurements.target.bottom.y;
                pointerLeft = measurements.popupWidth / 2 - pointers.bottom.width / 2 - bestFit.moveX;
                pointerWidth = pointers.bottom.width;
                pointerTop = null;
                break;

            case 'left':
                viewLeft = measurements.target.left.x - measurements.popupWidth - pointers.left.width / 2;
                viewTop = measurements.target.left.y - measurements.popupHeight / 2 + bestFit.moveY;
                pointerLeft = null;
                pointerTop = measurements.popupHeight / 2 - pointers.left.height / 2 - bestFit.moveY;
                pointerHeight = pointers.left.height;
                break;

            case 'right':
                viewLeft = measurements.target.right.x;
                viewTop = measurements.target.right.y - measurements.popupHeight / 2 + bestFit.moveY;
                pointerLeft = null;
                pointerTop = measurements.popupHeight / 2 - pointers.right.height / 2 - bestFit.moveY;
                pointerHeight = pointers.right.height;
                break;

            // no default
        }

        // make sure pointer placement does not overshoot popup
        if (pointerTop) {
            if (pointerTop < this.aConf.pointerEdgeDistance) {
                pointerTop = this.aConf.c;
            } else if (pointerTop + pointerHeight > measurements.popupHeight - this.aConf.pointerEdgeDistance) {
                pointerTop = measurements.popupHeight - this.aConf.pointerEdgeDistance - pointerHeight;
            }
        }

        if (pointerLeft) {
            if (pointerLeft < this.aConf.pointerEdgeDistance) {
                pointerLeft = this.aConf.pointerEdgeDistance;
            } else if (pointerLeft + pointerWidth > measurements.popupWidth - this.aConf.pointerEdgeDistance) {
                pointerLeft = measurements.popupWidth - this.aConf.pointerEdgeDistance - pointerWidth;
            }
        }

        /* this.els.box.style.transform = `translateX(${Math.round(viewLeft - measurements.parentPos.left)}px) translateY(${Math.round(viewTop - measurements.parentPos.top)}px)`;
        this.els.pointer.style.transform = `translateX(${pointerLeft ? `${pointerLeft}px` : 0}px) translateY(${pointerTop ? `${pointerTop}px` : 0}px)`; */

        this.els.box.style.left = `${Math.round(viewLeft - measurements.parentPos.left)}px`;

        if (viewBottom) {
            this.els.box.style.top = 'auto';
            this.els.box.style.bottom = `${Math.round(measurements.parentPos.top ? measurements.parentPos.top - measurements.target.top.y + measurements.parentRect.height : viewBottom)}px`;
        } else {
            this.els.box.style.bottom = 'auto';
            this.els.box.style.top = `${Math.round(viewTop - measurements.parentPos.top)}px`;
        }

        this.els.pointer.style.left = pointerLeft ? `${pointerLeft}px` : null;
        this.els.pointer.style.top = pointerTop ? `${pointerTop}px` : null;

    }

    /**
     * Helper function that calculates positions and widths used by the "layout" method.
     * @private
     */
    measureLayout() {

        const getPosition = ele => ele.getBoundingClientRect();

        // only calculate pointer measurement once
        if (!this.els.pointers.top.width) {

            const node = document.createElement('div');

            node.style.visibility = 'hidden';
            node.style.position = 'absolute';
            node.appendChild(this.els.pointers.top.ele);
            node.appendChild(this.els.pointers.right.ele);
            node.appendChild(this.els.pointers.bottom.ele);
            node.appendChild(this.els.pointers.left.ele);
            this.els.root.appendChild(node);

            for (const pointer of Object.values(this.els.pointers)) {
                pointer.width = pointer.ele.offsetWidth;
                pointer.height = pointer.ele.offsetHeight;
            }

            this.els.root.removeChild(node);

        }

        // reset old inline styles
        this.els.cnt.style.height = null;
        this.els.cnt.style.width = null;
        this.els.box.style.left = null;
        this.els.box.style.top = null;

        const parentRect = this.aConf.parentElement ? getPosition(this.aConf.parentElement) : null,
              parentPosition = parentRect || { top: 0, left: 0 },
              viewport = this.aConf.limitLayout && this.aConf.parentElement ? this.aConf.parentElement : document.documentElement,
              viewportWidth = viewport.clientWidth,
              viewportHeight = window.innerHeight && window.innerHeight < viewport.clientHeight ? window.innerHeight : viewport.clientHeight,
              viewportPos = this.aConf.limitLayout && this.aConf.parentElement ? parentPosition : { top: 0, left: 0, height: viewportHeight, width: viewportWidth },
              parentPos = !this.aConf.limitLayout && this.aConf.parentElement ? { top: parentPosition.top, left: parentPosition.left } : { top: 0, left: 0 },
              targetPos = this.els.target.type === 'mouse' || this.els.target.type === 'touch' ? this.els.target : getPosition(this.els.target),
              targetWidth = targetPos.width,
              targetHeight = targetPos.height,
              targetTop = targetPos.top - viewportPos.top + (window.innerHeight && window.innerHeight + 2 < viewport.clientHeight ? window.scrollY : 0), // iOS Soft keyboard
              targetLeft = targetPos.left - viewportPos.left,
              targetTopBottomX = targetLeft + targetWidth / 2,
              targetLeftRightY = targetTop + targetHeight / 2;

        this.measurements = {
            viewportPos,
            parentPos,
            parentRect,
            viewportWidth: viewportWidth - this.aConf.margins.left - this.aConf.margins.right,
            viewportHeight: viewportHeight - this.aConf.margins.top - this.aConf.margins.bottom,
            popupWidth: this.els.box.offsetWidth,
            popupHeight: this.els.box.offsetHeight,
            cntDeltaWidth: this.els.cntWrapper.offsetWidth - this.els.cnt.offsetWidth,
            cntDeltaHeight: this.els.cntWrapper.offsetHeight - this.els.cnt.offsetHeight,
            target: {
                top: {
                    x: targetTopBottomX,
                    y: targetTop - this.aConf.pointerDistance
                },
                bottom: {
                    x: targetTopBottomX,
                    y: targetTop + targetHeight + this.aConf.pointerDistance
                },
                left: {
                    x: targetLeft - this.aConf.pointerDistance,
                    y: targetLeftRightY
                },
                right: {
                    x: targetLeft + targetWidth + this.aConf.pointerDistance,
                    y: targetLeftRightY
                }
            },
            deltas: {
                top: targetTop - this.aConf.pointerDistance - this.aConf.margins.top,
                bottom: viewportHeight - targetTop - targetHeight - this.aConf.pointerDistance - this.aConf.margins.bottom,
                left: targetLeft - this.aConf.pointerDistance - this.aConf.margins.left,
                right: viewportWidth - targetLeft - targetWidth - this.aConf.pointerDistance - this.aConf.margins.right
            }
        };
    }

    /**
     * Keyboard handler for ESC key to close the popup.
     * @private
     * @param {KeyboardEvent} event  The original keyboard event.
     */
    onKey(event) {

        const { keyCode } = event;
        if (keyCode === 27) { this.hide(); } // ESC key

    }

    /**
     * Handles focus trapping inside the popup when `focusTrap` is enabled.
     * Ensures that `Tab` cycles between the first and last focusable elements within the popup.
     * @private
     * @param {KeyboardEvent} event  The keydown event used for detecting tab navigation.
     */
    onFocus(event) {

        if (event.key !== 'Tab') return;

        const first = this.focusables[0],
              last = this.focusables[this.focusables.length - 1];

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    /**
     * Replaces the popup content with new content.
     * @param {string|HTMLElement|DocumentFragment} content  New content to insert.
     */
    replaceContent(content) {

        this.detachContent();
        this.attachContent(content);
        this.layout();

    }

    /**
     * Fills the content area of the view with the desired content, depending on the type of content.
     * Also, if content is an Element which has a parent, the parent is saved so that the content can later be reinserted where it was when hiding the popup.
     * @private
     * @param  {string|Element|DocumentFragment} content  The content for the popup, can be a (html) string, an element or a DOM fragment.
     * @throws {Error}                                    If no valid content type was found.
     */
    attachContent(content) {

        if (this.aConf.onAttachment) { this.aConf.onAttachment(content); }

        if (content instanceof DocumentFragment || content instanceof Element) {

            if (content.parentNode) {

                //  save current Location
                this.savedParent = content.parentNode;
                this.savedSibling = content.nextElementSibling;
                this.savedStyle = typeof content.currentStyle === 'undefined' ? document.defaultView.getComputedStyle(content, null).display : content.currentStyle.display;

                if (this.savedStyle === 'none') {

                    switch (content.tagName) { // check for right display using tag names, when node was hidden ($$$$ VERY incomplete)
                        case 'SPAN':
                            content.style.display = 'inline';
                            break;
                        default:
                            content.style.display = this.aConf.display;
                            break;
                    }

                }

            }

            this.els.cnt.appendChild(content);

        } else if (typeof content === 'string' || content instanceof String) {

            this.els.cnt.textContent = content;

        } else {

            throw new Error('Popup: No valid content type, must be a string or DOM Element');

        }

    }

    /**
     * If an existing content parent position was saved before, put the element back where it was, otherwise just empty the content area.
     * @private
     */
    detachContent() {

        if (this.els.cnt.firstChild) {

            if (this.savedParent) {

                if (this.savedStyle === 'none') {
                    this.els.cnt.firstChild.style.display = 'none';
                }

                if (this.savedSibling) {
                    this.savedParent.insertBefore(this.els.cnt.firstChild, this.savedSibling);
                    this.savedSibling = null;
                } else {
                    this.savedParent.appendChild(this.els.cnt.firstChild);
                }

                this.savedParent = null;

            } else {

                // this.els.cnt.innerHTML = "";
                this.els.cnt.removeChild(this.els.cnt.firstChild);

            }

        }

        if (this.aConf.onDetachment) { this.aConf.onDetachment(); }

    }

    /**
     * Recalculates layout on viewport resize.
     * @private
     */
    resize() {

        this.layout();

    }

    /**
     * Removes the popup and detaches all event listeners.
     */
    remove() {

        if (this.state === 'visible' || this.state === 'showing') this.onHidden(); else this.detachContent();

        unsubscribe('location/changed', this.handlers.hide);
        document.removeEventListener('keydown', this.handlers.key);
        window.removeEventListener('resize', this.handlers.resize);
        this.els.cnt.removeEventListener('keydown', this.handlers.onFocus);
        this.els.bg.removeEventListener('click', this.handlers.hide, false);
        this.els.box.removeEventListener(this.transitionend, this.handlers.onUpdateComplete);
        this.els.box.removeEventListener(this.transitionend, this.handlers.visible);
        this.els.box.removeEventListener(this.transitionend, this.handlers.hidden);
        this.aConf.onHidden = null;
        this.els = this.handlers = null;

    }

    /**
     * Extends 'target' object with members from 'source'. Does only a simple shallow extension, and returns a copy of the target.
     * @private
     * @param   {Object}  target  Destination object.
     * @param   {Object}  source  Source object from which to extend.
     * @param   {boolean} clone   If set to true, a cloned copy of the target is returned.
     * @returns {Object}          Extended object.
     */
    extend(target, source, clone) {

        let result, i, key, keys;

        if (clone) {
            result = {};
            for (i = 0, key, keys = Object.keys(target); (key = keys[i]); i += 1) {
                result[key] = Array.isArray(target[key]) ? target[key].slice(0) : target[key];
            }
        } else {
            result = target;
        }

        if (source) {
            for (i = 0, key, keys = Object.keys(source); (key = keys[i]); i += 1) {
                if (key === 'margins') {
                    result[key] = this.extend(source[key], null, true);
                } else {
                    result[key] = Array.isArray(source[key]) ? source[key].slice(0) : source[key];
                }
            }
        }

        return result;

    }

}

/**
 * Holds the defaults for all instances.
 * @private
 * @type {module:lib/ui/Popup~options}
 */
Popup.defaults = {
    orientation: 'auto',
    margins: {
        top: 10,
        bottom: 10,
        right: 10,
        left: 10
    },
    pointerDistance: 10,
    pointerEdgeDistance: 15,
    animate: true,
    fixedPos: true,
    limitLayout: true,
    baseViewClass: 'pu',
    pointerViewClass: 'pu-pointer',
    viewClass: '',
    display: 'block',
    handleEscKey: true,
    onShow: null,
    onHide: null,
    onHidden: null,
    onVisible: null,
    onAttachment: null,
    onDetachment: null,
    focus: true,
    focusTrap: true,
    targetHoverClass: '',
    resize: true
};

/**
 * Configures the popup globally, so it must be called on the constructor: <code>Popup.configure(...)</code>. Uses defaults for options that are not specified.
 * Note that in contrast to the {@link module:lib/ui/Popup#configure} instance method, these options apply to *all* future instances of the overlay.
 * @param {module:lib/ui/Popup~options} options  The configuration object which applies to this instance.
 */
Popup.configure = function(options) {

    Popup.prototype.extend(Popup.defaults, options);

};

/**
 * @typedef  {Object} module:lib/ui/Popup~options    Structure of the Popup options
 * @property {HTMLElement}    [parentElement]                                The Element the popup DOM nodes should be attached to. Defaults to document.body.
 * @property {Array<string>}  [orientation="top","bottom","right","left"]    An Array holding the preferred orientation in relation to the target element, ie the element the popup points to. The orientations are checked in the order they appear in the array, an as soon as the popup would fit on the screen with the currently tested orientation,the appropriate layout is selected for display.
 * @property {Object<number>} [margins={top:10,bottom:10,right:10,left:10}]  Minimum margins from viewport, separate for all four edges.
 * @property {number}         [pointerDistance=5]                            Distance between popup and target element.
 * @property {number}         [pointerEdgeDistance=10]                       Minimum default distance between pointer graphic and the edge of the popup background.
 * @property {boolean}        [animate=true]                                 Determines if the popup should be animated.
 * @property {number}         [fixedPos=false]                               Indicates if Popup should have a fixed position.
 * @property {boolean}        [limitLayout=true]                             If true, the popup size is limited to the viewport when necessary, adding scrollbars.
 * @property {string}         [baseViewClass="pu"]                           Default classname of the main view.
 * @property {string}         [pointerViewClass="pu-pointer"]                Default classname of the pointer element.
 * @property {string}         [viewClass=""]                                 Additional classname of the main view.
 * @property {boolean}        [handleEscKey=true]                            If true, popup closes on ESC key.
 * @property {?Function}      [onHide=null]                                  Callback which is executed when the popup is about being hidden.  Cancels hiding if this callback returns `false`.
 * @property {?Function}      [onHidden=null]                                Callback which is executed when the popup has closed.
 * @property {?Function}      [onShow=null]                                  Callback which is executed when the popup is being shown. Cancels showing if this callback returns `false`.
 * @property {?Function}      [onVisible=null]                               Callback which is executed when the popup is visible.
 * @property {?Function}      [onAttachment=null]                            Callback which is executed when the content has been attached.
 * @property {?Function}      [onDetachment=null]                            Callback which is executed when the content has been detached.
 * @property {boolean}        [focus=true]                                   Automatically focuses popup as soon as it has opened. Helps with tabbing, in case the popup holds any suitable controls.
 * @property {boolean}        [focusTrap=true]                               If enabled, traps keyboard focus inside the popup until it is closed (useful for accessibility).
 * @property {boolean}        [resize=true]                                  If enabled, use internal resize function.
 */

/**
 * @typedef  {Object} module:lib/ui/Popup~layoutObject    Structure of the layout object
 * @property {string} o            Orientation for this layout.
 * @property {number} area         Area in square pixels occupied by this layout.
 * @property {number} deltaHeight  Delta between popup and vireport height.
 * @property {number} deltaWidth   Delta between popup and vireport height.
 * @property {number} index        Position of this layout in the array.
 * @property {number} moveX        Amount which the popup needs to be moved in horizontal direction so that it fits in the viewport.
 * @property {number} moveY        Amount which the popup needs to be moved in vertical direction so that it fits in the viewport.
 */
