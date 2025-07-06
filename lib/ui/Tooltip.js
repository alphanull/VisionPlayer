import Popup from './Popup.js';

/**
 * The Tooltip module. Works similar to a Popup and is in fact its subclass. Most notable differences are that the "target" is actually the mouse pointer,
 * the tooltip also moves with the mouse and is triggered on mouseover, and also automatically hidden on mouseout.
 * Layout / Positioning itself is identical to the Popup though.
 * @exports module:lib/ui/Tooltip
 * @requires lib/ui/Popup
 * @augments module:lib/ui/Popup
 * @author Frank Kudermann - alphanull
 * @version 1.5.0
 * @license MIT
 */
export default class Tooltip extends Popup {

    /**
     * Creates a new tooltip instance.
     * @param {module:lib/ui/tooltip~options} options  Configuration options for the tooltip instance.
     */
    constructor(options) {

        super({ ignore: true }); // TODO not ideal bc we shouldn't call the super constructor this way, needs refactoring

        /**
         * Holds the *active* configuration that applies to the current action.
         * @private
         * @type {Object<module:lib/ui/tooltip~options>}
         */
        this.aConf = {};

        /**
         * Holds the *instance* configuration for each instance.
         * @private
         * @type {Object<module:lib/ui/tooltip~options>}
         */
        this.iConf = this.extend(Tooltip.defaults, options, true);

        // prepare View

        /**
         * All references to DOM nodes are stored here.
         * @private
         * @type     {Object}
         * @property {HTMLElement} target   The "target" of the Popup, ie the Element the Popup points to. Based on this Element, also the layout is calculated.
         * @property {HTMLElement} root     The root element of this widget (i.e. The outermost layer).
         * @property {HTMLElement} pointer  The pointer element.
         * @property {HTMLElement} cnt      The inner content element, which holds popup content injected later on.
         */
        this.els = {
            target: null,
            root: document.createElement('div'),
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

        this.els.box = this.els.root;
        this.els.cntWrapper = this.els.cnt;

        // add classes
        this.els.root.className = this.iConf.baseViewClass;
        this.els.cnt.className = 'tt-cnt';
        this.els.pointer.className = this.iConf.pointerViewClass;
        this.els.pointers.top.ele.className = `${this.iConf.pointerViewClass} top`;
        this.els.pointers.right.ele.className = `${this.iConf.pointerViewClass} right`;
        this.els.pointers.bottom.ele.className = `${this.iConf.pointerViewClass} bottom`;
        this.els.pointers.left.ele.className = `${this.iConf.pointerViewClass} left`;

        // build View
        this.els.root.appendChild(this.els.cnt);
        this.els.root.appendChild(this.els.pointer);

        /**
         * Holds all relevant positioning values for calculating the layout.
         * @private
         * @type     {Object}
         * @property {number} scrollTop       Scrolling posiiton from the top.
         * @property {number} scrollLeft      Scrolling posiiton from the left.
         * @property {number} viewportWidth   The width of the viewport in pixels.
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
            target: { top: null, bottom: null, left: null, right: null },
            deltas: { top: null, bottom: null, left: null, right: null }
        };

        /**
         * Holds all calculated Layouts.
         * @private
         * @type {module:lib/ui/Popup~layoutObject}
         */
        this.layouts = [];

        /**
         * References to the various handlers, all bound (to "this").
         * @private
         * @type     {Object<Function>}
         * @property {Function}         preventEvent  Handler for preventing (click) events.
         * @property {Function}         visible       Handler for the show transition event.
         * @property {Function}         move          Handler for mousemove event.
         * @property {Function}         hide          Handler for the hide event.
         * @property {Function}         hidden        Handler for the hide transition event.
         */
        this.handlers = {
            resetTimer: this.resetTimer.bind(this),
            visible: this.onVisible.bind(this),
            move: this.onMove.bind(this),
            hide: this.hide.bind(this),
            hidden: this.onHidden.bind(this)
        };

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

        this.hasPointerEvents = Boolean(window.PointerEvent);

        const ua = navigator.userAgent;
        this.isWindows = Boolean(/Windows/i.test(ua) && !/Windows Phone/i.test(ua));
        this.isIos = Boolean(
            Boolean(/iPad/i.test(ua)) || Boolean(/iPhone/i.test(ua)) || Boolean(/iPod/i.test(ua))
            || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 4 && typeof window.DeviceMotionEvent !== 'undefined' && typeof window.DeviceOrientationEvent !== 'undefined');

        /**
         * The current state of the tooltip.
         * @private
         * @enum {string}
         */
        this.state = 'initialised';

    }

    /**
     * Sets various options for the tooltip.
     * @function module:lib/ui/tooltip#configure
     * @param {module:lib/ui/tooltip~options} [options]  Various options for the popup, see also {@link module:ui/Popup.show}.
     */
    configure(options) {

        // create configuration object based on defaults (or existing configuration)
        if (options) {
            this.extend(this.iConf, options);
            this.extend(this.aConf, options);
        }

    }

    /**
     * Shows the view.
     * @param {string|HTMLElement|DocumentFragment} content    The content for the view.
     * @param {Event|HTMLElement|DocumentFragment}  event      The originating event or element.
     * @param {module:lib/ui/Popup~options}         [options]  Additional options.
     */
    show(content, event, options) {

        if (this.state === 'showing' || this.state === 'visible' /* || this.state === "delaying" */) { return; }

        this.aConf = this.extend(this.iConf, options, true);
        this.resetTimer();
        this.state = 'delaying';
        this.oTarget = this.aConf.target || event.target || event.currentTarget || event.srcElement;
        this.els.root.style.position = this.aConf.fixedPos === true || !this.aConf.parentElement ? 'fixed' : 'absolute';

        if (event && event.touches || event.pointerType === 'touch') {

            if (this.aConf.touchMove) {
                document.addEventListener(this.hasPointerEvents ? 'pointermove' : 'touchmove', this.handlers.move/* , { passive: true } */);
            }

            if (this.aConf.touchEnd) {
                document.addEventListener(this.hasPointerEvents ? 'pointerup' : 'touchend', this.handlers.hide/* , { passive: true } */);
            }

            event.preventDefault();
            event.stopPropagation();

        } else {

            // we still need a touchmove here bc FF / Android with mouse switches from mousemove to touchmove as soon as the button is pressed ....
            document.addEventListener('touchmove', this.handlers.move/* , { passive: true } */);
            document.addEventListener(this.hasPointerEvents ? 'pointermove' : 'mousemove', this.handlers.move/* , { passive: true } */);
            document.addEventListener(this.hasPointerEvents ? 'pointerout' : 'mouseout', this.handlers.hide/* , { passive: true } */);

            this.oTarget.addEventListener('click', this.handlers.resetTimer);

            if (this.aConf.neverHideWhenPressed) {
                document.addEventListener(this.hasPointerEvents ? 'pointerup' : 'mouseup', this.handlers.hide/* , { passive: true } */);
            }

        }

        if (this.aConf.delay > 0 && ((event.touches || event.pointerType === 'touch') && this.aConf.touchDelay || !event.touches)) {

            this.lastPointerEvent = event;
            this.timer = window.setTimeout(this.showAfterDelay.bind(this, content, null), this.aConf.delay);

        } else {

            this.showAfterDelay(content, event);

        }

    }

    /**
     * Hides the view.
     * @param {?Event} [event]  The event that invoked the hide method. Not set if the widget is manually closed (in contrast to clicking on the background layer).
     */
    hide(event) {

        if (this.state === 'hiding' || this.state === 'hidden' || this.state === 'initialised') { return; }

        if (event) {

            if (event.touches || event.pointerType === 'touch') {
                event.preventDefault();
            }

            if (event.type === 'mouseout' || event.type === 'pointerout' || event.type === 'mouseup' || event.type === 'pointerup' && event.pointerType === 'mouse') {

                if (this.aConf.neverHideWhenPressed && this.detectLeftButton(event) && (event.type !== 'mouseup' && event.type !== 'pointerup')) { return; }

                // determine element the mouseout came from
                let related = event.relatedTarget || event.toElement || event.originalTarget || event.target;

                while (related) {

                    // hover change on the target ele happened?
                    if (related === this.oTarget) { return; }
                    //  check if element that caused the event is part of the tooltip itself
                    if (related === this.els.root) {

                        // now, check if we really left the target with the mouse, by comparing raw coordinates
                        const mouseTop = event.clientY,
                              mouseLeft = event.clientX;

                        if (mouseTop > this.oTargetPos.top && mouseTop < this.oTargetPos.top + this.oTargetPos.height
                          && (mouseLeft > this.oTargetPos.left && mouseLeft < this.oTargetPos.left + this.oTargetPos.width)) {
                            return;
                        }

                    }

                    related = related.parentNode;

                }
            }
        }

        this.resetTimer();

        if (this.oTarget) {
            this.oTarget.removeEventListener('click', this.handlers.hide);
            this.oTarget.removeEventListener('click', this.handlers.resetTimer);
        }

        document.removeEventListener('touchmove', this.handlers.move);
        document.removeEventListener('touchend', this.handlers.hide);
        document.removeEventListener('pointerup', this.handlers.hide);
        document.removeEventListener('mouseup', this.handlers.hide);
        document.removeEventListener('touchstart', this.handlers.hide);
        document.removeEventListener('pointerdown', this.handlers.hide);
        document.removeEventListener('mouseout', this.handlers.hide);
        document.removeEventListener('mousemove', this.handlers.move);
        document.removeEventListener('pointermove', this.handlers.move);

        this.state = 'hiding';

        cancelAnimationFrame(this.animId);
        this.isLayouting = false;

        if (this.hasTransitions && this.aConf.animate) {

            this.els.root.removeEventListener(this.transitionend, this.handlers.visible);
            this.els.root.addEventListener(this.transitionend, this.handlers.hidden);
            this.els.root.clientHeight; // eslint-disable-line no-unused-expressions
            this.els.root.classList.add('hiding');

        } else {

            this.handlers.hidden();

        }

    }

    /**
     * In essence, this is the equivalent to {@link module:lib/ui/Popup#show}, but in this case, the tooltip is (usually) shown with a small delay.
     * @private
     * @param {string|HTMLElement|DocumentFragment} content  The content to show.
     * @param {Event|HTMLElement|DocumentFragment}  event    The triggering event.
     */
    showAfterDelay(content, event) {

        const lastEvent = event || this.lastPointerEvent;

        if (this.state === 'visible' || this.state === 'hiding' || !lastEvent) { return; }

        this.timer = null;
        this.state = 'showing';
        this.detachContent();

        try {

            this.attachContent(content);

        } catch (e) { // eslint-disable-line no-unused-vars

            document.removeEventListener('touchmove', this.handlers.move);
            document.removeEventListener('touchend', this.handlers.hide);
            document.removeEventListener('pointerup', this.handlers.hide);
            document.removeEventListener('touchstart', this.handlers.hide);
            document.removeEventListener('pointerdown', this.handlers.hide);
            document.removeEventListener('mouseout', this.handlers.hide);
            document.removeEventListener('mousemove', this.handlers.move);
            document.removeEventListener('pointermove', this.handlers.move);

            if (this.oTarget) {
                this.oTarget.removeEventListener('click', this.handlers.hide);
                this.oTarget.removeEventListener('click', this.handlers.resetTimer);
            }

            return;

        }

        if (this.aConf.hideOnClick !== false) {
            this.oTarget.addEventListener('click', this.handlers.hide);
        }

        const attachEl = this.aConf.parentElement || document.body;
        attachEl.appendChild(this.els.root);

        this.layout(lastEvent);

        if (this.aConf.onShow) { this.aConf.onShow(lastEvent, this); }

        if (this.hasTransitions && this.aConf.animate) {

            this.els.root.classList.add('showing');
            this.els.root.addEventListener(this.transitionend, this.handlers.visible);
            this.els.root.clientHeight; // eslint-disable-line no-unused-expressions
            this.els.root.classList.remove('showing');

        } else {

            this.handlers.visible();

        }

    }

    /**
     * Called when the tooltip is fully visible, usually after transitions have completed.
     * Marks the state as 'visible' and finalizes any transition handling.
     * @private
     */
    onVisible() {

        if (this.hasTransitions && this.aConf.animate) {
            this.els.root.removeEventListener(this.transitionend, this.handlers.visible);
        }

        if (this.lastPointerEvent && (this.lastPointerEvent.touches || this.lastPointerEvent.pointerType === 'touch')) {
            if (!this.aConf.touchEnd) {
                document.addEventListener(this.hasPointerEvents ? 'pointerdown' : 'touchstart', this.handlers.hide);
            }
        } else {
            this.oTarget.removeEventListener('click', this.handlers.resetTimer);
        }

        this.state = 'visible';

    }

    /**
     * Recalculates layout and positioning of the tooltip based on pointer or target.
     * @param {Event} event  The layout-triggering event.
     */
    layout(event) {

        const oTargetRect = this.oTarget.getBoundingClientRect(),
              viewPortRect = this.aConf.parentElement ? this.aConf.parentElement.getBoundingClientRect() : { top: 0, left: 0 };

        this.oTargetPos = {
            top: oTargetRect.top - viewPortRect.top,
            left: oTargetRect.left - viewPortRect.left,
            width: oTargetRect.width,
            height: oTargetRect.height
        };

        this.viewPortPos = {
            top: viewPortRect.top,
            left: viewPortRect.left,
            width: viewPortRect.width,
            height: viewPortRect.height
        };

        if (event.touches || event.pointerType === 'touch' || event.type === 'mouseover' && this.isIos) {

            if (this.aConf.touchMove) {

                this.els.target = {
                    type: 'touch',
                    width: 20,
                    height: 20,
                    top: (event.touches && event.touches[0] ? event.touches[0].clientY : event.clientY) - 10,
                    left: (event.touches && event.touches[0] ? event.touches[0].clientX : event.clientX) - 10
                };

            } else {

                this.els.target = event instanceof DocumentFragment || event instanceof Element ? event : event.target || event.srcElement;

            }

        } else {

            this.els.target = {
                type: 'mouse',
                width: this.isWindows ? 24 : 20,
                height: 24,
                top: event.clientY - (this.isWindows ? 6 : 8),
                left: event.clientX - 10
            };

        }

        // TODO: this does not really work !!! Just a hack
        if (this.aConf.constrainMoveY) {
            this.els.target.top = this.oTargetPos.top + viewPortRect.top;
        }

        if (this.aConf.constrainMoveX) {
            this.els.target.left = this.oTargetPos.left;
        }

        super.layout();

    }

    /**
     * Finalizes hide transition, resets state and removes DOM.
     * @private
     */
    onHidden() {

        if (this.hasTransitions && this.aConf.animate) {
            this.els.root.removeEventListener(this.transitionend, this.handlers.hidden);
        }

        if (this.state === 'hiding') {
            this.detachContent();
            this.lastPointerEvent = null;
            this.oTargetPos = null;
            try {
                this.els.root.parentNode.removeChild(this.els.root);
            } catch (e) { // eslint-disable-line no-unused-vars
                /* */
            }
            this.state = 'hidden';
        }

        if (this.aConf.onHidden) { this.aConf.onHidden(); }

    }

    /**
     * Handler for mousemove or touchmove. Moves the tooltip with the pointer and hides it if necessary.
     * @private
     * @param {Event} event  The movement event.
     */
    onMove(event) {

        const mousePos = {
            top: event.touches ? event.touches[0].clientY : event.clientY,
            left: event.touches ? event.touches[0].clientX : event.clientX
        };

        this.lastPointerEvent = event;

        if (this.state === 'delaying') { return; }

        if (event && event.touches || event.pointerType === 'touch') {
            event.preventDefault();
        }

        // check if tooltip should not be hidden when either mouse button is pressed or we have a touch event
        let ignoreCheck = false;
        if (this.aConf.neverHideWhenPressed) {
            if (this.detectLeftButton(event) || event.touches || event.pointerType === 'touch') {
                ignoreCheck = true;
            }
        }

        const viewportPos = {
            top: this.aConf.limitLayout ? this.measurements.viewportPos.top : this.measurements.viewportPos.top + this.measurements.parentPos.top,
            left: this.aConf.limitLayout ? this.measurements.viewportPos.left : this.measurements.viewportPos.left + this.measurements.parentPos.left
        };

        // check if we have left the mouseover target and couldn't catch it bc of overlapping
        if (this.oTargetPos && !ignoreCheck
          && (mousePos.top - viewportPos.top + 1 < this.oTargetPos.top || mousePos.top - viewportPos.top - 1 > this.oTargetPos.top + this.oTargetPos.height
            || (mousePos.left - viewportPos.left + 1 < this.oTargetPos.left || mousePos.left - viewportPos.left - 1 > this.oTargetPos.left + this.oTargetPos.width))) {

            this.lastPointerEvent = null;
            this.hide(event);

        } else if (this.state === 'visible' || this.state === 'showing') {

            if (this.isLayouting) { return; }
            this.isLayouting = true;
            this.animId = requestAnimationFrame(() => {
                if (this.aConf.onMove) { this.aConf.onMove(event, this); }
                this.layout(event);
                this.isLayouting = false;
            });

        }

    }

    /**
     * Detects if the left mouse button is currently pressed.
     * @param   {Event}   event  The pointer or mouse event.
     * @returns {boolean}        True if left button is active.
     */
    detectLeftButton(event) { // eslint-disable-line class-methods-use-this

        const evt = event || window.event;
        if ('buttons' in event) {
            return evt.buttons === 1;
        }
        const button = evt.which || evt.button;
        return button === 1;

    }

    /**
     * Clears the delay timer if one is active.
     * @private
     */
    resetTimer() {

        if (this.timer !== null) {
            window.clearTimeout(this.timer);
            this.timer = null;
        }

    }

    /**
     * Cleans up DOM references and event listeners.
     */
    remove() {

        window.clearTimeout(this.timer);
        document.removeEventListener(this.hasPointerEvents ? 'pointermove' : 'touchmove', this.handlers.move);
        document.removeEventListener(this.hasPointerEvents ? 'pointerup' : 'touchend', this.handlers.hide);
        document.removeEventListener('touchmove', this.handlers.move);
        document.removeEventListener(this.hasPointerEvents ? 'pointermove' : 'mousemove', this.handlers.move);
        document.removeEventListener(this.hasPointerEvents ? 'pointerout' : 'mouseout', this.handlers.hide);
        document.removeEventListener(this.hasPointerEvents ? 'pointerup' : 'mouseup', this.handlers.hide);
        document.removeEventListener(this.hasPointerEvents ? 'pointerdown' : 'touchstart', this.handlers.hide);
        this.els.root.removeEventListener(this.transitionend, this.handlers.hidden);
        this.els.root.removeEventListener(this.transitionend, this.handlers.visible);

        if (this.oTarget) {
            this.oTarget.removeEventListener('click', this.handlers.hide);
            this.oTarget.removeEventListener('click', this.handlers.resetTimer);
            this.oTarget = null;
        }

        this.els = this.lastPointerEvent = null;

    }

}

/**
 * Holds the defaults for all instances.
 * @private
 * @type {module:lib/ui/tooltip~options}
 */
Tooltip.defaults = {
    orientation: 'auto',
    margins: {
        top: 10,
        bottom: 10,
        right: 10,
        left: 10
    },
    pointerDistance: 10,
    pointerEdgeDistance: 10,
    animate: true,
    delay: 250,
    baseViewClass: 'tt',
    display: 'block',
    pointerViewClass: 'tt-pointer',
    viewClass: '',
    hideOnClick: false,
    touchMove: false,
    touchEnd: false,
    touchDelay: true,
    neverHideWhenPressed: false,
    limitLayout: true
};

/**
 * Configures the tooltip globally, so it must be called on the constructor: `Tooltip.configure(...)`. Uses defaults for options that are not specified.
 * Unlike the instance method {@link module:lib/ui/tooltip#configure}, this applies to all future instances.
 * @param {module:lib/ui/tooltip~options} options  Global configuration object.
 */
Tooltip.configure = function(options) {

    Tooltip.prototype.extend(Tooltip.defaults, options);

};

/**
 * @typedef  {Object} module:lib/ui/tooltip~options                       Structure of the tooltip options
 * @property {Array<string>}  [orientation="top","bottom","right","left"]    An Array holding the preferred orientation in relation to the target element, ie the element the tooltip points to. The orientations are checked in the order they appear in the array, an as soon as the tooltip would fit on the screen with the currently tested orientation,the appropriate layout is selected for display.
 * @property {Object<number>} [margins={top:10,bottom:10,right:10,left:10}]  Minimum margins from viewport, separate for all four edges.
 * @property {number}         [pointerDistance=5]                            Distance between tooltip and target element.
 * @property {number}         [pointerEdgeDistance=10]                       Minimum default distance between pointer graphic and the edge of the tooltip background.
 * @property {boolean}        [animate=true]                                 Determines if the tooltip should be animated.
 * @property {number}         [delay=250]                                    Delay in milliseconds after which the tooltip is shown.
 * @property {string}         [pointerViewClass="tt-pointer"]                Default classname of the pointer element.
 * @property {string}         [viewClass=""]                                 Additional classname of the main view.
 * @property {boolean}        [hideOnClick=false]                            Usually, the tooltip hides when the mouse is clicked. Setting this to "true" prevents this behavior.
 * @property {boolean}        [touchMove=false]                              By default, the tooltip does not move with touch devices, but instead is rendered in the center of the target. If this is set to "true", the tooltip moves with the finger, i.e. Uses the "touchmove" event.
 * @property {boolean}        [touchEnd=false]                               By default, a visible tooltip hidden by a subsequent tap on touch devices. If this is set to "true", the tooltip is hidden with the "touchend" event.
 * @property {boolean}        [touchDelay=true]                              If this is set to "true", the tooltip delay is also in effect for touches. Otherwise it will only be active for mouse.
 * @property {boolean}        [neverHideWhenPressed=false]                   If this is set to "true", the tooltip is never hidden as long as the left mouse button is pressed, or the tap is still active (i.e. No touchend).
 */
