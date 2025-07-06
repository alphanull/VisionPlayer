import DomSmith from '../../lib/dom/DomSmith.js';
import { htmlspecialchars, stripTags, sanitizeHTML } from '../../lib/util/sanitize.js';

/**
 * The SubtitleRendererVTT component handles the rendering and positioning of VTT-based subtitles.
 * It is responsible for displaying subtitle cues on screen, adapting to both horizontal and vertical layouts,
 * and supporting snapping to line grids or absolute positioning. The renderer also performs HTML sanitization.
 * @exports module:src/text/SubtitleRendererVTT
 * @requires lib/dom/DomSmith
 * @requires lib/util/sanitize
 * @author  Frank Kudermann - alphanull
 * @version 1.0.0
 * @license MIT
 */
export default class SubtitleRendererVTT {

    /**
     * Configuration options for the SubtitleRendererVTT component.
     * @type {module:src/text/SubtitleRendererVTT~SubtitleRendererVTTConfig}
     */
    #config = {
        forceSnapToLines: false
    };

    /**
     * The player instance that this renderer belongs to.
     * @type {Object}
     */
    #player;

    /**
     * Maximum number of horizontal subtitle lines.
     * @type {number}
     */
    #linesHorMax = 9;

    /**
     * Map of active horizontal lines. Tracks which lines are in use.
     * @type {Array<{ isActive: boolean }>}
     */
    #linesHorMap = new Array(this.#linesHorMax).fill(true).map(() => ({ isActive: false }));

    /**
     * Maximum number of vertical subtitle lines.
     * @type {number}
     */
    #linesVertMax = 15;

    /**
     * Map of active vertical lines. Tracks which lines are in use.
     * @type {Array<{ isActive: boolean }>}
     */
    #linesVertMap = new Array(this.#linesVertMax).fill(true).map(() => ({ isActive: false }));

    /**
     * DomSmith instance to manage the structure of the subtitle elements.
     * @type {module:lib/dom/DomSmith}
     */
    #dom;

    /**
     * A map containing all currently active subtitle cues.
     * @type {Map}
     */
    #currentCues;

    /**
     * Creates an instance of the SubtitleRendererVTT.
     * @param {module:src/core/Player}    player  Main player instance.
     * @param {module:src/text/Subtitles} parent  The parent Subtitles component.
     */
    constructor(player, parent) {

        this.#config = player.initConfig('subtitlesVTT', this.#config);

        this.#player = player;

        parent.registerRenderer(this);

        this.#dom = new DomSmith({
            className: 'vip-subtitles-container vip-subtitles-vtt',
            _nodes: [{
                _ref: 'fixed',
                className: 'vip-subtitle-fixed'
            }, {
                _ref: 'lines-vert',
                className: 'vip-subtitle-lines is-vertical',
                _nodes: [...Array(this.#linesVertMax)].map((item, index) => ({
                    className: 'vip-subtitle-line',
                    _ref: `line-ver-${index}`
                }))
            }, {
                _ref: 'lines-hor',
                className: 'vip-subtitle-lines',
                _nodes: [...Array(this.#linesHorMax)].map((item, index) => ({
                    className: 'vip-subtitle-line',
                    _ref: `line-hor-${index}`
                }))
            }]
        }, parent.getElement());

    }

    /**
     * Checks if the subtitle cue has text to be rendered.
     * @param   {Object}  cue  The subtitle cue object.
     * @returns {boolean}      True if the cue contains text, false otherwise.
     */
    canRender(cue) { // eslint-disable-line class-methods-use-this

        return cue && cue.text;

    }

    /**
     * Renders a subtitle cue on the screen, positioning it based on various options.
     * @param {Object} cue          The subtitle cue to render.
     * @param {Map}    currentCues  A map containing all currently active subtitle cues.
     */
    render(cue, currentCues) { // eslint-disable-line max-lines-per-function

        const { text, align, line, snapToLines, vertical, position, size, alignStart, alignEnd, alignMiddle } = cue,
              subTitleEleWrapper = document.createElement('div'),
              subTitleEle = document.createElement('p');

        this.#currentCues = currentCues;

        // Parsing and sanitizing subtitle text
        let parsedText;

        const { allowHTML, background } = this.#player.getConfig('subtitles');

        if (allowHTML === 'basic') parsedText = stripTags(text, '<b><i><u><c>');
        else if (allowHTML === 'all') parsedText = sanitizeHTML(text);
        else parsedText = htmlspecialchars(stripTags(text));

        // Applying background condition based on configuration
        if (background === 'auto' && text.match(/^<img([\w\W]+?)\/?>$/) || background === 'never') {
            subTitleEle.classList.add('no-bg');
        }

        subTitleEle.classList.add('vip-subtitle-text');

        if (allowHTML === 'none') {
            subTitleEle.textContent = parsedText;
        } else {
            subTitleEle.innerHTML = parsedText.replace(/\n/g, '<br>');
        }

        if (!snapToLines) this.#dom.fixed.appendChild(subTitleEleWrapper);
        subTitleEleWrapper.className = 'vip-subtitle-item';
        subTitleEleWrapper.appendChild(subTitleEle);
        subTitleEleWrapper.height = subTitleEleWrapper.getBoundingClientRect().height;
        subTitleEleWrapper.width = subTitleEleWrapper.getBoundingClientRect().width;

        const alignS = align === 'left' || align === 'start' || alignStart,
              alignE = align === 'right' || align === 'end' || alignEnd,
              alignM = align === 'center' || align === 'middle' || alignMiddle,
              isVertical = vertical === 'lr' || vertical === 'rl',
              isLr = vertical === 'lr',
              isRl = vertical === 'rl',
              autoLine = typeof line === 'undefined' || line === 'auto';

        if (alignS) subTitleEleWrapper.classList.add('align-start');
        if (alignE) subTitleEleWrapper.classList.add('align-end');
        if (alignM) subTitleEleWrapper.classList.add('align-middle');

        if (isLr) subTitleEleWrapper.classList.add('vertical-lr');
        if (isRl) subTitleEleWrapper.classList.add('vertical-rl');

        // Handling the position of the subtitle
        if (typeof position !== 'undefined' && position !== 'auto') {
            if (isVertical) {
                if (alignS || alignM) subTitleEle.style.top = `${position}%`;
                if (alignM) subTitleEle.style.top = `${50 - position}%`;
                if (alignE) subTitleEle.style.bottom = `${100 - position}%`;
            } else {
                if (alignS || alignM) subTitleEle.style.left = `${position}%`;
                if (alignM) subTitleEle.style.left = `${50 - position}%`;
                if (alignE) subTitleEle.style.right = `${100 - position}%`;
            }
        }

        // Handling size
        if (typeof size !== 'undefined' && size !== 'auto') {
            if (isVertical) subTitleEle.style.maxHeight = `${size}%`;
            else subTitleEle.style.maxWidth = `${size}%`;
        }

        // Handling snapping to lines (grid positioning)
        if (snapToLines || this.#config.forceSnapToLines) {

            const linesMap = isVertical ? this.#linesVertMap : this.#linesHorMap,
                  maxLines = linesMap.length,
                  targetLine = isLr
                      ? autoLine
                          ? 0
                          : Math.min(Math.max(line >= 0 ? line : maxLines + line - 1, 0), maxLines - 1)
                      : autoLine
                          ? maxLines - 1
                          : isRl
                              ? Math.min(Math.max(line >= 0 ? maxLines - line : maxLines + line - 1, 0), maxLines - 1)
                              : Math.min(Math.max(line >= 0 ? line : maxLines + line - 1, 0), maxLines - 1);

            // Determine and allocate the next available line
            const linesReversed = [...linesMap].reverse();

            if (linesMap[targetLine].isActive) {

                if (autoLine) {

                    const previousFreeLine = isLr
                        ? linesMap.findIndex(findLine => !findLine.isActive)
                        : linesReversed.findIndex(findLine => !findLine.isActive);

                    if (previousFreeLine > -1) {
                        this.#addLine(cue, isLr ? previousFreeLine : maxLines - previousFreeLine - 1, subTitleEleWrapper, isVertical);
                    } else {
                        this.#replaceOldestLine(cue, subTitleEleWrapper, isVertical);
                    }

                } else {

                    const nextFreeLine = isRl
                        ? linesReversed.findIndex(findLine => !findLine.isActive)
                        : linesMap.findIndex(findLine => !findLine.isActive);

                    if (nextFreeLine > -1) {
                        this.#addLine(cue, isRl ? maxLines - nextFreeLine - 1 : nextFreeLine, subTitleEleWrapper, isVertical);

                    } else {

                        const previousFreeLine = isRl
                            ? linesMap.findIndex(findLine => !findLine.isActive)
                            : linesReversed.findIndex(findLine => !findLine.isActive);

                        if (previousFreeLine > -1) {
                            this.#addLine(cue, isLr ? previousFreeLine : maxLines - previousFreeLine - 1, subTitleEleWrapper, isVertical);
                        } else {
                            this.#replaceOldestLine(cue, subTitleEleWrapper, isVertical);
                        }
                    }
                }
            } else {

                this.#addLine(cue, targetLine, subTitleEleWrapper, isVertical);

            }

        } else if (!autoLine) {
            // Absolute positioning when snapping is not enabled
            subTitleEleWrapper.style.position = 'absolute';

            if (isVertical) {
                if (!alignS && !alignE) subTitleEleWrapper.style.height = '100%';

                if (vertical === 'lr') {
                    subTitleEleWrapper.style.left = `${line}%`;
                } else {
                    subTitleEleWrapper.style.right = `${line}%`;
                }

            } else {

                subTitleEleWrapper.style.top = `${line}%`;
                if (!alignS && !alignE) subTitleEleWrapper.style.width = '100%';

            }

            this.#currentCues.set(cue, { ele: subTitleEleWrapper, renderer: this });
        }

    }

    /**
     * Replaces the oldest subtitle line with a new one.
     * @param {Object}      cue         The subtitle cue to replace.
     * @param {HTMLElement} ele         Element representing the subtitle.
     * @param {boolean}     isVertical  Whether the subtitle is displayed vertically.
     */
    #replaceOldestLine(cue, ele, isVertical) {

        let oldest = { startTime: Infinity, index: -1 };

        this.#currentCues.forEach((cueEntry, index) => {
            if (cueEntry.startTime <= oldest.startTime && isVertical === cueEntry.isVertical) {
                oldest = { startTime: cueEntry.startTime, cueEntry, index };
            }
        });

        oldest.cueEntry.ele.parentNode.innerHTML = '';
        this.#currentCues.delete(oldest.index);
        this.#addLine(cue, oldest.cueEntry.line, ele, isVertical);

    }

    /**
     * Adds a subtitle line to the grid.
     * @param {Object}      cue         The subtitle cue object.
     * @param {number}      index       The index of the current line.
     * @param {HTMLElement} ele         Element representing the subtitle.
     * @param {boolean}     isVertical  Whether the subtitle is displayed vertically.
     */
    #addLine(cue, index, ele, isVertical) {

        const parent = isVertical ? this.#dom[`line-ver-${index}`] : this.#dom[`line-hor-${index}`];
        let currentCue = this.#currentCues.get(cue);

        if (isVertical) {
            this.#linesVertMap[index].isActive = true;
            this.#linesVertMap[index].startTime = cue.startTime;
        } else {
            this.#linesHorMap[index].isActive = true;
            this.#linesHorMap[index].startTime = cue.startTime;
        }

        if (!currentCue) {
            currentCue = { renderer: this };
            this.#currentCues.set(cue, currentCue);
        }

        currentCue.line = index;
        currentCue.isVertical = isVertical;
        currentCue.ele = ele;
        currentCue.startTime = cue.startTime;

        parent.appendChild(ele);

    }

    /**
     * Clears the rendered subtitles and resets the line maps.
     */
    clear() {

        this.#linesHorMap = new Array(this.#linesHorMax).fill(true).map(() => ({ isActive: false }));
        this.#linesVertMap = new Array(this.#linesVertMax).fill(true).map(() => ({ isActive: false }));

        this.#dom.fixed.innerHTML = '';

        for (let i = 0; i < this.#linesHorMax; i += 1) {
            this.#dom[`line-hor-${i}`].innerHTML = '';
        }

        for (let i = 0; i < this.#linesVertMax; i += 1) {
            this.#dom[`line-ver-${i}`].innerHTML = '';
        }

    }

    /**
     * Removes a subtitle line from the grid.
     * @param {Object}  params             The parameters for removing a line.
     * @param {number}  [params.line]      The index of the line to remove.
     * @param {boolean} params.isVertical  Whether the subtitle is vertical.
     */
    remove({ line, isVertical }) {

        if (typeof line !== 'undefined') {
            const map = isVertical ? this.#linesVertMap[line] : this.#linesHorMap[line];
            map.isActive = false;
        }

    }

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        this.clear();
        this.#dom.destroy();

    }

}
