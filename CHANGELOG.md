# Changelog

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org) and follows the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

---

## [1.1.0] – 2025-10-06

### Added

- New API: `fullscreen.enter()` and `fullscreen.leave()`

### Fixed

- Mobile menu in the demo has improved scrollbar handling
- Improved scroll locking for iOS devices when using the mobile menu

### Changed

- Updated dev dependencies

## [1.0.1] – 2025-08-07

### Fixed

- Removed dead code in DomSmith
- Fixed docs in srtParser

### Changed

- Updated dev dependencies

---

## [1.0.0] – 2025-07-06

### Added

- This marks the first release of **VisionPlayer**
- **Fully modular architecture** — Components can be easily added, removed, or replaced without modifying the core, with nearly 50 components already provided.
- **Native HTML5 video support** — Plays MP4, WebM, and other browser-supported formats.
- **Multi-language and multi-quality stream selection** — Each stream can offer multiple languages, resolutions, and encodings. Quality can be automatically selected depending on screen resolution.
- **Streaming support** — DASH and HLS support, both VOD and Live Streaming, fully integrated into the player UI including subtitles, audio and quality selection.
- **FairPlay, Widevine, and PlayReady DRM** — Encrypted media playback for premium content.
- **Chromecast and AirPlay** — External device playback handling with full UI synchronization.
- **Playback Controls** — Play/pause, scrubber, volume, playback rate, fullscreen, loop and more.
- **Playlist Management** — Seamless navigation between multiple media items, with optional shuffle and loop modes.
- **Subtitle support** — WebVTT rendering with support for positioning, all writing modes and built in HTML sanitiser, TTML (IMSC1/EBU-TT-D) handling, and native `<track>` integration for iOS compatibility.
- **Dynamic Overlays** — Posters, images and other content at defined cue points.
- **Thumbnails** — Display thumbnails in the scrubber tooltip or use them for a special scrubbing mode.
- **Chapters** — Display Chapters in the controller or scrubber tooltip.
- **Picture-in-Picture** — Play video in a separate overlay window.
- **Picture and Audio Ccontrols** — Adjust video brightness, contrast, and more, or fine-tune your audio with a multiband equalizer.
- **Advanced Accessibility** — Comprehensive accessibility features including Picture & Audio Controls for visual/auditory impairments, keyboard navigation, and screen reader support.
- **Local playback** — Play local media by selecting or dragging and dropping files.
- **Audio and Video Visualizations** — Including bar visualizer, ambient light effects, and waveform displays.
- **Extensive Media Data Format** — With support for extensible metadata and multiple media variants, representations, and encodings.
- **Extended Localization** — Builds includes the following out‑of‑the‑box UI translations: English, German, Spanish, Portuguese, French, Italian, Russian, Chinese (Simplified), Japanese, Korean, Hindi, Arabic & Turkish.
- **Scalable, responsive UI** — UI intelligently adapts to every player size, UI scale factor is dynamically changeable by the user.
- **Theme support** — Built-in dark and light modes, with CSS custom properties for full theming flexibility.
- **Easy Embedding** — Supports converting existing video tags and any other elements with `data-vip` attributes, optionally with autoloading.
- **Minimal global footprint** — Only one exported class (`VisionPlayer`), with everything else modular and encapsulated.
- **Single, zero dependency bundle File** — VisionPlayer bundles all code, styles, SVG assets and language files into a zero-dependency single build artifact – making integration seamless.
- **Optimized Performance** — GPU-accelerated transitions, minimal reflows, and efficient DOM updates.
- **Security Features** — Optional Secure Mode with Shadow DOM, API protection and XSS prevention.
- **1-Minute Setup** — Get from `npm install` to working demo in under 60 seconds with vite dev server.