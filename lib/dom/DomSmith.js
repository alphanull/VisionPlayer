/**
 * Returns an array of supported DOM event names for the given tag.
 * @private
 * @memberof module:lib/dom/DomSmith
 * @param   {HTMLElement} [ele]  The element for which to retrieve supported events.
 * @returns {string[]}           Sorted array of event names.
 */
function getSupportedDomEvents(ele = document.createElement('div')) {

    const events = [];
    for (const key in ele) {
        if (key.startsWith('on')) events.push(key.slice(2));
    }
    return events.sort();

}

// Private vars
const plugins = [], // holds all added plugins
      legacyKeys = ['ref', 'tag', 'nodes', 'text', 'events'], // old keys for deprecation warning
      rootProps = ['_dom', '_refs', '_parent', '_events', 'constructor', 'prototype', 'addNode', 'replaceNode', 'removeNode', 'addEvent', 'removeEvent', 'destroy', 'teardown'], // List of reserved root properties.
      defaultEvents = getSupportedDomEvents(); // Pre-calculate supported events for a generic element.

let pluginsSorted = false; // make sure plugins are only sorted once

/**
 * The `DomSmith` is a utility class that helps to dynamically generate a DOM tree
 * based on a declarative configuration. It supports event handling, DOM node creation,
 * manipulation, and removal. Additionally, it ensures proper cleanup by removing events
 * and references when the `destroy()` or `removeNode()` methods are called.
 * This is especially useful for building UI components in a modular way where nodes can
 * be dynamically added, updated, or removed.
 * @exports module:lib/dom/DomSmith
 * @author    Frank Kudermann - alphanull
 * @version   2.1.0
 * @license   MIT
 */
export default class DomSmith {

    /**
     * Creates a new DomSmith instance.
     * @param {module:lib/dom/DomSmith~NodeDefinition|module:lib/dom/DomSmith~NodeDefinition[]|string} nodeDef    Node definition. Can be an object, a string, or an array of definitions.
     * @param {HTMLElement|module:lib/dom/DomSmith~Options}                                            [options]  Either a target HTMLElement or an options object.
     */
    constructor(nodeDef, options) {

        if (!pluginsSorted) {
            pluginsSorted = true;
            plugins.sort((a, b) => b.priority - a.priority);
        }

        /**
         * Stores mount information like target node, insertMode type, parent, and next sibling.
         * @private
         * @type {Object}
         */
        this._mountContext = {};

        if (options instanceof HTMLElement) {
            this._mountContext = {
                ele: options,
                insertMode: 'append'
            };
        } else if (options && typeof options === 'object' && options.ele) {
            this._mountContext = {
                ele: options.ele,
                insertMode: options.insertMode || 'append'
            };
        }

        // Create a synthetic root parent object if a node is given (required by internal logic)
        const rootParent = this._mountContext.ele
            ? {
                _ele: this._mountContext.insertMode && this._mountContext.insertMode !== 'append' && this._mountContext.insertMode !== 'top'
                    ? this._mountContext.ele.parentNode
                    : this._mountContext.ele,
                _nodes: []
            } : null;

        /**
         * Stores additional node data for cleanup.
         * @private
         * @type {WeakMap}
         */
        this._refs = new WeakMap();

        /**
         * Central repository for event listeners.
         * @private
         * @type {WeakMap<HTMLElement, Object>}
         */
        this._events = new WeakMap();

        /**
         * The root node definition or an array of node definitions.
         * @private
         * @type {module:lib/dom/DomSmith~NodeDefinition|module:lib/dom/DomSmith~NodeDefinition[]}
         */
        this._dom = this.addNode(nodeDef, rootParent);

        /**
         * The parent DOM element where the constructed DOM tree is mounted.
         * @private
         * @type {HTMLElement}
         */
        this._mountContext.parent = rootParent && rootParent._ele;

        // If a synthetic root parent was used and the result is an array, update its nodes array.
        if (rootParent && Array.isArray(this._dom)) rootParent._nodes = this._dom;

        // Automatically mount the DOM node(s) if the 'mount' option is true
        if (this._mountContext.ele) this.mount();

    }

