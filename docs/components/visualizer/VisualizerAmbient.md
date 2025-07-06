# VisualizerAmbient

The VisualizerAmbient component renders a real-time ambient visualization based on color data extracted from the video stream. It creates a visual effect similar to “AmbiLight”, where the average color of the video is extended to a surrounding canvas. This component adds a strong visual layer that enhances immersion and atmosphere, especially in dark environments.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    visualizerAmbient: {
        selector: 'body',
        gridSize: 4,
        gridScale: 4,
        smooth: 0.96,
        opacity: 0.7,
        analyseTimer: 250
    }
};
```

### Settings

| Setting Name   | Type   | Description                                                  |
| -------------- | ------ | ------------------------------------------------------------ |
| `selector`     | String | CSS selector resolving to the DOM element to attach the visualizer to. |
| `gridSize`     | Number | Number of grid cells per row and column.                     |
| `gridScale`    | Number | Scaling factor applied to each grid cell.                    |
| `smooth`       | Number | Interpolation factor for temporal smoothing of color transitions. |
| `opacity`      | Number | Opacity value of the visualizer canvas (range: 0 to 1).      |
| `analyseTimer` | Number | Delay between analysis iterations in milliseconds.           |