# ScrubberTooltip

The ScrubberTooltip component provides a tooltip when hovering over the scrubber. It shows the time at the hovered position and can also serve as a container for additional information such as chapters or thumbnails.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    scrubberTooltip: {
        showFrames: false,
        showTime: true
    }
};
```

| Setting Name | Type    | Description                                                  |
| ------------ | ------- | ------------------------------------------------------------ |
| `showFrames` | Boolean | If true, also shows frame information (requires frameRate metadata). |
| `showTime`   | Boolean | If true, shows the time at the current scrubber position.    |

## Events

### Published own Events:

| Event Name                 | Payload Properties      | Description                                                  |
| -------------------------- | ----------------------- | ------------------------------------------------------------ |
| `scrubber/tooltip/show`    | `percent`&nbsp;(Number) | Fired when the tooltip is about to be shown.                 |
| `scrubber/tooltip/visible` | `percent`&nbsp;(Number) | Fired when the tooltip becomes visible. Value in percent (0 to 100). |
| `scrubber/tooltip/move`    | `percent`&nbsp;(Number) | Fired while moving the tooltip. Value in percent (0 to 100). |