    /**
     * Mounts the created DOM element(s) into the specified location.
     * Supports insertModes: 'append' (default), 'before', 'replace' and 'top.
     * If called after unmount() without arguments, reuses the original location.
     * @param  {HTMLElement|HTMLElement|module:lib/dom/DomSmith~Options} [options]  Either a target HTMLElement or an options object.
     * @throws {Error}                                                              If injection node was not found.
     */
    mount(options) {

        if (this._mountContext.mounted) return;

        if (options) {
            if (options instanceof HTMLElement) {
                this._mountContext = {
                    ele: options,
                    insertMode: 'append'
                };
            } else if (typeof options === 'object' && options.ele) {
                this._mountContext = {
                    ele: options.ele,
                    insertMode: options.insertMode || 'append'
                };
            }

            this._mountContext.parent = this._mountContext.insertMode === 'append' || this._mountContext.insertMode === 'top'
                ? this._mountContext.ele
                : this._mountContext.ele.parentNode;
        }

        const { ele, insertMode, parent, nextSibling } = this._mountContext;

        if (!ele || !parent) throw new Error('[DomSmith] Invalid insertMode ele.');

        // Insert mode 'top': Insert as first child of parent (before parent.firstChild)
        if (Array.isArray(this._dom)) {

            // Use fragment for efficient batch insertion
            const fragment = document.createDocumentFragment();
            let hasNodesToMount = false;

            this._dom.forEach(nd => {
                if (!nd._ele.parentNode) {
                    fragment.appendChild(nd._ele);
                    hasNodesToMount = true;
                }
            });

            if (!hasNodesToMount) return; // all nodes already mounted

            if (insertMode === 'top') {
                // Insert fragment as first child of parent
                parent.insertBefore(fragment, parent.firstChild);
            } else if (insertMode === 'before') {
                parent.insertBefore(fragment, ele);
            } else if (insertMode === 'replace') {
                parent.insertBefore(fragment, ele);
                if (parent.contains(ele)) parent.removeChild(ele);
            } else if (nextSibling && nextSibling.parentNode === parent) {
                parent.insertBefore(fragment, nextSibling);
            } else {
                parent.appendChild(fragment);
            }

        } else {
            const el = this._dom._ele;
            if (el.parentNode) return; // already mounted

            // Insert single element using appropriate strategy
            if (insertMode === 'top') {
                // Insert element as first child of parent
                parent.insertBefore(el, parent.firstChild);
            } else if (insertMode === 'before') {
                parent.insertBefore(el, ele);
            } else if (insertMode === 'replace') {
                parent.replaceChild(el, ele);
            } else if (nextSibling && nextSibling.parentNode === parent) {
                parent.insertBefore(el, nextSibling);
            } else {
                parent.appendChild(el);
            }
        }

        plugins.forEach(({ plugin }) => {
            if (typeof plugin.mount === 'function') plugin.mount(this._dom, this._mountContext);
        });

        this._mountContext.mounted = true;

    }

    /**
     * Unmounts the created DOM element(s) from their parent node.
     * For multiple nodes, each child element is removed individually.
     * Also stores the original parent and nextSibling for potential re-mounting.
     */
    unmount() {

        if (!this._mountContext.mounted) return;

        plugins.forEach(({ plugin }) => {
            if (typeof plugin.unmount === 'function') plugin.unmount(this._dom, this._mountContext);
        });

        if (Array.isArray(this._dom)) {
            // Filter all currently mounted elements
            const mounted = this._dom.filter(nd => nd._ele && nd._ele.parentNode);

            if (mounted.length > 0) {
                const parent = mounted[0]._ele.parentNode,
                      allElements = Array.from(parent.childNodes),
                      lastIndex = allElements.indexOf(mounted[mounted.length - 1]._ele),
                      next = allElements[lastIndex + 1] || null;
                // Store precise remount location
                this._mountContext.parent = parent;
                this._mountContext.nextSibling = next;
            }
            // Remove all elements from DOM
            mounted.forEach(nd => nd._ele.remove());

        } else if (this._dom && this._dom._ele && this._dom._ele.parentNode) {

            const el = this._dom._ele;
            this._mountContext.parent = el.parentNode;
            this._mountContext.nextSibling = el.nextSibling;
            el.remove();

        }

        this._mountContext.mounted = false;

    }

