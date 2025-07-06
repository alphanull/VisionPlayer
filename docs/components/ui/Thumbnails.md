# Thumbnails

The Thumbnails component displays preview images while scrubbing and hovering on the timeline. It uses a sprite sheet or grid-based image layout to show frame-accurate thumbnails in the scrubber tooltip and a larger preview above the player if enabled. The component dynamically adapts its layout and supports language-specific thumbnails when defined.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    thumbnails: {
        showInScrubber: true,
        showPreview: true
    }
};
```

| Setting Name      | Type    | Description                                                  |
| ----------------- | ------- | ------------------------------------------------------------ |
| `showInScrubber`  | Boolean | Displays a thumbnail inside the scrubber tooltip.            |
| `showPreview`     | Boolean | Displays a larger preview overlay while scrubbing (if `continuousUpdate` is false). |

## Media Data

This component extends the Media Format:

```javascript
const mediaData = {
    // ... other media data ...
    thumbnails: {
        src: {
            de: "/demo/trailer/thumbs/mediaplayer-trailer-thumbs.de.jpg",
            en: "/demo/trailer/thumbs/mediaplayer-trailer-thumbs.en.jpg"
        },
        gridX: 10,
        gridY: 10,
        timeDelta: 0.8795,
        timeDeltaHighres: 0.3
    }
}
```

| Data Property | Type            | Description                                                  |
| ------------- | --------------- | ------------------------------------------------------------ |
| `src`         | String / Object | Source of the image file. Can be a string or an object mapping language codes to thumbnail URLs. |
| `gridX`       | Number          | Number of columns in the thumbnail grid.                     |
| `gridY`       | Number          | Number of rows in the thumbnail grid.                        |
| `timeDelta`   | Number          | Timespan (in seconds) each thumbnail represents in the video timeline. For example, a video with 100 seconds and a grid of 100 items would yield  `timeDelta = 1`. |