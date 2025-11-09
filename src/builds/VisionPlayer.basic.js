/**
 * The basic build of VisionPlayer. This is the entry point if you create a new VisionPlayer.
 * Provides core functionality, basic UI components (controller, scrubber, play button, volume, fullscreen, etc.)
 * and essential UI feedback mechanisms (spinner, notifications, title).
 * In addition, all necessary assets like (s)css or locale files are included in the build as well.
 * @exports module:src/builds/VisionPlayer-basic
 * @requires src/builds/VisionPlayer-headless
 * @requires src/core/Media
 * @requires src/core/Data
 * @requires src/core/Player
 * @requires src/controller/Controller
 * @requires src/controller/FullScreen
 * @requires src/controller/Scrubber
 * @requires src/controller/Play
 * @requires src/controller/PlayOverlay
 * @requires src/controller/Volume
 * @requires src/util/AudioChain
 * @requires src/util/Locale
 * @requires src/ui/UI
 * @requires src/ui/Spinner
 * @requires src/ui/Notifications
 * @requires src/ui/Title
 * @requires src/ui/Time
 * @author   Frank Kudermann - alphanull
 * @version  1.2.3
 * @license  MIT
 */

// enable vite HMR
import '/@hmr-style-imports';
import.meta.hot?.accept(() => {});

// import headless player and extend it.
import Player from './VisionPlayer.headless.js';
export default Player;

// core components

import AudioChain from '../util/AudioChain.js';
Player.addComponent('audioChain', AudioChain);

// Locale (english only for this build)

import Locale from '../locale/Locale.js';
Player.addComponent('locale', Locale);

import localeEn from '../../assets/locale/VisionPlayer.en.json';
Player.addLocale(localeEn);

// additional components

import uiStyles from '../../assets/scss/ui/ui.scss?inline';
import UI from '../ui/UI.js';
Player.addComponent('ui', UI);
Player.addStyles('../../assets/scss/ui/ui.scss?inline', uiStyles);

import keyboardStyles from '../../assets/scss/controller/keyboard.scss?inline';
import Keyboard from '../controller/Keyboard.js';
Player.addComponent('ui.keyboard', Keyboard);
Player.addStyles('../../assets/scss/controller/keyboard.scss?inline', keyboardStyles);

import spinnerStyles from '../../assets/scss/ui/spinner.scss?inline';
import Spinner from '../ui/Spinner.js';
Player.addComponent('ui.spinner', Spinner);
Player.addStyles('../../assets/scss/ui/spinner.scss?inline', spinnerStyles);

import notificationsStyles from '../../assets/scss/ui/notifications.scss?inline';
import Notifications from '../ui/Notifications.js';
Player.addComponent('ui.notifications', Notifications);
Player.addStyles('../../assets/scss/ui/notifications.scss?inline', notificationsStyles);

import titleStyles from '../../assets/scss/ui/title.scss?inline';
import Title from '../ui/Title.js';
Player.addComponent('ui.title', Title);
Player.addStyles('../../assets/scss/ui/title.scss?inline', titleStyles);

import controllerStyles from '../../assets/scss/controller/controller.scss?inline';
import Controller from '../controller/Controller.js';
Player.addComponent('ui.controller', Controller);
Player.addStyles('../../assets/scss/controller/controller.scss?inline', controllerStyles);

import Play from '../controller/Play.js';
Player.addComponent('ui.controller.playControl', Play);

import volumeStyles from '../../assets/scss/controller/volume.scss?inline';
import Volume from '../controller/Volume.js';
Player.addComponent('ui.controller.volume', Volume);
Player.addStyles('../../assets/scss/controller/volume.scss?inline', volumeStyles);

import timeStyles from '../../assets/scss/ui/time.scss?inline';
import Time from '../ui/Time.js';
Player.addComponent('ui.controller.time', Time);
Player.addStyles('../../assets/scss/ui/time.scss?inline', timeStyles);

import scrubberStyles from '../../assets/scss/controller/scrubber.scss?inline';
import Scrubber from '../controller/Scrubber.js';
Player.addComponent('ui.controller.scrubber', Scrubber);
Player.addStyles('../../assets/scss/controller/scrubber.scss?inline', scrubberStyles);

import ScrubberTooltip from '../controller/ScrubberTooltip.js';
Player.addComponent('ui.controller.scrubber.tooltip', ScrubberTooltip);

import FullScreen from '../controller/FullScreen.js';
Player.addComponent('ui.controller.fullScreen', FullScreen);

import playOverlayStyles from '../../assets/scss/controller/playoverlay.scss?inline';
import PlayOverlay from '../controller/PlayOverlay.js';
Player.addComponent('ui.playOverlay', PlayOverlay);
Player.addStyles('../../assets/scss/controller/playoverlay.scss?inline', playOverlayStyles);
