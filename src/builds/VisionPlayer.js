/**
 * This module defines the full-featured VisionPlayer build.  This is the entry point if you create a new VisionPlayer.
 * This build extends the "basic" VisionPlayer build variant with a wide range of additional components.
 * This includes controller extensions, quality and subtitle menus, casting capabilities, and advanced visualization components.
 * In addition, all necessary assets like (s)css or locale files are included in the build as well.
 * @exports module:src/builds/VisionPlayer
 * @requires src/builds/VisionPlayer-basic
 * @requires src/casting/AirPlay
 * @requires src/casting/ChromeCast
 * @requires src/controller/Keyboard
 * @requires src/controller/Loop
 * @requires src/controller/PictureInPicture
 * @requires src/controller/ScrubberTooltip
 * @requires src/ui/Overlays
 * @requires src/ui/Chapters
 * @requires src/ui/Popup
 * @requires src/ui/Thumbnails
 * @requires src/text/Subtitles
 * @requires src/text/SubtitleRendererVTT
 * @requires src/selection/File
 * @requires src/selection/Playlist
 * @requires src/settings/AudioControls
 * @requires src/settings/Language
 * @requires src/settings/PlaybackRate
 * @requires src/settings/Quality
 * @requires src/settings/VideoControls
 * @requires src/util/Locale
 * @requires src/visualizer/VisualizerAmbient
 * @requires src/visualizer/VisualizerBar
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */

// enable vite HMR
import '/@hmr-style-imports';
import.meta.hot?.accept(() => {});

// import basic player and extend it.
import Player from './VisionPlayer.basic.js';
export default Player;

// change basic player defaults for extended controller layout
Player.setDefaultConfig({ scrubber: { placement: 'top' } });

// additional locale

import localeDe from '../../assets/locale/VisionPlayer.de.json';
Player.addLocale(localeDe);

import localeFr from '../../assets/locale/VisionPlayer.fr.json';
Player.addLocale(localeFr);

import localeEs from '../../assets/locale/VisionPlayer.es.json';
Player.addLocale(localeEs);

import localePt from '../../assets/locale/VisionPlayer.pt.json';
Player.addLocale(localePt);

import localeIt from '../../assets/locale/VisionPlayer.it.json';
Player.addLocale(localeIt);

import localeTr from '../../assets/locale/VisionPlayer.tr.json';
Player.addLocale(localeTr);

import localeRu from '../../assets/locale/VisionPlayer.ru.json';
Player.addLocale(localeRu);

import localeHi from '../../assets/locale/VisionPlayer.hi.json';
Player.addLocale(localeHi);

import localeJa from '../../assets/locale/VisionPlayer.ja.json';
Player.addLocale(localeJa);

import localeKo from '../../assets/locale/VisionPlayer.ko.json';
Player.addLocale(localeKo);

import localeZh from '../../assets/locale/VisionPlayer.zh.json';
Player.addLocale(localeZh);

import localeAr from '../../assets/locale/VisionPlayer.ar.json';
Player.addLocale(localeAr);
Player.setLocaleConfig('ar', { rtl: true });

// (additional) UI

import overlayStyles from '../../assets/scss/ui/overlays.scss?inline';
import Overlays from '../ui/Overlays.js';
Player.addComponent('overlays', Overlays);
Player.addStyles('../../assets/scss/ui/overlays.scss?inline', overlayStyles);

import chapterStyles from '../../assets/scss/ui/chapters.scss?inline';
import Chapters from '../ui/Chapters.js';
Player.addComponent('ui.controller.chapters', Chapters);
Player.addStyles('../../assets/scss/ui/chapters.scss?inline', chapterStyles);

import thumbnailStyles from '../../assets/scss/ui/thumbnails.scss?inline';
import Thumbnails from '../ui/Thumbnails.js';
Player.addComponent('ui.controller.scrubber.thumbnails', Thumbnails);
Player.addStyles('../../assets/scss/ui/thumbnails.scss?inline', thumbnailStyles);

// subtitles & language

import Popup from '../ui/Popup.js';
Player.addComponent('ui.controller.popupSettings', Popup, { buttonClass: 'icon settings', viewClass: 'vip-settings-popup', label: 'misc.settings', attach: 'right', sort: 62 });
Player.addComponent('ui.controller.popupLanguage', Popup, { buttonClass: 'icon subtitles', viewClass: 'vip-language-subtitle-popup', label: 'misc.languagesub', attach: 'right', sort: 60 });
Player.addComponent('ui.controller.popupControls', Popup, { buttonClass: 'icon control', viewClass: 'vip-control-popup', label: 'misc.audiovideo', attach: 'right', sort: 64 });

