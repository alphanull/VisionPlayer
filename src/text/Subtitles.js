import DomSmith from '../../lib/dom/DomSmith.js';
import Menu from '../util/Menu.js';
import srt2webvtt from './srtParser.js';

/**
 * The Subtitles component enables custom and native subtitle rendering with track selection and layout control.
 * It handles dynamic switching, SRT-to-VTT conversion, custom rendering with external renderer registration,
 * and also supports a subtitle menu with font size selection and adaptive layout behavior.
 * @exports module:src/text/Subtitles
 * @requires lib/dom/DomSmith
 * @requires src/text/srtParser
 * @requires src/util/Menu
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class Subtitles {

    /**
     * Holds the configuration options for the Subtitles component.
     * @type     {Object}
     * @property {string}         [mode="custom"]             "custom" mode uses the builtin subtitle engine, while "native" uses the browser engine. Note that not all Browsers may support custom engine, in this case the native fallback is used.
     * @property {string}         [allowHTML="none"]          When used in conjunction with the custom engine, specifies if subtitles formatted in HTML may be used not at all ("none"), only with some basic tags ("basic") or fully ("all"). WARNING: allowing HTML may be a potential security issue and may trigger XSS attacks. Only use this if you are in full control of your subtitles!
     * @property {boolean}        [adaptLayout=false]         If enabled, the layout is synchronized with the UI state of controller and title, meaning that if one of these is shown, subtitles get an additional offset to prevent overlapping. Only works with custom engine.
     * @property {string}         [fontSize="medium"]         The text size of the subtitles, can be "small", "medium" or "big". Only works with custom engine.
     * @property {boolean}        [showFontSizeControl=true]  If enabled, provide a UI to the user to change the subtitle text size. Only works with custom engine.
     * @property {boolean}        [showPlaceholder=false]     If enabled, display a 'not available' placeholder if no subtitles are available, otherwise completely hide the menu.
     * @property {boolean|string} [preferredSubtitles=false]  If enabled, try to display subtitles: if `true`, use the player locale as default, or use a string as language code and try to match with available subs.
     */
    #config = {
        mode: 'custom',
        allowHTML: 'none',
        adaptLayout: true,
        fontSize: 'medium',
        showFontSizeControl: true,
        showPlaceholder: false,
        preferredSubtitles: false
    };

    /**
     * Reference to the main player instance.
     * @type {module:src/core/Player}
     */
    #player;

    /**
     * Reference to the parent component.
     * @type {module:src/ui/Popup}
     */
    #parent;

    /**
     * Reference to the current media element.
     * @type {HTMLMediaElement}
     */
    #mediaElement;

    /**
     * Holds tokens of subscriptions to player events, for later unsubscribe.
     * @type {number[]}
     */
    #subscriptions;

    /**
     * Secret key only known to the player instance and initialized components.
     * Used to be able to restrict access to API methods in conjunction with secure mode.
     * @type {symbol}
     */
    #apiKey;

    /**
     * DomSmith for the main container used by the custom engine.
     * @type {module:lib/dom/DomSmith}
     */
    #dom;

    /**
     * Reference to the subtitles menu.
     * @type {module:src/util/Menu}
     */
    #menu;

    /**
     * Reference to the font menu.
     * @type {module:src/util/Menu}
     */
    #fontMenu;

    /**
     * Stores actual subtitle mode. May be different from the configuration if the target browser does not support custom subtitles.
     * @type {"custom"|"native"}
     */
    #mode;

    /**
     * Flag indicating if subtitle was preloaded.
     * @type {boolean}
     */
    #preloaded;

    /**
     * Allowed font size settings.
     * @type {string[]}
     */
    #fontSizes = ['small', 'medium', 'big'];

    /**
     * The current font size.
     * @type {"small"|"medium"|"big"}
     */
    #currentFontSize;

    /**
     * Array holding current subtitle data.
     * @type {module:src/text/Subtitles~SubtitleItem[]}
     */
    #subtitleData = [];

    /**
     * Stores additional renderer components (like subtitle line renderers).
     * @type {Object[]}
     */
    #renderers = [];

    /**
     * Array holding the index of the currently active subtitle.
     * @type {number}
     */
    #currentSubtitle = -1;

    /**
     * Map storing the currently active cues for rendering.
     * @type {Map<any, {ele: HTMLElement, renderer: Object}>}
     */
    #currentCues = new Map();

    /**
     * Creates an instance of the Subtitles component.
     * @param {module:src/core/Player} player            The main media player instance.
     * @param {module:src/ui/Popup}    parent            Reference to the parent instance (In this case the language popup).
     * @param {Object}                 [options]         Additional options.
     * @param {symbol}                 [options.apiKey]  Token for extended access to the player API.
     */
    constructor(player, parent, { apiKey }) {

        const htmlDefault = this.#config.allowHTML;

        this.#config = player.initConfig('subtitles', this.#config);

        if (!this.#config) return [false];

        // if allowHTML defaults are already set, prevent further change
        if (htmlDefault && apiKey) this.#config.allowHTML = htmlDefault;

        this.#player = player;
        this.#parent = parent;
        this.#apiKey = apiKey;
        this.#mode = this.#config.mode === 'custom' && !this.#player.getClient('iPhone') ? 'custom' : 'native';
        this.#currentFontSize = this.#config.fontSize;

        this.#dom = new DomSmith({
            _ref: 'root',
            className: `vip-subtitles${this.#config.adaptLayout ? ' adapt-layout' : ''} font-${this.#currentFontSize.toLowerCase()}`,
            'data-sort': 40
        }, this.#player.dom.getElement(apiKey));

        this.#menu = new Menu(
            this.#player,
            {
                target: this.#parent.getElement('center'),
                id: 'subtitles',
                header: this.#player.locale.t('subtitles.header'),
                showPlaceholder: this.#config.showPlaceholder,
                selected: 0,
                highlighted: 0,
                verticalMenuThreshold: 2,
                selectMenuThreshold: 3,
                onSelected: sel => { this.#toggleSubTitle(sel - 1); }
            }
        );

        if (this.#config.showFontSizeControl && this.#config.mode === 'custom') {
            this.#fontMenu = new Menu(
                this.#player,
                {
                    target: this.#menu.getDomSmithInstance().menu,
                    id: 'subtitlefont',
                    className: 'vip-menu-sub',
                    selectMenuThreshold: 1,
                    onSelected: this.#changeFontSize
                }
            );
        }

        const subs = [
            ['data/ready', this.#onDataReady],
            ['data/nomedia', () => { this.#menu.create([]); }],
            ['media/ready', this.#onMediaReady],
            ['subtitles/update', this.#onSubtitleUpdate]
        ];

        const hasFullscreen = 'fullscreenEnabled' in document || 'webkitFullscreenEnabled' in document;
        if (this.#player.getClient('iOS') && !hasFullscreen) {
            subs.push(
                ['fullscreen/enter', this.#oniOSFullScreen],
                ['fullscreen/leave', this.#oniOSFullScreen]
            );
        }

        this.#subscriptions = subs.map(([event, handler]) => this.#player.subscribe(event, handler));

        this.#player.setState('media.activeTextTrack', { get: () => this.#currentSubtitle }, this.#apiKey);

    }

    /**
     * Registers a renderer object that can handle the actual subtitle layout, like line placement etc.
     * @param {Object} renderer  The renderer to register.
     */
    registerRenderer(renderer) {

        this.#renderers.push(renderer);

    }

    /**
     * Called when the media data is ready, extracts the text track info from "mediaData.text" if present.
     * @param {module:src/core/Data~mediaItem}        mediaData       Current mediaData.
     * @param {module:src/core/Data~mediaItem_text[]} mediaData.text  The Subtitle section of the mediaData.
     * @listens module:src/core/Data#data/ready
     */
    #onDataReady = ({ text }) => {

        let preferredSubtitles = this.#player.getConfig('subtitles.preferredSubtitles');
        if (preferredSubtitles === true) preferredSubtitles = this.#player.getConfig('locale.lang');

        // clear old events first
        this.#subtitleData.forEach(entry => {
            if (entry.trackEle) this.#removeTextTrackEvents(entry.trackEle);
            if (entry.track) {
                URL.revokeObjectURL(entry.track.src);
                entry.track.removeEventListener('cuechange', this.#renderSubTitles);
            }
        });

        this.#currentCues.clear();
        this.#renderers.forEach(renderer => renderer.clear?.());
        this.#subtitleData = [];
        this.#preloaded = false;

        let selected = null;

        if (text && text.length) {
            // parse text tracks and filter out subtitles
            for (let i = 0; i < text.length; i += 1) {
                const track = text[i];
                if (track.type === 'subtitles' || track.type === 'captions') {

                    if (!track.language || !track.src) {
                        this.#player.data.error('Subtitle tracks must have language and src attributes set.');
                        break;
                    }

                    this.#subtitleData.push(track);

                    if (preferredSubtitles) {
                        if (track.language === preferredSubtitles) selected = i;
                    } else if (track.default && selected === null) selected = i;
                }
            }
        }

        this.#currentSubtitle = selected === null ? preferredSubtitles ? 0 : -1 : selected;

        this.#menu.create([{ language: null }].concat(this.#subtitleData).map(sData => ({ value: sData.language, label: this.#translate(sData.language) })));

        this.#fontMenu.create(this.#fontSizes.map(size => ({ value: size, label: this.#player.locale.t(`subtitles.fontSize_${size}`) })));
        this.#fontMenu.setIndex(this.#fontSizes.findIndex(size => size === this.#currentFontSize));

    };

    /**
     * Called when media is ready. If on iOS, we might preload the text tracks.
     * @listens module:src/core/Media#media/ready
     */
    #onMediaReady = async() => {

        this.#mediaElement = this.#player.media.getElement(this.#apiKey);

        // preload all tracks for iOS so we have them ready in the fullscreen menu as well
        if (this.#player.getClient('iOS') && !this.#preloaded) {
            this.#preloaded = true;

            for (let i = 0; i < this.#subtitleData.length; i += 1) {
                const sub = this.#subtitleData[i];
                if (!sub.src) continue;
                const loadTrack = await this.#loadTextTrack(sub.src, {
                    kind: 'subtitles',
                    mode: 'hidden',
                    label: this.#translate(sub.language),
                    lang: sub.language,
                    index: i.toString()
                });
                sub.loading = true;
                sub.track = loadTrack.track;
                sub.trackEle = loadTrack.trackEle;
            }
        }

        this.#toggleSubTitle(this.#currentSubtitle);

    };

    /**
     * Called when "subtitles/update" is published, e.g. After external changes in textTracks.
     * Rebuilds the menu and toggles the correct track if needed.
     * @listens module:src/text/Subtitles#subtitles/update
     */
    #onSubtitleUpdate = () => {

        const preferredSubtitles = this.#player.getConfig('subtitles.preferredSubtitles'),
              tracks = this.#player.media.getElement(this.#apiKey).textTracks;

        if (tracks.length) {

            const trackArray = Array.from(tracks),
                  subs = trackArray.filter((current, index) => {
                      const exists = trackArray.findIndex(sData => sData.language === current.language);
                      return exists === index && (current.kind === 'subtitles' || current.kind === 'captions');
                  });

            this.#subtitleData = subs.map(sub => {
                const { mode, label, language, id, kind } = sub;
                if (mode === 'showing' && this.#mode !== 'native') sub.mode = 'hidden';
                return {
                    type: kind.toUpperCase(),
                    id,
                    label,
                    language,
                    default: sub.default,
                    selected: mode === 'showing' || preferredSubtitles === language,
                    track: sub,
                    loaded: true
                };
            });

        }

        this.#menu.create([{ language: null }].concat(this.#subtitleData).map(sData => ({ value: sData.language, label: this.#translate(sData.language) })));
        const currentSubtitle = tracks.length ? this.#subtitleData.findIndex(sub => sub.selected) : 0;
        this.#toggleSubTitle(currentSubtitle);

    };

    /**
     * Changes active subtitle display after user interaction.
     * @param   {number}                                 index  The index of the new subtitle.
     * @returns {module:src/text/Subtitles~SubtitleItem}        Returns the selected subtitle data entry.
     * @fires module:src/text/Subtitles#subtitles/selected
     */
    async #toggleSubTitle(index) {

        if (this.#subtitleData.length < 1) return;

        this.#menu.setIndex(index + 1);

        const current = this.#currentSubtitle > -1 ? this.#subtitleData[this.#currentSubtitle] : { language: null, _ref: 'index-0' },
              selected = index > -1 ? this.#subtitleData[index] : { language: null, _ref: 'index-0' };

        if (current.loaded || current.loading) {
            if (this.#mode !== 'native') current.track.removeEventListener('cuechange', this.#renderSubTitles);
            current.track.mode = 'disabled';
        }

        if (index >= 0) {

            if (!selected.loading && !selected.loaded) {

                const loadTrack = await this.#loadTextTrack(selected.src, {
                    kind: 'subtitles',
                    label: this.#translate(selected.language),
                    lang: selected.language,
                    index: index.toString()
                });

                selected.loading = true;
                selected.track = loadTrack.track;
                selected.trackEle = loadTrack.trackEle;

            } else if (!selected.loading) {
                if (this.#mode !== 'native') selected.track.addEventListener('cuechange', this.#renderSubTitles);
                selected.track.mode = this.#mode === 'native' ? 'showing' : 'hidden';
            }

        } else {
            // disable, so tell the renderer to clear
            this.#currentCues.clear();
            this.#renderers.forEach(renderer => renderer.clear());
        }

        this.#currentSubtitle = index;

        const { language, src, type } = selected;
        this.#player.publish('subtitles/selected', { index, language, src, type }, this.#apiKey);

        return selected;

    }

    /**
     * Loads (and creates) a new text track. (see also {@link https://developer.mozilla.org/de/docs/Web/HTML/Element/track}).
     * @param   {string}                                                    [src]            The URL from where the text track should be loaded. If omitted, a new blank text track is created.
     * @param   {Object}                                                    [options]        Additional options.
     * @param   {string}                                                    [options.kind]   The kind of text track to create. Can be 'subtitles', 'captions', 'descriptions', 'chapters' or 'metadata'.
     * @param   {string}                                                    [options.lang]   Language of the track text data. It must be a valid BCP 47 language tag. If the kind attribute is set to subtitles, then lang must be defined.
     * @param   {string}                                                    [options.label]  A user-readable title of the text track which is used by the browser when listing available text tracks.
     * @param   {Object}                                                    [options.index]  The current id / index of the track.
     * @returns {Promise<{ track: TextTrack, trackEle: HTMLTrackElement }>}                  The newly created text track.
     * @throws  {Error}                                                                      Throws if attempting to load text tracks before the loadedmetadata event.
     */
    #loadTextTrack = async(src, { kind = 'captions', label, lang, index } = {}) => {

        let source = src;

        const ext = src.split(/[#?]/)[0].split('.').pop().trim().toLowerCase();
        if (ext === 'srt') {
            // convert srt to vtt
            try {
                const response = await fetch(src),
                      text = await response.text(),
                      vtt = srt2webvtt(text),
                      blob = new Blob([vtt], { type: 'text/vtt' });
                source = URL.createObjectURL(blob);
            } catch (e) {
                console.error(e); // eslint-disable-line no-console
            }
        }

        if (!source) {

            const track = this.#mediaElement.addTextTrack(kind || 'captions', label, lang);
            if (typeof index !== 'undefined') track.index = index;
            track.mode = 'showing'; // set track to display

            return { track };

        } else if (this.#mediaElement.src !== '' || this.#mediaElement.srcObject) {

            const track = document.createElement('track');
            track.kind = kind;
            track.srclang = lang;
            track.label = label;
            track.track.mode = 'hidden';

            if (ext === 'srt') track.objectURL = source;

            if (typeof index !== 'undefined') {
                track.setAttribute('data-index', index);
                track.track.index = index;
            }

            track.src = source;
            track.addEventListener('load', this.#onTextTrackLoaded);
            track.addEventListener('error', this.#onTextTrackError);

            this.#mediaElement.appendChild(track);

            return {
                track: track.track,
                trackEle: track
            };

        } throw new Error('[VisionPlayer] You cannot load text tracks before a media source was assigned.');

    };

    /**
     * This handler is called if a text track (containing subtitles) was loaded.
     * Shows the track (in native mode), or sets up an event handler for the "cuechange" event when in custom mode.
     * @param {Event} event  The original track 'load' event.
     */
    #onTextTrackLoaded = ({ target: trackEle }) => {

        this.#removeTextTrackEvents(trackEle);

        const subtitleIndex = Number(trackEle.track.index),
              dataEntry = this.#subtitleData[subtitleIndex];

        dataEntry.trackEle = trackEle;
        dataEntry.track = trackEle.track;
        dataEntry.loading = false;
        dataEntry.loaded = true;

        if (this.#currentSubtitle === subtitleIndex) {
            if (this.#mode !== 'native') trackEle.track.addEventListener('cuechange', this.#renderSubTitles);
            trackEle.track.mode = this.#mode === 'native' ? 'showing' : 'hidden';
        }
    };

    /**
     * This handler is called if a text track (containing subtitles) was loaded.
     * Shows the track (in native mode), or sets up an event handler for the "cuechange" event when in custom mode.
     * @param {Event} event  The original track 'error' event.
     */
    #onTextTrackError = ({ target: trackEle }) => {

        this.#removeTextTrackEvents(trackEle);

        const subtitleIndex = Number(trackEle.track.index),
              menu = this.#menu.getDomSmithInstance().list.childNodes;

        menu[subtitleIndex + 1].disabled = true;
        menu[subtitleIndex + 1].textContent += ` (${this.#player.locale.t('misc.error')})`;

    };

    /**
     * Removes both 'load' and 'error' events from a given track element.
     * @param {TextTrack} track  The track to remove events from.
     */
    #removeTextTrackEvents(track) {

        track.removeEventListener('load', this.#onTextTrackLoaded);
        track.removeEventListener('error', this.#onTextTrackError);

    }

    /**
     * When using the custom engine, this method listens to the cuechange event, and invokes any fitting renderer.
     * @param {Event} event  The "cuechange" event.
     */
    #renderSubTitles = ({ target }) => {

        const track = target.track || target;

        if (this.#mode === 'native') {
            this.#mode = 'custom';
            track.mode = 'hidden';
        }

        // check for cue changes
        const activeCues = Array.from(track.activeCues);

        this.#currentCues.forEach((info, cue) => {
            if (!activeCues.includes(cue)) {
                if (info.renderer && info.renderer.remove) info.renderer.remove(info, cue);
                info.ele.remove();
                this.#currentCues.delete(cue);
            }
        });

        activeCues.forEach(cue => {
            if (!this.#currentCues.get(cue)) {
                const renderer = this.#renderers.find(rendr => rendr.canRender(cue));
                if (renderer) renderer.render(cue, this.#currentCues);
            }
        });
    };

    /**
     * If we are on iOS, and using the custom engine, we need special handling when iOS enters fullscreen.
     * As only the video, or audio tag *itself* can go fullscreen, we cannot display using the custom engine here.
     * Instead we have to switch to the native engine in this case, and back to "custom" when leaving fullscreen.
     * @param {Object} data   Event data.
     * @param {string} topic  The event topic.
     * @listens module:src/controller/FullScreen#fullscreen/enter
     * @listens module:src/controller/FullScreen#fullscreen/leave
     */
    #oniOSFullScreen = (data, topic) => {

        if (this.#currentSubtitle < 0) return;

        const currentTrack = this.#subtitleData[this.#currentSubtitle].track,
              { textTracks } = this.#mediaElement;

        if (topic.indexOf('/enter') > -1 && currentTrack && this.#mode !== 'native') {

            [...textTracks].forEach((track, index) => {
                track.mode = this.#currentSubtitle === index ? 'showing' : 'hidden';
            });

        } else if (topic.indexOf('/leave') > -1 /* && this.#mode !== "native" */) {
            // we have to check if the user changed any tracks while he was in fullscreen
            const currentIndex = [...textTracks].reduce((acc, track, index) => {
                if (track.mode === 'showing') {
                    track.mode = this.#mode === 'native' ? 'showing' : 'hidden';
                    return index;
                }
                track.mode = 'hidden';
                return acc;
            }, -1);

            if (currentIndex !== this.#currentSubtitle) this.#toggleSubTitle(currentIndex);

        }

    };

    /**
     * Changes the font size of the custom subtitles.
     * @param {number} index       The index of the new fontsize.
     * @param {Object} item        The selected item.
     * @param {string} item.value  The actual item value.
     * @fires module:src/text/Subtitles#subtitles/fontsize
     */
    #changeFontSize = (index, { value }) => {

        this.#fontSizes.forEach(size => this.#dom.root.classList.remove(`font-${size.toLowerCase()}`));
        this.#currentFontSize = value ?? this.#config.fontSize;
        this.#dom.root.classList.add(`font-${this.#currentFontSize.toLowerCase()}`);
        this.#player.publish('subtitles/fontsize', { fontSize: this.#currentFontSize }, this.#apiKey);

    };

    /**
     * Translates a language code or "off" to a user-readable label.
     * @param   {string|null} language  The language code or null for "off".
     * @returns {string}                A translated language string or the code if not found.
     */
    #translate(language) {

        if (language === null) return this.#player.locale.t('misc.off');
        return this.#player.locale.getNativeLang(language);

    }

    /**
     * Returns the container element used by this component (for custom renderers to attach to).
     * @returns {HTMLElement} The root element of the subtitles component.
     */
    getElement() {

        return this.#dom.root;

    }

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        this.#subtitleData.forEach(entry => {
            if (entry.trackEle) this.#removeTextTrackEvents(entry.trackEle);
            if (entry.track) {
                entry.track.mode = 'disabled';
                entry.track.removeEventListener('cuechange', this.#renderSubTitles);
                entry.track = null;
                entry.subtitleEle = null;
                URL.revokeObjectURL(entry.src);
            }
        });

        this.#dom.destroy();
        this.#fontMenu.destroy();
        this.#menu.destroy();
        this.#currentCues.clear();
        this.#player.unsubscribe(this.#subscriptions);
        this.#player.removeState('media.activeTextTrack', this.#apiKey);
        this.#player = this.#dom = this.#parent = this.#renderers = this.#apiKey = null;

    }

}

