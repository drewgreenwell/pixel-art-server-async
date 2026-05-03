<script lang="ts">
    import { onMount } from 'svelte';

    let {
        showCursor = $bindable(false),
        iconSrc = $bindable(''),
        containerSelector = $bindable('.pixel-grid .frame.active'),
    } = $props();

    let x = $state(0);
    let y = $state(0);
    let pressed = $state(false);
    let inBounds = $state(false);

    function getTarget(): Element | null {
        return document.querySelector(containerSelector);
    }

    function isInsideTarget(evt: MouseEvent): boolean {
        const target = getTarget();
        if (!target) return false;
        const rect = target.getBoundingClientRect();
        return (
            evt.clientX >= rect.left &&
            evt.clientX <= rect.right &&
            evt.clientY >= rect.top &&
            evt.clientY <= rect.bottom
        );
    }

    function handleMouseMove(evt: MouseEvent) {
        x = evt.clientX;
        y = evt.clientY;
        inBounds = isInsideTarget(evt);
    }

    function handleMouseDown() {
        pressed = true;
    }

    function handleMouseUp() {
        pressed = false;
    }

    function handleWindowLeave() {
        inBounds = false;
    }

    onMount(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('mouseleave', handleWindowLeave);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('mouseleave', handleWindowLeave);
        };
    });
</script>

<img
    src={iconSrc}
    alt=""
    aria-hidden="true"
    class="mouse-follower {pressed ? 'pressed' : ''}"
    style:display={!showCursor || !inBounds || !iconSrc ? 'none' : 'block'}
    style:left={`${x + 12}px`}
    style:top={`${y + 10}px`}
/>

<style>
    .mouse-follower {
        position: fixed;
        width: 22px;
        height: 22px;
        pointer-events: none;
        z-index: 500;
        transform: translate(0, 0) scale(1);
        transition: transform 80ms ease-out;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45));
    }

    .mouse-follower.pressed {
        transform: scale(0.92);
    }
</style>
