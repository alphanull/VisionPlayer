# Popup

The Popup component adds a customizable button to the controller that opens a layered popup panel. It is designed to be reused by other components such as AirPlay, Quality, PlaybackRate, and Loop, which inject their UI into the popup dynamically. The component supports flexible layout areas (`top`, `center`, `bottom`) and only reveals itself when actual content is detected.

## Configuration

Configuration example:

```javascript
// The Popup component is not configured via playerConfig,
// but rather at build time via the addComponent method:
import Popup from '../ui/Popup.js';

Player.addComponent('ui.controller.popupSettings', Popup, {
    buttonClass: 'icon settings',
    viewClass: 'mp-settings-popup',
    label: 'components.settings.header',
    attach: 'right',
    hideNoContent: false
});
```

| Setting Name    | Type    | Description                                                  |
| --------------- | ------- | ------------------------------------------------------------ |
| `buttonClass`   | String  | CSS class(es) applied to the popup **button** in the controller. |
| `viewClass`     | String  | Additional class applied to the popup **container** for styling. |
| `label`         | String  | Translation path for the accessible button label.            |
| `attach`        | String  | Specifies where the button is inserted within the controller. |
| `hideNoContent` | Boolean | If `true` and no content is present after dynamic deletion hide the popup icon completely, otherwise set it to disabled. |
