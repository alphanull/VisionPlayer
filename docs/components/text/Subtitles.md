# Subtitles

The Subtitles component enables custom and native subtitle rendering with track selection and layout control. It handles dynamic switching, SRT-to-VTT conversion, custom rendering with external renderer registration, and also supports a subtitle menu with translation and adaptive layout behavior. Also includes native iOS subtitle support via real <track> elements, including fullscreen integration and cross-UI handover.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    subtitles: {
        mode: 'custom',
        allowHTML: 'none',
        adaptLayout: true,
        fontSize: 'medium',
        showFontSizeControl: true,
        showPlaceholder: false
    }
};
```

| Setting Name      | Type    | Description                                                  |
| ----------------- | ------- | ------------------------------------------------------------ |
| `mode`            | String  | Either `'custom'` or `'native'`. Defines whether the browser engine or the player’s renderer is used. |
| `allowHTML`       | String  | Controls HTML support in subtitles. Values: `'none'`, `'basic'`, `'all'`. |
| `adaptLayout`     | Boolean | Adjusts layout depending on other visible UI elements like controller or title. Only for custom engine. |
| `fontSize`        | String  | Text size setting: `'small'`, `'medium'`, `'big'`.           |
| `showFontSizeControl` | Boolean | Enables UI to let the user change subtitle size.             |
| `showPlaceholder`     | Boolean | If enabled, display a 'not available' placeholder if no subtitles are available, otherwise completely hide the menu. |

## Media Data

This component extends the Media Format:

```javascript
const mediaData = {
    // ... other media data ...
    text: {
        {
            type: 'subtitles',
            language: 'de',
            src: '/demo/trailer/text/mediaplayer-trailer.de.vtt',
            default: true
        },
        {
            type: 'subtitles',
            language: 'en',
            src: '/demo/trailer/text/mediaplayer-trailer.en.vtt'
        }
    }
}
```

| Data Property | Type    | Description                                                  |
| ------------- | ------- | ------------------------------------------------------------ |
| `src`         | String  | URL of the subtitle resource.                                |
| `type`        | String  | Text track type, only types `'subtitles'` and `'captions'` will be handled. |
| `language`    | String  | Language code of the subtitle resource.                      |
| `default`     | Boolean | If `true`, this track is selected by default.                |

## State

The following properties are exposed to the player’s global `player.state` object:

| State Name        | Type   | Description                                                  |
| ----------------- | ------ | ------------------------------------------------------------ |
| `activeTextTrack` | Number | Index of the currently active subtitle track, or `-1` if none. |

## Events

### Published own Events:

| Event Name           | Payload Properties                        | Payload Type                                 | Description                                                  |
| -------------------- | ----------------------------------------- | -------------------------------------------- | ------------------------------------------------------------ |
| `subtitles/selected` | index<br /> language<br /> src <br />type | Number<br /> String<br />String<br /> String | Fired when a new subtitle track is selected. Payload contains an object with various information like the language or type. |
| `subtitles/fontsize` | fontSize                                  | String                                       | Fired when the user changes the subtitle font size (custom engine). |

### Subscribed own Events:

| Event Name         | Payload Properties | Description                                                 |
| ------------------ | ------------------ | ----------------------------------------------------------- |
| `subtitles/update` |                    | Rebuilds the subtitle menu based on available `TextTracks`. |