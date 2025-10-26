import { isArray, isObject } from '../../lib/util/object.js';
import DomSmith from '../../lib/dom/DomSmith.js';

/**
 * The Chapters component provides visual representations of media chapters across different UI locations.
 * It enhances navigation and content awareness by highlighting current chapter positions and offering next/previous controls.
 * The chapter titles are localized and updated dynamically in the tooltip and controller based on playback time.
 * @exports module:src/ui/Chapters
 * @requires lib/util/object
 * @requires lib/dom/DomSmith
 * @author   Frank Kudermann - alphanull
 * @version  1.0.1
 * @license  MIT
 */
export default class Chapters {

    /**
     * Configuration options for the Chapters component.
     * @type     {Object}
     * @property {boolean} [showInScrubber=true]         Shows chapter segments along the scrubber timeline.
     * @property {boolean} [showInTooltip=true]          Shows chapter titles within the scrubber tooltip.
     * @property {boolean} [showInController=true]       Displays a controller item with chapter title and navigation controls.
     * @property {boolean} [showControllerButtons=true]  Shows previous/next chapter buttons in the controller.
     */
    #config = {
        showInScrubber: true,
        showInTooltip: true,
        showInController: true,
        showControllerButtons: true
    };

    /**
     * Reference to the main player instance.
     * @type {module:src/core/Player}
     */
    #player;

    /**
     * Holds tokens of subscriptions to player events, for later unsubscribe.
     * @type {number[]}
     */
    #subscriptions;

    /**
     * Holds tokens of secondary subscriptions to player events, for later unsubscribe.
     * @type {number[]}
     */
    #subs;

    /**
     * If we show chapters on the scrubber timeline, build that DOM here.
     * @type {module:lib/dom/DomSmith|undefined}
     */
    #scrubber;

    /**
     * If we show chapters in the controller, build a small UI with prev/next and a title area.
     * @type {module:lib/dom/DomSmith|undefined}
     */
    #controller;

    /**
     * If we show chapters in a tooltip, set it up in the existing scrubber tooltip area.
     * @type {module:lib/dom/DomSmith|undefined}
     */
    #tooltipContainer;

    /**
     * The array of available chapters, sorted by start time.
     * @type {module:src/core/Data~mediaItem_chapter[]}
     */
    #chapters = [];

    /**
     * Index of the currently active chapter.
     * @type {number}
     */
    #chapter = 0;

    /**
     * Creates a new instance of the Chapters component.
     * @param {module:src/core/Player}           player            Reference to the VisionPlayer instance.
     * @param {module:src/controller/Controller} parent            Reference to the parent instance.
     * @param {Object}                           [options]         Additional options.
     * @param {symbol}                           [options.apiKey]  Token for extended access to the player API.
     */
    constructor(player, parent, { apiKey }) {

        this.#config = player.initConfig('chapters', this.#config);

        const scrubberComp = player.getComponent('ui.controller.scrubber', apiKey),
              tooltipComp = player.getComponent('ui.controller.scrubber.tooltip', apiKey);

        // If the user asked to show chapters in certain places, verify that those sub-components exist:
        if (this.#config.showInScrubber) this.#config.showInScrubber = Boolean(scrubberComp);
        if (this.#config.showInTooltip) this.#config.showInTooltip = Boolean(tooltipComp);

        if (!this.#config || !this.#config.showInTooltip && !this.#config.showInScrubber && !this.#config.showInController) return [false];

        this.#player = player;

        if (this.#config.showInScrubber) {
            this.#scrubber = new DomSmith({
                _ref: 'wrapper',
                className: 'vip-chapter-scrubber',
                _nodes: [{
                    _ref: 'scrubberInner',
                    className: 'vip-chapter-scrubber-inner'
                }]
            }, scrubberComp.getElement());
        }

        if (this.#config.showInTooltip) {
            this.#tooltipContainer = new DomSmith({
                _ref: 'tooltip',
                className: 'vip-chapter-tooltip',
                _nodes: [{
                    _ref: 'chapterTooltip',
                    _text: ''
                }]
            }, tooltipComp.getElement());
        }

        if (this.#config.showInController) {
            this.#controller = new DomSmith({
                _ref: 'wrapper',
                className: 'vip-chapter-controller',
                'data-sort': 50,
                _nodes: [{
                    className: 'vip-chapter-controller-nav',
                    _nodes: [{
                        _tag: 'button',
                        _ref: 'navPrev',
                        className: 'icon prev',
                        ariaLabel: this.#player.locale.t('chapter.prev'),
                        click: this.#onSwitchChapter,
                        $tooltip: { player, text: this.#player.locale.t('chapter.prev') }
                    }, {
                        _tag: 'button',
                        _ref: 'navNext',
                        className: 'icon next',
                        ariaLabel: this.#player.locale.t('chapter.next'),
                        click: this.#onSwitchChapter,
                        $tooltip: { player, text: this.#player.locale.t('chapter.next') }
                    }]
                }, {
                    className: 'vip-chapter-controller-text',
                    _nodes: [{
                        className: 'vip-chapter-controller-text-inner',
                        _ref: 'textWrapper',
                        ariaLabel: '',
                        role: 'text',
                        _nodes: [{
                            _tag: 'span',
                            ariaHidden: true,
                            _nodes: [{
                                _ref: 'wrapperText',
                                _text: ''
                            }]
                        }]
                    }]
                }]
            }, parent.getElement('center'));
        }

        this.#subscriptions = [
            this.#player.subscribe('data/ready', this.#onDataReady),
            this.#player.subscribe('data/nomedia', this.#disable),
            this.#player.subscribe('media/error', this.#disable),
            this.#player.subscribe('media/canplay', this.#enable)
        ];

    }

    /**
     * Called when the media data is ready. This obtains the "chapters" array if present,
     * and sets up or hides the relevant UI elements.
     * @param {module:src/core/Data~mediaItem}           mediaItem             Object containing media type info.
     * @param {module:src/core/Data~mediaItem_chapter[]} [mediaItem.chapters]  The array of chapters from the media data.
     * @listens  module:src/core/Data#data/ready
     */
    #onDataReady = ({ chapters }) => {

        const hasChapters = chapters && isArray(chapters) && chapters.length;

        this.#player.unsubscribe(this.#subs);
        this.#subs = [];

        if (hasChapters) this.#subs.push(this.#player.subscribe('media/ready', this.#onMediaReady));

        this.#chapters = hasChapters ? [...chapters].sort((a, b) => a.start - b.start) : [];

        // switch off controls when no chapter data present

        if (this.#config.showInTooltip) {
            this.#tooltipContainer.tooltip.style.display = hasChapters ? 'block' : 'none';
        }

        if (this.#config.showInController) {
            this.#controller.wrapper.classList.toggle('is-hidden', !hasChapters);
            if (hasChapters) this.#subs.push(this.#player.subscribe('media/timeupdate', this.#onTimeUpdate));
        }

        if (this.#config.showInScrubber) {
            this.#scrubber.wrapper.style.display = hasChapters ? 'flex' : 'none';
            if (hasChapters) this.#subs.push(this.#player.subscribe('scrubber/tooltip', this.#onToolTip));
        }

    };

    /**
     * Called when the media is ready. This places the chapter segments on the scrubber if needed,
     * and triggers a time update to set the initial UI.
     * @listens module:src/core/Media#media/ready
     */
    #onMediaReady = () => {

        if (!this.#chapters.length) return;

        if (this.#config.showInScrubber) {

            const dur = this.#player.getState('media.duration');

            const nodes = this.#chapters.map(({ start }, index) => {
                const next = this.#chapters[index + 1]?.start ?? dur;
                return {
                    className: 'vip-chapter-scrubber-item',
                    style: `left: ${start / dur * 100}%; width: ${(next - start) / dur * 100}%;`,
                    _nodes: [{ className: 'vip-chapter-scrubber-item-inner' }]
                };
            });

            this.#scrubber.replaceNode('scrubberInner', {
                _ref: 'scrubberInner',
                className: 'vip-chapter-scrubber-inner',
                _nodes: nodes
            });
        }

        if (this.#config.showInController) this.#onTimeUpdate();

    };

    /**
     * Called when the user hovers on the scrubber tooltip, so we can display the chapter title.
     * @param {number} percent  The fractional position on the timeline (0..1).
     * @listens module:src/controller/ScrubberTooltip#scrubber/tooltip/show
     * @listens module:src/controller/ScrubberTooltip#scrubber/tooltip/visible
     * @listens module:src/controller/ScrubberTooltip#scrubber/tooltip/move
     */
    #onToolTip = ({ percent }) => {

        const duration = this.#player.getState('media.duration'),
              chapter = this.#chapters.filter(({ start }) => start <= duration * percent / 100).slice(-1)[0],
              lang = this.#player.getConfig('locale.lang');

        if (typeof percent === 'undefined') {
            this.#tooltipContainer.chapterTooltip.nodeValue = '-';
        } else if (chapter) {
            const title = isObject(chapter.title) ? chapter.title[lang] || chapter.title[Object.keys(chapter.title)[0]] : chapter.title;
            this.#tooltipContainer.chapterTooltip.nodeValue = title;
        }
    };

    /**
     * Called periodically by "media/timeupdate" to highlight the current chapter in the controller
     * and optionally enable/disable next/prev buttons.
     * @listens module:src/core/Media#media/timeupdate
     */
    #onTimeUpdate = () => {

        const currentTime = this.#player.getState('media.currentTime');

        this.#chapter = this.#chapters.length - 1 - this.#chapters.slice().reverse().findIndex(({ start }) => start <= currentTime);

        const chapter = this.#chapters[this.#chapter],
              lang = this.#player.getConfig('locale.lang'),
              chapterText = isObject(chapter.title) ? chapter.title[lang] || chapter.title[Object.keys(chapter.title)[0]] : chapter.title;

        this.#controller.navPrev.disabled = currentTime < 3;
        this.#controller.navNext.disabled = this.#chapter >= this.#chapters.length - 1;

        if (!this.#config.showInController || this.#controller.wrapperText.nodeValue === chapterText) return;

        this.#controller.wrapperText.nodeValue = chapterText;
        this.#controller.textWrapper.setAttribute('aria-label', `${this.#player.locale.t('misc.chapter')}: ${chapterText}`);

    };

    /**
     * Called when the user clicks the "prev" or "next" button to switch chapters.
     * @param {Event} event  The click event.
     */
    #onSwitchChapter = ({ target }) => {

        const currentTime = this.#player.getState('media.currentTime');
        this.#chapter += target === this.#controller.navNext ? 1 : this.#chapters[this.#chapter].start > currentTime - 2 ? -1 : 0;

        if (this.#chapter < 0) this.#chapter = 0;
        if (this.#chapter > this.#chapters.length - 1) return;

        this.#player.media.seek(this.#chapters[this.#chapter].start);

    };

    /**
     * Enables the next / prev button functionality. This method listens to canplay events in order to restore a usable state again
     * when the player recovered from a media error (for example by loading another file).
     * @listens module:src/core/Media#media/canplay
     */
    #enable = () => {

        if (!this.#config.showInController) return;

        if (this.#chapter < this.#chapters.length - 1) this.#controller.navNext.disabled = false;
        if (this.#player.getState('media.currentTime') > 3) this.#controller.navPrev.disabled = false;

    };

    /**
     * Disables the next / prev button functionality. This method listens to media error events which cause the button to be disabled.
     * @listens module:src/core/Media#media/error
     * @listens module:src/core/Data#data/nomedia
     */
    #disable = () => {

        if (!this.#config.showInController) return;

        this.#controller.navNext.disabled = true;
        this.#controller.navPrev.disabled = true;

    };

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        this.#tooltipContainer?.destroy();
        this.#controller?.destroy();
        this.#scrubber?.destroy();
        this.#player.unsubscribe(this.#subs);
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#scrubber = this.#controller = this.#tooltipContainer = null;

    }

}
