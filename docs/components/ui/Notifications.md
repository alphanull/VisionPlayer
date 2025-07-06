# Notifications

The Notifications component provides a centralized UI for showing messages triggered by the player or other components. It supports different notification types (e.g., `info`, `warning`, `error` or `success`), custom content nodes, and optional auto-hide behavior. 

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    notifications: {
        showFileOnError: false,
        showMessageOnError: false
    }
};
```

| Setting Name         | Type    | Description                                              |
| -------------------- | ------- | -------------------------------------------------------- |
| `showFileOnError`    | Boolean | If true, shows the media file name in errors.            |
| `showMessageOnError` | Boolean | Show additional message in errors, useful for debugging. |

## Events

### Subscribed own Events:

| Event Name     | Payload Properties                                           | Description                                                  |
| -------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `notification` | `type`&nbsp;(String)<br />`title`&nbsp;(String)<br />`message`&nbsp;(String)<br /> `messageSecondary`&nbsp;(String) <br />`content`&nbsp;(HTMLElement)  `options.timeout`&nbsp;(Number) | Triggers a visual notification. Can include type, title, the text message, additional DOM content and auto-hide settings. |