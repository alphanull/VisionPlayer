# VisualizerTime

The VisualizerTime component displays a real-time waveform visualization of audio signals using time-domain data. It extends the base AnalyserAudio class and renders a scrolling waveform on a canvas element. The component supports OffscreenCanvas-based rendering via a worker and is suitable for visually representing audio amplitude over time.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    visualizerTime: {
        channels: 1,
        fftSize: 512,
        smoothingTimeConstant: 1
    }
};
```

### Settings

| Setting Name            | Type   | Description                                                  |
| ----------------------- | ------ | ------------------------------------------------------------ |
| `channels`              | number | Number of audio channels to visualize.                       |
| `fftSize`               | number | Size of the FFT window used for analysis.                    |
| `smoothingTimeConstant` | number | Smoothing factor for reducing jitter in waveform transitions. |
