# AirPlay

The AirPlay component enables AirPlay functionality on compatible browsers such as Safari macOS and Safari iOS. When a compatible streaming device is found (e.g., Apple TV or AirPlay Server Software on macOS), the user can stream the current video to this device. This component **also works with HLS streams** provided the video element exposes a regular `https://...m3u8` URL. Blob-based MediaSource playback is not supported by AirPlay receivers. There is a heuristic **that falls back to** an MP4 rendition whenever both AV1 and MP4 are present, because AirPlay devices cannot decode AV1 (as of 2025).

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    airPlay: {
        showControllerButton: true,
        showMenuButton: false
    }
};
```

| Setting Name        | Type    | Description                                                       |
|---------------------|---------|-------------------------------------------------------------------|
| `showControllerButton`  | Boolean | Shows or hides the controller button.                        |
| `showMenuButton`        | Boolean | Shows or hides the menu button.                              |

## State

The following properties are exposed to the players global `player.state` object:

| State Name        | Type    | Description                                                                            |
|-------------------|---------|----------------------------------------------------------------------------------------|
| `airPlayActive`   | Boolean | Indicates whether AirPlay is currently active (either `connecting` or `connected`).   |

## Events

### Published own Events

| Event Name      | Payload Properties | Description                          |
| --------------- | ------------------ | ------------------------------------ |
| `airplay/start` |                    | Fired when AirPlay has been started. |
| `airplay/stop`  |                    | Fired when AirPlay has been stopped. |