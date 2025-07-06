import DomSmith from '../../lib/dom/DomSmith.js';
import { extend, isNumber } from '../../lib/util/object.js';

/**
 * The Menu Class provides a flexible menu UI that can switch between button-based and select-based layouts,
 * depending on the number of menu items. Supports a placeholder state, custom headers, vertical layout and emits a callback on selection.
 * @exports module:src/settings/Menu
 * @requires lib/dom/DomSmith
 * @requires lib/util/object
 * @author Frank Kudermann - alphanull
 * @version 1.0.0
 * @license MIT
 */
export default class Menu {

    /**
     * Reference to the main player instance.
     * @type {module:src/core/Player}
     */
    #player;

    /**
     * Holds the instance configuration for this component.
     * @type     {Object}
     * @property {string}      id                         Menu id, used for aria-labelledby connection.
     * @property {string}      [header='']                Optional Menu header.
     * @property {string}      [className='']             Additional classname applied to the root element.
     * @property {number}      [selected = 0]             Index of currently selected item.
     * @property {number}      [highlighted=0]            Index of currently highlighted item.
     * @property {HTMLElement} target                     A dom node to attach the menu to.
     * @property {string}      [insertMode='append']      Defines how the menu is inserted into the target DOM node.
     * @property {boolean}     [showPlaceholder=false]    If enabled, display a 'not available' placeholder text if no menu items are available, otherwise completely hide the menu.
     * @property {number}      [selectMenuThreshold=5]    Number of items above which a select-based menu will be used.
     * @property {number}      [verticalMenuThreshold=3]  Number of items above which the button menu switches to vertical layout.
     * @property {Function}    onSelected                 Callback invoked when a menu item is selected. Signature: (index: number, item: { value: any, label: string }, target: HTMLElement) => void.
     */
    #config = {
        id: '',
        header: '',
        layout: 'menu',
        className: '',
        selected: 0,
        highlighted: 0,
        target: null,
        insertMode: 'append',
        showPlaceholder: false,
        selectMenuThreshold: 5,
        verticalMenuThreshold: 3,
        onSelected: () => {}
    };

    /**
     * Contains menu data.
     * @type {Array<{ value: any, label: string }>}
     */
    #data;

    /**
     * Reference to the DomSmith instance of the menu.
     * @type {module:lib/dom/DomSmith}
     */
    #menu;

    /**
     * Creates an instance of the Menu class.
     * @param {module:src/core/Player} player  Reference to the media player instance.
     * @param {Object}                 config  Additional config.
     */
    constructor(player, config) {

        this.#player = player;

        this.#config = extend(this.#config, config);

        let menuConfig;

        if (this.#config.layout === 'label') {
            menuConfig = {
                _ref: 'menu',
                className: `vip-menu ${this.#config.className}`,
                _nodes: [{
                    _tag: 'label',
                    for: `${config.id}-menu-control`,
                    _nodes: [{
                        _tag: 'span',
                        className: 'form-label-text',
                        id: `${config.id}-menu-header`,
                        _nodes: [config.header ? config.header : null]
                    }, {
                        _tag: 'menu',
                        _ref: 'list',
                        style: 'display: none;',
                        className: 'menu is-grouped is-stretched',
                        id: `${config.id}-menu-control`,
                        'aria-labelledby': `${config.id}-menu-header`,
                        click: this.#menuSelected
                    }]
                }, {
                    _tag: 'p',
                    _ref: 'unavailable',
                    className: 'is-dimmed is-centered',
                    _nodes: [this.#player.locale.t('misc.unavailable')]
                }]
            };
        } else {
            menuConfig = {
                _ref: 'menu',
                className: `vip-menu ${this.#config.className}`,
                _nodes: [config.header ? {
                    _tag: 'h3',
                    id: `${config.id}-menu-header`,
                    _nodes: [config.header]
                } : null, {
                    _tag: 'p',
                    _ref: 'unavailable',
                    className: 'is-dimmed is-centered',
                    _nodes: [this.#player.locale.t('misc.unavailable')]
                }, {
                    _tag: 'menu',
                    _ref: 'list',
                    style: 'display: none;',
                    className: 'menu is-grouped is-stretched',
                    'aria-labelledby': `${config.id}-menu-header`,
                    click: this.#menuSelected
                }]
            };
        }

        this.#menu = new DomSmith(menuConfig);

    }

    /**
     * Builds or rebuilds the menu UI.
     * @param {Array<(null|number|string)>} data  List of menu entries.
     */
    create(data) {

        this.#data = data;

        if (this.#data.length < 2) {

            if (this.#config.showPlaceholder) {
                this.#menu.unavailable.style.display = 'flex';
                this.#menu.list.style.display = 'none';
            } else {
                this.#menu.unmount();
            }

        } else {

            this.#menu.unavailable.style.display = 'none';
            this.#menu.list.style.display = 'flex';
            this.#menu.mount({ ele: this.#config.target, insertMode: this.#config.insertMode });

            const newMenu = this.#data.length >= this.#config.selectMenuThreshold
                ? this.#createSelectMenu()
                : this.#createButtonMenu();

            this.#menu.replaceNode('list', newMenu);
        }

    }

    /**
     * Sets the active state of the menu item at the selected index.
     * @param {number} selected     Index of item to mark as selected.
     * @param {number} highlighted  Index of item to mark as hightlighted.
     */
    setIndex(selected, highlighted) {

        const oldSelectedNode = this.#menu.list.childNodes[this.#config.selected],
              oldHighlightNode = this.#menu.list.childNodes[this.#config.highlighted],
              selectedNode = this.#menu.list.childNodes[selected];

        if (this.#menu.list.childNodes.length >= this.#config.selectMenuThreshold) {

            if (oldSelectedNode) oldSelectedNode.selected = false;
            if (selectedNode) selectedNode.selected = true;

            if (oldHighlightNode && this.#data[this.#config.selected]) oldSelectedNode.textContent = this.#data[this.#config.selected].label;

            if (isNumber(highlighted) && highlighted !== selected) {
                selectedNode.textContent = `${this.#data[selected].label} (${this.#data[highlighted].label})`;
            }

        } else {

            if (oldSelectedNode) {
                oldSelectedNode.removeAttribute('aria-current');
                oldSelectedNode.classList.remove('is-active');
            }

            selectedNode?.setAttribute('aria-current', true);
            selectedNode?.classList.add('is-active', true);

            if (oldHighlightNode) oldHighlightNode.classList.remove('is-highlighted');
            if (typeof highlighted !== 'undefined') this.#menu.list.childNodes[highlighted].classList.add('is-highlighted');

        }

        this.#config.selected = selected;
        this.#config.highlighted = highlighted;

    }

    /**
     * Creates the select variant of the menu.
     * @returns {Object} DomSmith node description.
     */
    #createSelectMenu() {

        return {
            _tag: 'select',
            _ref: 'list',
            id: `${this.#config.id}-menu-control`,
            'aria-labelledby': `${this.#config.id}-menu-header`,
            change: this.#menuSelected,
            _nodes: this.#data.map((menuItem, index) => ({
                _tag: 'option',
                selected: this.#config.selected === index,
                value: index,
                _nodes: [menuItem.label]
            }))
        };

    }

    /**
     * Creates the button variant of the menu.
     * @returns {Object} DomSmith node description.
     */
    #createButtonMenu() {

        return {
            _tag: 'menu',
            _ref: 'list',
            className: `menu is-grouped is-stretched ${this.#data.length > this.#config.verticalMenuThreshold ? ' is-vertical' : ''}`,
            'aria-labelledby': 'quality-menu-header',
            click: this.#menuSelected,
            _nodes: this.#data.map((menuItem, index) => {

                let className,
                    ariaCurrent = false;

                if (this.#config.selected === index) {
                    ariaCurrent = true;
                    className = 'is-active';
                } else if (this.#config.highlighted === index) {
                    className = 'is-highlighted';
                }

                return {
                    _tag: 'button',
                    className,
                    'aria-current': ariaCurrent,
                    'data-index': index,
                    _nodes: [menuItem.label]

                };
            })
        };

    }

    /**
     * Returns the menus' DomSmith instance for additional manipulation.
     * @returns {module:lib/dom/DomSmith} The menus' DomSmith instance.
     */
    getDomSmithInstance() {

        return this.#menu;

    }

    /**
     * Handler which is called when the user changes quality in the menu.
     * Extracts the quality setting from the data attribute of the selected menu entry and invokes the toggleMenu method.
     * @param {Event} event  The click event which invoked this handler.
     */
    #menuSelected = ({ target }) => {

        if (target.tagName !== 'BUTTON' && target.tagName !== 'SELECT') return;

        const selected = Number(target.tagName === 'BUTTON' ? target.getAttribute('data-index') : target.value);

        this.#config.onSelected(selected, this.#data[selected], target);

    };

    /**
     * This method removes all events, subscriptions and DOM nodes created by this component.
     */
    destroy() {

        this.#menu.destroy();

    }

}
