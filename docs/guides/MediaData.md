# Media Data

The media format used by the player is highly flexible and supports a wide range of use cases – from simple media playback to multilingual, multi-quality, and multi-encoding scenarios. It is built to allow **progressive complexity**: you can start with a simple file and scale up to fully adaptive, multilingual setups with overlays, subtitles, and more.

This format is unique in supporting simultaneous encoding, quality, and language selection — all within one unified structure.

The format supports:

- **Minimalistic input** (e.g., just a video URL).
- **Multiple encodings** per source.
- **Alternative quality representations**.
- **Multilingual media definitions**.
- **Extensibility** for components such as subtitles, thumbnails, overlays, etc.

## Terminology

- A **media item** represents a single media defiinition, which in turn can be grouped into a **playlist**. Each media item points to at least one media ressource (i.e. a file or manifest) and can contain additional metadata.
- A **variant** represents a content-level variation of the media item – such as different languages, narration styles, or visual versions.
- Each variant contains one or more **representation**, which differ in technical quality – e.g. resolution, frameRate, encoding or color space.
- Each representation can contain multiple **encodings** for selecting the most suitable codec and fallback support across different browsers or platforms.

## Specifying mediaData

Media Data is specified using the second argument in the VisionPlayer constructor. This can be either an object describing the media, a URL pointing to a JSON ressource or an URL pointing directly to a media files. The player decides based on the extension if the resource is a potentially playable media ressource, everything else will be currently treated as JSON.

```javascript
const myPlayer1 = new VisionPlayer(targetEle, mediaDataObj);
const myPlayer2 = new VisionPlayer(targetEle, 'mediaData.json');
const myPlayer3 = new VisionPlayer(targetEle, 'mediaFile.mp4');
```

## Minimal Example

The most basic format is to just specify a simple string which points to the URL of the media ressource. But in many cases, the `mediaData` will be an object containing additional information. In this case, you can specify the media URL using the `src` attribute. If nothing else is specified, the player determines if the file is being playable (by checking an internal list of known formats), and if its video or audio only.

```javascript
const mediaData = 'visionplayer-trailer.mp4';
// equivalent to:
const mediaData = {
    src: 'visionplayer-trailer.mp4'
};
```

You also can explicitly specify the `mimeType` of the media ressource, which then will be used for playback checking instead of the `src` extension. This is especially useful when the resource has a nonstandard extension or wouldn't be played by specifiying a mimeType like `.mkv` or `.mov` files.

```javascript
const mediaData = {
    src: 'visionplayer-trailer.mp4',
    mimeType: 'video/mp4'
};
```

## Metadata

Besides the actual source you can specify more metadata. The properties `title` and `titleSecondary` are used to display the medias' title in the player top bar or the playlist menu, while `height` can be used for quality selection, and specifying a `frameRate` enables time display and navigating the media with frame level precision. Please note that the latter properties apply on source level (see below).

```javascript
const mediaData = {
    title: 'alphanull VisionPlayer',
    titleSecondary: {
        en: 'Official Trailer',
        de: 'Offizieller Trailer'
    },
    width: 1920,
    height: 1080,
    frameRate: 60,
    src: 'visionplayer-trailer.mp4'
};
```

Inn addition to that, `title` and `titleSecondary` are "localisable" so instead providing a string, you also can specify an object with the language code as key and the translation as value, as shown above.

## Encodings

Instead specifying `src` directly, you can always use the `encodings` array instead. This contains objects which specify a `src` and the `mimeType` which represents identical representations of the same media excpept for the final encoding. When encountering encodings, the player will pick the first supported format. This is very useful for supporting different formats - in the example below, `AV1` is the mostly preferred codec with `mp4` coming next and then finally a fallback to `webm` if the latter two are not supported.

```javascript
const mediaData = {
    encodings: [
        {
            mimeType: 'video/mp4; codecs=av01.0.05M.08',
            src: 'visionplayer-trailer.av1.mp4'
        },
        {
            mimeType: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
            src: 'visionplayer-trailer.mp4'
        },
        {
            mimeType: 'video/webm',
            src: 'visionplayer-trailer.webm'
        }
    ]

};
```

## DRM

In addition, you also can specify a `drmSystem` with each encoding, used in conjunction with the global `drm` property:

