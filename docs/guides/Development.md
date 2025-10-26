# Development

The VisionPlayer is developer-friendly and includes everything you need to extend or customize it. The development environment is based on Vite, using Rollup for generating the builds. In addition to the Markdown-based documentation, the project also provides automatically generated JSDoc from the source code to give you deeper technical insights when needed. On top of that, the environment also features a development server where you can quickly test and try the player.

## Installation

To set up the development environment, ensure the following dependencies are installed:

- **Node.js** (version 20 or higher)
- **npm** (version 7 or higher)

After cloning or downloading the project, navigate to the root directory and run:

```bash
npm install
```

This will install all required development dependencies. You’re now ready to start developing!

## Development Server

To start the local development server:

```bash
npm run dev
npm run debug # dev server with verbose logging
```

This launches a Vite-based dev server (by default at https://localhost:5173/) and automatically opens the demo page, using `/index.html` as the entry point. Changes to the source files will trigger a live reload. Note that https: is used in order for the examples to work properly (which use external resources).

**Please note** that the dev server is configured to use **https** (but with no real certificate), so you need to accept the security exception (once) in your browser.

### Previewing Builds

To preview the compiled version of the player from `/dist` instead of the raw source code, append the `build` query:

```url
https://localhost:5173/?build
```

Make sure you have generated a build using `npm run build` before.

### Switching player variants

The player offers different build variants (see [Setup](Setup.md)). You can switch between them using the `type` query, optionally combined with `build`:

```url
https://localhost:5173/?type=basic # launches basic variant from source
https://localhost:5173/?type=basic&build # launches prebuilt basic variant
```

### Building the Player

To build the player manually, use one of the following commands:

```bash
npm run build # builds all of the following
npm run build:headless
npm run build:basic
npm run build:default
npm run build:secure
npm run build:dev
```

### Generating docs

To generate HTML documentation ( found at `/docs/jsdoc/`) from the JSDoc comments in the source files:

```bash
npm run doc
```

### Linting

The player uses **ESLint**, including stylistic rules and JSDoc validation. Linting is automatically triggered during each build. To run it manually:

```bash
npm run lint
```

## Theming

VisionPlayer supports visual customization via a large set of native CSS variables. These allow for adjusting colors, spacing, border styles, typography, font scaling, UI layout and more – without writing a single line of JavaScript or touching internal class names.

To apply a theme, simply target the `<vision-player>` element using a selector or ID and override the desired variables.

For example (taken from `/demo/embed/index.html` ):

```html
<style>
    vision-player.theme-demo {
        --font-family-normal: Monospace;
        --color-1st: #FF9C00;
        --color-text: #FFFADD;
        --vip-ui-bg: #133D67;
        --vip-icon-color: #B8F1FF;
        /* ... and many more ... */
    }
</style>
<div id="div-embed" data-vip-config='{"player":{"className":"theme-demo"}' data-vip-media='...'></div>
```

If you need more control, you can override specific class styles with your own CSS. However, for most use cases, the variable-based theming layer should be fully sufficient.

## Creating Components

As described in the [Components](Components.md) section, the player is fully modular and built entirely from individual components. A component is simply a JavaScript class that adds functionality, modifies existing behavior, or builds upon other components.

Components can form hierarchical relationships: parent components can register child components, and child components will only be initialized if their parent—and the functionality it provides—are available. This ensures flexibility while maintaining clear dependencies and separation of concerns.

Each component can define its own configuration options, register internal state properties, add API functions, publish or subscribe to events, and include its own styles or templates. This makes it easy to build custom features or UI modules on top of the player’s core.

### Adding components to the player

To register a custom component:

```javascript
import MyComponent from './MyComponent.js';
Player.addComponent('namespace.componentname', MyComponent);
```

Components are typically registered at build time using Player.addComponent(path, Component, options) and must be added **before** creating a new player instance. Several prebuilt versions already exist in the `/src/builds` folder. To add a component manually, you can write something like this:

```javascript
import Player from '../core/Player.js';
export default Player;
// import Player first, then add components:
import Media from '../core/Media.js';
Player.addComponent('media', Media);
```

You can also import a prebuilt version (e.g. the `basic` build) and add additional components to it. This is how the more complex builds extend the basic one.

| Argument    | Type            | Description                                                  |
| ----------- | --------------- | ------------------------------------------------------------ |
| `path`      | String          | Defines the component’s position within the internal hierarchy. Use "." to separate namespaces. For example, the path `ui.controller.scrubber` registers a `scrubber` component as a child of `controller`, under `ui`. |
| `Component` | Component Class | The component class to be instantiated by the player. Must be a constructor that follows the structure described further below. |
| `options`   | Object          | Optional configuration object passed as the third argument to the component constructor. This allows the same component to be reused with different settings — for example, the Popup component. |

### Component CSS / SCSS

#### Adding CSS to the player entry point

The environment is based on Vite and set so you can directly use CSS as well as SCSS which will be automatically transpiled and hot-reloaded. So you *could* use just a regular import for your (s)css:

```javascript
import '../../assets/scss/player/spinner.scss';
```

However, since VisionPlayer supports the shadow domain, it was necessary to take control of stylesheet loading and managing, in order to be able to insert the style tags where necessary. Therefore it is strongly recommended to load any CSS using the player's `addStyles` API:

```javascript
import spinnerStyles from '../../assets/scss/ui/spinner.scss?inline';
Player.addStyles('../../assets/scss/ui/spinner.scss?inline', spinnerStyles);
```

Also note the `?inline` which tells Vite to load the CSS a a static asset, then to be handled by the player itself. Also make sure to use the exact same import path as argument for `addStyles`. Visionplayer always uses relative paths for imports to make the codebase more "movable".

Another side effect of managing styles on our own is the loss of Vites built in HMR and sourcemap support, so the player also takes care of that by a set of plugins and a virutal module which will trigger the players own CSS update process. So, you still will have HMR and Sourcemaps, but to make that happen, be sure to add those two lines at the beginning of your entry point:

```javascript
// enable vite HMR
import '/@hmr-style-imports';
import.meta.hot?.accept(() => {});
```

In case you have an entry point importing another - typical for player setups to use a base build and then extend upon it - make sure you have those two lines in every entry püoint file that uses CSS:

#### Writing CSS

When writing custom styles, keep in mind that all player CSS should be scoped under `vision-player`. It is strongly recommended that your component styles follow the same convention and also use a consistent prefix — ideally starting with `vip-`. Also keep in mind that shadow mode uses the same CSS, so while technically not necessary, CSS is still scoped:

```scss
vision-player {
    .vip-my-component {
        color: var(--color-1st); // use existing CSS vars is recommended
        // all component (s)css goes here
    }
}
```

### Component Locale

Components can also include their own localization by adding a locale data object to the player build:

```javascript
import myLocale from 'my-locale.json';
Player.addLocale(myLocale);
Player.setLocaleConfig('language code', { rtl: true }); // for languages going from right to left
```

There is also support for RTL languages, in this case you just add the `rtl` config param. Keep in mind that `addLocale` simply merges the provided object into the internal locale registry. While this makes the API flexible and straightforward, it’s your responsibility to ensure that the structure is correct and that you don’t accidentally override existing locale entries. You can either provide one file per language (similar to the global translations), or a single file containing all languages:

```json
{
    "en": {
        "chapter": {
            "next": "Next Chapter",
            "prev": "Previous Chapter"
        }
    },
    "de": {
        "chapter": {
            "next": "Nächstes Kapitel",
            "prev": "Voriges Kapitel"
        }
    }
}
```

In either case, make sure the root-level keys match the actual language codes you are using (e.g. `en`, `de`, etc.).

### Component Class

At the core of every component is a JavaScript class, which is instantiated by the player during initialization. Especially if you want secure mode, use of "real" private variables is strongly recommended. But keep in mind while you can use other ES2022 features like optional chaining, the code is transpiled - **but not polyfilled** - to ES2018 for all builds except the "secure build". So be aware that things like Array.at need to be either avoided or polyfilled.

A typical class skeleton might look like this (ES2022 style, for insights regarding the "secureApi pattern" consult the [Security Documentation](Security.md)):

```javascript
import DomSmith from '/lib/dom/DomSmith.js';

export default class MyComponent {
    // it is strongly recommended to make ALL properties private when using ES2022!
    #config: { myDefault: true }; // default values
    #player;
    #dom;

    // each component is instantiated with a reference to the player, parent and additional options
    // The apiKey in options is provided as well for access to all secure APIs.
    constructor(player, parent, options = {}) {
        // typically, a comp first gets the external config and merges with the own defaults
        const config = player.getConfig('myComponent', this.#config);
        // Abort initialization when user specified 'false' as the config for this comp
        // or there are other factors preventing the comp from running. To indicate this
        // to the player, just return [false] so this comp will be ignored.
        if (!config) return [false];
        // Store references
        this.#player = player;
        // Create DOM using DomSmith and attach to parent container
        const rootElement = player.getRootElement(options.apiKey); // uses secure API
        this.#dom = new DomSmith({/* domConfig */}, rootElement);
        // Subscribe to events
        this.#subscriptions = [
            this.player.subscribe('media/ready', this.onMediaReady)
        ];
    }

   // use bound methods for events etc.
   // prefer `private` methods and expose ONLY public APIs
   #onMediaReady = () => {
        // Logic to run when media is ready
    };

    destroy() {
        // Clean up DOM and event subscriptions
        this.#dom.destroy();
        this.#player.unsubscribe(this.#subscriptions);
        this.#player = this.#dom = null; // destroy references, helps prevent accidental leaks
    }
}
```

So basically, the player calls the constructor when initializing the Component with the following arguments:

| Argument  | Type      | Description                                                  |
| --------- | --------- | ------------------------------------------------------------ |
| `player`  | Player    | A reference to the main player instance. Allows access to player APIs, state, and event handling. |
| `parent`  | Component | A reference to the parent component. Useful when the parent provides a container where this component should attach its DOM elements. |
| `options` | Object    | Optional custom options passed via `addComponent()`. This can be used to configure the same component differently in different setups. Also contains the `apiKey` for extended access to the player when using secure mode. |

A typical workflow begins with retrieving the component’s configuration using `player.getConfig()`. This merges the player-wide config with default values defined inside the component. The first argument for `getConfig()` is usually the same key used in `Player.addComponent()`.

Note the use of `return [false];` inside the constructor. While unconventional, this signals the player not to include the component in the component tree. If a component returns this value, it (and all of its child components) will be skipped during initialization.

Most internal components build their UI using the `DomSmith` utility — a small library for declarative DOM construction — and it’s recommended for third-party components as well. Components often subscribe to events (like `media/ready`) and respond to state changes or lifecycle events. For event handling, use the player’s built-in publish/subscribe system, which is especially well-suited for decoupled, modular component logic.

### Removing Components with destroy()

Last but not least, when removing the player, or rebuilding components due to a config change, the player removes all components in the tree in the reverse order they were created (i.e. children will be removed before their parents) and while doing this, tries to call the `destroy()` method on each component to be removed. While it is not mandatory for components to actually implementent this method, it is almost always necessary to remove any DOM and / events the component was subscribed to.

## Contributing

You are invited to help improving the player and if you’re building something cool on top of the player, feel free to request or share it — or consider contributing your own components back to the ecosystem!