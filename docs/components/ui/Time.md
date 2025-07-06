# Time

The Time component displays the current, remaining, and total media time. Users can click the time element to toggle between representations, including optional frame display and prefix indicators. It dynamically updates based on playback state and disables itself during live streams or playback errors.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    time: {
        display: 'current',
        showFrames: false
    }
};
```

| Setting Name | Type    | Description                                                  |
| ------------ | ------- | ------------------------------------------------------------ |
| `display`    | String  | Sets the default mode: `'current'` or `'remaining'`.         |
| `showFrames` | Boolean | If true, enables high-frequency updates to show frame-accurate timing. |