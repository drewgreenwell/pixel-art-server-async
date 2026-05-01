<script lang="ts">
    import { Spring } from 'svelte/motion';
    import { onMount } from 'svelte';
    let {
        showCursor = $bindable(false),
        cursorType = $bindable('circle'),
        highlightColor = $bindable('pink'),
        containerSelector = $bindable('body'),
    } = $props();

    let coords1 = new Spring(
        { x: 0, y: 0 },
        {
            stiffness: 0.05,
            damping: 0.25,
        },
    );

    let coords2 = new Spring(
        { x: 0, y: 0 },
        {
            stiffness: 0.1,
            damping: 0.35,
        },
    );
    let sqrSize = 32;
    let cirSize = 16;
    let size = $derived.by(() => {
        return new Spring(cursorType == 'circle' ? cirSize : sqrSize);
    });

    let _c: Element | null = document.querySelector(containerSelector);
    let getContainer = () => {
        if (_c == null) _c = document.querySelector(containerSelector);
        return _c;
    };
    const targetSelector = '.pixel-grid .frame';
    let _t: Element | null = document.querySelector(targetSelector);
    let getTarget = () => {
        if (_t == null) _t = document.querySelector(targetSelector);
        return _t;
    };

    let outOfBounds = $state(false);

    function isPointInRect(
        rect: DOMRect,
        x: number,
        y: number,
        padding: number = 0,
    ) {
        return (
            x >= rect.left - padding &&
            x <= rect.right + padding &&
            y >= rect.top - padding &&
            y <= rect.bottom + padding
        );
    }

    function mouseMove(evt: Event) {
        let c = getContainer();
        let t = getTarget();
        if (!c || !t) return;
        let e = <MouseEvent>evt;
        let rect = t.getBoundingClientRect();
        outOfBounds = !isPointInRect(rect, e.clientX, e.clientY, 24);
        console.log({ outOfBounds });
        if (outOfBounds) return;
        coords1.set({
            x: e.clientX,
            y: e.clientY,
        });
        coords2.set({
            x: e.clientX,
            y: e.clientY,
        });
        // console.log({ e, evt, rect, coords1, coords2 });
    }

    function mouseLeave(evt: Event) {
        console.log('Mouse leave!!');
        outOfBounds = true;
    }

    function mouseDown(evt: Event) {
        // let e = <MouseEvent>evt;
        let sz = cursorType === 'circle' ? cirSize : sqrSize;
        size.set(sz * 2);
    }

    function mouseUp(evt: Event) {
        // let e = <MouseEvent>evt;
        let sz = cursorType === 'circle' ? cirSize : sqrSize;
        size.set(sz);
    }

    onMount(() => {
        let c = getContainer();
        if (!c) return;
        //container.addEventListener('mouseenter', mouseEnter);
        c.addEventListener('mouseleaave', mouseLeave);
        c.addEventListener('mousemove', mouseMove);
        c.addEventListener('mousedown', mouseDown);
        c.addEventListener('mouseup', mouseUp);

        // Return a cleanup function
        return () => {
            let c = getContainer();
            if (!c) return;
            // container.addEventListener('mouseenter', mouseEnter);
            c.removeEventListener('mouseleaave', mouseLeave);
            c.removeEventListener('mousemove', mouseMove);
            c.removeEventListener('mousedown', mouseDown);
            c.removeEventListener('mouseup', mouseUp);
        };
    });
</script>

<!-- <svelte:window
    on:mousemove={(e) => {
        if (!container) return;
        // todo: get container element position and offset
        //coords1.set({ x: e.clientX, y: e.clientY });
        //coords2.set({ x: e.clientX, y: e.clientY });
        let pixRect = container.getBoundingClientRect();
        //if (isPointInRect(pixRect, e.screenX, e.screenY)) {
        console.log({ inRect: true, pixRect, e });
        coords1.set({
            x: e.clientX, // - pixRect.left,
            y: e.clientY, // - pixRect.top,
        });
        coords2.set({
            x: e.clientX, // - pixRect.left,
            y: e.clientY, // - pixRect.top,
        });
        //} else {
        //    console.log({ inRect: false, pixRect, e });
        //}
    }}
    on:mousedown={(e) => {
        if (cursorType === 'circle') {
            size.set(30);
        } else if (cursorType === 'square') {
            size.set(64);
        }
    }}
    on:mouseup={(e) => {
        if (cursorType === 'circle') {
            size.set(10);
        } else if (cursorType === 'square') {
            size.set(32);
        }
    }}
/> -->
<svg
    style:display={!showCursor || outOfBounds || cursorType !== 'square'
        ? 'none'
        : null}
    class="bucket w-full h-full cursor square-cursor"
    style="--highlightcolor:{highlightColor}"
>
    <rect
        x={coords1.current.x - size.current / 2}
        height={size.current}
        width={size.current}
        y={coords1.current.y - size.current / 2}
        stroke="lightgray"
        stroke-width="1"
        fill-opacity="0"
    />
    <rect
        x={coords2.current.x - size.current / 8}
        height={size.current / 4}
        width={size.current / 4}
        y={coords2.current.y - size.current / 8}
        fill="darkgray"
    />
</svg>

<svg
    style:display={!showCursor || outOfBounds || cursorType !== 'circle'
        ? 'none'
        : null}
    class="w-full h-full cursor circle-cursor"
    style="--highlightcolor:{highlightColor}"
>
    <circle
        cx={coords1.current.x}
        cy={coords1.current.y}
        r={size.current}
        stroke="lightgray"
        stroke-width="1"
        fill-opacity="0"
    />
    <circle
        cx={coords2.current.x}
        cy={coords2.current.y}
        r={size.current / 4}
        fill="darkgray"
    />
</svg>

<style>
    .w-full {
        width: 100vw;
    }

    .h-full {
        height: 100vw;
    }

    svg {
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
    }
    svg circle {
        stroke: var(--highlightcolor);
    }
    svg circle:last-child {
        fill: var(--highlightcolor);
    }

    svg rect {
        stroke: var(--highlightcolor);
    }
    svg rect:last-child {
        fill: var(--highlightcolor);
    }
</style>
