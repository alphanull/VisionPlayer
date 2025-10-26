# API

This document outlines the core design principles behind the VisionPlayer API. It explains key methods and special behaviors in detail, and finally provides a consolidated overview of all core API calls.

## API Namespaces

While the core API of the Player class itself is directly available on the instance, APIs provided by component are typically using their own namespace. For example, the media API is available under the namespace `media` so media related functions use the signature `media.play`, `media.loop` etc. As the player API is dynamic and can be extended by any component, this minimises nameclashing and ensures better scalability and maintainability.

The VisionPlayer components use  the following namespaces:

- **player** - core player API (addComponent, setConfig)
- **player.media** - all media‐related operations (load, play, pause…)
- **player.data** - loading and parsing of mediaData
- **player.dom** - Access to the players root element
- **player.ui** - UI‐control (show, hide, autoHide…)
- **player.audio** - audio operations (getAudioContext, add or remove audio nodes)

## Instance vs. Static API

The VisionPlayer API is divided into two categories:

### Instance API

- The majority of the VisionPlayer API  functions operate on a specific player instance.
- You call them on an instance you have created. Example:

```javascript
const vip = new VisionPlayer(...);
vip.getConfig('media');
vip.media.play();
vip.ui.show();
```

### Static API

- These functions are called directly on the Player class.

- They typically only have effect **before** creating new instances.

- They typically affect global player behavior, manage shared resources (such as global styles or locale data), or provide system-wide information. Example:

```javascript
Player.addComponent(...);
Player.setGlobalConfig(...);
```

Some data (like global style sheets or supported codecs) are also stored and managed centrally using static class members. This means changes apply to all player instances, not just one. If a function in the documentation starts with `Player`, it's part of the Static API. Otherwise, it belongs to the Instance API.

## Asynchronous API

Some core API methods (`media.load`, `setMediaData`, `setMediaIndex`) are designed as `async` functions and always return a Promise. While you can call them just like regular methods, it is recommended to handle them as any other `async` function, i.e. use `await`, `catch()` etc. They will return some payload if executed and also throw exceptions in case something goes wrong.

### Promise Reuse & Cancellation

If an asynchronous function is called repeatedly with the **same** arguments while a previous call is still pending, the previous call is not cancelled; instead, both calls resolve or reject identically with the same payload. However, if you call it with **different** arguments, the previous request is cancelled and its promise is rejected. Make sure to handle these cases correctly in your application logic.

### Examples

```javascript
// Start loading a video
const promise1 = player.media.load(( src: 'video.mp4' ));
// Another call with the same source while still pending
const promise2 = player.media.load(( src: 'video.mp4' ));
// -> Both promises resolve/reject identically with the same payload

// Cancellation example
const p1 = player.media.load(( src: 'video1.mp4' ));
const p2 = player.media.load(( src: 'video2.mp4' )); // cancels p1

p1.catch(e => (
    if (e.name === 'AbortError') (
        // Task was cancelled
    )
));
```

Always await or .catch() errors, including cancellations. If not handled, cancellation rejections will still propagate (and may show as uncaught Promise rejections).

## **Protected API Pattern with Symbols**

VisionPlayer applies a **protected API pattern** by leveraging ES2022 `Symbol`s.  This ensures certain internal methods remain inaccessible to external scripts or manual invocation from the browser console.

From a users perspective, some API methods which may return sensitive data or objects, or allow a userland script to extend or modify the player are **completely blocked** when the players `secureApi` config is enabled. Usage of this API is restricted to components which are - and should be! - the only ones receiving the players' secret API key. For more information about security, see [Security](./Security.md) regarding API access control and best practices.

From a components perspective, those methods have to be called with the apiKey provided by the player at instantiation. Regardless of other optional arguments, the `apiKey` is always the last one.

## Core API Overview

For more information about additional APIs from non-core  components, consult the [components documentation](Components.md).

### Player API

