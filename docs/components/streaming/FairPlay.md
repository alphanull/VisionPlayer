# FairPlay

The FairPlay component handles Apple FairPlay DRM for HLS streams on Safari browsers. It works by setting up a WebKit key session using the `webkitneedkey` API, obtaining a DRM certificate, creating the SPC message, retrieving the license, and initializing secure playback. The plugin only activates on Safari browsers and registers itself during initialization.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    fairPlay: {
        certificateUrl: '',
        certificate: '',
        licenseUrl: '',
        header: {}
    }
};
```

| Setting Name     | Type   | Description                                               |
| ---------------- | ------ | --------------------------------------------------------- |
| `certificateUrl` | String | URL to fetch the base64-encoded FairPlay DRM certificate. |
| `certificate`    | String | Optional inline base64-encoded DRM certificate.           |
| `licenseUrl`     | String | URL of the license server to request content keys.        |
| `header`         | Object | Custom HTTP headers to include in the license request.    |
