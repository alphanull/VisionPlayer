# Dash

The Dash component integrates [dash.js](https://github.com/Dash-Industry-Forum/dash.js) into the player, enabling adaptive streaming using the MPEG-DASH standard. It also supports Subtitles, Widevine and PlayReady DRM, automatic quality switching, and synchronizes perfectly with the player's Language, Quality, and Subtitles components.

## Dependencies

This component uses  [dash.js](https://github.com/Dash-Industry-Forum/dash.js) (supports both versions 4.7.x and 5.x though at the moment of writing 4.7.4 is recommended) and requires the library to be present. This can be done using two ways:

1. By using the [streaming build](../../Setup.md), which includes both dash.js and hls.js
2. By using a customized build only including the Dash component, and loading the library separately before loading the player:

```html
<script type="text/javascript" src="http://cdn.dashjs.org/v4.7.4/dash.all.min.js"></script>
```

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    dash: {
        lazyLoadLib: true,
        libUrl: 'https://cdn.jsdelivr.net/npm/dashjs@4.7.4/dist/dash.all.min.js',
        debug: {
            enabled: false,
            drm: false,
            level: 'LOG_LEVEL_WARNING'
        }
    }
};
```

| Setting Name    | Type              | Description                                                  |
| --------------- | ----------------- | ------------------------------------------------------------ |
| `lazyLoadLib`   | Boolean           | If true, the Dash.js library is only loaded when loading the first media item. |
| `libUrl`        | String            | Custom URL for the Dash.js library. Defaults to CDN URL if not specified. |
| `debug`         | Object or Boolean | Enables debug output. Can be `true` or an object with further options. |
| `debug.enabled` | Boolean           | Whether debug output is shown.                               |
| `debug.drm`     | Boolean           | If true, logs DRM-specific protection events.                |
| `debug.level`   | String            | Dash.js debug level (`LOG_LEVEL_*`).                         |
