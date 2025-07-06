/**
 * Detects whether the browser supports Web Workers with ES6 module syntax (`type: 'module'`).
 * @module lib/util/supportsWorkerModules
 * @author  Frank Kudermann - alphanull
 * @version 1.0.0
 * @license MIT
 */
export default supportsWorkerModules;

/**
 * This function attempts to create a Web Worker with an ES6 module and sends a test message to verify support.
 * It creates a Worker from a Blob and attempts to run code that checks if `type: 'module'` works for Workers.
 * The function uses `eval()` to run a base64-encoded Worker script since `importScripts` cannot be used with ES6 modules.
 * @memberof module:lib/util/supportsWorkerModules
 * @returns {Promise<boolean>} A promise that resolves to true if ES6 module Workers are supported, otherwise false.
 */
function supportsWorkerModules() {
    return new Promise(resolve => {
        try {
            // Define the Worker code as a string (this will be base64 encoded)
            const workerCode = "onmessage = function() { postMessage('Worker Done'); }",
                  base64Module = btoa(workerCode), // Encode the Worker code into Base64
                  blob = new Blob([`const code = atob('${base64Module}'); eval(code);`], { type: 'application/javascript' }), // Create a Blob containing the Worker code wrapped in eval() for execution
                  workerURL = URL.createObjectURL(blob), // Create a URL for the Blob and create the Worker
                  testWorker = new Worker(workerURL, { type: 'module' }); // Create a Worker with ES6 module type

            // Set up message handler to check if the Worker module is supported
            testWorker.onmessage = function() {
                URL.revokeObjectURL(workerURL); // Clean up the Blob URL
                testWorker.terminate(); // Terminate the Worker
                resolve(true); // Resolve the Promise to indicate Worker module is supported
            };
            // Handle errors if the Worker fails (i.e., if modules are not supported)
            testWorker.onerror = function() {
                URL.revokeObjectURL(workerURL); // Clean up the Blob URL
                testWorker.terminate(); // Terminate the Worker
                resolve(false); // Resolve the Promise to indicate Worker module is not supported
            };
            // Post a test message to trigger Worker execution
            testWorker.postMessage('test'); // This triggers the `onmessage` callback in the Worker

        } catch {
            resolve(false); // Resolve the Promise to indicate failure
        }
    });
}