| **Method**                | **Arguments**                                                | **Returns**                        | **Description**                                              |
| ------------------------- | ------------------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------ |
| `getComponent`            | `componentPath`&nbsp;(String)<br />`apiKey`&nbsp;(Symbol)    | Component Class                    | Returns a registered component by path, e.g., 'ui.scrubber'. Requires valid apiKey in secure mode. |
| `initConfig`              | `key`&nbsp;(String)<br />`defaults`&nbsp;(Object)&nbsp;=&nbsp;true | Extended Config Value              | Initializes a configuration section by providing a key for the desired config section. If the property does not exist yet, it is created using the provided defaults (defaults to true). Used by components to retrieve and initialize their individual configuration. |
| `getConfig`               | `searchPath`&nbsp;(String)                                         | Config Value (object or primitive) | Gets the current config, as a whole or just a fragment based on the searchPath. |
| `setConfig`               | `config`&nbsp;(Object)<br />`reinitialize`&nbsp;(Boolean)    |                                    | Extends the existing config with the provided object. Optionally re-initializes the player. |
| `getClient`               | `key`&nbsp;(String)                                          | Client Value (object or primitive) | Returns player client information, either a property selected by the key or a clone of the whole client object. |
| `getState`                | `namespace`&nbsp;(String)                                    | State Value (object or primitive)  | Returns player state, either a property selected by the key or a clone of the whole state object. |
| `setState`                | `namespace`&nbsp;(String)<br />  `descriptor`&nbsp;(Object)<br />[`apiKey`]&nbsp;(Symbol) |                                    | Set the internal state property using a namespace (separated by "." like `ui.show`) and a descriptor object (which must contain a getter that returns the new state value). Requires valid `apiKey` in secure mode. State properties should generally be read-only. |
| `removeState`             | `namespaces`&nbsp;(Array)<br />[`apiKey`]&nbsp;(Symbol)      |                                    | Remove one or more namespaces (provided as an array of strings) from the internal state object. Requires valid apiKey in secure mode. |
| `setApi`                  | `namespace`&nbsp;(String)<br />`method`&nbsp;(Function)<br />[`isPrivate`]&nbsp;(Boolean)<br />[`apiKey`]&nbsp;(Symbol) |                                    | Adds a component method to the player API. This method adds the api method to the *instance*, as opposed to Player.setApi, which adds an API method to the *constructor*. If `isPrivate` is set, the method will only be available on the Player class itself through #privateApi. Requires valid apiKey in secure mode. **NOTE:** This does not check for existing methods with the same name, effectively allowing to override the API. |
| `removeApi`               | `namespaces`&nbsp;(Array)<br />[`apiKey`]&nbsp;(Symbol)    |                                    | Removes one or more instance API methods. Requires valid apiKey in secure mode. Not available if instance was frozen. |
| `subscribe`               | `topic`&nbsp;(String)<br />`handler`&nbsp;(Function)<br />[`options`]&nbsp;(Object) | Subscribe Token (Number)           | Subscribe to an internal event or topic using the player's Pub/Sub wrapper. handler is a callback function, options may include filtering or priority settings. |
| `unsubscribe`             | `topicOrToken`&nbsp;(Boolean/String/Array)<br />`handler`&nbsp;(Function) |                                    | Unsubscribe from an event. You can pass either the topic name & handler or the token returned by subscribe(). |
| `publish`                 | `topic`&nbsp;(String)<br />`data`&nbsp;(Object)<br />[`options`]&nbsp;(Object)<br />[`apiKey`]&nbsp;(Symbol) |                                    | Publish an event to a topic with optional payload data and options. Requires valid apiKey in secure mode. |
| `destroy`                 |                                                              |                                    | Clean up and remove the player instance, including all components, event listeners, and DOM references. After calling this, the instance is no longer usable. |
| **Static API**            |                                                              |                                    |                                                              |
| `Player.addComponent`     | `path`&nbsp;(String)<br />`Component`&nbsp;(Function)<br />[`config`]&nbsp;(Object) |                                    | Register a new component at the given path.  The `Component` must be a valid class or factory function. `config` is an optional default configuration used by the component upon instantiation. Only available in non-secure builds (i.e. extensible mode). |
| `Player.setApi`           | `key`&nbsp;(String)<br />`method`&nbsp;(Function)            |                                    | Globally override or add a new player-wide API method named key. Only available before instantiating any players, and not in the secure build. |
| `Player.removeApi`        | `key`&nbsp;(String)                                          |                                    | Remove one or more global API methods before they are bound to any player instance. Not available in the secure build. |
| `Player.setDefaultConfig` | `config`&nbsp;(Object)                                       |                                    | Define a default configuration object that will be applied to all new player instances. Not available in the secure build. |
| `Player.getFormats`       |                                                              |                                    | Returns a cloned list of all supported media formats.        |
| `Player.addFormat`        | `format`&nbsp;(Object)                                       |                                    | Adds a new format definition to the global format registry.  |

### Data API

