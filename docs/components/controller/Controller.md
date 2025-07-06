# Controller

The Controller component acts as a container for all player control elements (e.g., play/pause buttons, volume, etc.). It provides a parent element - divided into three layout areas - to which all child components can attach. The visibility of the Controller is automatically synchronized with the UI component based on events like `ui/show` and `ui/hide`.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
  controller: true
};
```

| Setting Name | Type    | Description                                                  |
| ------------ | ------- | ------------------------------------------------------------ |
| `controller` | Boolean | Enables or disables the controller component. Note that when disabling the Controller, any child components will be disabled as well. |