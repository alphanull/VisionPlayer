# Scrubber

The Scrubber component provides interactive navigation through the media by allowing users to click or drag to seek. It includes a visual representation of both the buffered and played media ranges. The component adapts to live streams by hiding itself when seeking is not applicable.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    scrubber: {
        placement: 'buttons',
        continuousUpdate: false,
        continuousUpdateBlob: true
        showBuffered: true,
        showPlayed: true
    }
};
```

| Setting Name           | Type    | Description                                                  |
| ---------------------- | ------- | ------------------------------------------------------------ |
| `placement`            | String  | Where to place the scrubber, either on `'top'` or centered in the `'buttons'` bar. The latter results in a more compact layout. Note that the default build of the player changes this default to `'top'`. |
| `continuousUpdate`     | Boolean | Enables continuous seeking while dragging. Since this can be quite laggy on network connections, this setting is more suitable for playing local files. |
| `continuousUpdateBlob` | Boolean | Enables continuous seeking while dragging for blob media sources, even if `continuousUpdate` is false. |
| showBuffered           | Boolean | If set, shows buffered ranges on the scrubber.               |
| showPlayed             | Boolean | If set, shows played ranges on the scrubber.                 |

## Events

### Published own Events:

| Event Name        | Payload Properties | Description                                                  |
| ----------------- | ------------ | ------------------------------------------------------------ |
| `scrubber/start`  | `percent`&nbsp;(Number)      | Fired when scrubbing starts. The value is the current position in percent (0 to 100). |
| `scrubber/update` | `percent`&nbsp;(Number)      | Fired while scrubbing is in progress. The value is the position in percent (0 to 100). |
| `scrubber/end`    | `percent`&nbsp;(Number)      | Fired when scrubbing ends. The value is the final scrub position in percent (0 to 100). |