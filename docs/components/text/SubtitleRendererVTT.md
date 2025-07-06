# SubtitleRendererVTT

The SubtitleRendererVTT component handles the rendering and positioning of VTT-based subtitles. It is responsible for displaying subtitle cues on screen, adapting to both horizontal and vertical layouts, and supporting snapping to line grids or absolute positioning. The renderer also performs HTML sanitization.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    subtitlesVTT: {
        forceSnapToLines: false
    }
};
```

| Setting Name       | Type    | Description                                                  |
| ------------------ | ------- | ------------------------------------------------------------ |
| `forceSnapToLines` | Boolean | Forces cues to snap to grid lines, even if not explicitly defined in cues. |
