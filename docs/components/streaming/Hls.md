# Hls

The Hls component integrates the [hls.js](https://github.com/video-dev/hls.js) library into the player for MPEG-HLS streaming, adding Widevine (and optional Fairplay) DRM support. It allows adaptive streaming, real-time error handling, subtitle, language and quality control integration, and reacts to various stream metadata updates.

## Dependencies

This component uses  [hls.js](https://github.com/video-dev/hls.js) and requires the library to be present. This can be done using two ways:

1. By using the [streaming build](../../Setup.md), which includes both dash.js and hls.js
2. By using a customized build only including the Dash component, and loading the library separately before loading the player:

```html
<script type="text/javascript" src="https://cdn.jsdelivr.net/npm/hls.js@1.5.19/dist/hls.min.js"></script>
```

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    hls: {
        lazyLoadLib: true, // If true, the Hls.js library is lazy loaded
        libUrl: 'https://cdn.jsdelivr.net/npm/hls.js@^1.5.19/dist/hls.min.js', // Custom URL for the Hls.js library
        debug: false
    }
};
```

| Setting Name  | Type    | Description                                                  |
| ------------- | ------- | ------------------------------------------------------------ |
| `lazyLoadLib` | Boolean | If true, the Hls.js library is only loaded when loading the first media item. |
| `libUrl`      | String  | Custom URL for the Hls.js library. Defaults to CDN URL if not specified. |
| `debug`       | Boolean | Enables verbose logging from the HLS component.              |
