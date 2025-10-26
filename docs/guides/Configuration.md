# Configuration

The VisionPlayer is highly configurable and allows for extensive customization through a unified configuration object.

## Configuring the player

Basically, you configure the player by passing a configuration object as the third argument when creating a new player instance:

```javascript
const myPlayer1 = new VisionPlayer(target, mediaData, playerConfig);
```

**Specifying a `playerConfig` is entirely optional. Every component will fall back to its own defaults if no explicit configuration is provided. In many cases, there's no need to define custom settings unless you want to override the defaults.**

### Config Object

The config object itself consists of multiple properties, each belonging to a certain component. For example, the settings for the Subtitles component are reflected by the `subtitles` property:

```javascript
const playerConfig = {
    subtitles: {
        mode: 'native'
    }
};
```

In this case the Subtitles rendering mode will be set to 'native' while the rest of the settings will be unchanged. For more information, consult the documentation of the respective component which will describe each setting and its defaults.

### Boolean Config

If a component does not define its own specific settings, its configuration usually defaults to `true`:

```javascript
const playerConfig = {
    controller: true
};
```

Last but not least, setting a config to `true` for a component with multiple configuration options will use its defaults.

### Disabling Components

You can set any components' config (except for the core components) to `false` in order to completly disable it:

```javascript
const playerConfig = {
    controller: false
};
```

In this case the controller is not even initialised as if it wasn't included at all — except the decision is made at runtime instead of build time. But note that when disabling a component, all child components will be disabled as well!

## Configurations at Runtime

After the player instance has been created, you can use the player API to access or modify the configuration at runtime.

### Reading Configurations

Get the complete currently active config, in this case the default config since nothing was set:

```javascript
const myPlayer = new VisionPlayer(attachTo, mediaData);
const playerConfig = myPlayer.getConfig();
```

Get a reference to a certain config item:

```javascript
const myPlayer = new VisionPlayer(attachTo, mediaData, { subtitles: { mode: 'native' } });
const subtitleConfig = myPlayer.getConfig('subtitles');
```

This would yield the following object (note that all other settings remain at their default values):

```javascript
const subtitleConfig = {
    mode: 'native',
    allowHTML: 'basic',
    adaptLayout: true,
    size: 'medium',
    sizeControl: true
}
```

### Setting Configurations

You also can set certain values in the configuration:

```javascript
myPlayer.setConfig({ data: { preferredLanguage: 'en' } });
```

In this case, the preferred Language setting for auto selecting media would be set to english.

**Note:** Components are currently not notified when configurations change at runtime. Therefore, runtime updates only have an effect if the component explicitly reads its configuration again. Also many - if not most - settings are applied at the initialisation stage and most components have no support to change those settings later on.

However, it is still possible to apply those changes by setting the second argument of setConfig to true. This is kind of "brute force" since it completely re-initializes the player after changing config (but will retain any loaded media data). So this following example would change the player locale to 'en':

```javascript
myPlayer.setConfig({ locale: 'en' }, true);
```

## Sample Config with defaults

The following configuration shows a config with all player components enabled and their default values. For more detailed information, please refer to the documentation of each component.

