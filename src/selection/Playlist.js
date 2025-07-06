import DomSmith from '../../lib/dom/DomSmith.js';
import Popup from '../util/PopupWrapper.js';

const catcher = error => {
    if (error.name !== 'AbortError' && !(error instanceof MediaError || error.name === 'ExtendedMediaError')) throw error;
};

/**
 * The Playlist component provides a UI for selecting and managing multiple media items.
 * It extends the player’s intrinsic ability to handle multiple media entries (see also the section describing the media format) by offering a user interface and additional functionality.
 * The component supports previous/next navigation and an optional popup menu listing all playlist items, including thumbnails and secondary titles — if available.
 * The Playlist menu also adds controls for looping, shuffling (with repetition avoidance), and continuous playback.
 * @exports module:src/selection/Playlist
 * @requires lib/dom/DomSmith
 * @requires lib/ui/Popup
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class Playlist {

    /**
     * Holds the components' configuration options.
     * @type     {Object}
     * @property {boolean} [loop=false]            Enables looping the playlist to the first item after reaching the last one.
     * @property {boolean} [shuffle=false]         Randomizes playback order; avoids repetitions.
     * @property {boolean} [continuous=true]       Enables automatic playback of the next item after media ends.
     * @property {boolean} [showButtons=true]      Shows previous/next navigation buttons in the controller UI.
     * @property {boolean} [showMenu=true]         Enables the playlist menu popup and displays the menu button in the controller.
     * @property {boolean} [showMenuButtons=true]  Shows control buttons for playlist behavior (loop, shuffle, etc.) in the menu.
     * @property {boolean} [showPoster=true]       Displays poster images for each media item in the playlist menu.
     */
    #config = {
        loop: false,
        shuffle: false,
        continuous: true,
        showButtons: true,
        showMenu: true,
        showMenuButtons: true,
        showPoster: true
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
     * Secret key only known to the player instance and initialized components.
     * Used to be able to restrict access to API methods in conjunction with secure mode.
     * @type {symbol}
     */
    #apiKey;

    /**
     * Reference to the DomSmith Instance for the playlist menu.
     * @type {module:lib/dom/DomSmith}
     */
    #menu;

    /**
     * Reference to the DomSmith Instance for the controller buttons.
     * @type {module:lib/dom/DomSmith}
     */
    #buttons;

    /**
     * Reference to the popup instance.
     * @type {module:lib/ui/Popup}
     */
    #popup;

    /**
     * References to DOM element holding the popup content.
     * @type {HTMLElement}
     */
    #popupContent = document.createElement('div');

    /**
     * Stores shuffled playback order when shuffle is enabled.
     * Ensures each index is chosen only once before repeating.
     * @type {number[]}
     */
    #shuffles = [];

    /**
     * Holds all media items, basically a copy of the Data components' state.
     * @type     {Object}
     * @property {module:src/core/Data~mediaItem[]} media              Array of media items.
     * @property {number}                           currentMediaIndex  Index of the currently active media item.
     */
    #data = {
        media: [],
        currentMediaIndex: 0
    };

    /**
     * Creates an instance of the Playlist component.
     * @param {module:src/core/Player}           player            Reference to the VisionPlayer instance.
     * @param {module:src/controller/Controller} parent            The parent container, in this case the controller.
     * @param {Object}                           [options]         Additional options.
     * @param {symbol}                           [options.apiKey]  Token for extended access to the player API.
     */
    constructor(player, parent, { apiKey }) {

        this.#config = player.initConfig('playlist', this.#config);

        if (!this.#config) return [false];

        this.#player = player;
        this.#apiKey = apiKey;

        this.#subscriptions = [
            ['data/parsed', this.#onDataParsed],
            ['data/ready', this.#onDataReady],
            ['data/nomedia', () => { this.#buttons.wrapper.style.display = 'none'; }],
            ['media/ended', this.#onMediaEnded],
            ['ui/resize', () => { this.#popup.layout(); }],
            ['ui/hide', () => { this.#popup.hide(null, { focus: false }); }]
        ].map(([event, handler]) => this.#player.subscribe(event, handler));

        if (this.#config.showButtons === false && this.#config.showMenu === false) return; // no UI but playlist component still active

        this.#buttons = new DomSmith({
            _ref: 'wrapper',
            className: `vip-playlist-controller${this.#config.showMenu ? ' has-menu' : ''}${this.#config.showButtons ? ' has-buttons' : ''}`,
            'data-sort': 20,
            _nodes: [
                this.#config.showButtons ? {
                    _tag: 'button',
                    _ref: 'prev',
                    className: 'icon play-prev',
                    disabled: true,
                    'data-sort': 15,
                    ariaLabel: this.#player.locale.t('playlist.prev'),
                    click: this.#prevItem,
                    $tooltip: { player, text: this.#player.locale.t('playlist.prev') }
                } : null,
                this.#config.showMenu ? {
                    _tag: 'button',
                    _ref: 'playlist',
                    className: 'icon playlist',
                    disabled: true,
                    'data-sort': 16,
                    ariaLabel: this.#player.locale.t('playlist.open'),
                    click: this.#openPlaylist,
                    $tooltip: { player, text: this.#player.locale.t('playlist.open') }
                } : null,
                this.#config.showButtons ? {
                    _tag: 'button',
                    _ref: 'next',
                    className: 'icon play-next',
                    disabled: true,
                    'data-sort': 17,
                    ariaLabel: this.#player.locale.t('playlist.next'),
                    click: this.#nextItem,
                    $tooltip: { player, text: this.#player.locale.t('playlist.next') }
                } : null]
        }, parent.getElement('left'));

        this.#popup = new Popup(player, player.dom.getElement(apiKey), {
            orientation: ['top', 'bottom'],
            viewClass: 'vip-playlist-popup',
            margins: { top: 0, left: 20, right: 20, bottom: 0 },
            targetHoverClass: 'is-hover',
            resize: false
        }, this.#apiKey);

    }

    /**
     * Event handler for when the player data is parsed, so we can build the playlist menu.
     * Updates the playlist UI based on the current media data.
     * @param {Object} data  Reference to the data store.
     * @listens module:src/core/Data#data/parsed
     */
    #onDataParsed = data => {

        this.#data = data;
        this.#shuffles = [];

        if (!this.#buttons) return;

        if (data.media.length < 2) {
            this.#buttons.wrapper.style.display = 'none';
            return;
        }

        this.#buttons.wrapper.style.display = 'block';

        if (!this.#config.showMenu) return;

        if (this.#menu) this.#menu.destroy();

        this.#buttons.playlist.disabled = false;

        const language = this.#player.getConfig('locale.lang'),
              index = this.#data.currentMediaIndex,
              resolve = lang => (lang && typeof lang === 'object' ? lang[language] ?? Object.values(lang)[0] : lang),
              playlistTitle = resolve(this.#data.title) ?? this.#player.locale.t('playlist.playlist'),
              playlistTitleSecondary = resolve(this.#data.titleSecondary) ?? null;

        let foundPoster;

        this.#menu = new DomSmith({
            _ref: 'menu',
            className: 'vip-menu vip-playlist-menu',
            role: 'dialog',
            ariaModal: 'true',
            'aria-labelledby': 'playlist-menu-header',
            _nodes: [{
                _ref: 'header',
                className: 'vip-playlist-menu-header',
                _nodes: [{
                    _tag: 'h3',
                    id: 'playlist-menu-header',
                    _nodes: [playlistTitle]
                },
                this.#config.showMenuButtons ? {
                    className: 'vip-playlist-menu-buttons',
                    _nodes: [{
                        _tag: 'button',
                        _ref: 'continuous',
                        className: `icon continue ${this.#config.continuous ? 'is-enabled' : ''}`,
                        ariaLabel: this.#player.locale.t('playlist.continuous'),
                        click: () => this.#toggleSettings('continuous'),
                        $tooltip: { player: this.#player, text: this.#player.locale.t('playlist.continuous') }
                    }, {
                        _tag: 'button',
                        _ref: 'loop',
                        className: `icon loop ${this.#config.loop ? 'is-enabled' : ''}`,
                        ariaLabel: this.#player.locale.t('playlist.loop'),
                        click: () => this.#toggleSettings('loop'),
                        $tooltip: { player: this.#player, text: this.#player.locale.t('playlist.loop') }
                    }, {
                        _tag: 'button',
                        _ref: 'shuffle',
                        className: `icon shuffle ${this.#config.shuffle ? 'is-enabled' : ''}`,
                        ariaLabel: this.#player.locale.t('playlist.shuffle'),
                        click: () => this.#toggleSettings('shuffle'),
                        $tooltip: { player: this.#player, text: this.#player.locale.t('playlist.shuffle') }
                    }]
                } : null]
            },
            playlistTitleSecondary
                ? {
                    _tag: 'p',
                    _nodes: [playlistTitleSecondary]
                } : null,
            {
                _tag: 'menu',
                _ref: 'list',
                className: 'is-grouped is-stretched is-vertical',
                _nodes: this.#data.media.map((media, idx) => {

                    // find src and just display URL of the first stream TODO: make better, maybe via "getPreferredMetaData"????
                    const title = resolve(media.title) ?? media.variants[0].src,
                          titleSecondary = resolve(media.titleSecondary),
                          poster = media.poster || (media.overlays && this.#config.showPoster ? media.overlays.find(ov => ov.type === 'poster').src : null);

                    if (poster) foundPoster = true;

                    return {
                        _tag: 'button',
                        className: `vip-playlist-item ${idx === index ? 'is-active' : ''}`,
                        'aria-current': idx === index ? 'true' : null,
                        click: this.#selectItem,
                        'data-index': idx,
                        _nodes: [poster ? {
                            _tag: 'img',
                            className: 'vip-playlist-img',
                            src: poster
                        } : { className: 'vip-playlist-img-placeholder' },
                        {
                            _tag: 'span',
                            className: 'vip-playlist-item-header',
                            _nodes: [title]
                        },
                        titleSecondary ? {
                            _tag: 'span',
                            className: 'vip-playlist-item-text',
                            _nodes: [titleSecondary]
                        } : null]
                    };
                })
            }]
        }, this.#popupContent);

        if (!foundPoster) this.#menu.menu.classList.add('has-no-poster');

        if (this.#config.shuffle && this.#shuffles.length === 0) requestAnimationFrame(() => this.#shuffle());

    };

    /**
     * Event handler for when the data is ready, updating the UI.
     * @listens module:src/core/Data#data/ready
     */
    #onDataReady = () => {

        if (this.#data.media.length < 2) return;

        const current = this.#player.data.getMediaData('index');

        // update menu
        Array.from(this.#menu.list.childNodes).forEach((el, index) => {
            el.classList.toggle('is-active', index === current);
            el.toggleAttribute('aria-current', index === current);
        });

        // update buttons
        this.#updatePrevNextButtons(current);

    };

    /**
     * Updates the previous and next navigation buttons based on the current media index.
     * @param   {number} [current=this.#player.data.getMediaData("index")]  The current media index.
     * @returns {void}
     */
    #updatePrevNextButtons(current = this.#player.data.getMediaData('index')) {

        if (this.#config.showButtons) {
            if (this.#config.shuffle) {
                this.#buttons.prev.disabled = (this.#shuffles.length === 0 || this.#shuffles[0] === current) && !this.#config.loop;
                this.#buttons.next.disabled = this.#shuffles.length === this.#data.media.length && !this.#config.loop;
            } else {
                this.#buttons.prev.disabled = current === 0 && !this.#config.loop;
                this.#buttons.next.disabled = current === this.#data.media.length - 1 && !this.#config.loop;
            }
        }

    }

    /**
     * Selects a new random media index for playback in shuffle mode. Also makes sure to minimize repetitions.
     * @param {boolean} [play]  Whether to immediately play the selected media.
     * @param {number}  [last]  Index of last played element, to avoid repetitions.
     */
    #shuffle(play = !this.#player.getState('media.paused'), last) {

        let newIndex,
            lastIndex = last;

        if (this.#shuffles.length === this.#data.media.length) {
            // if all titles were played with shuffle, clear the Set and start over
            // but make sure the next item is not the same
            lastIndex = this.#shuffles[this.#shuffles.length - 1];
            this.#shuffles = [];
        }

        // keep selecting random numbers until we find one that wasnt used before
        do newIndex = Math.floor(Math.random() * this.#data.media.length);
        while (this.#shuffles.includes(newIndex) || newIndex === lastIndex);

        this.#shuffles.push(newIndex);

        this.#player.data.setMediaIndex(newIndex, { play }).catch(catcher);

    }

    /**
     * Opens the playlist popup menu.
     * @param {Event} event  The click event.
     */
    #openPlaylist = event => {

        this.#popup.show(this.#popupContent, event, { parentElement: this.#player.dom.getElement(this.#apiKey) });

    };

    /**
     * Toggles a specific setting (e.g., "continuous", "loop", or "shuffle") and updates the UI.
     * @param {string} type  The type of setting to toggle ("continuous", "loop", or "shuffle").
     */
    #toggleSettings = type => {

        this.#config[type] = !this.#config[type];
        this.#menu[type].classList.toggle('is-enabled', this.#config[type]);

        if (type === 'shuffle') this.#shuffles = [this.#data.currentMediaIndex];
        if (type === 'loop') this.#updatePrevNextButtons();

    };

    /**
     * Advances to the next media item.
     * @param {Event}   event   The click event (optional).
     * @param {boolean} [play]  Determines whether to play the new media immediately.
     */
    #nextItem = (event, play = !this.#player.getState('media.paused')) => {

        if (this.#config.shuffle && (this.#shuffles.length < this.#data.media.length || this.#config.loop)) {
            this.#shuffle(play);
        } else {
            const nextIndex = this.#data.media.length === this.#data.currentMediaIndex + 1 ? 0 : this.#data.currentMediaIndex + 1;
            this.#player.data.setMediaIndex(nextIndex, { play }).catch(catcher);
        }

    };

    /**
     * Moves to the previous media item.
     * @param {Event}   event   The click event (optional).
     * @param {boolean} [play]  Determines whether to play the new media immediately.
     */
    #prevItem = (event, play = !this.#player.getState('media.paused')) => {

        if (this.#config.shuffle) {
            const last = this.#shuffles.pop();
            if (this.#shuffles.length) {
                this.#player.data.setMediaIndex(this.#shuffles[this.#shuffles.length - 1], { play }).catch(catcher);
            } else if (this.#config.loop) {
                this.#shuffle(play, last);
            }
        } else {
            const prevIndex = this.#data.currentMediaIndex === 0 ? this.#data.media.length - 1 : this.#data.currentMediaIndex - 1;
            this.#player.data.setMediaIndex(prevIndex, { play }).catch(catcher);
        }

    };

    /**
     * Selects a media item from the playlist menu.
     * @param {Event}   event   The click event.
     * @param {boolean} [play]  Determines whether to play the selected media after selecting.
     * @listens click (menu item)
     */
    #selectItem = ({ target }, play = !this.#player.getState('media.paused')) => {

        const index = Number(target.getAttribute('data-index'));
        this.#player.data.setMediaIndex(index, { play }).catch(catcher);

    };

    /**
     * Event handler for when the media ends.
     * If continuous playback is enabled, moves to the next item or loops back to the first item.
     * @listens module:src/core/Media#media/ended
     */
    #onMediaEnded = () => {

        if (!this.#config.continuous) return;

        if (this.#config.shuffle) {
            if (this.#shuffles.size < this.#data.media.length || this.#config.loop) this.#shuffle(true);
        } else if (this.#data.media.length > this.#data.currentMediaIndex + 1) {
            this.#nextItem({}, true);
        } else if (this.#data.media.length === this.#data.currentMediaIndex + 1 && this.#config.loop) {
            this.#player.data.setMediaIndex(0, { play: true }).catch(catcher);
        }

    };

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        this.#popup.remove();
        this.#buttons?.destroy();
        this.#menu?.destroy();
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#buttons = this.#menu = this.#popup = this.#apiKey = null;

    }

}
