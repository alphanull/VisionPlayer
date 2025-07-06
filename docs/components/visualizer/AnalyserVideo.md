# AnalyserVideo

The AnalyserVideo component analyzes video frames to extract pixel-based data for visual processing and visualizations. It captures snapshots of the current video frame, reduces them to a defined grid, and smooths color values over time. The component supports real-time analysis, optional debug rendering via canvas elements, and flexible configuration. It is typically used to drive reactive UI elements or video-based ambient visualizations.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    // Note: This component is not configured directly via playerConfig,
    // but extended by visualizer components that subclass it.
    analyserVideo: {
        gridSize: 3,
        gridScale: 3,
        lerp: 0.6,
        dim: 1,
        debug: false,
        analyseTimer: 250
    }
};
```

### Settings

| Setting Name   | Type    | Description                                          |
| -------------- | ------- | ---------------------------------------------------- |
| `gridSize`     | Number  | Number of grid cells per row/column.                 |
| `gridScale`    | Number  | Scaling factor applied to each grid cell.            |
| `lerp`         | Number  | Interpolation factor for smoothing pixel values.     |
| `dim`          | Number  | Dimming multiplier applied to each pixel value.      |
| `debug`        | Boolean | Enables canvas-based visual debugging.               |
| `analyseTimer` | Number  | Delay between analysis iterations (in milliseconds). |