```javascript
const mediaData = {
    title: 'Multi DRM Demo 1',
    titleSecondary: '(FairPlay HLS, Widevine DASH)',
    encodings: [
        {
            src: 'https://contents.pallycon.com/bunny/hls/master.m3u8',
            drmSystem: 'FairPlay'
        },
        {
            src: 'https://contents.pallycon.com/bunny/stream.mpd',
            drmSystem: 'PlayReady'
        },
        {
            src: 'https://contents.pallycon.com/bunny/stream.mpd',
            drmSystem: 'Widevine'
        }
    ],
    drm: {
        Widevine: {
            licenseUrl: 'https://license-global.pallycon.com/ri/licenseManager.do',
            header: {
                'pallycon-customdata-v2': '...'
            }
        },
        FairPlay: {
            certificateUrl: 'https://license-global.pallycon.com/ri/fpsKeyManager.do?siteId=INKA',
            licenseUrl: 'https://license.pallycon.com/ri/licenseManager.do',
            header: {
                'pallycon-customdata-v2': '....'
            }
        },
        PlayReady: {
            licenseUrl: 'https://license-global.pallycon.com/ri/licenseManager.do',
            header: {
                'pallycon-customdata-v2': '....'
            }
        }
    }
}
```

So each encoding gets its own drm system definition, currently supported are: `Widevine`, `FairPlay` and `PlayReady`.This works in conjunction with the `drm` section, where you can specify `licenseUrl`, `certificateUrl` and also custom headers, as needed.

## Representations

While multiple encodings all point to the **same** representation just with different encodings, representations contains the list of **all** available representations . A representation still has exactly the same content as others belonging to the same variant, but differs in quality, i.e. resolution, frameRate etc.  which should be described in each entry.

```javascript
const mediaData = {
    representations: [
        {
            height: 2160,
            src: 'visionplayer-trailer.2160.mp4'
        },
        {
            height: 1080,
            src: 'visionplayer-trailer.1080.mp4'
        }
    ]
};
```

Furthermore, it is also possible to name quality specifically, i.e. setting the `quality` property. When setting `quality`, specifying `height` is optional for the quality selection to work, but note that without specifying `height`, any automatic quality selection won't work anymore:

```javascript
const mediaData = {
    representations: [
        {
            quality: '4K',
            height: 2160,
            src: 'visionplayer-trailer.2160.mp4'
        },
        {
            quality: 'Full HD',
            height: 1080,
            src: 'visionplayer-trailer.1080.mp4'
        }
    ]
};
```

## Representations & Encodings combined

As with a single source, you can use the `encodings` array instead of just specifying `src`. This combines both representation and encoding selection:

```javascript
const mediaData = {
    representations: [
        {
            height: 2160,
            encodings: [
                {
                    mimeType: 'video/mp4; codecs=av01.0.05M.08',
                    src: 'visionplayer-trailer.2160.av1.mp4'
                },
                {
                    mimeType: 'video/mp4; codecs=\'avc1.42E01E, mp4a.40.2\',
                    src: 'visionplayer-trailer.2160.mp4'
                }
            ]
        },
        {
            height: 1080,
            encodings: [
                {
                    mimeType: 'video/mp4; codecs=av01.0.05M.08',
                    src: 'visionplayer-trailer.1080.av1.mp4'
                },
                {
                    mimeType: 'video/mp4; codecs=\'avc1.42E01E, mp4a.40.2\',
                    src: 'visionplayer-trailer.1080.mp4'
                }
            ]
        }
    ]
};
```

## Variants

Last but not least the media data format allows for different variants. In contrast to different representations, a variant still represents the same media subject in general, but may differ in actual content, like the audio language:

```javascript
const mediaData = {
    variants: [
        {
            language: 'de',
            src: 'visionplayer-trailer.de.mp4'
        },
        {
            language: 'en',
            src: 'visionplayer-trailer.en.mp4'
        }
    ]
};
```

## Variants, Representations & Encodings combined

You can combine all of this, so you can specify a media item by different content variations, representations and encodings:

