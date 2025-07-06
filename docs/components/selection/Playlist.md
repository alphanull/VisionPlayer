# Playlist

The Playlist component provides a UI for selecting and managing multiple media items. It extends the player’s intrinsic ability to handle multiple media entries (see also the section describing the media format) by offering a user interface and additional functionality. The component supports previous/next navigation and an optional popup menu listing all playlist items, including thumbnails and secondary titles—if available. The Playlist menu also adds controls for looping, shuffling (with repetition avoidance), and continuous playback.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    playlist: {
        loop: false,
        shuffle: false,
        continuous: true,
        showButtons: true,
        showMenu: true,
        showMenuButtons: true,
        showPoster: true
    }
};
```

| Setting Name      | Type    | Description                                                  |
| ----------------- | ------- | ------------------------------------------------------------ |
| `loop`            | Boolean | Enables looping the playlist to the first item after reaching the last one. |
| `shuffle`         | Boolean | Randomizes playback order; avoids repetitions.               |
| `continuous`      | Boolean | Enables automatic playback of the next item after media ends. |
| `showButtons`     | Boolean | Shows previous/next navigation buttons in the UI.            |
| `showMenu`        | Boolean | Enables the playlist menu popup.                             |
| `showMenuButtons` | Boolean | Shows control buttons for playlist behavior (loop, shuffle, etc.). |
| `showPoster`      | Boolean | Displays poster images for each media item in the playlist menu. |
