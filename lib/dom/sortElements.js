/**
 * Sorts the direct child elements of a container by their `data-sort` attribute.
 * Elements with:
 * - `data-sort < 0` → Excluded from sorting, moved last, and get `tabindex="-1"`.
 * - `data-sort ≥ 0` → Sorted in ascending order.
 * - no `data-sort`  → Appended before or after the sorted items depending on `sortOrder`.
 * @exports module:lib/dom/sortElements
 * @author  Frank Kudermann - alphanull
 * @version 1.0.0
 * @license MIT
 */
export default sortElements;

/**
 * Sorts the direct child elements of a container by their `data-sort` attribute.
 * @memberof module:lib/dom/sortElements
 * @param {HTMLElement}      container    The container whose children should be sorted.
 * @param {'sorted-last'|''} [sortOrder]  Determines whether sorted items come after (`'sorted-last'`) or before the unsorted ones.
 */
function sortElements(container, sortOrder = '') {

    const children = Array.from(container.children),
          staticNodes = [],
          sortedNodes = [],
          unsortedNodes = [];

    children.forEach(node => {

        const attr = node.getAttribute('data-sort');
        node.removeAttribute('data-sort');

        if (attr === null) {
            // No data-sort defined
            unsortedNodes.push(node);
            return;
        }

        const value = parseInt(attr, 10);

        if (isNaN(value)) {
            unsortedNodes.push(node);
            return;
        }

        if (value < 0) {
            node.setAttribute('tabindex', '-1');
            staticNodes.push(node);
            return;
        }

        sortedNodes.push({ node, value });

    });

    // Sort numeric entries ascending
    sortedNodes.sort((a, b) => a.value - b.value);

    const sortedList = sortedNodes.map(({ node }) => node),
          finalOrder = sortOrder === 'sorted-last'
              ? [...unsortedNodes, ...sortedList, ...staticNodes]
              : [...sortedList, ...unsortedNodes, ...staticNodes];

    finalOrder.forEach(node => container.appendChild(node)); // Re-append in new order

}
