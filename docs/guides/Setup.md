# Setup

## Importing

The VisionPlayer can be used as an ES6 module or accessed directly via a global variable.

### ES6

```javascript
import VisionPlayer from '@alphanull/visionplayer'; // default build, or use variants:
import VisionPlayer from '@alphanull/visionplayer/headless';
import VisionPlayer from '@alphanull/visionplayer/basic';
import VisionPlayer from '@alphanull/visionplayer/streaming';
```

### Global Variable

```html
<script src="/dist/js/VisionPlayer.min.js"></script> <!-- default build -->
<script src="https://unpkg.com/@alphanull/visionplayer/basic"></script> <!-- basic build -->
<script src="https://cdn.jsdelivr.net/npm/@alphanull/visionplayer/streaming"></script> <!-- streaming build -->
```

## Build Variants

Due to its modular architecture, the player supports countless variations tailored to different setups and component combinations. Several prebuilt variants of the VisionPlayer can be found in the `/dist` or the corresponding `/src/builds` folder. Each build includes a different set of components and features. To keep the footprint as small as possible, choose the build that matches your use case best:

| File Name                      | Size&nbsp;(gzipped) | Description                                                  |
| ------------------------------ | -------------- | ------------------------------------------------------------ |
| `VisionPlayer.min.js`          | ~111kB         | Default build including the most commonly used components, as well as more advanced features like subtitles and multiple quality or language settings. Recommended for most use cases. |
| `VisionPlayer.basic.min.js`    | ~58kB          | This build contains only very basic functionality for playing simple media files. Provides a basic UI including play, time, volume, and fullscreen controls. |
| `VisionPlayer.headless.min.js` | ~31kB          | Minimal build with no UI. Suitable for background playback or custom external interfaces. |
| `VisionPlayer.secure.min.js`   | ~115kB         | Sealed, non extensible "hardened build" with all security features activated. |
| `VisionPlayer.dev.min.js`      | ~113KB         | Complete build including all available components, including debug components as well as experimental and in-development modules. (Not included on npm) |

## Initialisation

Since the player is class-based, you can create multiple instances on the same page, each independently controllable. To initialize a player, simply create a new `VisionPlayer` instance:

```javascript
new VisionPlayer(target, mediaData, playerConfig);
```

| Argument Name  | Argument Type     | Description                              |
| -------------- | ----------------- | ---------------------------------------- |
| `target` | Element or String | DOM node or selector where player mounts |
| `mediaData`    | String or Object  | The media to play (simple or complex)    |
| `playerConfig` | Object  | Customizes behavior and features         |

### `target` Argument

The first argument `target` defines the **DOM element or selector** where the player should be mounted. You can either pass a string (used as a CSS selector) or a direct DOM reference:

```javascript
new VisionPlayer('body', mediaData, playerConfig); // equivalent to:
new VisionPlayer(document.body, mediaData, playerConfig);
```

Note: by default,  the player will **append** to the `target` , except for audio or video tags, as well any `target` with an attribute `data-vip-media` - which be seen as placeholders and **replaced** by the player. You can change this behaviour by setting a config:

```javascript
const playerConfig = {
    player: {
        insertMode: 'replace' // also accepts 'append', 'before', or the default: 'auto'
    }
};
```

Where `insertMode` defines how the player is inserted into the DOM in conjunction with the `target` element. Can have the following values: `auto` generally appends to `target`, but replaces media elements (`audio` and `video`) and elements with a `vip-data-media attribute`, `append` treats the target element as parent to attach to, `replace` replaces the target element while `before` inserts the player before the target.

### Player Layout

The following options control how the player is sized and positioned within the page. These settings belong to the "dom" component and define whether the player uses a fixed aspect ratio, fills the available space, or behaves like a minimal audio-only controller.

```javascript
const playerConfig =
    dom: {
        layout: '',
        aspectRatio: 16 / 9,
        aspectRatioTransitions: false,
        width: '100%',
        height: '',
    }
};
```

- **`layout`** activates special layout modes. Currently supported: `'controller-only'`: this mode displays only the control interface (no video, canvas, or overlays). Can be used for audio playback.
- **`aspectRatio`** defines the geometric aspect ratio of the player. Can be a numeric value like `16/9` or `1.777`, `'auto'`  or `'fill'`. Ignored when **both** `width` and `height` are defined.
- If **`aspectRatioTransitions`** are set, the player will animate layout changes due to playing media with different aspect ratio
- **`width`** and **`height`** can be either numeric values (interpreted as pixels) or a string value representing a CSS value (e.g. `'100%'`, `'80vw'`). **Note that if both `height` and `width` are set, `aspectRatio` is ignored.**

#### Aspect Ratio Handling

VisionPlayer separates size and proportion to give developers full control:

- The player is fully responsive by default – it adapts to its container at all times.
- Set size independently as pixels or css value, defaults to 100% width.
- The `aspectRatio` option determines only the visual ratio of the player content, not its actual size.
- If set to `'auto'`, the player automatically adopts the native aspect ratio of the video once metadata is available.
- If no aspect ratio is provided or detectable, it gracefully falls back to `16:9` to avoid layout shifts.
- Developers can override this behavior entirely by setting `aspectRatio: 'fill'`, allowing the player to stretch to fit any container.

This ensures both predictability and flexibility – from embedded demos to complex responsive designs.

### Extract Data from target

