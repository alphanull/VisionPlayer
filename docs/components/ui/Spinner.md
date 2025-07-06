# Spinner

The Spinner component displays a "busy" animation when the player stalls—typically due to an empty buffer or network-related delay. It appears with a configurable delay to avoid flickering during short interruptions. The spinner listens to player stall events as well as manually published control events.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    spinner: {
        delay: 2
    }
};
```

| Setting Name | Type   | Description                                                  |
| ------------ | ------ | ------------------------------------------------------------ |
| `delay`      | Number | Delay (in seconds) before showing the spinner. Helps prevent flickering on short interruptions. |

## Events

### Subscribed own Events:

| Event Name     | Payload Properties | Description                            |
| -------------- | ------------------ | -------------------------------------- |
| `spinner/show` |                    | Manually triggers the spinner to show. |
| `spinner/hide` |                    | Manually triggers the spinner to hide. |