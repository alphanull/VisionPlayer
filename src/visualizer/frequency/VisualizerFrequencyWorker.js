/**
 * This worker processes frequency data for the VisualizerFrequency component.
 * It receives messages from the main thread to initialize the worker,
 * resize the offscreen canvas, or render frequency data.
 * @exports module:src/visualizer/frequency/VisualizerFrequencyWorker
 * @requires lib/util/math
 * @requires src/visualizer/frequency/VisualizerFrequencyRender
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */

let renderCanvas, ctx, conf;

import render from './VisualizerFrequencyRender.js';

/**
 * Global message handler for the worker.
 * Processes messages from the main thread based on the message type.
 * @param {MessageEvent} event  The message event from the main thread.
 * @listens MessageEvent
 */
onmessage = event => {

    const { type, frequencyData, offscreenCanvas, config, width, height } = event.data;

    switch (type) {
        case 'init':
            renderCanvas = offscreenCanvas;
            ctx = renderCanvas.getContext('2d');
            conf = config;
            break;
        case 'resize':
            renderCanvas.width = width;
            renderCanvas.height = height;
            break;
        case 'render':
            render(frequencyData, renderCanvas, ctx, conf);
            break;
        default:
            // eslint-disable-next-line no-console
            console.warn('[VisWorker] unknown event type', event.type, event);
    }
};
