# Media

The `Media` component is the core engine of the player, managing the HTML5 `<video>` element and its interaction with sources, playback state, and media events. It handles playback logic, volume, mute, seeking, stall detection, plugin registration, and offers access to the current media element. It provides a player-wide state mapping of the media element, publishes a wide set of wrapped native events, and ensures consistent audio/video behavior across platforms. In addition, this component supports plugin-based extensions (such as HLS or DASH plugins) which may "take over" parts of the Media component by being able to hook into the `load` and `canPlay` methods.

**Note:** this component is **mandatory** and required for normal player operations, so it cannot be switched off.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    media: {
        autoPlay: false,
        autoMute: true,
        loop: false,
        muted: false,
        volume: 1,
        preload: 'metadata',
        crossOrigin: 'anonymous',
        stallTimeout: 2
    }
};
```

| Setting Name   | Type    | Description                                                  |
| -------------- | ------- | ------------------------------------------------------------ |
| `autoPlay`     | Boolean | If true, the media is played immediately after loading.      |
| `autoMute`     | Boolean | If true, the player will automatically mute and retry playback if autoplay fails. |
| `loop`         | Boolean | If true, the media will loop after ending.                   |
| `muted`        | Boolean | Sets the initial mute state of the media.                    |
| `volume`       | Number  | Sets the initial volume (range 0 to 1).                      |
| `preload`      | String  | Controls how much media should be preloaded. Supported values are: 'metadata', 'auto', or 'none'. It is strongly recommended to leave this setting as it is, as many components require to have metadata loaded. In addition, not all browsers behave identically here, some seem to simply ignore values like 'none'. |
| `crossOrigin`  | String  | If set to `'use-credentials'`, enables CORS credentials mode. Default is `'anonymous'`. |
| `stallTimeout` | Number  | Timeout (in seconds) after which the `media/stall/begin` event is triggered.  Use `0` to disable stall checks. |

## State

The following properties are exposed to the player's global `player.state` object:

| Property        | Type          | Description                                                  |
| --------------- | ------------- | ------------------------------------------------------------ |
| `src`           | String        | The current media source URL.                                |
| `width`         | Number        | Video width in pixels.                                       |
| `height`        | Number        | Video height in pixels.                                      |
| `preload`       | String        | Preload setting of the media element.                        |
| `networkState`  | Number        | Network state of the media element.                          |
| `readyState`    | Number        | Ready state of the media element.                            |
| `error`         | Object / null | The current media error, if any.                             |
| `duration`      | Number        | Total duration of the media.                                 |
| `currentTime`   | Number        | Current playhead position.                                   |
| `remainingTime` | Number        | Time left in the media.                                      |
| `paused`        | Boolean       | Whether the media is currently paused.                       |
| `ended`         | Boolean       | Whether the media has ended.                                 |
| `looped`        | Boolean       | Whether looping is enabled.                                  |
| `muted`         | Boolean       | Whether the media is muted.                                  |
| `volume`        | Number        | Current volume (0 to 1).                                     |
| `playbackRate`  | Number        | Playback speed.                                              |
| `seeking`       | Boolean       | Whether the media is currently seeking.                      |
| `seekable`      | TimeRanges    | Seekable time ranges.                                        |
| `buffered`      | TimeRanges    | Buffered time ranges.                                        |
| `played`        | TimeRanges    | Played time ranges.                                          |
| `liveStream`    | Boolean       | Whether the media is a live stream.                          |
| `frameRate`     | Number        | The framerate of the current stream (might not always be available). |

## API

The following API functions are added to the player instance to control the component:

| **Method**           | **Arguments**                                             | **Returns**                                                  | **Description**                                              |
| -------------------- | --------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `media.load`    | `metaData`&nbsp;(Object)<br />`options`&nbsp;(Object) | Promise, resolves with media data object, rejects with media error. | Sets a new media source by passing a stream object, with the same format as the currentSource in the Data component.  Triggers reinitialization of the media element. Additional options can influence switching behavior, such as trying to restore the previous seek position (`rememberState`) or controlling whether and how the media is played after switching (`ignoreAutoplay`, `play`). This method may be extended or replaced by plugins. Returns the currently loaded media metadata or throws an error if the media could not be loaded. |
| `media.getMetaData`    |                                                           | Object                                                       | Returns the current source object.                           |
| `media.canPlay`  | `mimeType`&nbsp;(String)<br />`drmSystem`&nbsp;(String) | Boolean                                                      | Checks whether the current environment can play a given MIME type and an optional DRM system. Also used by plugins to determine whether a given plugin can play this media type. |
| `media.getElement`   | `apiKey`&nbsp;(Symbol)                                  | HTMLElement                                                  | Returns a reference to the underlying video element for direct DOM manipulation or advanced control. Requires valid apiKey in secure mode. **Use with caution, as direct DOM manipulation may break internal state.** |
| `async media.play`   |                                                           | Promise                                                      | Start or resume media playback. Returns a promise that resolves when playback begins or rejects if playback fails (e.g. user gesture required). |
| `media.pause`        |                                                           |                                                              | Pauses media playback. Does nothing if already paused.       |
| `media.loop`         | `doLoop`&nbsp;(Boolean)                                   |                                                              | Enables (doLoop = true) or disables media looping.           |
| `media.playbackRate` | `rate`&nbsp;(Number)                                      |                                                              | Set playback speed. 1.0 is normal speed; 0.5 is half speed; 2.0 is double speed. |
| `media.seek`         | `position`&nbsp;(Number)                                  |                                                              | Seeks to the specified time in seconds.                      |
| `media.volume`       | `vol`&nbsp;(Number)                                       |                                                              | Set the audio volume. Value between 0.0 (muted) and 1.0 (max). |

## Events

### Published own Events

| **Event Name**      | **Payload**         | **Description**                                              |
| ------------------- | ------------------------ | ------------------------------------------------------------ |
| `media/ready`       | `currentSource`&nbsp;(Object) | Fired when media is ready and metadata is available. Payload contains object with currently selected stream information. |
| `media/stall/begin` |                          | Fired when playback begins to stall due to buffering issues. |
| `media/stall/end`   |                          | Fired when playback has recovered from stalling.             |
| `media/loop`        | `isLooping`&nbsp;(Boolean)    | Fired when looping starts or ends.                           |

### Relayed MediaElement Events

These standard events are forwarded from the internal `<video>` element:

| Event Name             | Payload | Description                                                  |
| ---------------------- | ------- | ------------------------------------------------------------ |
| `media/loadstart`      |         | Fired when the browser starts looking for the media.         |
| `media/loadedmetadata` |         | Metadata for the media (like duration, dimensions) has been loaded. |
| `media/loadeddata`     |         | First frame of the media is loaded.                          |
| `media/canplay`        |         | Media can start playing, but might stop for buffering.       |
| `media/canplaythrough` |         | Media can be played to the end without buffering.            |
| `media/play`           |         | Playback has been requested.                                 |
| `media/playing`        |         | Playback has started.                                        |
| `media/pause`          |         | Playback has been paused.                                    |
| `media/waiting`        |         | Playback is delayed pending data.                            |
| `media/seeking`        |         | Seeking is in progress.                                      |
| `media/seeked`         |         | Seeking operation completed.                                 |
| `media/timeupdate`     |         | Current playback position changed.                           |
| `media/ended`          |         | Playback has ended.                                          |
| `media/durationchange` |         | The duration attribute has been updated.                     |
| `media/volumechange`   |         | Volume or mute state has changed.                            |
| `media/ratechange`     |         | Playback rate has changed.                                   |
| `media/progress`       |         | Browser is fetching media data.                              |
| `media/stalled`        |         | Media data is not available.                                 |
| `media/suspend`        |         | Media loading has been suspended.                            |
| `media/error`          |         | A media error occurred.                                      |
| `media/abort`          |         | Media load was aborted.                                      |
| `media/emptied`        |         | The media has become empty.                                  |