```javascript
const defaultConfig = {
    airPlay: {
        showControllerButton: true, // Shows or hides the controller button
        showMenuButton: false // Shows or hides the menu button in the settings
    },
    analyserVideo: {
        analyseTimer: 250, // Delay between analysis iterations (in milliseconds)
        debug: false, // Enables canvas-based visual debugging
        dim: 1, // Dimming multiplier applied to each pixel value
        gridScale: 3, // Scaling factor applied to each grid cell
        gridSize: 3, // Number of grid cells per row/column
        lerp: 0 // Interpolation factor for smoothing pixel values
    },
    audioChain: true, // Enables or disables the AudioChain.
    audioControls: {
        bands: [1, 1, 1, 1, 1] // Default equalizer band values.
    },
    chapters: {
        showControllerButtons: true, // Shows previous/next chapter buttons in the controller
        showInController: true, // Displays a controller segment with title and navigation controls
        showInScrubber: true, // Shows chapter segments along the scrubber timeline
        showInTooltip: true // Shows chapter titles within the scrubber tooltip
    },
    chromeCast: {
        showControllerButton: true, // Shows or hides the controller button
        lazyLoadLib: true, // If true, the Cast library is loaded only after user interaction
        showMenuButton: false // Shows or hides the menu button in the settings (if available)
    },
    controller: true, // Enables or disables the controller component.
    dash: {
         lazyLoadLib: true, // If true, the Dash.js library is lazy loaded
         libUrl: 'https://cdn.jsdelivr.net/npm/dashjs@4.7.4/dist/dash.all.min.js', // Custom URL for the Dash.js library
         debug: {
            enabled: false, // Whether debug output is shown.
            drm: false, // If true, logs DRM-specific protection events.
            level: 'LOG_LEVEL_WARNING'  // Dash.js debug level.
        }
    },
    data: {
        disablePlayCheck: false, // Skip thorough MIME-type checks and trust the source to be playable
        lenientPlayCheck: false, // Check only file extensions, but do not use `canPlay`
        lenientPlayCheckBlob: true, // Assume `blob:` URLs are valid without checking
        skipInvalidItems: false, // Ignore (skip) invalid media items rather than throwing an error
        skipInvalidRepresentations: false, // Ignore invalid sources instead of throwing errors for them
        skipEmptyData: false, // Ignore invalid representations instead of throwing errors for them
        preferredQuality: false, // Quality setting that should be preferred when loading new media.
        preferredLanguage: true // Language setting that should be preferred when loading new media.
    },
    debug: {
        logMediaEvents: true, // Logs media related events, i.e. event topic starts with `media`.
        logPlayerEvents: true, // Logs all other events, like `player/ready`.
        verboseLogging: false // Enables verbose logging.
    },
    dom: {
        shadow: '', // Shadow DOM mode: 'closed', 'open', or '' (no Shadow DOM).
        darkMode: 'dark', // Sets the preferred visual mode for the player
        className: '', //  Sets a custom classname on the player instance
        insertMode: 'auto', // Defines how the player is inserted into the DOM
        layout: '', // Activates special layout modes
        aspectRatio: 16 / 9, // Defines the aspect ratio of the player
        width: '100%', // The width of the player
        height: 0 // The height of the player
    },
    fairPlay: {
        certificate: '', // Optional inline base64-encoded DRM certificate
        certificateUrl: '', // URL to fetch the base64-encoded FairPlay DRM certificate
        licenseUrl: '', // URL of the license server to request content keys
    },
    file: {
        fileDrop: true, // Enables drag & drop file upload
        fileSelector: true, // Enables the file selection button in the controller
        fileSelectorAccept: true // Restricts selection to known supported extensions when true.
    },
    fullScreen: true, // Enables or disables fullscreen component
    hls: {
        lazyLoadLib: true, // If true, the Hls.js library is lazy loaded
        libUrl: 'https://cdn.jsdelivr.net/npm/hls.js@^1.5.19/dist/hls.min.js', // Custom URL for the Hls.js library
        debug: false // Enables verbose logging from the HLS component
    },
    keyboard: {
        keyPlay: 'Space', // Key to toggle play/pause
        keySeekBack: 'ArrowLeft', // Key to seek backward
        keySeekForward: 'ArrowRight', // Key to seek forward
        keyVolumeDown: 'ArrowDown', // Key to decrease volume
        keyVolumeUp: 'ArrowUp', // Key to increase volume
        overlay: true, // Whether to show a visual overlay when pressing a matching key
        overlayDelay: 1, // Delay (in seconds) before hiding the overlay after a key is released
        seekStep: 10, // Number of seconds to seek
        volumeStep: 10 // Volume adjustment step in percent
    },
    languageMenu: {
        showPlaceholder: false // display a 'not available' placeholder if no languages are available
    },
    locale: {
        lang: defaultLocale // Sets the default UI language.
    },
    loopControl: true, // Enables or disables loop control capability
    media: {
        autoMute: true, // Player will automatically mute and retry playback if autoplay fails
        autoPlay: false, // If true, the media is played immediately after loading
        crossOrigin: 'anonymous', // If set to 'use-credentials', enables CORS credentials mode.
        loop: false, // Enables looping the playlist to the first item after reaching the last one
        muted: false, // Whether the media is muted
        preload: 'metadata', // Preload setting of the media element
        volume: 1, // Current volume (0 to 1),
        stallTimeout: 2 // Timeout after which the stall event is triggered.
    },
    notifications: {
        showFileOnError: false, // If true, shows the media file name in errors.
        showMessageOnError: false // If true, show additional message in errors.
    },
    overlays: {
        adaptLayout: true, // Adjusts layout depending on other visible UI elements.
        sanitizeHTML: true //  Sanitizes the HTML of the overlay to prevent XSS attacks.
    },
    pictureInPicture: true, // Enables or disables Picture-in-Picture support
    playControl: true, // Enables or disables the play button component
    playOverlay: {
        dimmer: false, // If enabled, dims the viewport background when media is paused
        showOnce: false // If enabled, shows the overlay only once after the media has loaded
    },
    playbackRate: {
        speed: 1, // Initial playback speed
        allowedValues: [0.25, 0.5, 1, 2, 4] // Defines which playback speeds are available.
    },
    player: {
        id: '', // Defines custom player id
        secureApi: false // If enabled, certain APIs are restricted to internal use.
    },
    playlist: {
        continuous: true, // Enables automatic playback of the next item after media ends
        loop: false, // Enables looping the playlist to the first item after reaching the last one
        showButtons: true, // Shows previous/next navigation buttons in the UI
        showMenu: true, // Enables the playlist menu popup
        showMenuButtons: true, // Shows control buttons for playlist behavior (loop, shuffle, etc.)
        showPoster: true, // Displays poster images for each media item in the playlist menu
        shuffle: false // Randomizes playback order; avoids repetitions
    },
    quality: {
        adaptToSize: true, // If true, adapt quality to display size changes
        downgradeDelay: 10, // Time in seconds to wait before lowering quality after a stall
        downgradeIfStalled: true, // If true, automatically downgrade quality after a stalling delay
        resizeDelay: 2, // Time in seconds to delay resize-based quality logic
        useDeviceRatio: true, // If true, use `devicePixelRatio` for display-based quality decisions
        showPlaceholder: false // Display a 'not available' placeholder if no qualities are available
    },
    scrubber: {
        continuousUpdate: false, // Enables continuous seeking while dragging
        continuousUpdateBlob: true // Enables continuous seeking while dragging for blob sources
        showBuffered: true, // If set, shows buffered ranges on the scrubber
        showPlayed: true, // If set, shows played ranges on the scrubber
        placement: 'buttons' // Scrubber placement, either on 'top' or in the 'buttons' bar
    },
    scrubberTooltip: {
        showFrames: false, // If true, also shows frame information (requires frameRate metadata)
        showTime: true // If true, shows the time at the current scrubber position
    },
    spinner: {
        delay: 2 // Delay (in seconds) before showing the spinner.
    },
    subtitles: {
        adaptLayout: true, // Adjusts layout depending on other visible UI elements.
        allowHTML: 'basic', // Controls HTML support in subtitles. Values: 'none', 'basic', 'all'
        mode: 'custom', // Either 'custom' (player renderer) or 'native' (browser engine).
        fontSize: 'medium', // Text size setting: 'small', 'medium', 'big'
        showFontSizeControl: true, // Enables UI to let the user change subtitle size
        showPlaceholder: false // display a 'not available' placeholder if no subtitles are available
    },
    subtitlesVTT: {
        forceSnapToLines: false // Forces cues to snap to grid lines
    },
    thumbnails: {
        showPreview: true, // Displays a larger preview overlay while scrubbing.
        showInScrubber: true // Displays a thumbnail inside the scrubber tooltip
    },
    time: {
        display: 'current', // Sets the default mode: 'current' or 'remaining'
        showFrames: false // If true, also shows frame information (requires frameRate metadata)
    },
    title: {
        showSecondary: true // If true, shows the secondary title (if available)
    },
    ui: {
        alwaysVisible: false, // If true, the UI never auto-hides, even when not in focus
        autoHide: 5, // Time (in seconds) after which the UI auto-hides. `0` disables it
        clickToPlay: true, // If true, clicking on the video element toggles play/pause
        iconStyle: 'default', // The style of the icons: 'default' or 'filled'.
        uiScale: 1, // Initial scale factor for the UI
        showScaleSlider: true // If `true`, the UI scale slider is shown
    },
    videoControls: {
        brightness: 1, // Enables brightness control and sets initial level
        contrast: 1, // Enables contrast control and sets initial level
        hue: 1, // Enables hue-rotation control and sets initial factor
        saturate: 1, // Enables saturation control and sets initial level
        sharpen: 1 // Enables sharpen control and sets initial level
    },
    visualizerAmbient: {
        analyseTimer: 250, // Delay between analysis iterations (in milliseconds)
        gridScale: 4, // Scaling factor applied to each grid cell
        gridSize: 4, // Number of grid cells per row/column
        opacity: 0, // Opacity value of the ambient visualizer canvas (0 to 1)
        selector: 'body', // CSS selector resolving to the DOM element to attach the visualizer to
        smooth: 0 // Additional interpolation factor for pixel smoothing over time
    },
    visualizerBar: {
        bands: 7, // Number of EQ bands to displayed as mirrored bars
        channels: 2, // Number of audio channels to use
        fftSize: 32 // Size of the FFT window used for frequency analysis
    },
    visualizerFrequency: {
        channels: 2, // Number of audio channels to use
        fftSize: 512 // Size of the FFT window used for frequency analysis
    },
    visualizerTime: {
        channels: 1, // Number of audio channels to use
        fftSize: 512, // Size of the FFT window used for frequency analysis
        smoothingTimeConstant: 1 // Smoothing time constant used in the analysis
    },
    volumeControl: {
        slider: true, // If enabled, a volume slider is shown, else only mute/unmute is available
        sliderAutoHide: true // If enabled, the slider is automatically hidden after a short delay
    }
};```