# UI

The UI component serves as the parent container for all UI-related elements within the video player. It manages the display of the interface by providing auto-hide and show functionality based on user interactions and timeouts. Additionally, it implements basic responsive design features, allowing CSS and other components to adapt the layout based on viewport size changes.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    ui: {
        alwaysVisible: false,
        autoHide: 5,
        clickToPlay: true,
        uiScale: 1,
        showScaleSlider: true
  }
};
```

| Setting Name    | Type    | Description                                                                 |
|------------------|---------|-----------------------------------------------------------------------------|
| `alwaysVisible`  | Boolean | If true, the UI never auto-hides, even when not in focus.               |
| `autoHide`       | Number  | Time (in seconds) after which the UI auto-hides. `0` disables it.          |
| `clickToPlay`    | Boolean | If true, clicking on the video element toggles play/pause. |
| `uiScale`        | Number  | Initial scale factor for the UI. |
| `showScaleSlider`    | Boolean | If `true`, the UI scale slider is shown in the settings popup. |

## API

The following API functions are available:

| **Method**           | **Arguments** | **Returns** | **Description**                                              |
| -------------------- | ------------- | ----------- | ------------------------------------------------------------ |
| `ui.hide`            |               |             | Hide all player UI elements. Does not pause playback; just removes the UI layer from view. |
| `ui.show`            |               |             | Show the player UI if it was previously hidden.              |
| `ui.disableAutoHide` |               |             | Disable the automatic UI hide feature. Normally, the UI hides after a short timeout when idle; this call prevents that behavior. |
| `ui.enableAutoHide`  |               |             | Re-enable the automatic UI hide after a period of inactivity. |
| `ui.enableAutoHide`  |               |             | Re-enable the automatic UI hide after a period of inactivity. |

## State

The following properties are exposed to the players global `player.state` object:

| State Name     | Type    | Description                                                                 |
|-----------------|---------|-----------------------------------------------------------------------------|
| `uiVisible`     | Boolean | Indicates whether the UI is currently visible.                              |
| `hasFocus`      | Boolean | Determines if the player (or UI container) currently has focus.             |
| `playerWidth`   | Number  | Current width of the player's container element.                            |
| `playerHeight`  | Number  | Current height of the player's container element.                           |

## Events

### Published own Events

| Event Name    | Payload Properties                                  | Description                                                  |
| ------------- | --------------------------------------------------- | ------------------------------------------------------------ |
| `ui/show`     |                                                     | Fired when the UI is shown                                   |
| `ui/hide`     |                                                     | Fired when the UI is hiding                                  |
| `ui/enabled`  |                                                     | Fired when the UI functionalities are enabled                |
| `ui/disabled` |                                                     | Fired when the UI functionalities are disabled               |
| `ui/resize`   | `width`&nbsp;(Number)<br />  `height`&nbsp;(Number) | Fired when the player viewport resizes. Note that the resize is - when supported - only fired when the viewport resizes, not necessarily the whole browser window. This events' payload contains the width and height of the players' viewport. |