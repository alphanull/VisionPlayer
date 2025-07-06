# Volume

The Volume component allows the user to adjust the media volume and toggle mute/unmute. It optionally includes a slider UI for fine-grained control, which can auto-hide based on configuration. The component listens to player state and updates its icon and slider accordingly. On touch devices, it features specific interaction behavior for first tap and slider visibility.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    volumeControl: {
        slider: true,
        sliderAutoHide: true
    }
};
```

| Setting Name     | Type    | Description                                                  |
| ---------------- | ------- | ------------------------------------------------------------ |
| `slider`         | Boolean | If enabled, a volume slider is shown. If disabled, only mute/unmute is available. |
| `sliderAutoHide` | Boolean | If enabled, the slider is automatically hidden on `pointerout` after a short delay. |
