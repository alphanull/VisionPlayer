# Quality

The Quality component provides a UI for changing video quality, either automatically or manually through a menu in the settings popup. If multiple resolutions are available, it can adapt the stream to display size changes and downgrade quality automatically when stalling occurs. It also reacts to language-based quality updates and supports advanced adaptive streaming logic.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    quality: {
        adaptToSize: true,
        useDeviceRatio: true,
        downgradeIfStalled: true,
        downgradeDelay: 10,
        resizeDelay: 2,
        showPlaceholder: false
    }
};
```

| Setting Name         | Type    | Description                                                  |
| -------------------- | ------- | ------------------------------------------------------------ |
| `adaptToSize`        | Boolean | If true, adapt quality to display size changes.              |
| `useDeviceRatio`     | Boolean | If true, use `devicePixelRatio` for display-based quality decisions. |
| `downgradeIfStalled` | Boolean | If true, automatically downgrade quality after a stalling delay. |
| `downgradeDelay`     | Number  | Time in seconds to wait before lowering quality after a stall. |
| `resizeDelay`        | Number  | Time in seconds to delay resize-based quality logic, so resizes do not immediately affect quality selection. |
| `showPlaceholder`    | Boolean | If enabled, display a 'not available' placeholder if no qualities are available, otherwise completely hide the menu. |

## Events

### Published own Events

| Event Name         | Payload Properties  | Description                                                  |
| ------------------ | ------------------------------- | ------------------------------------------------------------ |
| `quality/selected` | `quality`&nbsp;(String/Number)      | Fired when the user or the component logic selects a new quality. |
| `quality/resize`   | `width`&nbsp;(Number)<br/>`height`&nbsp;(Number) | Fired (after the predefined delay) when the player triggers a quality check based on resize dimensions. |

### Subscribed own Events

| Event Name                 | Payload Properties | Description                                                  |
| -------------------------- | -------------------- | ------------------------------------------------------------ |
| `quality/active`              | `currentSource`&nbsp;(Object)        | Updates the menu when an external quality change occurs. Payload object contains the current media data. |
| `quality/update`           | `qualityData`&nbsp;(Array)<br/>`current`&nbsp;(Object) | Rebuilds the quality menu from externally updated qualities. The payload includes an array of available qualities and the current stream height and quality. |
| `quality/language/refresh` | `mediaItem`&nbsp;(Object)            | Rebuilds the menu based on language switch. Payload contains the current mediaItem. |