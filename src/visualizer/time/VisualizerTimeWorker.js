/**
 * This worker receives messages from the main thread to initialize, resize, or render time-domain data as a waveform visualization.
 * @exports module:src/visualizer/time/VisualizerTimeWorker
 * @author Frank Kudermann - alphanull
 * @version 1.0.0
 * @license MIT
 */

let canvas, ctx;

/**
 * Renders a waveform visualization based on the provided time-domain data.
 * @private
 * @param {number[][]} timeData  An array containing time-domain data for each channel.
 */
const render = timeData => {

    const bufferLength = timeData[0].length,
          sliceWidth = canvas.width / bufferLength;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgb(255 255 255)';

    let x = 0;

    ctx.beginPath();

    for (let i = 0; i < bufferLength; i += 1) {
        const v = timeData[0][i] / 128.0,
              y = v * canvas.height / 2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        x += sliceWidth;
    }

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

};

/**
 * Global message handler for the worker.
 * @private
 * @param {MessageEvent} event  The message event sent from the main thread.
 * @listens MessageEvent
 */
onmessage = function(event) {

    const { type, timeData, offscreenCanvas, width, height } = event.data;

    switch (type) {
        case 'init':
            canvas = offscreenCanvas;
            ctx = canvas.getContext('2d');
            break;
        case 'resize':
            canvas.width = width;
            canvas.height = height;
            break;
        case 'render':
            render(timeData);
            break;
        default:
            // eslint-disable-next-line no-console
            console.warn('[VisWorker] unknown event type', event.type, event);
    }
};
