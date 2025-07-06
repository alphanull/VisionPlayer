/**
 * Provides an abortable asynchronous task with status tracking and promise-based interface.
 * Designed for use cases where you need to await, resolve, reject or cancel asynchronous flows manually.
 * @exports module:lib/util/AsyncTask
 * @author  Frank Kudermann - alphanull
 * @version 1.0.0
 * @license MIT
 */
export default class AsyncTask {

    /**
     * Internal AbortController instance used for cancellation.
     * @private
     * @type {AbortController}
     */
    #abortController;

    /**
     * Abort signal to be passed to consumers (e.g. Fetch, plugin tasks, etc).
     * @private
     * @type {AbortSignal}
     */
    #signal;

    /**
     * Promise resolve function (internal use).
     * @private
     * @type {Function}
     */
    #resolve;

    /**
     * Promise reject function (internal use).
     * @private
     * @type {Function}
     */
    #reject;

    /**
     * Current status of the task: 'pending', 'resolved', 'rejected', or 'cancelled'.
     * @private
     * @type {string}
     */
    #status = 'pending';

    /**
     * The underlying promise that will resolve, reject, or cancel according to the task's outcome.
     * @type {Promise<*>}
     */
    promise;

    /**
     * Creates a new AsyncTask instance. The task will be in 'pending' state until resolved, rejected, or cancelled.
     */
    constructor() {
        this.#abortController = new AbortController();
        this.#signal = this.#abortController.signal;

        this.promise = new Promise((resolve, reject) => {

            this.#resolve = value => {
                if (this.#status === 'pending') {
                    this.#status = 'resolved';
                    resolve(value);
                }
            };
            this.#reject = reason => {
                if (this.#status === 'pending') {
                    this.#status = reason instanceof DOMException && reason.name === 'AbortError'
                        ? 'cancelled'
                        : 'rejected';
                    reject(reason);
                }
            };

            // Cancel immediately if already aborted.
            if (this.#signal.aborted) {
                this.#reject(new DOMException('Cancelled', 'AbortError'));
            }

            // Listen for external cancellation via AbortController.
            this.#signal.addEventListener('abort', () => {
                this.#reject(new DOMException('Cancelled', 'AbortError'));
            });
        });
    }

    /**
     * Resolves the task successfully. Sets status to 'resolved' and fulfills the promise.
     * @param {*} value  Value with which the promise will resolve.
     */
    resolve(value) { this.#resolve(value); }

    /**
     * Rejects the task with an error. Sets status to 'rejected' (or 'cancelled' if AbortError) and rejects the promise.
     * @param {*} reason  Reason for rejection (error object or value).
     */
    reject(reason) { this.#reject(reason); }

    /**
     * Cancels the task using the AbortController. Sets status to 'cancelled' and rejects the promise with an AbortError.
     * @returns {Promise} Returns current promise.
     */
    cancel() {

        if (this.#status === 'pending') this.#abortController.abort();
        return this.promise;

    }

    /**
     * Returns the AbortSignal associated with this task. Useful for passing to APIs that support cancellation.
     * @returns {AbortSignal} The signal instance.
     */
    get signal() { return this.#signal; }

    /**
     * Returns the current status of the task: 'pending', 'resolved', 'rejected', or 'cancelled'.
     * @returns {string} The current status.
     */
    get status() { return this.#status; }
}
