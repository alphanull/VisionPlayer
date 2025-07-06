# Data

The `Data` component is responsible for managing, parsing, and validating the media metadata used by the player. It supports single media items as well as complex playlist structures, including multiple quality levels, encodings, subtitle tracks, and overlays. It exposes an API for dynamic switching of streams or media entries, integrates MIME-type and capability checks, and handles fallback scenarios for unplayable or malformed data.

This component ensures that only valid and playable streams are used, while offering flexibility through configuration options such as lenient parsing or skipping invalid entries. Additionally, it dispatches lifecycle events to signal when media is ready, parsed, or in case of errors.

**Note:** this component is **mandatory** and required for normal player operations, so it cannot be switched off.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    data: {
        skipInvalidItems: false,
        skipInvalidRepresentations: false,
        skipEmptyData: false,
        disablePlayCheck: false,
        lenientPlayCheck: false,
        lenientPlayCheckBlob: true,
        preferredQuality: false,
        preferredLanguage: true
    }
};
```

| Setting Name           | Type            | Description                                                  |
| ---------------------- | --------------- | ------------------------------------------------------------ |
| `skipInvalidItems`     | Boolean         | Ignore (skip) invalid media items rather than throwing an error. |
| `skipInvalidRepresentations`   | Boolean         | Ignore invalid representations instead of throwing errors for them. |
| `skipEmptyData`   | Boolean         | Ignore empty media data (eg is `null` or `undefined`) and do not throw an error. Useful if you want to assign mediaData not immediatly on player instantiation. |
| `disablePlayCheck`     | Boolean         | Skip any play checks and trust the source to be playable. |
| `lenientPlayCheck`     | Boolean         | Check only file extensions, but do not use `canPlay`.    |
| `lenientPlayCheckBlob` | Boolean         | Assume `blob:` URLs are valid without checking.              |
| `preferredQuality`     | Number / String / Boolean | Quality setting that should be preferred when loading new media, or `false` to not set such a preference and use autoselect instead. |
| `preferredLanguage`    | String / Boolean | Language that should be preferred when loading new media, `true` to use the player locale as preferred default or `false` to not set any preference at all. |

## API

The following API functions are added to the player instance to control the component:

| **Method**                  | **Arguments**                                              | **Returns**                                                  | **Description**                                              |
| ------------------------------- | ------------------- | ------------------------- | ------------------------------------------------------------ |
| `data.getMediaData`         | `selector`&nbsp;(String/Number)                            | Object                                                       | Depending on the selector, returns a specific media item (selector is a number representing the index in the media playlist), the entire data object (selector = 'all'), the current stream (selector = 'current') or the currently active index (selector = 'index'). |
| `data.setMediaData`         | `mediaData`&nbsp;(Object/String)<br/>`index`&nbsp;(Number) | Promise, resolves with parsed media data, rejects with DataError | Assigns media data to the player instance. mediaData can be a valid data object or a string - in this case the player will either try to to load it as a media resource directly (if the extension matches a known type) or try to load it as a mediaData object in JSON format. Returns the parsed media data object or throws an error when data could not be parsed. |
| `data.setMediaIndex`        | `index`&nbsp;(Number)<br/>`options`&nbsp;(Object)          | Promise, resolves with loaded media metadata, rejects with MediaError | Switches playback to another media item, with index representing the position of the media to switch to in the internal playlist. Additional options can influence switching behavior in the Media component, like trying to restore the previous seek position (rememberState) or controlling if and how the media is played after switching (ignoreAutoplay, play). Returns the loaded media source object or throws an error when the media could not be loaded. |
| `data.getPreferredMetaData` | `options`&nbsp;(Object)<br/>`media`&nbsp;(Object)          | Object or `false` if nothing was found                       | Helper function to find a suitable media source. This searches the media data for encodings that are playable by the client and returns the most suitable one. In addition, some preferences like the desired quality (`preferredQuality`) or language (`preferredLanguage`) can be optionally provided. If no 'perfect match' is found,  tries to find a 'fallback' stream that most closely matches what is actually preferred. In this case, language preferences have priority over quality preferences. By default, this searches the currently active mediaItem, but with the media argument one can also specify any other item to search. |
| `data.error`                | `messageOrKey`&nbsp;(String)<br />`error`&nbsp;(Object)    |                                                              | Emits a data/error event with the given message, with `messageOrKey` either being a translate path or the message text itself. An additonal `error` object for more (debug) information can also be specified. |

## Events

### Published own Events

| Event Name     | Payload Properties | Description                                                  |
| -------------- | -------------------- | ------------------------------------------------------------ |
| `data/parsed`  | `data`&nbsp;(Object)      | Fired when the full media data has been parsed. Payload contains the full `data` object. |
| `data/ready`   | `mediaItem`&nbsp;(Object) | Fired when a media item has been assigned (but media is not fully loaded yet). Payload contains an object with the currently selected mediaItem |
| `data/error`   | `msgObj`&nbsp;(Object)    | Fired when a data related error occurs (for example a parsing error due to wrong media data format). Payload contains an object with error data. |
| `data/nomedia` |                      | Fired when no usable media data is found.                    |