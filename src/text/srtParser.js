/**
 * @exports module:src/text/srtParser
 * @author Silvia Pfeiffer
 * @license MIT
 * @see     https://github.com/silviapfeiffer/silviapfeiffer.github.io/blob/master/index.html
 */

/**
 * Converts an SRT-formatted string to a WebVTT-formatted string.
 * @param   {string} data  The SRT input data.
 * @returns {string}       A WebVTT-formatted string.
 */
export default function srt2webvtt(data) {
    let srt = data.replace(/\r+/g, ''); // remove dos newlines
    srt = srt.replace(/^\s+|\s+$/g, ''); // trim white space start and end

    const cuelist = srt.split('\n\n');// get cues
    let result = '';
    if (cuelist.length > 0) {
        result += 'WEBVTT\n\n';
        for (let i = 0; i < cuelist.length; i += 1) {
            result += convertSrtCue(cuelist[i]);
        }
    }

    return result;
}

/**
 * Converts a single SRT cue entry to a WebVTT cue entry.
 * @private
 * @memberof module:src/text/srtParser
 * @param   {string} caption  The SRT cue text (including timecode and content).
 * @returns {string}          A WebVTT cue string, or an empty string if parsing fails.
 */
function convertSrtCue(caption) {

    let cue = '';
    const s = caption.split(/\n/);

    // concatenate muilt-line string separated in array into one
    while (s.length > 3) {
        for (let i = 3; i < s.length; i += 1) {
            s[2] += `\n${s[i]}`;
        }
        s.splice(3, s.length - 3);
    }

    let line = 0;

    // detect identifier
    if (!s[0].match(/\d+:\d+:\d+/) && s[1].match(/\d+:\d+:\d+/)) {
        cue += `${s[0].match(/\w+/)}\n`;
        line += 1;
    }

    // get time strings
    if (s[line].match(/\d+:\d+:\d+/)) {
        // convert time string
        const m = s[1].match(/(\d+):(\d+):(\d+)(?:,(\d+))?\s*--?>\s*(\d+):(\d+):(\d+)(?:,(\d+))?/);
        if (m) {
            cue += `${m[1]}:${m[2]}:${m[3]}.${m[4]} --> ${m[5]}:${m[6]}:${m[7]}.${m[8]}\n`;
            line += 1;
        } else {
            return ''; // Unrecognized timestring
        }
    } else {
        return ''; // file format error or comment lines
    }

    if (s[line]) cue += `${s[line]}\n\n`; // get cue text

    return cue;
}
