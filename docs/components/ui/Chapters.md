# Chapters

The Chapters component provides visual representations of media chapters across different UI locations. It enhances navigation and content awareness by highlighting current chapter positions and offering next/previous controls. The chapter titles are localized and updated dynamically in the tooltip and controller based on playback time.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    chapters: {
        showInScrubber: true,
        showInTooltip: true,
        showInController: true,
        showControllerButtons: true
    }
};
```

| Setting Name               | Type    | Description                                                  |
| -------------------------- | ------- | ------------------------------------------------------------ |
| `showInScrubber`           | Boolean | Shows chapter segments along the scrubber timeline.          |
| `showInTooltip`            | Boolean | Shows chapter titles within the scrubber tooltip.            |
| `showInController`         | Boolean | Displays a controller segment with chapter title and navigation controls. |
| `showControllerButtons` | Boolean | Shows previous/next chapter buttons in the controller.     |

## Media Data

This component extends the Media Format:

```javascript
const mediaData = {
    // ... other data ...
    chapters: [
        {
            title: 'Intro',
            start: 0
        },
        {
            title: {
                en: 'Overview',
                de: 'Übersicht'
            },
            start: 18
        },
        {
            title: 'Demo',
            start: 31
        },
        {
            title: {
                en: 'More Features',
                de: 'Weitere Funktionen'
            },
            start: 58
        }
    ]
}
```

| Data Property | Type            | Description                                                  |
| ------------- | --------------- | ------------------------------------------------------------ |
| `title`       | String / Object | Chapter title, can be string or locale object with the language code as the respective key |
| `start`       | Number          | Start time of this chapter (in seconds)                      |