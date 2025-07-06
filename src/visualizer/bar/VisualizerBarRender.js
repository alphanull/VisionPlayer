import { convertRange } from '../../../lib/util/math.js';

/**
 * This module provides the render function for frequency-based audio visualization.
 * It receives raw frequency data (typically from the Web Audio API) and draws animated bars
 * on a given canvas element using logarithmic scaling and dynamic smoothing.
 * The function is used by both the main thread and worker-based rendering logic in
 * frequency visualizer components.
 * @module   src/visualizer/bar/VisualizerBarRender
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

    const bufferLength = frequencyData.length,
          barPadding = canvas.width * 0.03,
          bars = bufferLength - bufferLength * config.hiPass - bufferLength * config.loPass,
          barWidth = Math.round((canvas.width - (bars * 2 - 1) * barPadding) / Math.max(1, bars * 2 - 1)),
          roundness = 100;

    context.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = bufferLength * config.hiPass; i < bufferLength * (1 - config.loPass); i += 1) {

        const lData = frequencyData[i],
              center = canvas.width / 2 - barWidth / 2,
              barHeight = convertRange(lData, [0, 255], [0, canvas.height]),
              canvasHeight = canvas.height / 2;

        context.fillStyle = 'white';

        if (i === 0) { // center
            context.beginPath();
            context.roundRect(center, canvasHeight - barHeight / 2, barWidth, barHeight, roundness);
            context.fill();
            continue;
        }

        context.beginPath(); // left
        context.roundRect(center - (barWidth + barPadding) * i, canvasHeight - barHeight / 2, barWidth, barHeight, roundness);
        context.fill();

        context.beginPath(); // right
        context.roundRect(center + (barWidth + barPadding) * i, canvasHeight - barHeight / 2, barWidth, barHeight, roundness);
        context.fill();

    }

}
