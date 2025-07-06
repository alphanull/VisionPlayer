# ChromeCast

The ChromeCast component enables media playback on Chromecast devices. It supports playback control from both the player UI and the Chromecast remote, and is compatible with subtitles, poster images, and more – depending on the receiving device's capabilities. There is also a heuristic that falls back to an MP4 rendition whenever both AV1 and MP4 are present, because  most ChromeCast devices cannot decode AV1 (as of 2025). In addition, this component also supports resuming, i.e. when you reload the browser while a cast session is active, the player just picks off the running session and continues casting.

Please note that this component is currently not compatible with the `secureApi` mode and will be switched off in the secure build.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    chromeCast: {
        showControllerButton: true,
        showMenuButton: false,
        lazyLoadLib: true
    }
};
```

| Setting Name       | Type    | Description                                                              |
|--------------------|---------|--------------------------------------------------------------------------|
| `showControllerButton` | Boolean | Shows or hides the controller button.                               |
| `showMenuButton`       | Boolean | Shows or hides the menu button in the settings (if available).      |
| `lazyLoadLib`      | Boolean | If true, the Cast library is loaded only after user interaction.         |

## Events

### Published own Events

| Event Name           | Payload Properties | Description                                                                 |
|----------------------|--------------|-----------------------------------------------------------------------------|
| `chromecast/start`   |     | Fired when casting is initiated.                                           |
| `chromecast/stop`    |     | Fired when casting is stopped.                                             |