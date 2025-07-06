# File

The File component provides functionality to handle playing local media files. Files can be selected via the standard file selector or by dragging & dropping. Selected files are converted into binary blobs and passed to the player where they can be played as usual. If more than one file is selected, a corresponding playlist will be generated automatically.

**Note: This component is disabled by default and has to be explicitly enabled via `playerConfig`**

## Configuration

Configuration example with defaults (when enabled with `file: true`):

```javascript
const playerConfig = {
    file: {
        fileDrop: true,
        fileSelector: true,
        fileSelectorAccept: true
    }
};
```

| Setting Name         | Type    | Description                                                  |
| -------------------- | ------- | ------------------------------------------------------------ |
| `fileDrop`           | Boolean | Enables drag & drop file upload.                             |
| `fileSelector`       | Boolean | Enables the file selection button in the controller.         |
| `fileSelectorAccept` | Boolean | If `true`, the file picker limits selection to supported extensions (e.g. .mp4, .webm); if `false`, it accepts any file type, enabling formats such as .mov or .mkv. |