| **Method**                     | **Arguments**                                     | **Returns**                                                  | **Description**                                              |
| ------------------------------ | ------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `data.getMediaData`            | `selector`&nbsp;(String/Number)                   | Object                                                       | Depending on the selector, returns a specific media item (selector is a number representing the index in the media playlist), the entire data object (selector = 'all'), the current stream (selector = 'current') or the currently active index (selector = 'index'). |
| `data.setMediaData`            | `mediaData`&nbsp;(Object/String)<br/>`index`&nbsp;(Number)&nbsp;=&nbsp;0 | Promise, resolves with parsed media data, rejects with DataError | Assigns media data to the player instance. mediaData can be a valid data object or a string - in this case the player will either try to to load it as a media resource directly (if the extension matches a known type) or try to load it as a mediaData object in JSON format. Returns the parsed media data object or throws an error when data could not be parsed. |
| `data.setMediaIndex`            | `index`&nbsp;(Number)<br/>`options`&nbsp;(Object)&nbsp;=&nbsp;{} | Promise, resolves with loaded media metadata, rejects with MediaError | Switches playback to another media item, with index representing the position of the media to switch to in the internal playlist. Additional options can influence switching behavior in the Media component, like trying to restore the previous seek position (rememberState) or controlling if and how the media is played after switching (ignoreAutoplay, play). Returns the loaded media source object or throws an error when the media could not be loaded. |
| `data.getPreferredMetaData` | `options`&nbsp;(Object)<br/>`media`&nbsp;(Object) | Object or `false` if nothing was found                       | Helper function to find a suitable media source. This searches the media data for encodings that are playable by the client and returns the most suitable one. In addition, some preferences like the desired quality (`preferredQuality`) or language (`preferredLanguage`) can be optionally provided. If no 'perfect match' is found,  tries to find a 'fallback' stream that most closely matches what is actually preferred. In this case, language preferences have priority over quality preferences. By default, this searches the currently active mediaItem, but with the media argument one can also specify any other item to search. |
| `data.error`                   | `messageOrKey`&nbsp;(String)<br />`error`&nbsp;(Object) |                                                              | Emits a data/error event with the given message, with `messageOrKey` either being a translate path or the message text itself. An additonal `error` object for more (debug) information can also be specified. |

### Dom API

| **Method**            | **Arguments**                   | **Returns** | **Description**                                              |
| ---------------------- | ------------- | ------------- | ------------------------------------------------------------ |
| `dom.getElement`      | [`apiKey`]&nbsp;(Symbol)             | HTMLElement | Return the top-level DOM element where the player is rendered. Requires a valid `apiKey` in secure mode. |
| `dom.updateStyles`    | `styles`&nbsp;(Array)                |             | Update the player's style rules at runtime. This is mainly used for HMR (Hot Module Replacement) during development. Takes an array of style objects and patches the existing CSS. |
| **Static API** |                                 |             |                                                              |
| `Player.addStyles`    | `path`&nbsp;(String)<br/>`css`&nbsp;(String) |             | Adds a new CSS rule set loaded from the given path with the provided raw CSS text. Only available in development mode; not in secure builds. |
| `Player.updateStyles` | `styles`&nbsp;(Array)                |             | Global version of updateStyles. Replaces CSS of all components, based on an array of ( selector, rules ) objects, mainly for HMR support. |

### Media API

| **Method**           | **Arguments**                                             | **Returns**                                                  | **Description**                                              |
| -------------------- | --------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `media.load`    | `metaData`&nbsp;(Object)&nbsp;=&nbsp;{}<br />`options`&nbsp;(Object)&nbsp;=&nbsp;{}    | Promise, resolves with media metadata object, rejects with media error. | Sets a new media source by passing a stream object, with the same format as the currentSource in the Data component.  Triggers reinitialization of the media element. Additional options can influence switching behavior, such as trying to restore the previous seek position (`rememberState`) or controlling whether and how the media is played after switching (`ignoreAutoplay`, `play`). This method may be extended or replaced by plugins. Returns the currently loaded media metadata or throws an error if the media could not be loaded. |
| `media.getMetaData`    |                                                           | Object                                                       | Returns the current source object.                           |
| `media.canPlay`  | `mimeType`&nbsp;(String)<br />[`drmSystem`]&nbsp;(String) | Boolean                                                      | Checks whether the current environment can play a given MIME type and an optional DRM system. Also used by plugins to determine whether a given plugin can play this media type. |
| `media.getElement`   | [`apiKey`]&nbsp;(Symbol)                                  | HTMLElement                                                  | Returns a reference to the underlying video element for direct DOM manipulation or advanced control. Requires valid apiKey in secure mode. **Use with caution, as direct DOM manipulation may break internal state.** |
| `async media.play`   |                                                           | Promise                                                      | Start or resume media playback. Returns a promise that resolves when playback begins or rejects if playback fails (e.g. user gesture required). |
| `media.pause`        |                                                           |                                                              | Pauses media playback. Does nothing if already paused.       |
| `media.loop`         | `doLoop`&nbsp;(Boolean)                                   |                                                              | Enables (doLoop = true) or disables media looping.           |
| `media.playbackRate` | `rate`&nbsp;(Number)                                      |                                                              | Set playback speed. 1.0 is normal speed; 0.5 is half speed; 2.0 is double speed. |
| `media.seek`         | `position`&nbsp;(Number)                                  |                                                              | Seeks to the specified time in seconds.                      |
| `media.volume`       | `vol`&nbsp;(Number)                                       |                                                              | Set the audio volume. Value between 0.0 (muted) and 1.0 (max). |
| `media.mute`         | `doMute`&nbsp;(Boolean)                                   |                                                              | Mute (doMute = true) or unmute (doMute = false) the audio.   |

