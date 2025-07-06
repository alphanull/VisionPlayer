# Security

Welcome to the **Security Overview** for Vision Player – a little playground, a practical toolkit, and a proof-of-concept for modern JavaScript sandboxing. Vision Player’s Secure Mode is not just a feature – it’s a case study and a challenge for all who love modern JS security. Use it, break it, improve it.

## Why Security?

Vision Player is not designed to guard your nuclear launch codes – but it *is* built to survive in wild CSS environments, resist accidental breakage, and showcase what’s possible with JavaScript, Shadow DOM, and private APIs in 2025. Security in Vision Player is both a *serious experiment* and a playful challenge to see “how far can we go” with encapsulation and controlled API exposure.

If you’re a hacker or just a curious soul:  **Try to break it! The first successful attack gets a beer. Seriously. 🍺**

## Threat Model & Use Cases

- **Main goals:**
  - Prevent accidental or malicious DOM/CSS/JS pollution from breaking the player.
  - Prevent “userland” (e.g., other scripts on the page) from accessing or mutating the player’s internals in a “non official” way.
  - Limit what can be read or modified via the public API – both for privacy and robustness.

- **Non-goals:**
  - Prevent browser plugin or devtools-based hacking (if you can pause the VM, you can own anything).
  - “Ultimate” security for high-value secrets. Vision Player is a *sandbox* – not a digital vault.

## Key Protection Mechanisms

- **No direct DOM access via Shadow DOM (closed mode):**
  - DOM nodes and video elements are only accessible via gated methods, or not at all in Secure Mode.
  - External CSS selectors (like `body .my-player {}`) do not reach inside the player.
