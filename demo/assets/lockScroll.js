/**
 * Copyright (c) 2015-2025 Frank Kudermann @ alphanull.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import pubsub from './publisher.js';

const iOS = /iPad|iPhone|iPod/.test(navigator.platform);

/* eslint-disable no-invalid-this */

/**
 * The touch move handler for iOS.
 * @function module:lib/ui/lockScroll~touchMoveHandler
 * @param {Event} event  The touchmove event.
 */
function touchMoveHandler(event) {

    const currentY = event.touches ? event.touches[0].pageY : event.pageY, // get current Y touch value
          { scrollTop } = this,
          delta = Number(this.dataset.delta),
          lastY = Number(this.dataset.lastY);

    if (this.dataset.lastY < 0) {
        // reset last value
        this.dataset.lastY = currentY;
        return;
    }

    const unchangedDir = currentY === lastY || Math.abs(currentY - lastY) < 1,
          dir = unchangedDir ? 'unchanged' : currentY > lastY ? 'down' : 'up'; // evaluate in which direction the swipe went

    this.dataset.lastY = currentY; // remember

    if (scrollTop < 1 && dir === 'down') { // check if we are already on top and trying to go further up
        event.preventDefault();
        event.stopPropagation();
    } else if (delta === 0 || scrollTop >= delta && dir === 'up') { // check if we are already on bottom and trying to go further down
        event.preventDefault();
        event.stopPropagation();
    }

    this.removeEventListener('touchmove', touchMoveHandler);

}

/**
 * This handler blocks touchmove events.
 * @function module:lib/ui/lockScroll~blockHandler
 * @param {Event} event  The touchmove event.
 */
function blockHandler(event) {

    event.preventDefault();

}

/* eslint-enable no-invalid-this */

/**
 * This handler handles touchstart events.
 * @function module:lib/ui/lockScroll~touchStartHandler
 * @param {HTMLElement} scrollLayer  The layer which should be blocked. This handler initializes the touchmove event on this layer.
 * @param {Event}       event        The touchstart event.
 */
function touchStartHandler(scrollLayer, event) {

    const { target } = event,
          { clientHeight } = scrollLayer;

    if (scrollLayer.dataset.isLocked !== 'true') {
        scrollLayer.dataset.isLocked = 'true';
        scrollLayer.addEventListener('touchmove', blockHandler);
        // document.body.addEventListener("touchmove", blockHandler);
    }

    if (scrollLayer.contains(target) && scrollLayer.scrollHeight > window.innerHeight + 1) {

        scrollLayer.dataset.lastY = event.touches ? event.touches[0].pageY : event.pageY;
        scrollLayer.dataset.scrollHeight = scrollLayer.scrollHeight;
        scrollLayer.dataset.clientHeight = clientHeight;
        scrollLayer.dataset.delta = scrollLayer.scrollHeight - scrollLayer.clientHeight;
        scrollLayer.dataset.isLocked = 'false';
        scrollLayer.removeEventListener('touchmove', blockHandler);
        scrollLayer.addEventListener('touchmove', touchMoveHandler);

    }

}

/**
 * Locks the UI, but allows an overlay to scroll.
 * @module   lib/ui/lockScroll
 * @requires toolbox/client
 * @requires lib/util/publisher
 * @author Frank Kudermann @ alphanull
 * @version 1.2.0
 */
export default {

    /**
     * Determines how many locks are active.
     * @type {number}
     */
    locks: 0,

    /**
     * The scrollTop position, saved for later restoring.
     * @type {number}
     */
    savedScrollTop: 0,

    /**
     * This method is triggered when this controller enters focus. Since this controller is "persistent" it has no "leave" method.
     */
    enter() {

        this.locks = 0;
        this.touchStartHandlers = [];
        pubsub.subscribe('locklayer', this.lock.bind(this));
        pubsub.subscribe('unlocklayer', this.unlock.bind(this));

    },

    /**
     * Locks scrolling on a certain layer.
     * @param {HTMLElement} data  The Element which should be locked.
     */
    lock(data) {

        const scrollLayer = data;

        if (iOS) {

            // lock handling for iOS devices
            const onTouchStartHandler = touchStartHandler.bind(scrollLayer, scrollLayer);

            this.touchStartHandlers.push({
                layer: scrollLayer,
                handler: onTouchStartHandler
            });

            scrollLayer.addEventListener('touchstart', onTouchStartHandler);

            if (scrollLayer.dataset.isLocked !== 'true') {
                scrollLayer.dataset.isLocked = 'true';
                scrollLayer.addEventListener('touchmove', blockHandler);
                // document.body.addEventListener("touchmove", blockHandler);
            }

        } else if (this.locks === 0) {

            this.savedScrollTop = document.body.scrollTop;

            document.body.style.position = 'absolute';
            document.body.style.overflow = 'hidden';
            document.body.scrollTop = this.savedScrollTop;

            this.locks = 1;

        } else {

            this.locks += 1;

        }

    },

    /**
     * Unlocks a previously locked layer.
     */
    unlock() {

        if (iOS) {

            const lastHandler = this.touchStartHandlers.pop();

            if (lastHandler) {
                lastHandler.layer.removeEventListener('touchstart', lastHandler.handler);
            }

        } else if (this.locks === 1) {

            document.body.scrollTop = this.savedScrollTop;
            document.body.style.position = '';
            document.body.style.overflow = '';

            this.locks = 0;

        } else if (this.locks > 0) {

            this.locks -= 1;

        }

    }
};