### Locale API

| **Method**                | **Arguments**                                    | **Returns** | **Description**                                              |
| ------------------------- | ------------------------------------------------ | ----------- | ------------------------------------------------------------ |
| `locale.t`                | `path`&nbsp;(String)                             | String      | Returns the translated value based on the given key / path.  |
| `locale.getLocalizedTime`             | `timeArg`&nbsp;(Number)                          | String      | This method takes a time value in seconds and converts it to a human-readable format,  applying language-specific singular or plural forms for hours, minutes, and seconds, depending on the current locale. |
| `locale.getNativeLang`       | `lang`&nbsp;(String)                             | String      | Translates a language identifier (ISO 639-3 or legacy code) to its native language name. If no translation is available, the original language code is returned. |
| **Static API**            |                                                  |             |                                                              |
| `Player.addLocale`        | `translations`&nbsp;(Object)                     |             | Adds or merges a set of translation objects at runtime. The translations object should have corresponding language codes at the root level, e.g. ( "de": ( … ), "fr": ( … ) ). Not available in the secure build. |
| `Player.setDefaultLocale` | `lang`&nbsp;(String)                             |             | Sets the default locale for the player globally (before instantiation). |
| `Player.setLocaleConfig`  | `lang`&nbsp;(String)<br />`config`&nbsp;(Object) |             | Sets a config for a certain locale. Currently, specifying RTL languages (like Arabic) is supported, by using this config: ( rtl: true ). Not available in the secure build. |

### UI API

| **Method**           | **Arguments** | **Returns** | **Description**                                              |
| -------------------- | ------------- | ----------- | ------------------------------------------------------------ |
| `ui.hide`            |               |             | Hide all player UI elements. Does not pause playback; just removes the UI layer from view. |
| `ui.show`            |               |             | Show the player UI if it was previously hidden.              |
| `ui.resize`          |               |             | Forces recalculation of player width and height and also fires the `ui/resize` event.              |
| `ui.disableAutoHide` |               |             | Disable the automatic UI hide feature. Normally, the UI hides after a short timeout when idle; this call prevents that behavior. |
| `ui.enableAutoHide`  |               |             | Re-enable the automatic UI hide after a period of inactivity. |

### Audio API

| **Method**         | **Arguments**                                                | **Returns** | **Description**                                              |
| ------------------ | ------------------------------------------------------------ | ----------- | ------------------------------------------------------------ |
| `audio.getContext` | `apiKey`&nbsp;(Symbol)                                       |             | Provides the audio context of this component. This API is protected in secureApi mode. |
| `audio.addNode`    | `input`&nbsp;(AudioNode)<br />`output`&nbsp;(AudioNode)<br />[`order`] (Number)<br />`apiKey`&nbsp;(Symbol) |             | Inserts an audio node into the internal processing chain. This method expects the input and output (or null if no output is defined, as with analysers) of the processing chain to be inserted, and optionally an order value which determines when the inserted chain will be executed. This API is protected in secureApi mode. |
| `audio.removeNode` | `input`&nbsp;(AudioNode)<br />`output`&nbsp;(AudioNode)<br />`apiKey`&nbsp;(Symbol) |             | Removes a previously added audio node from the processing chain. This method expects the input and outputs of the processing chain to be removed from the 'master chain'. This API is protected in secureApi mode.|
