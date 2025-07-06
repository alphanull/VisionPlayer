# Language

The Language component provides a UI that displays the current media language and allows the user to change it via a popup menu. It supports external updates (e.g., from DASH or HLS components) and can dynamically rebuild the menu when available languages change. Language names are translated when possible and presented in a user-friendly format.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    languageMenu: {
        placeholder: false
    }
};
```

| Setting Name  | Type    | Description                                                  |
| ------------- | ------- | ------------------------------------------------------------ |
| `placeholder` | Boolean | If enabled, display a 'not available' placeholder if no languages are available, otherwise completely hide the menu. |

## Events

### Published own Events

| Event Name          | Payload Properties                           | Description                                                  |
| ------------------- | -------------------------------------------- | ------------------------------------------------------------ |
| `language/selected` | `lang`&nbsp;(String)<br />`id`&nbsp;(String) | Fired when the user selects a language from the menu. Payload contains the language code and a custom id (to be used with Dash and Hls to switch streams correctly). |

### Subscribed own Events

| Event Name        | Payload Properties                                           | Description                                                  |
| ----------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `language/active`    | `lang`&nbsp;(String)<br />`id`&nbsp;(String)                 | The Language component listens for this event to react to outside changes to the current lang. Payload contains  `language` code, `id` and `name` (optional). |
| `language/update` | `languages`&nbsp;(Array)  <br />`currentLanguage`&nbsp;(Object) | Rebuilds the menu when the set of available languages is updated externally (for example by Dash or Hls components). The event payload contains an array of language objects, containing `language` code, `id` and `name` (optional), as well as the currently selected language, containing language code and id (optional). |