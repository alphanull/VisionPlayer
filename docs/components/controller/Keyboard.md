# Keyboard

The Keyboard component enables keyboard shortcuts for common media controls such as play/pause, seek, and volume adjustments. It also displays a contextual overlay when configured to do so. This component improves accessibility and enhances usability for keyboard-centric interactions.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    keyboard: {
        keyPlay: 'Space',
        keySeekBack: 'ArrowLeft',
        keySeekForward: 'ArrowRight',
        keyVolumeUp: 'ArrowUp',
        keyVolumeDown: 'ArrowDown',
        seekStep: 10,
        volumeStep: 10,
        overlay: true,
        overlayDelay: 1
    }
};
```

| Setting Name     | Type            | Description                                                  |
| ---------------- | --------------- | ------------------------------------------------------------ |
| `keyPlay`        | String /Number  | Key to toggle play/pause.                                    |
| `keySeekBack`    | String / Number | Key to seek backward.                                        |
| `keySeekForward` | String / Number | Key to seek forward.                                         |
| `keyVolumeUp`    | String / Number | Key to increase volume.                                      |
| `keyVolumeDown`  | String / Number | Key to decrease volume.                                      |
| `seekStep`       | Number          | Number of seconds to seek.                                   |
| `volumeStep`     | Number          | Volume adjustment step in percent.                           |
| `overlay`        | Boolean         | Whether to show a visual overlay when pressing a matching key. |
| `overlayDelay`   | Number          | Delay (in seconds) before hiding the overlay after a key is released. |

Please note that all values that define keyCodes can be either a string 'key' value (recommended) or the numerical 'key' value.