- **Private fields (#foo) everywhere:**
  - Internals are not accessible via normal JS property access.
  - In fact, there is no single public property in the VisionPlayer source. If you find one, please file a bug.
- **Object.freeze on the player instance and constructor:**
  - No new properties or methods can be added, existing ones can’t be replaced.
- **Public APIs can be dynamically restricted:**
  - In Secure Mode, APIs like `getComponent` or `getElement` are token-locked and only accessible for internal player components.
  - Add/remove API is blocked.
- **State is strictly read-only:**
  - Only non-critical information (duration, title, etc.) is exposed.
  - Sensitive properties (like `textTracks`) are not exposed at all.
- **Event system (“publish/subscribe”) review:**
  - All events are reviewed to prevent leakage of internals or direct node references.
  - Only components can publish, thus preventing tampering or breakage.
- **XSS protection:**
  - VisionPlayer is (almost) completely immune to any XSS attacks by only using safe DOM methods like `textContent` instead of `innerHTML`, including any locale files or content from media data. In fact, you will only encounter ONE single `innerHTML` method in the whole player codebase that actually sets content.
  - In this case - the Subtitles component - you can configure the level of HTML allowed, and even then the HTML is sanitized and stripped away from any malicious content. Tested with over 50 Attack vectors, but at this point it cannot not 100% guaranteed that this is 100% safe, and frankly - at the moment you set `innerHTML` or use similar APIs there always will be some residual risk. That being said, processing HTML must be explicitly enabled in the Subtitles component.

## **Secure API Pattern with Symbols**

VisionPlayer applies a **secure API pattern** using ES2022 Symbols. This design provides a robust separation between public and privileged (internal) APIs, allowing core components and plugins to interact securely—while blocking unauthorized access from external scripts or the browser console.

From a users perspective, some API methods which may return sensitive data or objects, or allow a userland script to extend or modify the player are **completely blocked** when the players `secureApi` config is enabled. Usage of this API is restricted to components which are - and should be! - the only ones receivingh the players' secret API key.

### **Implementation**

#### **1. Secret Key as a Symbol – Only Player and initialized components know it:**

```javascript
export default class Player {
    /**
     * Secret key only known to the player instance and initialized components.
     * Used to restrict access to API methods in secure mode.
     * @type {symbol}
     */
    #apiKey = Symbol('apiKey');
    // Passing the key to a trusted component
    #launchComponents() {
        // do other stuff
        const newComponent = new ComponentClass(this, parent, {
            apiKey: this.#apiKey, // <- here!
            config
        });
    }
}
```

#### **2. Component accesses privileged API using the secret key:**

```javascript
class MyComponent {
    constructor(player, parent, options) {
        const { apikey } = options;
        player.media.getElement(apiKey); // access secure API
    }
}
```

#### **3. The secured API validates the key with its own before allowing access:**

```javascript
#getElement = apiKey => {
    // Only allow if key matches when secure API is enabled
    if (this.getConfig('player.secureApi') && apiKey !== this.#apiKey) {
        throw new Error('[VisionPlayer] Secure mode: access denied.');
    }
    return this.#videoEle;
};
```

### **Advanced: Dynamic Security and Access Levels**

- The pattern can be extended, currently, the `config.player.secureApi` config flag toggles protection for sensitive methods.

- **Multi-level access** is possible: the system could support multiple levels of trust (e.g. “trusted plugin”, “read-only component”) by issuing different keys or adding additional validation.

- Security can be toggled at runtime (see config).

### **Advantages**

- **Truly protects privileged methods** from tampering, XSS, or console-based attacks.
- **Flexible**: Works for individual components, plugins, or global secure modes.
- **No dependencies**: 100% ES2022, no polyfills, no 3rd-party packages.

### **How is this different from private fields?**

- Private fields (#foo) are limited to the class instance—they don’t allow “friend” access.
- The Symbol key pattern enables **explicit, fine-grained access** for trusted code only, without leaking any public properties.

### **Conclusion**

This approach enables VisionPlayer to offer both an open, modular API **and** a strict “Fort Knox” mode for high-security use cases—*with zero code duplication*.

## How Secure Is It?

Short answer:  *About as secure as a browser-based player can get, without giving up usability or going full iFrame.*

- In practice, “userland” scripts cannot tamper with the player’s core logic, overwrite APIs, or mess with internals
- You can still access video data (duration, current time, etc.), but not internals or DOM nodes.
- Events are reviewed and will not leak direct node references.

**If you find a way in – please let me know!** Security is always a moving target, and the best way to improve is to learn from real attacks.

## Caveats

A secure player build is only as safe as the sum of its components, each component receives the `apiKey` and is responsible for keeping it safe. It is imperative that every component never exposed this key, be it as an event payload or by accidentally setting a global variable etc.

Also if components expose other properties on the global object encapsulation cannot be guaranteed. So if you use the Dash or Hls Components with a secure build, they might leak player internals via their own exposed APIs and objects.

## The Secure Build

Vision Player ships with a dedicated **Secure Build** for those who want to experience all protection mechanisms right away.  This build enables Secure Mode, Shadow DOM (closed), and hardens the player instance and constructor by default. It also freezes the main player object and disables any API surface areas that could expose or allow mutation of internals. So unlike all other entry points, this one is not extensible.

### How to try it:

JUst use the  `VisionPlayer.secure.min.js` build – available in the npm package or github repo.

### What’s different?

- **Build target is ES2022**, so only newer browsers are supported. This means the secure build only works in modern browsers, but also allows the use of true [native private fields](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_class_fields) and methods throughout the codebase. These are enforced at the language level and cannot be accessed or tampered with from outside the class—making “class internals” truly private.
- **Shadow DOM is enabled** in 'closed' mode. This means the internal player DOM is fully encapsulated—even with direct DOM access you cannot reach into the player’s internals.
- **secureApi mode is active**, so the only available player API methods are non-leaking by design. All potentially dangerous or introspective APIs are either restricted or disabled.
- **Default configuration** **cannot be downgraded** (no switching off secureApi or shadow mode at runtime)
- The Player instance and constructor are **frozen** for maximal immutability
- APIs for component and style injection are disabled or removed
- Subtitle rendering is forced to be **text only**, thus completely shielding the player from any possible XSS attack.

**Perfect for:**

- Sandboxing demos
- Embedding in 3rd-party or legacy environments
- Showcasing modern browser isolation features

## "Bug Bounty"

If you manage to break out of the sandbox, overwrite an internal method, or leak internals from a Secure Player instance:
**You get a beer (or a coffee, if you’re remote).**

Open an issue, ping me on GitHub, or write me directly – I’ll gladly reward your efforts.

**PRs, issues and security reviews are always welcome!*