```javascript
const mediaData = {
    title: 'VisionPlayer Trailer',
    variants: [
        {
            language: 'de',
            representations: [
                {
                    height: 2160,
                    encodings: [
                        {
                            mimeType: 'video/mp4; codecs=av01.0.05M.08',
                            src: 'visionplayer-trailer.de.2160.av1.mp4'
                        },
                        {
                            mimeType: 'video/mp4; codecs=\'avc1.42E01E, mp4a.40.2\',
                            src: 'visionplayer-trailer.de.2160.mp4'
                        }
                    ]
                },
                {
                    height: 1080,
                    encodings: [
                        {
                            mimeType: 'video/mp4; codecs=av01.0.05M.08',
                            src: 'visionplayer-trailer.de.1080.av1.mp4'
                        },
                        {
                            mimeType: 'video/mp4; codecs=\'avc1.42E01E, mp4a.40.2\',
                            src: 'visionplayer-trailer.de.1080.mp4'
                        }
                    ]
                }
            ]
        },
        {
            language: 'en',
            representations: [
                {
                    height: 2160,
                    encodings: [
                        {
                            mimeType: 'video/mp4; codecs=av01.0.05M.08',
                            src: 'visionplayer-trailer.en.2160.av1.mp4'
                        },
                        {
                            mimeType: 'video/mp4; codecs=\'avc1.42E01E, mp4a.40.2\',
                            src: 'visionplayer-trailer.en.2160.mp4'
                        }
                    ]
                },
                {
                    height: 1080,
                    encodings: [
                        {
                            mimeType: 'video/mp4; codecs=av01.0.05M.08',
                            src: 'visionplayer-trailer.en.1080.av1.mp4'
                        },
                        {
                            mimeType: 'video/mp4; codecs=\'avc1.42E01E, mp4a.40.2\',
                            src: 'visionplayer-trailer.en.1080.mp4'
                        }
                    ]
                }
            ]
        }
    ]
};
```

## Playlists

The format also supports playlists, in fact each media is handled as an playlist internally. Creating playlists is easy: just nest single media items in the `media` Array. In addition more metadata can be specified on the root object, currently `title` and `titleSecondary` are supported.

```javascript
const mediaData = {
    title: 'Playlist',
    titleSecondary: {
        en: 'title and titleSecondary can be localized as well.',
        de: 'title and titleSecondary können ebenfalls lokalisiert werden.'
    },
    media: [
    {
        title: 'First Media',
        src: 'path/to/1st.mp4'
    },
    {
        title: 'Second Media',
        src: 'path/to/2nd.mp4'
    }
    ]

};
```

Alternatively, you can specify just a string as entry in the playlist Array. In this case, the player will behave like if you only specify a string  for the media data. So, depending the extension the player will treat it as a single media resource or a media item definition file (typically in JSON format).

```javascript
const mediaData = {
    title: {
      en: 'VisionPlayer Playlist',
      de: 'VisionPlayer Abspielliste'
    },
    media: [
      '/demo/trailer/visionplayer-trailer.json',
      '/demo/trailer/visionplayer-trailer-audio.json'
    ]
};
```

## mediaData from other components

The media format can be extended by other components. Currently the following components use their own extension of this format:

- [Subtitles](components/text/Subtitles.md)
- [Chapters](components/ui/Chapters.md)
- [Overlays](components/ui/Overlays.md)
- [Thumbnails](components/ui/Thumbnails.md)

Please refer to the respective documentation for more details.

## Example mediaData

This is a "full blown" example as found in `/demo/trailer/trailer.json` which also uses component format extensions:

```json
{
    "title": {
        "en": "alphanull VisionPlayer EN",
        "de": "alphanull VisionPlayer DE"
    },
    "titleSecondary": {
        "en": "Various Demos",
        "de": "Diverse Demos"
    },
    "variants": [
        {
            "language": "de",
            "representations": [
                {
                    "height": 2160,
                    "encodings": [
                        {
                            "mimeType": "video/mp4; codecs=av01.0.05M.08",
                            "src": "visionplayer-trailer.de.2160.av1.mp4"
                        },
                        {
                            "mimeType": "video/mp4; codecs=\"avc1.42E01E, mp4a.40.2\"",
                            "src": "visionplayer-trailer.de.2160.mp4"
                        }
                    ]
                },
                {
                    "height": 1440,
                    "encodings": [
                        {
                            "mimeType": "video/mp4; codecs=av01.0.05M.08",
                            "src": "visionplayer-trailer.de.1440.av1.mp4"
                        },
                        {
                            "mimeType": "video/mp4; codecs=\"avc1.42E01E, mp4a.40.2\"",
                            "src": "visionplayer-trailer.de.1440.mp4"
                        }
                    ]
                },
                {
                    "height": 1080,
                    "encodings": [
                        {
                            "mimeType": "video/mp4; codecs=av01.0.05M.08",
                            "src": "visionplayer-trailer.de.1080.av1.mp4"
                        },
                        {
                            "mimeType": "video/mp4; codecs=\"avc1.42E01E, mp4a.40.2\"",
                            "src": "visionplayer-trailer.de.1080.mp4"
                        }
                    ]
                },
                {
                    "height": 720,
                    "encodings": [
                        {
                            "mimeType": "video/mp4; codecs=av01.0.05M.08",
                            "src": "visionplayer-trailer.de.720.av1.mp4"
                        },
                        {
                            "type": "video/mp4; codecs=\"avc1.42E01E, mp4a.40.2\"",
                            "src": "visionplayer-trailer.de.720.mp4"
                        }
                    ]
                }
            ]
        },
        {
            "language": "en",
            "representations": [
                {
                    "height": 2160,
                    "encodings": [
                        {
                            "mimeType": "video/mp4; codecs=av01.0.05M.08",
                            "src": "visionplayer-trailer.en.2160.av1.mp4"
                        },
                        {
                            "mimeType": "video/mp4; codecs=\"avc1.42E01E, mp4a.40.2\"",
                            "src": "visionplayer-trailer.en.2160.mp4"
                        }
                    ]
                },
                {
                    "height": 1440,
                    "encodings": [
                        {
                            "mimeType": "video/mp4; codecs=av01.0.05M.08",
                            "src": "visionplayer-trailer.en.1440.av1.mp4"
                        },
                        {
                            "mimeType": "video/mp4; codecs=\"avc1.42E01E, mp4a.40.2\"",
                            "src": "visionplayer-trailer.en.1440.mp4"
                        }
                    ]
                },
                {
                    "height": 1080,
                    "encodings": [
                        {
                            "mimeType": "video/mp4; codecs=av01.0.05M.08",
                            "src": "visionplayer-trailer.en.1080.av1.mp4"
                        },
                        {
                            "mimeType": "video/mp4; codecs=\"avc1.42E01E, mp4a.40.2\"",
                            "src": "visionplayer-trailer.en.1080.mp4"
                        }
                    ]
                },
                {
                    "height": 720,
                    "encodings": [
                        {
                            "mimeType": "video/mp4; codecs=av01.0.05M.08",
                            "src": "visionplayer-trailer.en.720.av1.mp4"
                        },
                        {
                            "mimeType": "video/mp4; codecs=\"avc1.42E01E, mp4a.40.2\"",
                            "src": "visionplayer-trailer.en.720.mp4"
                        }
                    ]
                }
            ]
        }
    ],
    "chapters": [
        {
            "title": "Intro",
            "start": 0
        },
        {
            "title": {
                "en": "Overview",
                "de": "Übersicht"
            },
            "start": 18
        },
        {
            "title": "Demo",
            "start": 31
        },
        {
            "title": {
                "en": "More Features",
                "de": "Weitere Funktionen"
            },
            "start": 58
        }
    ],
    "text": [
        {
            "type": "subtitles",
            "language": "de",
            "src": "/demo/trailer/text/visionplayer-trailer.de.vtt",
            "default": true
        },
        {
            "type": "subtitles",
            "language": "en",
            "src": "/demo/trailer/text/visionplayer-trailer.en.vtt"
        }
    ],
    "thumbnails": {
        "src": {
            "de": "/demo/trailer/thumbs/visionplayer-trailer-thumbs.de.jpg",
            "en": "/demo/trailer/thumbs/visionplayer-trailer-thumbs.en.jpg"
        },
        "gridX": 10,
        "gridY": 10,
        "timeDelta": 0.8795,
        "timeDeltaHighres": 0.3
    },
    "overlays": [
        {
            "type": "poster",
            "src": "/demo/trailer/overlays/visionplayer-trailer-poster.jpg"
        },
        {
            "type": "image",
            "src": "/demo/trailer/overlays/overlay-demo-right.svg",
            "className": "overlay-demo",
            "alt": "Arrow",
            "placement": "bottom-right",
            "margin": 10,
            "cueIn": 59,
            "cueOut": 64
        },
        {
            "type": "image",
            "src": "/demo/trailer/overlays/overlay-demo-left.svg",
            "className": "overlay-demo",
            "alt": "Arrow",
            "placement": "bottom-left",
            "margin": 10,
            "cueIn": 59.5,
            "cueOut": 64.2
        },
        {
            "type": "image",
            "src": "/demo/trailer/overlays/overlay-demo-left.svg",
            "className": "overlay-demo",
            "alt": "Arrow",
            "placement": "top-left",
            "margin": 10,
            "cueIn": 60,
            "cueOut": 64.4
        },
        {
            "type": "image",
            "src": "/demo/trailer/overlays/overlay-demo-right.svg",
            "className": "overlay-demo",
            "alt": "Arrow",
            "placement": "top-right",
            "margin": 10,
            "cueIn": 60.5,
            "cueOut": 64.6
        }
    ]
}
```