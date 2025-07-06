import Menu from '../util/Menu.js';

/**
 * The Quality component provides a UI for changing video quality, either automatically or manually through a menu in the settings popup.
 * If multiple resolutions are available, it can adapt the stream to display size changes and downgrade quality automatically when stalling occurs.
 * It also reacts to language-based quality updates and supports advanced adaptive streaming logic.
 * @exports module:src/settings/Quality
 * @requires src/util/Menu
 * @author Frank Kudermann - alphanull
 * @version 1.0.0
 * @license MIT
 */
export default class Quality {
    /**
     * Configuration options for the Quality component.
     * @type     {Object}
     * @property {boolean} [adaptToSize=true]         If `true`, adapt quality to display size changes.
     * @property {boolean} [useDeviceRatio=true]      If `true`, use `devicePixelRatio` for display-based quality decisions.
     * @property {boolean} [downgradeIfStalled=true]  If `true`, automatically downgrade quality after a stalling delay.
     * @property {number}  [downgradeDelay=10]        Time in seconds to wait before lowering quality after a stall.
     * @property {number}  [resizeDelay=2]            Time in seconds to delay resize-based quality logic, so resizes do not immediately affect quality selection.
     * @property {boolean} [showPlaceholder=false]    If enabled, display a 'not available' placeholder if no qualities are available, otherwise completely hide the menu.
     */
    #config = {
        adaptToSize: true,
        useDeviceRatio: true,
        downgradeIfStalled: true,
        downgradeDelay: 10,
        resizeDelay: 2,
        showPlaceholder: false
    };

    /**
     * Reference to the main player instance.
     * @type {module:src/core/Player}
     */
    #player;

    /**
     * Reference to the parent instance.
     * @type {module:src/controller/Controller}
     */
    #parent;

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
     * Reference to the quality menu.
     * @type {module:src/util/Menu}
     */
    #menu;

    /**
     * Whether a quality change has been initiated from an external component
     * Used by Dash and Hls.
     * @type {boolean}
     */
    #isExternalUpdate = false;

    /**
     * The currently active source object.
     * @type {module:src/core/Media~metaData}
     */
    #currentSource;

    /**
     * List of available qualities (could be numeric or textual, but can also be "null" which means "auto").
     * @type {Array<(null|number|string)>}
     */
    #qualities = [];

    /**
     * The currently selected quality, or `null` for "auto".
     * @type {?string|number}
     */
    #current = null;

    /**
     * Timer ID for stalling-based quality downgrade.
     * @type {number}
     */
    #stallId = -1;

    /**
     * Timer ID for size-based adaptation checks.
     * @type {number}
     */
    #resizeId = -1;

    /**
     * Creates an instance of the Quality component.
     * @param {module:src/core/Player} player            Reference to the media player instance.
     * @param {module:src/ui/Popup}    parent            Reference to the parent instance (In this case the settings popup).
     * @param {Object}                 [options]         Additional options.
     * @param {symbol}                 [options.apiKey]  Token for extended access to the player API.
     */
    constructor(player, parent, { apiKey }) {

        this.#config = player.initConfig('quality', this.#config);

        if (!this.#config) return [false];

        this.#player = player;
        this.#parent = parent;
        this.#apiKey = apiKey;

        this.#menu = new Menu(
            this.#player,
            {
                target: this.#parent.getElement('center'),
                id: 'quality',
                className: 'quality-menu',
                layout: 'label',
                insertMode: 'top',
                header: this.#player.locale.t('misc.quality'),
                showPlaceholder: this.#config.showPlaceholder,
                selectMenuThreshold: 1,
                onSelected: sel => { this.#toggleQuality(this.#qualities[sel]); }
            }
        );

        this.#subscriptions = [
            ['data/source', this.#onDataSource],
            ['data/ready', this.#onDataReady],
            ['data/nomedia', () => { this.#menu.create([]); }],
            ['media/ready', this.#updateMenu],
            ['quality/active', this.#updateMenu],
            ['quality/update', this.#onQualityUpdate],
            ['quality/language/refresh', this.#onDataReady],
            ['ui/resize', this.#resize],
            ['media/stall/begin', this.#onStallBegin],
            ['media/stall/end', this.#onStallEnd]
        ].map(([event, handler]) => this.#player.subscribe(event, handler));

    }

    /**
     * Called when a media source has been selected.
     * @param {module:src/core/Media~metaData} metaData  The new media item data.
     * @listens module:src/core/Data#data/source
     */
    #onDataSource = metaData => {

        this.#currentSource = metaData;

    };

    /**
     * Called when player data is ready, or when a "quality/language/refresh" event arrives.
     * Collects the available quality levels from the stream data and sets up the menu.
     * @param {module:src/core/Data~mediaItem} mediaItem  Object containing media info.
     * @listens module:src/core/Data#data/ready
     * @listens module:src/settings/Quality#quality/language/refresh
     */
    #onDataReady = mediaItem => {

        const variants = mediaItem.variants ?? this.#player.data.getMediaData().variants;

        const qualityData = variants.reduce((acc, variant) => {

            const addQuality = ({ quality }) => {
                if (quality && variant.language === this.#currentSource.language && !acc.includes(quality)) {
                    acc.push(quality);
                }
            };

            addQuality(variant);
            if (variant.representations) variant.representations.forEach(representation => addQuality(representation));
            return acc;

        }, [null]);

        // Sort numeric ascending; keep strings in place
        this.#qualities = qualityData.sort((a, b) => {
            const isNumA = typeof a === 'number',
                  isNumB = typeof b === 'number';
            if (isNumA && isNumB) return a - b;
            else if (isNumA) return -1;
            else if (isNumB) return 1;
            return 0; // dont switch Strings (stable Sort)
        }).map(q => ({ value: q, label: q === null ? this.#player.locale.t('misc.auto') : isNaN(q) ? q : `${q}p` }));

        this.#isExternalUpdate = false;
        this.#current = this.#player.getConfig('data.preferredQuality') || null;

        this.#menu.create(this.#qualities);

    };

    /**
     * Called when an external update modifies the quality list or current selection.
     * Rebuilds the menu and sets externalUpdate to "true".
     * @param {Array<string|number>}        data                  Array with available qualities.
     * @param {Array<(null|number|string)>} data.qualityData      Updated quality array.
     * @param {Object}                      data.current          Updated current stream.
     * @param {number}                      data.current.height   Height of currentSource.
     * @param {string}                      data.current.quality  Quality of currentSource.
     * @listens module:src/settings/Quality#quality/update
     */
    #onQualityUpdate = ({ qualityData }) => {

        this.#isExternalUpdate = true;
        this.#qualities = qualityData.map(q => ({ value: q, label: q === null ? this.#player.locale.t('misc.auto') : isNaN(q) ? q : `${q}p` }));
        this.#menu.create(this.#qualities);

    };

    /**
     * Updates the UI to match the new current stream's quality.
     * @param {module:src/core/Media~metaData} metaData  The updated meta data object.
     * @listens module:src/core/Media#media/ready
     * @listens module:src/settings/Quality#quality/active
     */
    #updateMenu = metaData => {

        if (!metaData.quality && !metaData.value) return;

        this.#currentSource = metaData;

        if (!metaData.quality) this.#currentSource.quality = metaData.value;

        const selectedIndex = this.#qualities.findIndex(q => q.value === this.#current),
              highlightedIndex = this.#qualities.findIndex(q => q.value === metaData.quality);

        this.#menu.setIndex(selectedIndex, highlightedIndex);

    };

    /**
     * Switches to a new quality if it differs from the current.
     * Publishes "quality/selected" and tries to switch streams if needed.
     * @param {number|string} quality  The chosen quality value.
     * @fires module:src/settings/Quality#quality/selected
     */
    #toggleQuality(quality) {

        this.#currentSource = this.#player.media.getMetaData();

        if (quality.value === this.#currentSource.quality) return;

        this.#current = quality.value;
        this.#player.publish('quality/selected', { quality: quality.value }, this.#apiKey);

        if (this.#isExternalUpdate) return;

        const result = this.#player.data.getPreferredMetaData({ preferredQuality: quality.value });
        if (!result) this.#player.data.error('[Quality] Did not find quality in stream Data');

        this.#player.setConfig({ media: { preferredQuality: result.quality } });

        if (result.src !== this.#currentSource.src) this.#player.media.load(result, { rememberState: true, ignoreAutoplay: true });

    }

    /**
     * Reacts to the "ui/resize" event if adaptToSize is enabled. Schedules a check to see
     * if we should automatically pick a new quality based on the new player dimensions.
     * @param {Object} size         Resize data.
     * @param {number} size.width   New width in pixels.
     * @param {number} size.height  New height in pixels.
     * @fires   module:src/settings/Quality#quality/resize
     * @listens module:src/ui/UI#ui/resize
     */
    #resize = ({ width, height }) => {

        if (!this.#config.adaptToSize || this.#current) return;

        const doResize = () => {

            const deviceRatio = window.devicePixelRatio && this.#config.useDeviceRatio ? window.devicePixelRatio : 1;

            this.#player.publish('quality/resize', {
                width: width * deviceRatio,
                height: height * deviceRatio
            }, this.#apiKey);

            if (this.#isExternalUpdate) return;

            const result = this.#player.data.getPreferredMetaData({ preferredQuality: null });
            if (result && result.src !== this.#currentSource?.src) this.#player.media.load(result, { rememberState: true, ignoreAutoplay: true });

        };

        clearTimeout(this.#resizeId);
        this.#resizeId = setTimeout(doResize, this.#config.resizeDelay * 1000);

    };

    /**
     * Called when stalling begins. If configured, schedules a possible quality downgrade after a delay.
     * @listens module:src/core/Media#media/stall/begin
     */
    #onStallBegin = () => {

        if (!this.#config.downgradeIfStalled) return;

        const stallIntervalEnd = () => {
            clearTimeout(this.#stallId);
            const downgrade = this.#qualities.sort((a, b) => b - a).find(q => q < this.#currentSource.quality);
            if (downgrade) {
                const result = this.#player.data.getPreferredMetaData({ preferredQuality: downgrade });
                if (result.src !== this.#currentSource.src) this.#player.media.load(result, { rememberState: true, ignoreAutoplay: true });
            }
        };

        clearTimeout(this.#stallId);
        this.#stallId = setTimeout(stallIntervalEnd, this.#config.downgradeDelay * 1000);

    };

    /**
     * Called when stalling ends, canceling any queued downgrade.
     * @listens module:src/core/Media#media/stall/end
     */
    #onStallEnd = () => {

        clearTimeout(this.#stallId);

    };

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        clearTimeout(this.#resizeId);
        clearTimeout(this.#stallId);
        this.#menu.destroy();
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#parent = this.#menu = this.#apiKey = null;

    }

}

/**
 * The Quality component listens to this event to react to outside changes to the selected quality.
 * Updates the menu accordingly. Used mainly for external control by components as dash and hls.
 * @event  module:src/settings/Quality#quality/active
 * @param {string|number} quality  The selected quality.
 */

/**
 * The Quality component listens to this event to react to outside changes to the available qualities.
 * Rebuilds the menu accordingly. Used mainly for external control by components as dash and hls.
 * @event  module:src/settings/Quality#quality/update
 * @param {Array<string|number>} qualities  Array with available qualities.
 */

/**
 * The Quality component listens to this event to react to outside changes to the selected language.
 * Rebuilds the menu accordingly, using available qualities from the new language.
 * @event  module:src/settings/Quality#quality/language/refresh
 * @param {Array<string|number>} qualities  Array with available qualities.
 */

/**
 * Fired when a new quality is selected by the user or component logic.
 * @event  module:src/settings/Quality#quality/selected
 * @param {Object}        qualityInfo  The selected quality information.
 * @param {string|number} quality      The newly selected quality.
 */

/**
 * Fired when the component performs a resize-based logic, providing updated width/height info.
 * @event  module:src/settings/Quality#quality/resize
 * @param {Object} size         The updated size information.
 * @param {number} size.width   The new width in pixels.
 * @param {number} size.height  The new height in pixels.
 */
