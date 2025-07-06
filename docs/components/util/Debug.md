# Debug

The Debug component provides internal diagnostics during player initialization and runtime. It logs basic environment and state data and helps developers debug player behavior by monitoring events and inspecting supported media formats. While not intended for end users, this component can be useful during development, testing, or when troubleshooting media playback issues. Note that this component is not included in the regular production builds.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    debug: {
        logMediaEvents: true,
        logPlayerEvents: true,
        verboseLogging: false
    }
};
```

| Setting Name      | Type    | Description                                                  |
| ----------------- | ------- | ------------------------------------------------------------ |
| `logMediaEvents`  | Boolean | Logs media related events, i.e. event topic starts with `media`. |
| `logPlayerEvents` | Boolean | Logs all other events, except for media related events, like `player/ready`. |
| `verboseLogging`  | Boolean | Enables verbose logging, i.e. additional 'spammy' events like `media/progress` are logged via `console.debug()`. |
