import DomSmith from '../../lib/dom/DomSmith.js';

/**
 * The File component provides functionality to handle playing local media files.
 * Files can be selected via the standard file selector or by dragging & dropping.
 * It converts the selected files into binary blobs and passes them to the player where they can be played as usual.
 * If more than one file is selected, a corresponding playlist will be automatically generated.
 * @exports module:src/selection/File
 * @requires lib/dom/DomSmith
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default class File {

    /**
     * Contains configuration options for how files are handled.
     * @type     {Object}
     * @property {boolean} [fileDrop=true]            Enables drag & drop file upload.
     * @property {boolean} [fileSelector=true]        Enables the file selection button in the controller.
     * @property {boolean} [fileSelectorAccept=true]  If `true`, the file picker limits selection to supported extensions (e.g. .mp4, .webm); if false, it accepts any file type, enabling formats such as .mov or .mkv.
     */
    #config = {
        fileDrop: true,
        fileSelector: true,
        fileSelectorAccept: true
    };

    /**
     * Reference to the main player instance.
     * @type {module:src/core/Player}
     */
    #player;

    /**
     * Reference to the DomSmith instance for the file selector button.
     * @type {module:lib/dom/DomSmith}
     */
    #button;

    /**
     * Reference to the DomSmith instance for the drop zone.
     * @type {module:lib/dom/DomSmith}
     */
    #dropZone;

    /**
     * Holds uploades blobs for later revoking.
     * @type {Array}
     */
    #blobs = [];

    /**
     * Creates an instance of the File component.
     * @param {module:src/core/Player}           player            Reference to the VisionPlayer instance.
     * @param {module:src/controller/Controller} parent            The parent container, in this case the controller.
     * @param {Object}                           [options]         Additional options.
     * @param {symbol}                           [options.apiKey]  Token for extended access to the player API.
     */
    constructor(player, parent, { apiKey }) {

        // This component is disabled by default and has to be explicitly enabled via playerConfig
        if (!player.getConfig('file')) return [false];

        this.#config = player.initConfig('file', this.#config);

        const hasDragDrop = 'draggable' in player.dom.getElement(apiKey),
              { fileDrop, fileSelector } = this.#config;

        // If neither fileDrop is enabled nor fileSelector with drag & drop is available, do not add this component.
        if (!fileSelector && (!fileDrop || !hasDragDrop)) return [false];

        this.#player = player;

        // get all supported extensions
        const allowedExts = this.#player.constructor.getFormats().reduce((acc, format) => acc.concat(format.extensions), []);

        if (this.#config.fileSelector) {

            const playerId = this.#player.getConfig('player.id');

            this.#button = new DomSmith({
                _ref: 'wrapper',
                className: 'vip-file',
                'data-sort': 55,
                _nodes: [{
                    _tag: 'input',
                    id: `vip-file-input-${playerId}`,
                    className: 'vip-file-input is-hidden',
                    type: 'file',
                    multiple: true,
                    ariaLabel: this.#player.locale.t('file.select'),
                    accept: this.#config.fileSelectorAccept ? allowedExts.map(ext => `.${ext}`).join(',') : null,
                    change: this.#fileSelected
                },
                {
                    _ref: 'button',
                    _tag: 'label',
                    for: `vip-file-input-${playerId}`,
                    className: 'icon file',
                    $tooltip: { player, text: this.#player.locale.t('file.select') }
                }]
            }, parent.getElement('right'));

        }

        if (this.#config.fileDrop && hasDragDrop) {

            this.#dropZone = new DomSmith({
                _ref: 'drop',
                className: 'vip-file-dropper',
                ariaHidden: true,
                dragenter: this.#onZoneDragEnter,
                dragleave: this.#onZoneDragLeave,
                drop: this.#onZoneDrop,
                _nodes: [{
                    className: 'vip-file-dropper-icon icon'
                }, {
                    className: 'vip-file-dropper-text-drop',
                    _nodes: [this.#player.locale.t('file.drop')]
                }]
            }, this.#player.dom.getElement(apiKey));

            document.addEventListener('dragover', this.#onWinDragOver);
            document.addEventListener('dragleave', this.#onWinDragLeave);

        }
    }

    /**
     * Handler for file selection via the file input or drag'n'drop event.
     * Creates an array of file objects with properties:
     * - title: File name.
     * - ext: File extension.
     * - src: Blob URL created from the file.
     * - type: MIME type of the file.
     * Then sets the media data for the player by creating a playlist of the selcted files.
     * @param {Event} event  The change event from the file input.
     */
    #fileSelected = event => {

        // remove old uploads first
        this.#blobs.forEach(url => URL.revokeObjectURL(url));
        this.#blobs = [];

        const files = [];

        for (const file of event.target.files) {
            const url = URL.createObjectURL(file);
            this.#blobs.push(url);
            files.push({
                title: file.name,
                src: url,
                mimeType: file.type || (file.name.endsWith('.mkv') ? 'video/x-matroska' : '')
            });
        }

        this.#player.data.setMediaData({
            title: 'My File Upload',
            media: files
        }).catch(error => {
            if (error.name !== 'AbortError' && error.name !== 'DataError') throw error;
        });

    };

    /**
     * Handles the dragenter event on the drop zone. Displays a visual indication that the file can be dropped.
     * @param {DragEvent} event  The dragenter event.
     * @listens module:src/selection/File#dragover
     */
    #onZoneDragEnter = event => {

        if (!this.#isFileDrag(event)) return;

        // prevent safari from firing while over the inner drop zone
        document.removeEventListener('dragleave', this.#onWinDragLeave);

        event.stopPropagation();
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        this.#dropZone.drop.classList.add('drag-over');

    };

    /**
     * Handles the dragleave event on the drop zone. Removes the visual drag indicator.
     * @param {DragEvent} event  The dragleave event.
     * @listens module:src/selection/File#dragleave
     */
    #onZoneDragLeave = event => {

        if (!this.#isFileDrag(event)) return;

        document.addEventListener('dragleave', this.#onWinDragLeave); // enable again!
        this.#dropZone.drop.classList.remove('drag-over');

    };

    /**
     * Handles the drop, by extracting the associated files from the drop event.
     * @param {DragEvent} event  The originating drag event.
     * @listens module:src/selection/File#drop
     */
    #onZoneDrop = event => {

        if (!this.#isFileDrag(event)) return;

        document.removeEventListener('dragleave', this.#onWinDragLeave);
        this.#dropZone.drop.classList.remove('drag-over');
        this.#dropZone.drop.classList.remove('is-active');
        event.stopPropagation();
        event.preventDefault();

        this.#fileSelected({ target: { files: event.dataTransfer.files } });

    };

    /**
     * Handles the dragenter event on the window. Visually activates the inner drop zone.
     * @param {DragEvent} event  The dragenter event.
     * @listens module:src/selection/File#dragover
     */
    #onWinDragOver = event => {

        if (!this.#isFileDrag(event)) return;

        event.preventDefault();
        this.#dropZone.drop.classList.add('is-active');
        event.dataTransfer.dropEffect = 'copy';

    };

    /**
     * Handles the dragleave event on the window. Visually deactivates the inner drop zone.
     * @param {DragEvent} event  The dragleave event.
     * @listens module:src/selection/File#dragover
     */
    #onWinDragLeave = event => {

        if (!this.#isFileDrag(event)) return;

        this.#dropZone.drop.classList.remove('is-active');

    };

    /**
     * Helper function to determine whether the drag event contains files.
     * @param   {DragEvent} event  The originating drag event.
     * @returns {boolean}          Returns true if the drag event contains files.
     */
    #isFileDrag(event) { // eslint-disable-line class-methods-use-this

        const dt = event.dataTransfer;
        return dt.types && (dt.types.indexOf ? dt.types.indexOf('Files') !== -1 : dt.types.contains('Files'));

    }

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        window.removeEventListener('dragover', this.#onWinDragOver);
        window.removeEventListener('dragleave', this.#onWinDragLeave);
        this.#blobs.forEach(url => URL.revokeObjectURL(url));
        this.#button?.destroy();
        this.#dropZone?.destroy();
        this.#player = this.#button = this.#dropZone = this.#blobs = null;

    }

}
