# VisualizerBar

The VisualizerBar component displays a real-time mirrored bar visualization of audio signals. It extends the base AnalyserAudio component and renders a symmetric set of vertical bars based on frequency data using an HTML5 Canvas element. This component is useful for compact audio-only UIs or background visualizations.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    visualizerBar: {
        bands: 7,  
        channels: 2,
        fftSize: 32
    }
};
```

### Settings

| Setting Name | Type   | Description                                        |
| ------------ | ------ | -------------------------------------------------- |
| `bands`      | Number | Number of EQ bands to displayed as mirrored bars). |
| `channels`   | Number | Number of audio channels to use.                   |
| `fftSize`    | Number | Size of the FFT window used for analysis.          |
