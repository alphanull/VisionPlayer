import Tooltip from '../../lib/ui/Tooltip.js';

/**
 * DomSmith plugin to enable tooltip support via `$tooltip` key on node definitions.
 * Tooltips are shown when the pointer enters an element that includes a `$tooltip` block.
 * The plugin modifies the node definition in-place and adds a `pointerenter` event handler.
 * @module   src/util/domSmithTooltip
 * @requires lib/ui/Tooltip
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */

/**
 * Tooltip Instance used for this plugin.
 * @type {module:lib/ui/Tooltip}
 */
const tooltip = new Tooltip({
    viewClass: 'vip-tooltip',
    touchMove: true,
    touchEnd: true,
    neverHideWhenPressed: true,
    delay: 1250,
    orientation: ['top', 'bottom']
});

let parentElement;

/**
 * Hook called by DomSmith during node creation.
 * @private
 * @param   {module:lib/dom/DomSmith~NodeDefinition}           nodeDef  Node definition passed from DomSmith.
 * @returns {module:lib/dom/DomSmith~NodeDefinition|undefined}          The modified nodeDef or undefined if no tooltip was applied.
 */
function addNode(nodeDef) {

    if (!nodeDef.$tooltip) return;

    const { text, player } = nodeDef.$tooltip,
          getText = typeof text === 'function' ? text : () => text ?? text,
          tooltipOptions = {
              parentElement,
              limitLayout: player.getConfig('dom').layout !== 'controller-only'
          };

    nodeDef.pointerenter = event => tooltip.show(getText(), event, tooltipOptions);
    nodeDef.pointerleave = event => tooltip.hide(event);

    delete nodeDef.$tooltip;
    return nodeDef;

}

/**
 * Assign parent element during initialization.
 * @param {HTMLElement} parentEle  The element the tooltip is attaching to.
 */
function setParent(parentEle) {
    parentElement = parentEle;
}

/**
 * Remove parent element during destroy.
 */
function removeParent() {
    parentElement = null;
}

export default {
    addNode,
    setParent,
    removeParent
};
