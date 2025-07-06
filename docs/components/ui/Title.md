# Title

The Title component displays the primary and secondary media titles (if available) above the player viewport. It remains hidden when no title data is present or when the feature is disabled. The component automatically updates based on media data and playback language.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    title: {
        showSecondary: true
    }
};
```

| Setting Name       | Type    | Description                                           |
| ------------------ | ------- | ----------------------------------------------------- |
| `showSecondary` | Boolean | If true, shows the secondary title (if available). |