import subtitlesStyles from '../../assets/scss/text/subtitles.scss?inline';
import Subtitles from '../text/Subtitles.js';
Player.addComponent('ui.controller.popupLanguage.subtitles', Subtitles);
Player.addStyles('../../assets/scss/text/subtitles.scss?inline', subtitlesStyles);

import SubtitleRendererVTT from '../text/SubtitleRendererVTT.js';
Player.addComponent('ui.controller.popupLanguage.subtitles.subtitleRendererVTT', SubtitleRendererVTT);

import SubtitleRendererIsd from '../text/SubtitleRendererIsd.js'; // (very simple) isd subtitle support
Player.addComponent('ui.controller.popupLanguage.subtitles.subtitleRendererIsd', SubtitleRendererIsd);

import Language from '../settings/Language.js';
Player.addComponent('ui.controller.popupLanguage.languageMenu', Language);

// settings

import Loop from '../controller/Loop.js';
Player.addComponent('ui.controller.popupSettings.loop', Loop);

import pipStyles from '../../assets/scss/controller/pip.scss?inline';
import PictureInPicture from '../controller/PictureInPicture.js';
Player.addComponent('ui.controller.popupSettings.pip', PictureInPicture);
Player.addStyles('../../assets/scss/controller/pip.scss?inline', pipStyles);

import PlaybackRate from '../settings/PlaybackRate.js';
Player.addComponent('ui.controller.popupSettings.playbackRate', PlaybackRate);

import Quality from '../settings/Quality.js';
Player.addComponent('ui.controller.popupSettings.quality', Quality);

// audio / video controls

import pictureStyles from '../../assets/scss/settings/picture.scss?inline';
import VideoControls from '../settings/VideoControls.js';
Player.addComponent('ui.controller.popupControls.videoControls', VideoControls);
Player.addStyles('../../assets/scss/settings/picture.scss?inline', pictureStyles);

import AudioControls from '../settings/AudioControls.js';
Player.addComponent('ui.controller.popupControls.audioControls', AudioControls);

// selecting media

import playlistStyles from '../../assets/scss/selection/playlist.scss?inline';
import Playlist from '../selection/Playlist.js';
Player.addComponent('ui.controller.playlist', Playlist);
Player.addStyles('../../assets/scss/selection/playlist.scss?inline', playlistStyles);

import fileStyles from '../../assets/scss/selection/file.scss?inline';
import File from '../selection/File.js';
Player.addComponent('ui.controller.file', File);
Player.addStyles('../../assets/scss/selection/file.scss?inline', fileStyles);

// casting

import airplayStyles from '../../assets/scss/casting/airplay.scss?inline';
import AirPlay from '../casting/AirPlay.js';
Player.addComponent('ui.controller.airplay', AirPlay);
Player.addStyles('../../assets/scss/casting/airplay.scss?inline', airplayStyles);

import chromecastStyles from '../../assets/scss/casting/chromecast.scss?inline';
import Chromecast from '../casting/ChromeCast.js';
Player.addComponent('ui.controller.chromeCast', Chromecast);
Player.addStyles('../../assets/scss/casting/chromecast.scss?inline', chromecastStyles);

// streaming

import FairPlay from '../streaming/FairPlay.js';
Player.addComponent('media.fairPlay', FairPlay);

import HlsComponent from '../streaming/Hls.js';
Player.addComponent('media.hls', HlsComponent);

import Dash from '../streaming/Dash.js';
Player.addComponent('media.dash', Dash);

// analyser / visualizer

import '../../assets/scss/visualizer/visualizerAmbient.scss';
import VisualizerAmbient from '../visualizer/VisualizerAmbient.js';
Player.addComponent('visualizerAmbient', VisualizerAmbient);

import visualizerAudioStyles from '../../assets/scss/visualizer/visualizerAudio.scss?inline';
import VisualizerBar from '../visualizer/bar/VisualizerBar.js';
Player.addComponent('audioChain.visualizerBar', VisualizerBar);
Player.addStyles('../../assets/scss/visualizer/visualizerAudio.scss?inline', visualizerAudioStyles);
