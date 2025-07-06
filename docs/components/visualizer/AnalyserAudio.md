# AnalyserAudio

The AnalyserAudio component forms the backbone for all audio visualizations in the player. It uses the Web Audio API to perform real-time frequency and time-domain analysis on audio streams. This base class is meant to be subclassed by visual components that make use of the analysis data to render visual effects. It is not intended to be used directly.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    // Note: This component is not configured via playerConfig directly,
    // but extended by visualizer components that subclass it.
    analyserAudio: {
        audioOnly: true,
        channels: 1,
        hiPass: 0,
        loPass: 0,
        fftSize: 512,
        minDecibels: -120,
        maxDecibels: 0,
        smoothingTime: 0.8,
        stopDelay: 1000
    }
};
```

| Setting Name    | Type    | Description                                                  |
| --------------- | ------- | ------------------------------------------------------------ |
| `audioOnly`     | Boolean | If true, analyser activates only for audio media items.      |
| `channels`      | Number  | Number of audio channels to analyse.                         |
| `hiPass`        | Number  | High-pass filter cutoff value.                               |
| `loPass`        | Number  | Low-pass filter cutoff value.                                |
| `fftSize`       | Number  | FFT size used for frequency analysis.                        |
| `minDecibels`   | Number  | Minimum decibel threshold for analysis.                      |
| `maxDecibels`   | Number  | Maximum decibel threshold for analysis.                      |
| `smoothingTime` | Number  | Smoothing time constant used in the analysis.                |
| `stopDelay`     | Number  | Time in milliseconds after pause before stopping the animation loop. |