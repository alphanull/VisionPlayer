/**
 * Enables auto initialization of the player.
 * This function must be executed after all components have been added.
 * This snipped is appended after completing the build.
 */
(function() {
    const selector = document.currentScript.getAttribute('data-vip-autoselector');
    if (!window.VisionPlayer) return;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.VisionPlayer.autoLoad(selector || undefined));
    } else window.VisionPlayer.autoLoad(selector || undefined);
})();
