# PlaybackRate

The PlaybackRate component displays the current playback speed and provides a UI to change it. It shows a configurable list of allowed playback speeds and highlights the currently active speed in the settings menu. If the current media is a live stream, certain speeds (e.g., fast forward) are automatically excluded.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    playbackRate: {
        speed: 1,
        allowedValues: [0.25, 0.5, 1, 2, 4]
    }
};
```

| Setting Name    | Type          | Description                                              |
| --------------- | ------------- | -------------------------------------------------------- |
| `speed`         | Number        | Initial playback speed.                                  |
| `allowedValues` | Array<Number> | Defines which playback speeds are available in the menu. |
