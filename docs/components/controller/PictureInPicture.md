# PictureInPicture

The PictureInPicture component enables support for native Picture-in-Picture (PiP) mode on platforms that support the standardized or WebKit-specific API. It provides a control button and backdrop UI, and also exposes API methods to programmatically enter or exit PiP mode.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    pictureInPicture: true
};
```

| Setting Name         | Type    | Description                                      |
|----------------------|---------|--------------------------------------------------|
| `pictureInPicture`   | Boolean | Enables or disables Picture-in-Picture support.  |
