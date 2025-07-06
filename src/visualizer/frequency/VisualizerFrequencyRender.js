import { convertRange, convertRangeClamp, lerp } from '../../../lib/util/math.js';

// store last values for smoothing
let previous = [{}, {}];

/**
 * This module provides the render function for frequency-based audio visualization.
 * It receives raw frequency data (typically from the Web Audio API) and draws a frequency spectrum
 * on a given canvas element using logarithmic scaling and dynamic smoothing.
 * The function is used by both the main thread and worker-based rendering logic in
 * frequency visualizer components.
 * @module   src/visualizer/frequency/VisualizerFrequencyRender
 * @requires lib/util/math
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */

/**
 * Renders the frequency data onto the provided canvas using the specified context and configuration.
 * This function is both being used by the worker / non-worker rendering path.
 * @function render
 * @param {number[]}                 frequencyData  An array containing frequency data for left and right channels.
 * @param {HTMLCanvasElement}        canvas         The canvas element where the visualization will be rendered.
 * @param {CanvasRenderingContext2D} context        The 2D rendering context for the canvas.
 * @param {Object}                   config         Additional render options.
 * @param {number}                   config.hiPass  The high-pass filter value (0-1).
 * @param {number}                   config.loPass  The low-pass filter value (0-1).
 */
export default function render(frequencyData, canvas, context, config) {

    const bufferLength = frequencyData[0].length,
          bars = bufferLength - bufferLength * config.hiPass - bufferLength * config.loPass,
          barWidth = Math.round(canvas.width / Math.max(1, bars));

    let x = 0,
        barHeightL,
        barHeightR;

    context.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = bufferLength * config.hiPass; i < bufferLength * (1 - config.loPass); i += 1) {

        const log = Math.floor((i / bars) ** 2 * bufferLength), // logarithmically scaled index
              lData = frequencyData[0][log],
              rData = frequencyData[1] ? frequencyData[1][log] : lData,
              sData = lData + rData / 2;

        barHeightL = lerp(previous[0][log] || 0, convertRangeClamp(lData, [0, 255], [0, canvas.height / 2]), 0.5);
        barHeightR = lerp(previous[1][log] || 0, convertRangeClamp(rData, [0, 255], [0, canvas.height / 2]), 0.5);

        context.fillStyle = `hsla(${convertRange(log, [0, bufferLength], [0, 360])}, 100%, 50%, ${convertRange(sData, [0, 255], [1, 1])})`;
        context.fillRect(x, canvas.height / 2 - barHeightL, barWidth, barHeightL + barHeightR);

        x += barWidth;

    }

    previous = frequencyData;

}