You can also extract media data and player configs directly from the target element by specifying `data-vip-media` and `data-vip-config` attributes:

```html
<div data-vision-player data-vip-config='{"ui":{"theme":"light"}}' data-vip-media='/path/to/mediaData.json'></div>
```

```javascript
new VisionPlayer('[data-vision-player]');
```

In this case, the target becomes the only argument. `data-vip-media` and `data-vip-config` can be either a JSON compatible string which will be treated either as direct data input, or a simple string which will then be treated as link to an external media or config resource. Please note that those attributes will be parsed automatically if the attributes are present. However, if you still explicitly specify `mediaData` or `playerConfig` in the constructor, the following will happen:

- If  `mediaData` or `playerConfig` are **objects**, they will be **merged** **with** the parsed configs or media data, potentially overriding them.
- If  `mediaData` or `playerConfig` are **strings**, they will be **used instead of** the parsed configs or media data.

### Using existing video tags

You can also use an existing `<video>` or `<audio>` element as target, which then will be replaced by a VisionPlayer instance. In this case, `mediaData` and `playerConfig` are derived from the available DOM properties, sources (converted into representations), and track elements:

```html
<video id="video-embed"
    loop muted autoplay controls disableremoteplayback disablepictureinpicture
    controlslist="nofullscreen nodownload noremoteplayback noplaybackrate foobar"
    poster="VisionPlayerTrailer-poster.jpg">
    <track kind="subtitles" srclang="de" src="VisionPlayerTrailer.de.vtt">
    <track kind="subtitles" srclang="en" src="VisionPlayerTrailer.en.vtt">
    <source src="VisionPlayerTrailer.de.1080.av1.mp4" type="video/mp4; codecs=av01.0.05M.08" />
    <source src="VisionPlayerTrailer.de.1080.mp4" type="video/mp4" />
</video>
```

```javascript
new VisionPlayer('#video-embed');
```

**Note on `<video src>` handling:** If the  `src` attribute is present on a `<video>` element, all `<source>` tags (and corresponding encodings) will be ignored by the browser. If you have multiple encodings and want to benefit from VisionPlayer's codec detection logic, omit the `src` attribute and define all media via `<source>` tags.

You can also add `data-vip-media` or `data-vip-config` as with all other target elements. This makes it also possible to add additional data to an existing video tag, like in this case, adding a custom title:

```html
<video controls data-vip-media='{"title":"VisionPlayer Trailer"}'>...</video>
```

### Autoloading

Instead of manually initializing tags with media data information - be it video tags or other elements with a `data-vip-media` attribute - you can also use the "autoload" feature of the player. That means that any tag with a specfied selector will be searched for and initialized automatically when the scripts loads, so no manual `new VisionPlayer` is necessary.

**Please note:**  this feature only works for builds and is disabled by default. To enable it, set the `data-vip-autoload` attribute on the players `script` tag, or use the `VisionPlayer.autoLoad()` method to manually initiate autoloading:

```html
<script data-vip-autoload src="/dist/js/VisionPlayer.min.js"></script>
<!-- OR use this equivalent: -->
<script src="/dist/js/VisionPlayer.min.js"></script>
<script>VisionPlayer.autoLoad();</script>
<!-- then, after loading the script, the following will be converted into player instances: -->
<div data-vision-player data-vip-config='{"ui":{"theme":"light"}}' data-vip-media='/path/to/media'></div>
<video data-vision-player controls src="/path/to/media" data-config='{"ui":{"alwaysVisible":true}}'></video>
```

By default, the selector is `[data-vision-player]` but you can also specify any other selector using the `data-vip-autoselector` attribute:

```html
<script data-vip-autoload data-vip-autoselector="#my-video" src="/dist/js/VisionPlayer.min.js"></script>
<!-- OR use this equivalent: -->
<script src="/dist/js/VisionPlayer.min.js"></script>
<script>VisionPlayer.autoLoad('#my-audio');</script>
<!-- then, after loading the script, the following will be converted into a player instance: -->
<audio id="my-audio" controls src="/path/to/media"></audio>
```

### iFrame embedding

While it is out of the scope of this project to deal with iFrames, it is still easy to embed the VisionPlayer into an iFrame. In `/demo/embed` you will find an example of how to do this using `iframe-wrapper.html`. This demo allows you to pass media data and config by URL params, like this:

```html
<iframe width=600 height=400 allowfullscreen frameborder="0" src="iframe-wrapper.html?media=/demo/visionplayer-trailer.json&config=%7B%22ui%22%3A%7B%22alwaysVisible%22%3Atrue%7D%7D"></iframe>
```

### `mediaData` Argument

The second argument specifies the actual media to be played.  It supports multiple formats – from a simple video URL to a full JSON-based structure.

```javascript
new VisionPlayer(target, 'VisionPlayerTrailer.mp4');
new VisionPlayer(target, 'VisionPlayerTrailer.json');
new VisionPlayer(target, { title: 'VisionPlayer Trailer', src: 'VisionPlayerTrailer.mp4' });
```

For a detailed description of the format, see [Media Data](MediaData.md)

### `playerConfig` Argument

```javascript
new VisionPlayer(target, mediaData, { fullscreen: false });
```

The last (optional) argument specifies the player configuration for this instance. While in many cases you can leave those settings at their default, it is possible to override them using either an object:

```javascript
new VisionPlayer(target, mediaData, { ui: { autoHide: false }});
```

For a detailed description, see [Configuration](Configuration.md)