/**
 * Fired when the user changes the subtitle font size (custom engine).
 * @event module:src/text/Subtitles#subtitles/fontsize
 * @param {Object} fontInfo           Object containing fontInfo.
 * @param {Object} fontInfo.fontSize  New size of the font ('small', 'normal' or 'big').
 */

/**
 * Fired when the user changes the displayed subtitle.
 * @event module:src/text/Subtitles#subtitles/selected
 * @param {Object}    subtitleInfo           Object containing information about the selected Subtitle.
 * @param {Object}    subtitleInfo.index     Index of the selected subtitle track.
 * @param {TextTrack} subtitleInfo.language  Language code (e.g. "en", "de") of the selected subtitle.
 * @param {Object}    subtitleInfo.src       URL or data source of the selected subtitle.
 * @param {TextTrack} subtitleInfo.type      MIME type of the selected subtitle (e.g. "text/vtt").
 */

/**
 * The Subtitles component listens to this event to react to outside changes to the available subtitles.
 * Rebuilds the menu according to the current TextTracks. Used mainly for external control by components as dash and hls.
 * @event module:src/text/Subtitles#subtitles/update
 */

/**
 * Represents a single subtitle item.
 * @typedef {Object} module:src/text/Subtitles~SubtitleItem
 * @property {string}           type      The type of subtitle track, e.g. "subtitles" or "captions".
 * @property {string}           id        The identifier of the subtitle track (if any).
 * @property {string}           language  The language code of this subtitle track.
 * @property {boolean}          default   Whether this track is the default (as indicated by the media data).
 * @property {boolean}          selected  Whether this track is currently selected or active.
 * @property {TextTrack|Object} track     The underlying browser TextTrack (or custom track object).
 * @property {boolean}          loaded    True if this subtitle track has finished loading.
 */