    /**
     * Adds a DOM node based on a declarative definition.
     * Supports string, object, or an array of node definitions.
     * @param   {module:lib/dom/DomSmith~NodeDefinition}                                          nodeDefArg  Node definition or an array of definitions.
     * @param   {Object}                                                                          [parent]    Parent object (synthetic) to assign to the newly created node.
     * @returns {module:lib/dom/DomSmith~NodeDefinition|module:lib/dom/DomSmith~NodeDefinition[]}             A node definition object or an array of such objects.
     * @throws  {Error}                                                                                       If trying to add a duplicate ref or a property was not found.
     */
    addNode(nodeDefArg, parent) {

        // Clone nodeDef to avoid mutation
        let nodeDef = typeof nodeDefArg === 'string' || Array.isArray(nodeDefArg)
            ? nodeDefArg
            : { ...nodeDefArg };

        // If an array is provided, return an array of node definitions.
        if (Array.isArray(nodeDef)) {

            const nodes = nodeDef.map(nd => {
                const node = this.addNode(nd, parent);
                if (parent && Array.isArray(parent._nodes)) parent._nodes.push(node);
                return node;
            });

            return nodes;
        }

        if (typeof nodeDef !== 'string') {
            // Migrate legacy properties to underscore-prefixed keys
            legacyKeys.forEach(key => {
                if (key in nodeDef && !(`_${key}` in nodeDef)) {
                    nodeDef[`_${key}`] = nodeDef[key];
                    delete nodeDef[key];
                    // eslint-disable-next-line no-console
                    console.warn(`[DomSmith] Deprecated nodeDef key "${key}" – use "_${key}" instead.`);
                }
            });
        }

        // Helper function: assign a value to a property by path (e.g., 'style.color')
        function assignWithPath(obj, path, value) { // eslint-disable-line jsdoc/require-jsdoc
            const pathArray = path.split('.'),
                  pathObj = pathArray.slice(0, -1).reduce((acc, key) => (typeof acc === 'undefined' || typeof acc[key] === 'undefined' ? null : acc[key]), obj);
            if (typeof pathObj !== 'object' || pathObj === null) throw new Error(`[DomSmith] Did not find property with path: ${path}`);
            pathObj[pathArray.pop()] = value;
        }

        /**
         * Creates Element from node definition.
         * @param   {module:lib/dom/DomSmith~NodeDefinition} nd  The definition to parse.
         * @returns {HTMLElement}                                The newly created element.
         */
        function createEle(nd) {

            if (typeof nd._text !== 'undefined') return document.createTextNode(nd._text);

            // Use SVG namespace if the current node's tag is 'svg' (case-insensitive), or a parent is provided and its element is in the SVG namespace.
            const SVG_NS = 'http://www.w3.org/2000/svg', // Define SVG namespace
                  isParentForeign = parent && parent._ele && parent._ele.tagName.toLowerCase() === 'foreignobject',
                  useSvgNS = !isParentForeign && (nd._tag && nd._tag.toLowerCase() === 'svg' || parent && parent._ele && parent._ele.namespaceURI === SVG_NS);

            if (useSvgNS) return document.createElementNS(SVG_NS, nd._tag);
            return document.createElement(nd._tag || 'div');
        }

        if (typeof nodeDef === 'string' || nodeDef instanceof String) {
            nodeDef = { _text: nodeDef };
        }

        nodeDef._ele = createEle(nodeDef);

        plugins.forEach(({ plugin }) => {
            if (typeof plugin.addNode === 'function') {
                nodeDef = plugin.addNode(nodeDef) || nodeDef;
            }
        });

        if (!nodeDef._ele) nodeDef._ele = createEle(nodeDef);

        const { _nodes, _tag, _ref, _events, _ele } = nodeDef;

        // Process each property of nodeDef
        Object.entries(nodeDef).forEach(([key, value]) => {
            // Skip reserved keys or undefined values
            if (key.startsWith('_') || key.startsWith('$') || value === null || typeof value === 'undefined') return;

            // Determine supported events; extra events for 'video' and 'audio'
            const supportedEvents = _tag === 'video' || _tag === 'audio'
                ? getSupportedDomEvents(_ele)
                : defaultEvents;

            if (supportedEvents.includes(key)) {
                // Add event listener if key is a supported event name
                this.addEvent(_ele, key, value);

            } else if (key.includes('.')) {

                assignWithPath(_ele, key, value);

            } else if (key in _ele) {
                // Directly assign the property if it exists on the element
                try {
                    _ele[key] = value;
                } catch (e) { // eslint-disable-line no-unused-vars
                    // If direct assignment fails (e.g., property is readonly, as with some SVG elements), fallback to using setAttribute.
                    _ele.setAttribute(key, value);
                }
            } else {
                // fall back to setAttribute if key does not exist
                _ele.setAttribute(key, value);
            }
        });

        // Process explicit "events" property if provided
        if (_events) {
            Object.entries(_events).forEach(([evName, evHandler]) => {
                this.addEvent(_ele, evName, evHandler);
            });
        }

        // Set the parent reference (if provided)
        if (parent) nodeDef._parent = parent;

        // Register references for easy access
        if (_ref) {
            // Skip reserved keys
            if (rootProps.includes(_ref)) throw new Error('[DomSmith] Reserved properties are not allowed as ref');
            if (this[_ref]) throw new Error('[DomSmith] No Duplicate Refs are allowed');
            this[_ref] = _ele;
            this._refs.set(_ele, nodeDef);
        }

        // Process child nodes recursively
        if (_nodes) {
            if (typeof _nodes === 'string') nodeDef._nodes = [_nodes];
            nodeDef._nodes = nodeDef._nodes.reduce((acc, node) => {
                if (node) {
                    const childNodeDef = this.addNode(node, nodeDef);
                    _ele.appendChild(childNodeDef._ele);
                    acc.push(childNodeDef);
                }
                return acc;
            }, []);
        }

        return nodeDef;

    }

