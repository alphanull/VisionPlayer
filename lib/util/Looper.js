/**
 * Provides a robust, stoppable animation loop based on requestAnimationFrame.
 * Ensures that only one loop instance is running at any given time.
 * Can run on requestAnimationFrame (default) or at a custom interval.
 * Supports an optional frame limit for one-shot animations.
 * @exports module:lib/util/Looper
 * @author    Frank Kudermann - alphanull
 * @version   1.0.0
 * @license MIT
 */
export default class Looper {
    /**
     * The user-defined render function to be called on each frame/tick.
     * @type {Function}
     */
    #renderFn;

    /**
     * Current timer ID (RAF or interval), or null if stopped.
     * @type {number|null}
     */
    #timerId = null;

    /**
     * The update interval in milliseconds. If null, uses requestAnimationFrame.
     * @type {number|null}
     */
    #interval = null;

    /**
     * The maximum number of frames/ticks to run, or null for unlimited.
     * @type {number|null}
     */
    #tickLimit = null;

    /**
     * Current tick/frame count for a limited run.
     * @type {number}
     */
    #tickCount = 0;

    /**
     * Number of frames/ticks since the last FPS calculation.
     * @type {number}
     */
    #frameCount = 0;

    /**
     * Timestamp of the last FPS calculation.
     * @type {number}
     */
    #lastFpsUpdate = 0;

    /**
     * Most recent calculated FPS value.
     * @type {number}
     */
    #currentFps = 0;

    /**
     * Creates a new RAFLoop instance.
     * @param  {Function}  renderFn    The function to execute on each frame/tick. Must not be null.
     * @param  {number}    [interval]  Optional: update interval in milliseconds. If omitted or falsy, uses requestAnimationFrame.
     * @throws {TypeError}             If renderFn is not a function.
     */
    constructor(renderFn, interval) {

        if (typeof renderFn !== 'function') throw new TypeError('RAFLoop: renderFn must be a function.');
        this.#renderFn = renderFn;
        this.#interval = typeof interval === 'number' && interval > 0 ? interval : null;

    }

    /**
     * Starts the loop if not already running.
     * Optionally limits the number of ticks/frames.
     * If called again while running, changes the tick limit or makes the loop unlimited.
     * @param {number} [limit]  Optional maximum number of ticks; unlimited if omitted or invalid.
     */
    start(limit) {

        const isFiniteLimit = typeof limit === 'number' && Number.isFinite(limit) && limit > 0;

        if (this.#timerId !== null) {
            // Already running: update limit if needed.
            if (isFiniteLimit) {
                this.#tickLimit = limit;
            } else {
                this.#tickLimit = null;
            }
            return;
        }

        this.#tickLimit = isFiniteLimit ? limit : null;
        this.#tickCount = 0;
        this.#lastFpsUpdate = performance.now();
        this.#frameCount = 0;

        if (this.#interval === null) {
            this.#tickRAF(); // RAF mode
        } else {
            this.#timerId = setInterval(() => { this.#handleTick(); }, this.#interval); // Interval mode
        }

    }

    /**
     * Stops the loop if running.
     */
    stop() {

        if (this.#timerId !== null) {
            if (this.#interval === null) {
                cancelAnimationFrame(this.#timerId); // RAF mode
            } else {
                clearInterval(this.#timerId); // Interval mode
            }
            this.#timerId = null;
        }
        this.#tickLimit = null;
        this.#tickCount = 0;

    }

    /**
     * Returns whether the loop is currently running.
     * @returns {boolean} True if the loop is active, false otherwise.
     */
    isRunning() {

        return this.#timerId !== null;

    }

    /**
     * Returns the currently measured frames/ticks per second (FPS/TPS).
     * @returns {number} The most recent FPS/TPS value, updated once per second.
     */
    getFPS() {

        return this.#currentFps;

    }

    /**
     * Internal tick method for RAF mode.
     * @private
     */
    #tickRAF = () => {

        this.#timerId = requestAnimationFrame(this.#tickRAF);
        this.#handleTick();

    };

    /**
     * Internal tick logic shared by RAF and interval.
     * Increments tick counter, handles limit and FPS calculation.
     * @private
     */
    #handleTick() {

        // FPS Calculation
        const now = performance.now();
        this.#frameCount += 1;
        if (now - this.#lastFpsUpdate >= 1000) {
            this.#currentFps = Math.round(this.#frameCount * 1000 / (now - this.#lastFpsUpdate));
            this.#frameCount = 0;
            this.#lastFpsUpdate = now;
        }

        // Limited run: tick counting
        if (this.#tickLimit !== null) {
            this.#tickCount += 1;
            if (this.#tickCount > this.#tickLimit) {
                this.stop();
                return;
            }
        }

        this.#renderFn();

    }

    /**
     * Performs full cleanup by stopping the loop and clearing the render function.
     * Should be called when the instance is no longer needed.
     */
    destroy() {
        this.stop();
        this.#renderFn = null;
    }
}
