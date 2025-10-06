/**
 * Provides an accessible, multi-level navigation system with ARIA support, touch-first submenus, keyboard accessibility, and dynamic state management.
 * - Supports both pointer and keyboard navigation for submenus.
 * - Automatically manages ARIA attributes and tab order.
 * - Ensures only one submenu is open per scope and closes submenus on outside click or focus loss.
 * - Designed for modern HTML structure with `<menu>` elements and toggle buttons.
 * @module nav/navMain
 * @author   Frank Kudermann - alphanull
 * @version  1.0.1
 * @license  MIT
 * @example
 * // Basic structure:
 * <menu>
 *   <li class="has-submenu">
 *     <a href="...">Main Entry</a> <!-- or: <span>Main Entry</span> -->
 *     <button class="nav-submenu-toggle" aria-expanded="false" aria-haspopup="true"></button>
 *     <div class="menu-wrapper">
 *       <menu>
 *         <li><a href="...">Sub Entry 1</a></li>
 *         <li><a href="...">Sub Entry 2</a></li>
 *       </menu>
 *     </div>
 *   </li>
 * </menu>
 * @example
 * // Initialization:
 * import navMain from './navMain.js';
 * navMain.init('menu'); // or pass a DOM element as root
 */
export default {
    init,
    destroy
};

let root;

/**
 * Toggles the visibility of a submenu and updates accessibility state.
 * @param {MouseEvent} event  The toggle button event.
 */
function toggleSubmenu(event) {
    const toggle = event.target,
          submenu = getSubmenu(toggle),
          isOpen = toggle.getAttribute('aria-expanded') === 'true',
          newState = !isOpen,
          scopeMenu = toggle.closest('menu') || root; // Scope is the parent menu containing the toggle

    if (newState) closeAllOpenSubmenus(toggle, scopeMenu);
    updateAriaState(toggle, submenu, newState);
    syncTabIndex(submenu, newState);
}

/**
 * Closes all open submenus inside the specified scope except for an optional one to exclude.
 * @param {HTMLButtonElement|null} [exceptToggle=null]  Toggle whose submenu should remain open, if any.
 * @param {Element}                [scope=root]         Scope in which to close submenus.
 */
function closeAllOpenSubmenus(exceptToggle = null, scope = root) {

    // Find all toggles only within the current scope (e.g., the current <menu>)
    const toggles = scope.querySelectorAll('.nav-submenu-toggle');
    toggles.forEach(toggle => {
        if (toggle === exceptToggle) return;
        const submenu = getSubmenu(toggle);
        if (submenu && toggle.getAttribute('aria-expanded') === 'true') {
            updateAriaState(toggle, submenu, false);
            syncTabIndex(submenu, false);
        }
    });
}

/**
 * Closes any submenu that loses keyboard focus.
 */
function handleGlobalFocusChange() {
    root.querySelectorAll('menu.is-open').forEach(submenu => {
        const listItem = submenu.closest('.has-submenu'), // Find the nearest ancestor with the class 'has-submenu'
              toggle = listItem ? listItem.querySelector('.nav-submenu-toggle') : null; // Get the corresponding toggle button within that listItem
        if (!submenu.contains(document.activeElement) && toggle) {
            updateAriaState(toggle, submenu, false);
            syncTabIndex(submenu, false);
        }
    });
}

/**
 * Handle both mouse and touch on click/pointerup
 * - first click: open submenu, prevent navigation
 * - second click on `<a>`: let default navigation happen.
 * @param {MouseEvent|PointerEvent} event  The originating mouse or pointer event.
 */
function handleTouchToggle(event) {

    // only care about touch OR primary mouse
    if (event.pointerType && event.pointerType !== 'touch') return;

    const label = event.currentTarget, // <a> or <span>
          parentLi = label.closest('.has-submenu'),
          toggle = parentLi.querySelector('.nav-submenu-toggle'),
          submenu = getSubmenu(toggle),
          isOpen = toggle.getAttribute('aria-expanded') === 'true',
          isAnchor = label.tagName === 'A';

    if (!isOpen) {
        event.preventDefault();
        closeAllOpenSubmenus(toggle, toggle.closest('menu') || root);
        updateAriaState(toggle, submenu, true);
        syncTabIndex(submenu, true);
    } else if (!isAnchor) {
        event.preventDefault();
        updateAriaState(toggle, submenu, false);
        syncTabIndex(submenu, false);
    }
}

/**
 * Handles Escape key to close active submenu or return focus.
 * @private
 * @param {KeyboardEvent} event  The keydown event.
 */
function handleKeyDown(event) {
    if (event.key !== 'Escape') return;

    const active = document.activeElement;

    // Case 1: Focus is on a toggle button and its submenu is open
    if (active.classList.contains('nav-submenu-toggle')) {
        const listItem = active.closest('.has-submenu'),
              submenu = listItem ? getSubmenu(active) : null;
        if (submenu && submenu.classList.contains('is-open')) {
            updateAriaState(active, submenu, false);
            syncTabIndex(submenu, false);
            event.preventDefault(); // Focus stays on the toggle
            return;
        }
    }

    // Case 2: Focus is inside an open submenu
    const openSubmenu = active.closest && active.closest('menu.is-open');
    if (openSubmenu) {
        const listItem = openSubmenu.closest('.has-submenu'),
              toggle = listItem ? listItem.querySelector('.nav-submenu-toggle') : null;
        if (toggle) {
            updateAriaState(toggle, openSubmenu, false);
            syncTabIndex(openSubmenu, false);
            toggle.focus();
            event.preventDefault();
        }
    }
}

/**
 * Called when clicked outside the menu, closes all active submenus.
 * @param {Event} e  The pointer down event.
 */