    /**
     * Replaces an existing DOM node (specified by its ref) with a new node definition.
     * This method first removes all events from the old node, then replaces it in the DOM.
     * @param  {string}                                 ref         Reference name of the node to be replaced.
     * @param  {module:lib/dom/DomSmith~NodeDefinition} replaceDef  The new node definition to replace the old node.
     * @throws {Error}                                              If an invalid ref was used.
     */
    replaceNode(ref, replaceDef) {

        const replaceEle = this[ref];

        let oldNode = this._refs.get(replaceEle);

        if (!oldNode) throw new Error('[DomSmith] invalid ref used with replaceNode');

        // Remove all events attached to the old node and clean up references
        oldNode = this.removeNode(oldNode);

        const parentIndex = oldNode._parent._nodes.findIndex(pnode => pnode === oldNode), // Index of the old node within its parent's nodes array
              newNode = this.addNode(replaceDef, oldNode._parent); // New node using the same parent reference

        newNode._parent._ele.replaceChild(newNode._ele, oldNode._ele); // Replace the old node with the new node in the parent's DOM element
        newNode._parent._nodes[parentIndex] = newNode; // Update the parent's nodes array

    }

    /**
     * Removes all events and references associated with a DOM node.
     * If the passed node definition is an array, iterates through each element.
     * @param   {module:lib/dom/DomSmith~NodeDefinition|module:lib/dom/DomSmith~NodeDefinition[]} [nodeDefArg=this._dom]  The node definition(s) from which to remove events.
     * @returns {module:lib/dom/DomSmith~NodeDefinition|module:lib/dom/DomSmith~NodeDefinition[]}                         The - possibly modified - node definition(s).
     */
    removeNode(nodeDefArg = this._dom) {

        let nodeDef = nodeDefArg;

        plugins.forEach(({ plugin }) => {
            if (typeof plugin.removeNode === 'function') nodeDef = plugin.removeNode(nodeDef) || nodeDef;
        });

        if (Array.isArray(nodeDef)) { // If nodeDef is an array, process each node individually
            nodeDef.forEach(nd => this.removeNode(nd));
            return nodeDef;
        }

        this.removeEvent(nodeDef._ele);

        if (nodeDef._events) delete nodeDef._events;

        if (nodeDef._ref) {
            this._refs.delete(this[nodeDef._ref]);
            delete this[nodeDef._ref];
        }

        if (nodeDef._nodes) {
            nodeDef._nodes.forEach(child => this.removeNode(child));
        }

        return nodeDef;

    }

    /**
     * Adds an event listener to the specified element and registers it in the central events repository.
     * @param  {HTMLElement|string}  eleOrRef   Target DOM element or ref.
     * @param  {string}              eventName  Event name (e.g., 'click').
     * @param  {Function|Function[]} handler    Event handler(s) to add.
     * @throws {Error}                          If element was not found, or handler is not a function.
     */
    addEvent(eleOrRef, eventName, handler) {

        if (!handler) return; // ignore undefined handlers

        const ele = typeof eleOrRef === 'string' ? this[eleOrRef] : eleOrRef;

        if (!ele) throw new Error(`[DomSmith] removeEvent: ele or ref: ${eleOrRef} not found`);

        if (!this._events.has(ele)) this._events.set(ele, {}); // Initialize mapping if not present
        const events = this._events.get(ele);
        if (!events[eventName]) events[eventName] = [];

        if (Array.isArray(handler)) {
            handler.forEach(h => {
                if (typeof h !== 'function') throw new Error('[DomSmith] Handler must be a function');
                ele.addEventListener(eventName, h);
                events[eventName].push(h);
            });
        } else {
            if (typeof handler !== 'function') throw new Error('[DomSmith] Handler must be a function');
            ele.addEventListener(eventName, handler);
            events[eventName].push(handler);
        }

    }

