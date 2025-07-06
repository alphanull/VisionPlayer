# Shadow DOM

VisionPlayer can use Shadow DOM for ultimate encapsulation, consistent theming, and style robustness – even in hostile CSS environments.

## What is Shadow DOM?

Shadow DOM creates a protected, isolated DOM subtree for your component’s internal UI. No external CSS or JavaScript can leak in, override your styles, or manipulate your player’s internals. This guarantees your player always looks and works as designed – regardless of global CSS chaos.

* Shadow mode creates a mirrored, encapsulated `<vision-player>` inside the original one.
* All classes, IDs, and CSS variables are automatically copied over for seamless theming.
* Set the width/layout on the outer element – the inner player will fill it.
* Switch between Shadow and Non-Shadow with minimal code or config changes.
* Use the same selectors and CSS variables for both modes. Per-instance styling "just works".

### When to use this?

* Whenever you need bulletproof, isolated UI (e.g. in CMS, complex apps, or "hostile" CSS environments)
* When you want to ensure your player always looks and behaves as intended, regardless of global styles
* For scenarios requiring maximum security (preventing JS/CSS leaks to internals)

## Why are there *two* `<vision-player>` elements in shadow mode?

When you activate shadow mode, VisionPlayer creates a second internal  `<vision-player>` element inside the ShadowRoot. This means:

* **Outer** `<vision-player>`:
  * Remains in the normal document flow
  * Used for layout, width, selectors, and hosting attributes/classes/IDs
  * Ensures your CSS selectors for `vision-player` work in both modes
  
* **Inner** `<vision-player>` (Shadow Host):
  * Lives *inside* the ShadowRoot
  * Hosts the actual player UI and logic
  * Mirrors (copies) classes, IDs, and CSS variables from the outer element
  * Always gets an additional `.is-shadow` class for precise targeting

> **In non-Shadow mode:** There is only one `<vision-player>` element, behaving like any standard web component.  
> **In Shadow mode:** There are two `<vision-player>` tags: the outer (for layout/config) and the inner (for encapsulated UI).

This design keeps the developer experience and theming nearly identical between both modes!

## How class, ID, and CSS variable mirroring works

To make theming and per-instance customization as easy and predictable as possible:

* All classes and IDs from the outer  `<vision-player>` are mirrored onto the inner ShadowRoot `<vision-player>`
* All supported \`vip-xxx\` CSS variables set on the outer element (e.g., via a style block or inline) are made available in the ShadowRoot as well
* The  `.is-shadow` class is automatically added to the inner player in Shadow mode, for targeted styling

### Example

```html
<vision-player id="player42" class="vip-theme-dark" data-vip-config='{"dom":{"shadow":"closed"}}'></vision-player>
```

Results in:

* **Outer:**
  `<vision-player id="player42" class="vip-theme-dark" ...>`
* **Inner (in ShadowRoot):**
  `<vision-player id="player42" class="vip-theme-dark is-shadow">`

This means your CSS like:

```css
vision-player.vip-theme-dark { ... }
```

and

```css
:host(.vip-theme-dark) { ... }
```

will work exactly the same, regardless of Shadow mode.

## Important: Width and Layout in Shadow Mode

**Note:** In Shadow mode, the *outer* `<vision-player>` acts as the layout container for the player.
By default, VisionPlayer tries to set its width to `100%`.
**However, due to Shadow DOM scoping, this may not always work as expected!**

If your player appears collapsed or invisible, **make sure to set an explicit width on the outer element** – for example:

```html
<vision-player style="width: 100%"></vision-player>
```

or via CSS:

```css
vision-player { width: 100%; }
```

The inner player will always stretch to fill the outer host.