function docPointerDown(e) {
    if (!root.contains(e.target)) closeAllOpenSubmenus();
}

/**
 * Returns the submenu element associated with the given toggle.
 * @param   {HTMLElement}      toggle  The toggle button element.
 * @returns {HTMLElement|null}         The associated submenu or null if not found.
 */
function getSubmenu(toggle) {
    if (!toggle || !toggle.parentElement) return null;
    return Array.from(toggle.parentElement.querySelectorAll('menu'))
        .find(menu => menu.closest('.has-submenu') === toggle.parentElement);
}

/**
 * Updates the ARIA attributes and visibility class of a submenu.
 * @param {HTMLButtonElement} toggle   The button element that controls the submenu.
 * @param {HTMLElement}       submenu  The submenu element to be shown or hidden.
 * @param {boolean}           open     Whether the submenu should be shown (`true`) or hidden (`false`).
 */
function updateAriaState(toggle, submenu, open) {

    const current = toggle.getAttribute('aria-expanded') === 'true';
    if (open === current) return;
    toggle.setAttribute('aria-expanded', String(open));
    submenu.setAttribute('aria-hidden', String(!open));
    submenu.classList.toggle('is-open', open);
}

/**
 * Enables or disables keyboard focusability on links within a submenu.
 * @param {HTMLElement} submenu  The submenu element whose links will be affected.
 * @param {boolean}     active   Whether to make the submenu links focusable (`true`) or not (`false`).
 */
function syncTabIndex(submenu, active) {
    // Always remove focusability from the menu element itself when inactive
    if (active) {
        submenu.removeAttribute('tabindex');
    } else {
        submenu.setAttribute('tabindex', '-1');
        if (document.activeElement === submenu) submenu.blur();
    }

    // Enable/disable only the direct child links
    submenu.querySelectorAll(':scope > li > a').forEach(link => {
        if (active) link.removeAttribute('tabindex');
        else link.setAttribute('tabindex', '-1');
    });

    // Enable/disable only the direct child toggles
    submenu.querySelectorAll(':scope > li > .nav-submenu-toggle').forEach(toggle => {
        if (active) toggle.removeAttribute('tabindex');
        else toggle.setAttribute('tabindex', '-1');
    });
}

/**
 * Initializes the navigation system and wires up all required event listeners.
 * @param {string|HTMLElement} [rootSelector='menu']  Root menu container as selector or element.
 */
export function init(rootSelector = 'menu') {

    root = typeof rootSelector === 'string' ? document.querySelector(rootSelector) : rootSelector;

    // Initializes toggle buttons and its associated submenu.
    const toggles = root.querySelectorAll('.nav-submenu-toggle');
    toggles.forEach(toggle => {
        const submenu = getSubmenu(toggle);
        syncTabIndex(submenu, false); // Use the unified syncTabIndex function for full accessibility
        submenu.setAttribute('aria-hidden', 'true');
        submenu.classList.remove('is-open');

        toggle.setAttribute('aria-expanded', 'false');
        toggle.addEventListener('click', toggleSubmenu);
    });

    // Handles loss of focus from submenus
    document.addEventListener('focusin', handleGlobalFocusChange);

    // Registers pointer-based touch behavior for submenu parents
    root.querySelectorAll('.has-submenu > a, .has-submenu > span').forEach(el => {
        el.addEventListener('click', handleTouchToggle);
    });

    // Handle mouse hover for ARIA state management (only for mouse, not touch)
    root.querySelectorAll('.has-submenu').forEach(li => {
        li._pointerenterHandler = event => {
            // Only handle mouse events, not touch events
            if (event.pointerType !== 'mouse') return;

            const toggle = li.querySelector('.nav-submenu-toggle'),
                  submenu = getSubmenu(toggle);
            if (toggle && submenu) updateAriaState(toggle, submenu, true);
        };

        li._pointerleaveHandler = event => {
            // Only handle mouse events, not touch events
            if (event.pointerType !== 'mouse') return;

            const toggle = li.querySelector('.nav-submenu-toggle'),
                  submenu = getSubmenu(toggle);
            if (toggle && submenu) updateAriaState(toggle, submenu, false);
        };

        li.addEventListener('pointerenter', li._pointerenterHandler);
        li.addEventListener('pointerleave', li._pointerleaveHandler);
    });

    document.addEventListener('pointerdown', docPointerDown); // Closes submenus when clicking outside the root
    document.addEventListener('keydown', handleKeyDown); // keyboard handler for ESC key
}

/**
 * Destroys the navigation system, removing all event listeners and restoring state.
 */
export function destroy() {

    document.removeEventListener('pointerdown', docPointerDown);
    document.removeEventListener('focusin', handleGlobalFocusChange);
    document.removeEventListener('keydown', handleKeyDown);

    root.querySelectorAll('.nav-submenu-toggle').forEach(toggle => {
        toggle.removeEventListener('click', toggleSubmenu);
    });

    root.querySelectorAll('.has-submenu > a, .has-submenu > span').forEach(el => {
        el.removeEventListener('click', handleTouchToggle);
    });

    // Remove mouse hover event listeners
    root.querySelectorAll('.has-submenu').forEach(li => {
        li.removeEventListener('pointerenter', li._pointerenterHandler);
        li.removeEventListener('pointerleave', li._pointerleaveHandler);
    });
}

init();

// Mobile Menu

import menuMobile from './menuMobile.js';
import lockScroll from './lockScroll.js';

lockScroll.init();
menuMobile.init(document.getElementById('nav-main-wrapper'), {
    preventDefault: true,
    initiator: document.getElementById('menu-mobile-button'),
    closeTrigger: document.getElementById('menu-mobile-close')
});