    /**
     * Removes event listener(s) from the specified element.
     * If no eventName and handler are provided, all event listeners for that element are removed.
     * If an eventName is provided but no handler, then all handlers for that event are removed.
     * Otherwise, only the specified handler for the given eventName is removed.
     * @param  {HTMLElement|string} eleOrRef     Target DOM element or ref.
     * @param  {string}             [eventName]  Event name (e.g., 'click').
     * @param  {Function}           [handler]    Event handler to remove.
     * @throws {Error}                           If element or ref was not found.
     */
    removeEvent(eleOrRef, eventName, handler) {

        const ele = typeof eleOrRef === 'string' ? this[eleOrRef] : eleOrRef;

        if (!ele) throw new Error(`[DomSmith] removeEvent: ele or ref: ${eleOrRef} not found`);

        if (!this._events.has(ele)) return;
        const events = this._events.get(ele);

        if (eventName) {
            if (!events[eventName]) return;
            if (handler) {
                ele.removeEventListener(eventName, handler);
                events[eventName] = events[eventName].filter(h => h !== handler);
            } else {
                events[eventName].forEach(h => ele.removeEventListener(eventName, h));
                delete events[eventName];
            }
            if (Object.keys(events).length === 0) this._events.delete(ele);
        } else {
            Object.keys(events).forEach(evName => {
                events[evName].forEach(h => ele.removeEventListener(evName, h));
            });
            this._events.delete(ele);
        }

    }

    /**
     * Cleans up all resources: removes all events, unmounts the DOM nodes, and clears all references.
     * DEPRECATED, alias for `destroy()`.
     * @deprecated Since version 2.1.0.
     */
    teardown() {

        // eslint-disable-next-line no-console
        console.warn('[DomSmith] teardown() is deprecated, use destroy() instead.');
        this.destroy();

    }

    /**
     * Cleans up all resources: removes all events, unmounts the DOM nodes, and clears all references.
     * @since 2.1.0
     */
    destroy() {

        plugins.forEach(plugin => {
            if (plugin.destroy) plugin.destroy();
        });

        this.removeNode();
        this.unmount();

        // Explicitly null out external DOM references to avoid memory leaks
        if (this._mountContext) {
            this._mountContext.ele = null;
            this._mountContext.parent = null;
            this._mountContext.nextSibling = null;
        }

        this._dom = this._refs = this._mountContext = this._events = null;

    }

    /**
     * Registers a singleton-style plugin for DomSmith.
     * The plugin may define any of the following methods: addNode, removeNode, mount, unmount & destroy.
     * Duplicate plugin instances will be ignored.
     * @param {Object} plugin                The plugin object.
     * @param {Object} [options]             Additional Options for registration.
     * @param {number} [options.priority=0]  Priority value for plugin execution order (higher runs earlier).
     */
    static registerPlugin(plugin, { priority = 0 } = {}) {
        if (plugins.some(entry => entry.plugin === plugin)) return;
        plugins.push({ plugin, priority });
    }
}

/**
 * @typedef  {Object} module:lib/dom/DomSmith~NodeDefinition       Structure of a node definition
 * @property {string}                                   [_tag]     Tag name of the element. Defaults to 'div' if unspecified.
 * @property {string}                                   [_text]    Text content for text nodes.
 * @property {string}                                   [_ref]     A unique reference name used to store a direct reference on the DomSmith instance.
 * @property {Object.<string, Function|Function[]>}     [_events]  Object containing event names and their handler(s).
 * @property {module:lib/dom/DomSmith~NodeDefinition[]} [_nodes]   Child node definitions; can be a single NodeDefinition, a string, or an array of them.
 * @property {*}                                        [any]      Additional properties that will be assigned either directly or via setAttribute.
 */

/**
 * @typedef {Object} module:lib/dom/DomSmith~Options
 * @property {HTMLElement}                 node          Target DOM node for mounting or insertion.
 * @property {'append'|'before'|'replace'} [insertMode]  Injection strategy. Use 'append' to append, 'before' to insert before the node, or 'replace' to replace it. Defaults to 'append'.
 */
