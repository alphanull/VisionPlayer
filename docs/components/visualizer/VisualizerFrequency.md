# VisualizerFrequency

The VisualizerFrequency component renders a real-time frequency visualization of audio signals. It extends the base AnalyserAudio component and visualizes the frequency spectrum either on the main thread or via a worker using OffscreenCanvas. It is typically used in audio-focused contexts, providing audio-reactive visual effects, and is compatible with both audio and video content.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    visualizerFrequency: {
        channels: 2,
        fftSize: 512
    }
};
```

### Settings

| Setting Name | Type    | Description                                           |
| ------------ | ------- | ----------------------------------------------------- |
| `channels`   | number  | Number of audio channels to use.                      |
| `fftSize`    | number  | Size of the FFT window used for frequency analysis.   |
| `audioOnly`  | boolean | Whether to activate the component only in audio mode. |
