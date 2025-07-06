# Accessibility

The VisionPlayer was designed from the ground up with a strong commitment to accessibility (a11y), making it usable by keyboard and screenreader users. This document provides an overview of implemented accessibility features and best practices applied throughout the player.

## Accessibility Standards

VisionPlayer is designed with accessibility best practices and WCAG guidelines in mind, providing comprehensive accessibility features that go beyond basic ARIA implementation. The player includes specialized controls for users with visual and auditory impairments, making it suitable for environments where accessibility is a priority.

**Note:** While VisionPlayer implements many accessibility features, formal WCAG compliance should be verified through appropriate testing and audit procedures for your specific use case.

## Keyboard Navigation

The VisionPlayer is navigable via keyboard:

### Global Shortcuts

- **Left / Right Arrow**: Seek -10s / +10s
- **Up / Down Arrow**: Volume up / down
- **Space**: Toggle Play / Pause

### UI-Level Navigation

- **Tab / Shift+Tab**: Move between all interactive elements in logical, visible order
- **Enter / Space**: Activate focused buttons and controls
- **Focus Trap**: When popups are open, the focus is locked inside and loops within
- **Tab Order**: explicit sorting of UI elements in their intended order, allowing modular and predictable focus progression even in dynamic or optional components (e.g., subtitle, Chromecast, PiP)

## ARIA Roles & Attributes

The player uses ARIA attributes to communicate structure and context to screenreaders:

### Dialogs

- `role="dialog"` and `aria-modal="true"` on all popups
- `aria-labelledby` or `aria-label` for contextual titles
- Optional grouping with `role="group"` and `aria-labelledby` within popups

### Buttons & Controls

- All icon buttons have meaningful `aria-label`s
- Input elements (e.g. volume slider, filters) use `aria-label`, optional `aria-valuetext`
- Playlist items use real `<button>`s and `aria-current="true"` to mark active entries

## Visually Hidden Techniques

The player uses accessibility best practices like:

- `tabindex="-1"` for skipping non-focusable content
- CSS styles to expose elements to screenreaders without rendering them visually
- `aria-hidden="true"` for hiding decorative or redundant content
- `role="presentation"` for layout-only containers

## Screenreader Enhancements

### Localized Time Announcements

Time values like `00:00` are accompanied by a localized `aria-valuetext` (e.g. "0 Minutes 0 Seconds") to avoid being misread as a clock.

### Chapter Labels

- Chapter names in the scrubber include a localized prefix using `aria-label` (e.g. "Kapitel: Intro").
- The visible text remains readable and is hidden from screenreaders using `aria-hidden="true"`.

### Dialog and Popup Accessibility

- Popups use `role="dialog"` and `aria-modal="true"` on the main interactive wrapper.
- The dialog label is connected using `aria-labelledby`.
- VoiceOver correctly announces “dialog with N items” and the label text.

### Live Regions and Notifications

- Notifications are inserted into a persistent `aria-live="assertive"` container.
- This triggers screenreader announcements automatically—especially when triggered by keyboard.

## Specialized Accessibility Features

### Picture Controls for Visual Accessibility

VisionPlayer includes advanced picture controls that help users with visual impairments:

- **Brightness Adjustment** — Helps users with low vision or sensitivity to bright screens
- **Contrast Enhancement** — Improves readability for users with color vision deficiencies
- **Color Temperature** — Allows customization for different types of color blindness
- **Saturation Control** — Helps users distinguish between similar colors

### Audio Controls for Hearing Accessibility

The player provides comprehensive audio controls for users with hearing impairments:

- **Multiband Equalizer** — Fine-tune specific frequency ranges for better hearing
- **Volume Normalization** — Consistent audio levels across different content
- **Audio Enhancement** — Boost speech frequencies for clearer dialogue
- **Balance Control** — Adjust left/right channel balance for hearing aids

### Dynamic UI Scaling

- **Real-time Scale Adjustment** — Users can dynamically change UI scale factor during playback
- **Responsive Design** — UI elements adapt to different screen sizes and zoom levels
- **High Contrast Mode** — Enhanced visibility for users with visual impairments

## Disclaimer on Testing

All accessibility features have been tested using VoiceOver (macOS).
Please note that I am not disabled myself and rely on community feedback.
Suggestions, improvements, and bug reports are always welcome!
