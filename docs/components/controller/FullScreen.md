# FullScreen

The FullScreen component manages entering and exiting fullscreen mode within the player. It supports the standardized Fullscreen API, as well as iOS-specific handling. A button in the controller area allows the user to toggle fullscreen.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    fullScreen: true
};
```

| Setting Name | Type    | Description                                   |
| ------------ | ------- | --------------------------------------------- |
| `fullScreen` | Boolean | Enables or disables fullscreen functionality. |

## API

The following API functions are added to the player instance to control the component:

| **Method**         | **Arguments** | **Returns** | **Description**         |
| ------------------ | ------------- | ----------- | ----------------------- |
| `fullscreen.enter` |               |             | Enters fullscreen mode. |
| `fullscreen.leave` |               |             | Exits fullscreen mode.  |

## Events

### Published own Events

| Event Name         | Payload Properties | Description                                   |
| ------------------ | ------------------ | --------------------------------------------- |
| `fullscreen/enter` |                    | Fired when the player enters fullscreen mode. |
| `fullscreen/leave` |                    | Fired when the player exits fullscreen mode.  |