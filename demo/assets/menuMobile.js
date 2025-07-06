import { publish } from './publisher.js';

export default {

    init(content, options = {}) {

        if (content) {
            this.content = content;
        } else {
            this.content = document.createElement('nav');
            this.content.id = 'menu-mobile';
        }

        this.options = options;

        if (options.initiator) {
            this.initiator = options.initiator;
            this.initiator.addEventListener('click', this.show.bind(this));
        }

        if (options.closeTrigger) {
            this.closeTrigger = options.closeTrigger;
        }

        this.dragLayer = this.content;

        this.clickBlocker = document.createElement('div');
        this.clickBlocker.className = 'menu-mobile-bg';

        this.wrapper = document.createElement('div');
        this.wrapper.className = 'menu-mobile-wrapper';

        this.view = document.createElement('div');
        this.view.className = 'menu-mobile';
        this.view.setAttribute('data-lenis-prevent', '');
        this.view.appendChild(this.clickBlocker);
        this.view.appendChild(this.wrapper);

        const sty = this.content.style,
              transforms = ['webkitTransform', 'MozTransform', 'msTransform', 'OTransform', 'transform'];

        this.transform = 'transform';

        for (const i in transforms) {
            if (i in sty) {
                this.transform = transforms[i];
                break;
            }
        }

        this.onNavTouchStartHandler = this.pointerStart.bind(this);
        this.onNavTouchMoveHandler = this.pointerMove.bind(this);
        this.onNavTouchEndHandler = this.pointerEnd.bind(this);
        this.onHide = this.hide.bind(this);
        this.onNavAniEnd = this.hideEnd.bind(this);
        this.onNavResize = this.resize.bind(this);
        this.onNavClick = this.navClick.bind(this);

        this.ro = new ResizeObserver(this.onNavResize);

    },

    show() {

        this.mobileNaviActive = true;
        this.attachContent(this.content);

        this.wrapper.addEventListener('click', this.onHide);
        this.content.addEventListener('click', this.onNavClick);
        this.content.classList.add('menu-mobile-content');
        this.view.classList.add('active');

        // window.addEventListener('resize', this.onNavResize);
        this.ro.observe(this.view);

        publish('locklayer', this.wrapper, { async: false });
        publish('menu/mobile/show');

        if (this.options.insertBefore) {
            this.options.insertBefore.parentNode.insertBefore(this.view, this.options.insertBefore);
        } else {
            document.body.appendChild(this.view);
        }

        if (this.closeTrigger) {
            this.closeTrigger.addEventListener('click', this.hide.bind(this));
        }

        this.content.addEventListener('pointerdown', this.onNavTouchStartHandler);

        setTimeout(() => { this.view.classList.add('visible'); }, 20);

    },

    hide(event) {

        if (event === true || event === undefined || event.target === this.wrapper || event.target === this.closeTrigger) {

            publish('menu/mobile/hide');

            this.navDragPercent = 0;
            this.wrapper.removeEventListener('click', this.onHide);
            this.content.removeEventListener('click', this.onNavClick);
            // window.removeEventListener('resize', this.onNavResize);
            this.ro.unobserve(this.view);

            this.clickBlocker.addEventListener('transitionend', this.onNavAniEnd);
            this.pointerEnd();
            this.content.removeEventListener('pointerdown', this.onNavTouchStartHandler);

            this.view.classList.remove('visible');

        } else if (event.target.tagName !== 'A' && event.target.tagName !== 'BUTTON' && event.target.tagName !== 'INPUT') {

            event.preventDefault();

        }

    },

    hideEnd() {

        this.detachContent();

        this.mobileNaviActive = false;
        this.dragLayer.style[this.transform] = '';
        this.navDragPercent = 0;

        this.clickBlocker.removeEventListener('transitionend', this.onNavAniEnd);

        if (this.closeTrigger) {
            this.closeTrigger.removeEventListener('click', this.hide.bind(this));
        }

        this.view.classList.remove('active');
        this.content.classList.remove('menu-mobile-content');

        this.view.parentNode.removeChild(this.view);

        publish('unlocklayer', this.wrapper, { async: false });
        publish('menu/mobile/hidden');

        if (this.event) {

            // $$$ PATCH
            // location.href = this.event.srcElement.href;
            // window.location.replace(this.event.srcElement.href);
            this.event.srcElement.click();

            publish('menu/mobile/navigate', this.event);
            this.event = null;

        }

    },

    navClick(event) {

        publish('menu/mobile/clicked', event);

        const target = event.target.parentNode.tagName === 'A'
            ? event.target.parentNode
            : event.target;

        if (target.tagName === 'A') {

            this.event = event;

            if (this.options.preventDefault) {
                event.preventDefault();
                event.stopPropagation();
            }

            this.hide(true);

        }

    },

    resize(entries) {

        this.viewportWidth = entries[0] && entries[0].contentRect.width;
        if (this.viewportWidth > 1023) this.hide();

    },

    attachContent(content) {

        if (content instanceof DocumentFragment || content instanceof Element) {

            if (content.parentNode) {

                //  save current Location
                this.savedParent = content.parentNode;
                this.savedSibling = content.nextElementSibling;
                /* this.savedStyle = content.currentStyle === undefined ? window.getComputedStyle(content, null).display : content.currentStyle.display;

                if (this.savedStyle === "none") {
                    switch (content.tagName) { // check for right display using tag names, when node was hidden ($$$$ VERY incomplete)
                        case "SPAN":
                            content.style.display = "inline";
                            break;
                        default:
                            content.style.display = "block";
                            break;
                    }
                } */

            }

            this.wrapper.appendChild(content);

        } else if (typeof content === 'string' || content instanceof String) {

            this.wrapper.innerHTML = content;

        } else {

            throw new Error('Overlay: No valid content type, must be a string or DOM Element');

        }

    },

    /**
     * If an existing content parent position was saved before, put the element back where it was, otherwise just empty the content area.
     * @private
     */
    detachContent() {

        if (this.savedParent) {

            /* if (this.savedStyle === "none") {
                this.content.style.display = "none";
            } */

            if (this.savedSibling) {
                this.savedParent.insertBefore(this.content, this.savedSibling);
                this.savedSibling = null;
            } else {
                this.savedParent.appendChild(this.content);
            }

            this.savedParent = null;

        } else if (this.wrapper && this.wrapper.firstChild && this.content) {

            this.wrapper.removeChild(this.content);

        }

    },

    pointerStart(event) {

        this.dragLayer.classList.add('dragging');
        this.isDragging = true;
        this.lastX = event.touches ? event.touches[0].pageX : event.pageX; // get current Y touch value;

        this.content.addEventListener('pointermove', this.onNavTouchMoveHandler);
        this.content.addEventListener('pointerup', this.onNavTouchEndHandler);

    },

    pointerMove(event) {

        if (this.requestID !== undefined && this.requestID !== null) { return false; }

        this.requestID = window.requestAnimationFrame(() => {

            this.requestID = null;

            const currentX = event.touches ? event.touches[0].pageX : event.pageX; // get current X touch values
            let delta;

            // reset last value
            if (this.lastX < 0) {
                this.lastX = currentX;
                delta = 0;
            } else {
                delta = currentX - this.lastX;
            }

            this.navDragPercent = delta / this.viewportWidth * 200;

            if (this.navDragPercent > 40 && this.dragLayer === this.content) {

                this.isDragging = false;
                this.hide();

            } else if (this.navDragPercent > 1 && this.dragLayer === this.content) {

                window.requestAnimationFrame(() => {
                    this.dragLayer.style[this.transform] = `translateX(${this.navDragPercent}%) translateY(0) translateZ(0)`;
                });

            }

        });

    },

    pointerEnd(event, reset) {

        if (this.requestID !== undefined && this.requestID !== null) {
            cancelAnimationFrame(this.requestID);
            this.requestID = null;
        }

        this.dragLayer.classList.remove('dragging');
        this.isDragging = false;

        if (reset !== false) {
            this.dragLayer.style[this.transform] = '';
            this.navDragPercent = 0;
        }

        this.content.removeEventListener('pointermove', this.onNavTouchMoveHandler);
        this.content.removeEventListener('pointerup', this.onNavTouchEndHandler);

    }
};
