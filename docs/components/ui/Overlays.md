# Overlays

The Overlays component displays layered visual elements—such as logos or posters—on top of the player viewport. It supports various positioning, scaling and timing modes.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    overlays: {
        adaptLayout: true,
        sanitizeHTML: true
    }
};
```

| Setting Name  | Type    | Description                                                  |
| ------------- | ------- | ------------------------------------------------------------ |
| `adaptLayout` | Boolean | Aligns overlay position with controller and title visibility state. |
| `sanitizeHTML | Boolean | Sanitizes the HTML of the overlay to prevent XSS attacks. |

## Media Data

This component extends the Media Format:

```javascript
const mediaData = {
    // ... other media data ...
    overlays: [
        {
            type: 'poster',
            src: '/path/to/poster.jpg',
            scale: 'cover'
        },
        {
            type: 'html',
            src: '<p><a href="https://visionplayer.io">VisionPlayer</a></p>',
            scale: 'cover'
        },
        {
            type: 'image',
            src: '/path/to/image.svg',
            className: 'overlay-demo',
            alt: 'Arrow',
            placement: 'bottom-right',
            margin: 10,
            cueIn: 59,
            cueOut: 64
        }
    ]
}
```

| Overlayitem Property | Type   | Required | Description                                                  |
| -------------------- | ------ | -------- | ------------------------------------------------------------ |
| `type`               | String | Yes      | Overlay type, currently supported are `poster` (Poster Image displayed at the beginning), `poster-end` (Poster Image displayed at the end) or `image` (Image displayed either permanetly or during a specified time span) |
| `src`                | String | Yes      | URL of the overlay image, or HTML code for type `html`.      |
| `className`          | String |          | Custom classname for this overla item.                       |
| `alt`                | String |          | Additional `alt` text for the overlay image.                 |
| `placement`          | String |          | Defines the placement of the image in the viewport. Currently supported are: `center`, `top`, `bottom`, `left`, `right`, `top-left`, `top-right`, `center-left`, `center-right`, `bottom-left`, `bottom-right` |
| `scale`              | String |          | Defines how to scale the overlay image. Currently supported are: cover, contain. |
| `margin`             | Number |          | Margin (in pixels) which defines the distance of the overlay to the players' viewport. |
| `cueIn`              | Number |          | Time (in seconds) at which this overlay item should be displayed. |
| `cueOut`             | Number |          | Time (in seconds) at which this overlay item should be hidden. |

In addition, a standard poster image can be specified using this shortcut:

```javascript
const mediaData = {
  	poster: '/demo/trailer/overlays/mediaplayer-trailer-poster.jpg',
    // equivalent to:
    overlays: [
        {
            type: 'poster',
            src: '/demo/trailer/overlays/mediaplayer-trailer-poster.jpg'
        }
    ]
}
```

