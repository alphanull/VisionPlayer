# PerformanceMonitor

Displays a small overlay with real-time FPS & video rendering stats inside the VisionPlayer UI. This is intended for development and not included in the default builds.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    performanceMonitor: true
};
```

| Setting Name | Type    | Description                           |
| ------------ | ------- | ------------------------------------- |
| `performanceMonitor`      | Boolean | Enables or disables monitoring capability. |