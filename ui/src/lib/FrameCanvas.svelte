<script lang="ts">
    import { onMount } from 'svelte';
    import type { ImageRow } from './DataTypes';
    let p = $props();
    let frameId: number = $state(p.frameId);
    let height: number = $state(p.height);
    let width: number = $state(p.width);
    let palette: string[] = $state(p.palette);
    let data: ImageRow[] = $state(p.data);
    let frameCanvas: HTMLCanvasElement;

    function hexToRgb(hex: string): { r: number; g: number; b: number } {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        // console.log({ hex, result })
        return result
            ? {
                  r: parseInt(result[1], 16),
                  g: parseInt(result[2], 16),
                  b: parseInt(result[3], 16),
              }
            : { r: 0, g: 0, b: 0 };
    }

    function drawCanvas() {
        if (!frameCanvas) return;
        const ctx = frameCanvas.getContext('2d');
        if (!ctx) return;
        const imgData = ctx.createImageData(width, height);

        for (let y = 0; y < data.length; y++) {
            for (let x = 0; x < data[y].pixels.length; x++) {
                const pixel = hexToRgb(palette[data[y].pixels[x]]);
                for (let dy = 0; dy < 2; dy++) {
                    for (let dx = 0; dx < 2; dx++) {
                        const targetIdx =
                            ((y * 2 + dy) * width + (x * 2 + dx)) * 4;
                        imgData.data[targetIdx] = pixel.r;
                        imgData.data[targetIdx + 1] = pixel.g;
                        imgData.data[targetIdx + 2] = pixel.b;
                        imgData.data[targetIdx + 3] = 255; // Alpha
                    }
                }
            }
        }
        ctx.putImageData(imgData, 0, 0);
    }
    onMount(() => {
        drawCanvas();
    });
</script>

<canvas {height} {width} bind:this={frameCanvas}></canvas>
