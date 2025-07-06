# Dom

This component manages the root DOM structure of the player. It is responsible for injecting, replacing, or appending the root wrapper element, according to the configured `placement` mode. All internal components depend on this element being mounted and available, as it acts as the main container and layout context for the entire player. It also includes layout logic for aspect ratio handling and emits well-defined lifecycle events for DOM readiness.

Furthermore, this component also manages CSS styles and can insert it at different locations, with Vite HMR and Sourcemaps still intact while developing. This also enables support for Shadow DOM, so the player can be completely shielded against outer DOM and style access.

Note:** this component is **mandatory** and required for normal player operations, so it cannot be switched off and also should be the first component to be added.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    dom: {
        shadow: '',
        className: '',
        insertMode: 'auto',
        darkMode: 'dark',
        layout: '',
        aspectRatio: 16 / 9,
        aspectRatioTransitions: false,
        width: '100%',
        height: ''
    }
};
```

| Setting Name             | Type            | Description                                                  |
| ------------------------ | --------------- | ------------------------------------------------------------ |
| shadow                   | String          | Shadow DOM mode: `'closed`', `'open'`, or `''` (no Shadow DOM). If enabled, all player UI is rendered inside a shadow root for encapsulation and style isolation. |
| `className`              | String          | Sets a custom classname on the player instance.              |
| `insertMode`             | String          | Defines how the player is inserted into the DOM in conjunction with the `target` element. Can have the following values: `auto` generally appends to `target`, but replaces media elements (`audio` and `video`) and elements with a `vip-data-media attribute`, `append` treats the target element as parent to attach to, `replace` replaces the target element while `before` inserts the player before the target. |
| `darkMode`               | String          | Sets the preferred visual mode for the player: `dark`, `light`, or `auto` for using system defaults. |
| `layout`                 | String          | Activates special layout modes. Currently supported: `'controller-only'`: Only the controller bar is shown for audio use cases. |
| `aspectRatio`            | String / Number | Defines the aspect ratio of the player. Can be a numeric value like `16/9` or `1.777`, `'auto'` to automatically adapt to the current video, or `'fill'` to make layout depend on the container. Ignored when **both** `width` and `height` are defined. |
| `aspectRatioTransitions` | Boolean         | If true, aspect ratio changes are animated (if supported by the browser). |
| `width`                  | String / Number | Optional fixed width. If set as a number, it will be interpreted as pixels. If set as a string, it will be passed as-is to the CSS (e.g. `'100%'`, `'80vw'`). |
| `height`                 | String / Number | Optional fixed height. If set as a number, it will be interpreted as pixels. If set as a string, it will be passed as-is to the CSS (e.g. `'100%'`, `'80vw'`). |

## API

The following API functions are available:

| **Method**            | **Arguments**                                | **Returns** | **Description**                                              |
| --------------------- | -------------------------------------------- | ----------- | ------------------------------------------------------------ |
| `dom.getElement`      | `apiKey`&nbsp;(Symbol)                     | HTMLElement | Return the top-level DOM element where the player is rendered. Requires a valid `apiKey` in secure mode. |
| `dom.updateStyles`    | `styles`&nbsp;(Array)                        |             | Update the player's style rules at runtime. This is mainly used for HMR (Hot Module Replacement) during development. Takes an array of style objects and patches the existing CSS. |
| **Static API**        |                                              |             |                                                              |
| `Player.addStyles`    | `path`&nbsp;(String)<br/>`css`&nbsp;(String) |             | Adds a new CSS rule set loaded from the given path with the provided raw CSS text. Only available in development mode; not in secure builds. |
| `Player.updateStyles` | `styles`&nbsp;(Array)                        |             | Global version of updateStyles. Replaces CSS of all components, based on an array of ( selector, rules ) objects, mainly for HMR support. |

## Events

### Published own Events

| Event Name        | Payload Properties | Description                                                  |
| ----------------- | ------------------ | ------------------------------------------------------------ |
| `dom/beforemount` |                    | This event is fired when the player has initialized all components, and the DOM is finalized but is not added to the document yet. |
| `dom/ready`       |                    | Fired when the player root dom was inserted into the document |
