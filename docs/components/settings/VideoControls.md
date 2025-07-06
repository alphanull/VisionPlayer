# VideoControls

The VideoControls component provides UI controls in the controls popup menu to adjust various visual properties of the video output in real time. It includes sliders for brightness, contrast, saturation, sharpening, and hue rotation. These settings are mapped to CSS or SVG-based filters and applied live to the video element. The component disables itself automatically for audio-only media.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    videoControls: {
        brightness: 1,
        contrast: 1,
        sharpen: 1,
        saturate: 1,
        hue: 1
    }
};
```

| Setting Name | Type   | Description                                                  |
| ------------ | ------ | ------------------------------------------------------------ |
| `brightness` | Number | Enables brightness control and sets initial level (range 0–2, default is 1). |
| `contrast`   | Number | Enables contrast control and sets initial level (range 0–2, default is 1). |
| `sharpen`    | Number | Enables sharpen control and sets initial level (range 0–2, default is 1). |
| `saturate`   | Number | Enables saturation control and sets initial level (range 0–2, default is 1). |
| `hue`  | Number | Enables hue-rotation control and sets initial factor (range 0–2, default is 1). |
