# AudioChain

The `AudioChain` component implements an own audio processing chain for the player, where other components can insert their own processing chains in order to add effects, filters, analyzers or other processing. This component ensures that all audio is routed through a consistent and controllable flow and also automatically suspends or resumes audio processing based on the media's playback state. If no external `AudioNode`s are attached, the audio is simply passed through. As soon as other modules insert nodes into the chain, they are automatically connected in a logical sequence, and disconnected when removed. Please note that this component has some limitations when building the audio graph, so it is recommended to add `AudioNode`s early during initialization and not change the graph later on.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    audioChain: true
};
```

| Setting Name | Type    | Description                                                  |
| ------------ | ------- | ------------------------------------------------------------ |
| `audioChain` | Boolean | Enables or disables the AudioChain. Note if this is set to false, all childs depending on this component (like audio analysers / visualizers) will be disabled as well. |

## API

The following API functions are added to the player instance to control the component:

| **Method**         | **Arguments**                                                | **Returns** | **Description**                                              |
| ------------------------------------ | ---------------------------- | ------------------------------------ | ------------------------------------------------------------ |
| `audio.getContext` | `secureApiKey`&nbsp;(Symbol)                                 |             | Provides the audio context of this component. This API is protected in secureApi mode. |
| `audio.addNode`    | `input`&nbsp;(AudioNode)<br />`output`&nbsp;(AudioNode)<br />`order` (Number)<br />`apiKey`&nbsp;(Symbol) |             | Inserts an audio node into the internal processing chain. This method expects the input and output (or null if no output is defined, as with analysers) of the processing chain to be inserted, and optionally an order value which determines when the inserted chain will be executed. This API is protected in secureApi mode. |
| `audio.removeNode` | `input`&nbsp;(AudioNode)<br />`output`&nbsp;(AudioNode)<br />`apiKey`&nbsp;(Symbol) |             | Removes a previously added audio node from the processing chain. This method expects the input and outputs of the processing chain to be removed from the 'master chain'. This API is protected in secureApi mode. |
