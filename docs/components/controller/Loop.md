# Loop

The Loop component provides a simple button that allows the user to toggle the media's loop state in the settings menu. It listens to the player's loop events and updates its visual state accordingly. If the media is a live stream, the component disables itself.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    loopControl: true
};
```

| Setting Name     | Type    | Description                                 |
|------------------|---------|---------------------------------------------|
| `loopControl`    | Boolean | Enables or disables loop control capability. |
