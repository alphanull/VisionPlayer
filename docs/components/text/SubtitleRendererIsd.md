# SubtitleRendererIsd

SubtitleRendererIsd is a plugin renderer for subtitles in TTML format. It is registered with the Subtitles component and creates DOM output from `isd` (Intermediate Synchronic Document) subtitle cues. The renderer currently supports rudimentary structure parsing (`div`, `p`, `span`, `br`) and ignores formatting and styling instructions. This component is intended for rendering embedded TTML subtitles provided by streaming engines like DASH.js.
