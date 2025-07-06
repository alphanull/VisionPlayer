# PlayOverlay

The PlayOverlay component displays a large play button centered in the viewport, allowing the user to toggle media playback. It dynamically hides or shows itself in response to player events and can optionally dim the background when paused. The overlay can be shown only once after media load, based on configuration.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    playOverlay: {
        dimmer: false,
        showOnce: false
    }
};
```

| Setting Name | Type    | Description                                                  |
| ------------ | ------- | ------------------------------------------------------------ |
| `dimmer`     | Boolean | If enabled, dims the viewport background when media is paused. |
| `showOnce`   | Boolean | If enabled, shows the overlay only once after the media has loaded. |
