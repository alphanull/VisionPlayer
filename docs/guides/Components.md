# Component Index

Components are the building blocks of the VisionPlayer, in fact the player is entirely composed of components, inclduing the base class itself. Components can deliver core functionality, like data parsing or augment certain aspects of media handling, like controlling the volume. Each component can augment the global player state, the player API and define it's own events to fire or to react to.

Here is an overview which links to each components' documentation, including settings, API, media format and custom events:

## Core

Components providing essential core functionalities of the player:

### [Data](../components/core/Data.md)

### [Dom](../components/core/Dom.md)

### [Media](../components/core/Media.md)

### [Player](../components/core/Player.md)

## Locale

Locale specific components, i.e. translations etc.

### [Locale](../components/locale/Locale.md)

## Controller

Components which deal with controlling media:

### [Controller](../components/controller/Controller.md)

### [FullScreen](../components/controller/FullScreen.md)

### [Keyboard](../components/controller/Keyboard.md)

### [Loop](../components/controller/Loop.md)

### [PictureInPicture](../components/controller/PictureInPicture.md)

### [Play](../components/controller/Play.md)

### [PlayOverlay](../components/controller/PlayOverlay.md)

### [Scrubber](../components/controller/Scrubber.md)

### [ScrubberTooltip](../components/controller/ScrubberTooltip.md)

### [Volume](../components/controller/Volume.md)

## Selection

Components related to selecting media (e.g. from playlists):

### [File](../components/selection/File.md)

### [Playlist](../components/selection/Playlist.md)

## Settings

Components related to user-adjustable playback settings:

### [AudioControls](../components/settings/AudioControls.md)

### [Language](../components/settings/Language.md)

### [PlaybackRate](../components/settings/PlaybackRate.md)

### [Quality](../components/settings/Quality.md)

### [VideoControls](../components/settings/VideoControls.md)

## Casting

Components related to external media casting:

### [AirPlay](../components/casting/AirPlay.md)

### [ChromeCast](../components/casting/ChromeCast.md)

## Streaming

Components which enable (live) streaming:

### [Dash](../components/streaming/Dash.md)

### [FairPlay](../components/streaming/FairPlay.md)

### [Hls](../components/streaming/Hls.md)

## Text

Components dealing with text:

### [SubtitleRendererVTT](../components/text/SubtitleRendererVTT.md)

### [SubtitleRendererIsd](../components/text/SubtitleRendererIsd.md)

### [Subtitles](../components/text/Subtitles.md)

## Ui

User Interface components that provide additional visual feedback and information:

### [Chapters](../components/ui/Chapters.md)

### [Notifications](../components/ui/Notifications.md)

### [Overlays](../components/ui/Overlays.md)

### [Popup](../components/ui/Popup.md)

### [Spinner](../components/ui/Spinner.md)

### [Thumbnails](../components/ui/Thumbnails.md)

### [Time](../components/ui/Time.md)

### [Title](../components/ui/Title.md)

### [UI](../components/ui/UI.md)

## Util

Various helper modules and components

### [AudioChain](../components/util/AudioChain.md)

### [Debug](../components/util/Debug.md)

### [PerformanceMonitor](../components/util/PerformanceMonitor.md)

## Visualizer

Components dedicated to audio and video visualization effects and enhancements:

### [AnalyserAudio](../components/visualizer/AnalyserAudio.md)

### [AnalyserVideo](../components/visualizer/AnalyserVideo.md)

### [VisualizerAmbient](../components/visualizer/VisualizerAmbient.md)

### [VisualizerBar](../components/visualizer/VisualizerBar.md)

### [VisualizerFrequency](../components/visualizer/VisualizerFrequency.md)

### [VisualizerTime](../components/visualizer/VisualizerTime.md)