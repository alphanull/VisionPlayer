# AudioControls

The AudioControls component provides an equalizer for adjusting multiple frequency bands of the audio output. It integrates with the player’s internal audio processing chain and provides real-time feedback for all adjustments. This component is part of the player’s extended audio feature set and attaches its UI to the 'controls' popup component.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    audioControls: {
        bands: [1, 1, 1, 1, 1]
    }
};
```

| Setting Name | Type          | Description                                                  |
| ------------ | ------------- | ------------------------------------------------------------ |
| `bands`      | Array<Number> | Default frequency band values. Each band controls a specific frequency range from low to high. |
