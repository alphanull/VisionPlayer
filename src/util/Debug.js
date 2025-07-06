/* eslint-disable no-console */

/**
 * The Debug component provides internal diagnostics during player initialization and runtime.
 * It logs basic environment and state data and helps developers debug player behavior by monitoring events and inspecting supported media formats.
 * While not intended for end users, this component can be very useful during development, testing, or when troubleshooting media playback issues.
 * Note that this component is usually not included in the regular production builds.
 * @exports module:src/util/Debug
 * @author Frank Kudermann - alphanull
 * @version 1.0.0
 * @license MIT
 */
export default class Debug {

    /**
     * Contains configuration options for this component.
     * @type     {Object}
     * @property {boolean} [logMediaEvents=true]   Logs media related events, i.e. Event topic starts with `media`.
     * @property {boolean} [logPlayerEvents=true]  Logs all other events, except for media related events, like `player/ready`.
     * @property {boolean} [verboseLogging=false]  Enables verbose logging, i.e. Additional 'spammy' events like `media/progress` are logged via console.debug.
     */
    #config = {
        logMediaEvents: true,
        logPlayerEvents: true,
        verboseLogging: false
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
    #subscriptions = [];

    /**
     * Creates an instance of the Debug component.
     * @param {module:src/core/Player} player  Reference to the VisionPlayer instance.
     */
    constructor(player) {

        this.#config = player.initConfig('debug', this.#config);

        if (!this.#config) return [false];

        console.info('[Debug] Client Info:', player.getClient());
        console.info('[Debug] Player State:', player.getState());

        Debug.canPlayTest(player);

        this.#player = player;

        // subscribe to all player events
        this.#subscriptions.push(this.#player.subscribe('*', this.#logEvent, { priority: 99 }));

    }

    /**
     * Logs events coming from the debug mode to the console.
     * @param {Object} data   Data object from the event.
     * @param {string} topic  The pubsub event topic (e.g., "media/play", "media/error").
     */
    #logEvent = (data, topic) => {

        const eventName = topic.match(/^vip\/[^/]+\/(.*)$/)[1];

        if (eventName.startsWith('media/') && this.#config.logMediaEvents) {

            if (eventName.endsWith('/error')) {

                console.error('[Debug] Media Error:  ', eventName, data);

            } else {

                const verboseEvents = ['media/timeupdate', 'media/progress', 'media/suspend', 'media/durationchange'],
                      isVerbose = verboseEvents.find(verbose => verbose === eventName);

                if (isVerbose) {
                    if (this.#config.verboseLogging) console.debug('[Debug] Media Event:  ', eventName, data);
                } else {
                    console.log('[Debug] Media Event:  ', eventName, data);
                }
            }

        } else if (this.#config.logPlayerEvents) {

            if (eventName.endsWith('/error')) {

                console.error('[Debug] Player Error: ', eventName, data);

            } else {

                const verboseEvents = ['scrubber/update', 'scrubber/tooltip/move'],
                      isVerbose = verboseEvents.find(verbose => verbose === eventName);

                if (isVerbose) {
                    if (this.#config.verboseLogging) console.debug('[Debug] Global Event: ', eventName, data);
                } else {
                    console.log('[Debug] Global Event: ', eventName, data);
                }
            }

        }

    };

    /**
     * Cleans up the Debug component by unsubscribing from events.
     */
    destroy() {

        this.#player.unsubscribe(this.#subscriptions);

    }

    /**
     * Determines all MIME type formats the client can (probably) play and displays the results in the console.
     * @param {module:src/core/Player} player  Reference to the media player instance.
     */
    static canPlayTest(player) {

        const audio = [],
              video = [];

        player.constructor.getFormats().forEach(format => {
            if (format.mimeTypeAudio) {
                const canPlay = player.media.canPlay({ mimeType: format.mimeTypeAudio[0] });
                if (canPlay === 'maybe' || canPlay === 'probably') audio.push(format.extensions.join(', '));
            }
            if (format.mimeTypeVideo) {
                const canPlay = player.media.canPlay({ mimeType: format.mimeTypeVideo[0] });
                if (canPlay === 'maybe' || canPlay === 'probably') video.push(format.extensions.join(', '));
            }
        });

        console.info('[Debug] canPlayTest Result');
        console.log('  Audio: ', audio.join(', '));
        console.log('  Video: ', video.join(', '));

    }

}
