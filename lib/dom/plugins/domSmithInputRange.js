/**
 * DomSmith plugin that enhances `input type="range"` elements with touch-drag support.
 * It injects `pointerdown`, `pointermove` and `pointerup` handlers via the nodeDef object,
 * while preserving any pre-existing handlers. State is held in closures per element.
 * @module lib/dom/plugins/domSmithInputRange
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

    if (!nodeDef._tag || nodeDef._tag.toLowerCase() !== 'input' || nodeDef.type !== 'range' || nodeDef.$rangeFixDisable) return;

    let isDragging = false,
        rect = null,
        hasNativeChange = false;

    const ele = nodeDef._ele,
          isVertical = nodeDef.orient === 'vertical';

    /**
     * Calculates the value of a range input based on pointer event position and orientation.
     * @param   {PointerEvent} event  The pointer event.
     * @returns {number}              The computed slider value.
     */
    function calculateSliderValue(event) {
        const raw = isVertical ? 1 - (event.clientY - rect.top) / rect.height : (event.clientX - rect.left) / rect.width,
              clamped = Math.max(0, Math.min(1, raw)),
              max = parseFloat(ele.max) || 1;
        return clamped * max;
    }

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

    // Listen for native change events to avoid duplicates
    ele.addEventListener('change', () => {
        hasNativeChange = true;
    }, { passive: true });

    appendHandler('pointerdown', event => {
        if (event.pointerType !== 'touch') return;

        isDragging = true;
        hasNativeChange = false;
        rect = ele.getBoundingClientRect();

        ele.value = calculateSliderValue(event);
        ele.setPointerCapture(event.pointerId);
        ele.dispatchEvent(new Event('input', { bubbles: true }));

        event.preventDefault();
    });

    appendHandler('pointermove', event => {
        if (event.pointerType !== 'touch' || !isDragging || !rect) return;

        ele.value = calculateSliderValue(event);
        ele.dispatchEvent(new Event('input', { bubbles: true }));
        event.preventDefault();
    });

    appendHandler('pointerup', event => {
        isDragging = false;
        if (event.pointerType === 'touch') ele.releasePointerCapture(event.pointerId);

        const playerEle = ele.closest('vision-player');
        if (playerEle) playerEle.focus();

        // Use setTimeout to ensure native change event has time to fire
        setTimeout(() => {
            // Only fire change event if no native change was detected
            if (!hasNativeChange) {
                ele.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, 0);

        event.preventDefault();
    });

    return nodeDef;
}

export default {
    addNode
};
