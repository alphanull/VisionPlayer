/**
 * DomSmith plugin that just takes all `<select>` and wraps them.
 * @module lib/dom/plugins/domSmithSelect
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */

/**
 * Hook called by DomSmith during node creation.
 * @param   {module:lib/dom/DomSmith~NodeDefinition}           nodeDef  The original node definition object.
 * @returns {module:lib/dom/DomSmith~NodeDefinition|undefined}          The patched nodeDef or undefined.
 */
function addNode(nodeDef) {

    if (!nodeDef._tag || nodeDef._tag.toLowerCase() !== 'select' || nodeDef.$wrapped) return;

    nodeDef.$wrapped = true;

    /**
     * Appends an event handler to a nodeDef entry without overwriting existing handlers.
     * If no handler exists, the function is assigned directly.
     * If one handler exists, it is converted into an array containing both.
     * If multiple handlers already exist (as an array), the new one is appended.
     * @param {string}   eventName  The name of the event (e.g. 'pointerdown').
     * @param {Function} fn         The event handler function to append.
     */
    function appendHandler(eventName, fn) {
        if (!nodeDef[eventName]) nodeDef[eventName] = fn;
        else if (Array.isArray(nodeDef[eventName])) nodeDef[eventName].push(fn);
        else nodeDef[eventName] = [nodeDef[eventName], fn];
    }

    appendHandler('focus', ({ target }) => target.parentNode.classList.add('has-focus'));
    appendHandler('blur', ({ target }) => target.parentNode.classList.remove('has-focus'));

    // return original nodeDef wrapped in new Wrapper
    return {
        className: 'select-wrapper',
        _nodes: [nodeDef]
    };
}

/**
 * Hook called by DomSmith during node removal.
 * @param   {module:lib/dom/DomSmith~NodeDefinition}           nodeDef  The original node definition object.
 * @returns {module:lib/dom/DomSmith~NodeDefinition|undefined}          The patched nodeDef or undefined.
 */
function removeNode(nodeDef) {

    if (nodeDef._tag?.toLowerCase() !== 'select' || nodeDef.$removed) return;

    nodeDef.$removed = true;
    // return parent, IMPORTANT so removal not only removes the original select
    return nodeDef._parent;
}

export default {
    addNode,
    removeNode
};
