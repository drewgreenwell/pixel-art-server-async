<script lang="ts">
  let {
    showModal = $bindable(false),
    file = $bindable<File | null>(null),
    oncrop,
    oncancel,
  }: {
    showModal: boolean;
    file: File | null;
    oncrop: (blob: Blob, serverCrop?: { x: number; y: number; w: number; h: number }) => void;
    oncancel: () => void;
  } = $props();

  const MAX_DISPLAY = 600;
  const ANIMATED_TYPES = ['image/gif', 'image/webp', 'image/apng'];

  let dialog = $state<HTMLDialogElement | undefined>(undefined);
  let imageCanvas = $state<HTMLCanvasElement | undefined>(undefined);
  let overlayCanvas = $state<HTMLCanvasElement | undefined>(undefined);

  let displayWidth = $state(0);
  let displayHeight = $state(0);
  let imgNatWidth = $state(0);
  let imgNatHeight = $state(0);
  let scale = $state(1); // natural pixels per display pixel

  // Canvas drag state (display coords)
  let cropStart = $state<{ x: number; y: number } | null>(null);
  let cropEnd = $state<{ x: number; y: number } | null>(null);
  let isDragging = false;

  // Editable dimension fields (natural pixels)
  let editX = $state(0);
  let editY = $state(0);
  let editW = $state(0);
  let editH = $state(0);

  // Frame navigation
  let frameCount = $state(1);
  let currentFrame = $state(0);
  let isLoadingFrame = $state(false);
  let uploadAllFrames = $state(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let decoder: any = null;
  let frameCache = new Map<number, ImageBitmap>();

  $effect(() => {
    if (showModal) {
      dialog?.showModal();
      if (file) init(file);
    }
  });

  function init(f: File) {
    cropStart = null;
    cropEnd = null;
    currentFrame = 0;
    frameCount = 1;
    decoder = null;
    frameCache = new Map();

    // Draw first frame immediately using the proven Image+setTimeout approach
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      imgNatWidth = img.naturalWidth;
      imgNatHeight = img.naturalHeight;
      setupScale();
      // setTimeout(0) fires after Svelte's microtask flush has updated canvas attributes
      setTimeout(() => {
        if (!imageCanvas) return;
        const ctx = imageCanvas.getContext('2d')!;
        ctx.clearRect(0, 0, displayWidth, displayHeight);
        ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
        URL.revokeObjectURL(url);
      }, 0);

      // Set up ImageDecoder for frame navigation after the first frame is drawn
      if ('ImageDecoder' in window && ANIMATED_TYPES.includes(f.type)) {
        f.arrayBuffer().then((ab) => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const dec = new (window as any).ImageDecoder({ data: ab, type: f.type });
            dec.tracks.ready.then(() => {
              decoder = dec;
              frameCount = (dec.tracks.selectedTrack?.frameCount as number) ?? 1;
            }).catch(() => {});
          } catch (e) {
            console.warn('ImageDecoder unavailable:', e);
          }
        });
      }
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }

  async function renderFrame(idx: number) {
    if (!decoder || !imageCanvas) return;
    isLoadingFrame = true;
    try {
      if (!frameCache.has(idx)) {
        const result = await decoder.decode({ frameIndex: idx });
        frameCache.set(idx, result.image);
      }
      const bitmap = frameCache.get(idx)!;
      // displayWidth/displayHeight are already set; just draw after current tasks
      setTimeout(() => {
        if (!imageCanvas) return;
        const ctx = imageCanvas.getContext('2d')!;
        ctx.clearRect(0, 0, displayWidth, displayHeight);
        ctx.drawImage(bitmap, 0, 0, displayWidth, displayHeight);
      }, 0);
    } catch (e) {
      console.error('Frame decode error:', e);
    }
    isLoadingFrame = false;
  }

  function setupScale() {
    const s = Math.min(MAX_DISPLAY / imgNatWidth, MAX_DISPLAY / imgNatHeight, 1);
    displayWidth = Math.round(imgNatWidth * s);
    displayHeight = Math.round(imgNatHeight * s);
    scale = 1 / s;
  }

  async function gotoFrame(delta: number) {
    if (isLoadingFrame) return;
    currentFrame = Math.max(0, Math.min(frameCount - 1, currentFrame + delta));
    await renderFrame(currentFrame);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function clamp(v: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, v));
  }

  function eventPos(e: MouseEvent): { x: number; y: number } {
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    return {
      x: clamp(Math.round(e.clientX - rect.left), 0, displayWidth - 1),
      y: clamp(Math.round(e.clientY - rect.top), 0, displayHeight - 1),
    };
  }

  function touchPos(e: TouchEvent): { x: number; y: number } {
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    const t = e.touches[0];
    return {
      x: clamp(Math.round(t.clientX - rect.left), 0, displayWidth - 1),
      y: clamp(Math.round(t.clientY - rect.top), 0, displayHeight - 1),
    };
  }

  // ── Overlay drawing ────────────────────────────────────────────────────────

  function drawOverlay() {
    if (!overlayCanvas) return;
    const ctx = overlayCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    if (!cropStart || !cropEnd) return;

    const x = Math.min(cropStart.x, cropEnd.x);
    const y = Math.min(cropStart.y, cropEnd.y);
    const w = Math.abs(cropEnd.x - cropStart.x);
    const h = Math.abs(cropEnd.y - cropStart.y);

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    ctx.clearRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    // rule-of-thirds guides
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x + (w / 3) * i, y);
      ctx.lineTo(x + (w / 3) * i, y + h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y + (h / 3) * i);
      ctx.lineTo(x + w, y + (h / 3) * i);
      ctx.stroke();
    }
  }

  // ── Dimension field sync ───────────────────────────────────────────────────

  /** Call after a drag finishes to push values into the edit fields. */
  function syncEditFromCrop() {
    if (!cropStart || !cropEnd) return;
    editX = Math.round(Math.min(cropStart.x, cropEnd.x) * scale);
    editY = Math.round(Math.min(cropStart.y, cropEnd.y) * scale);
    editW = Math.round(Math.abs(cropEnd.x - cropStart.x) * scale);
    editH = Math.round(Math.abs(cropEnd.y - cropStart.y) * scale);
  }

  /** Call when the user finishes editing a field to push values back to the canvas. */
  function applyEditDimensions() {
    const x = clamp(editX, 0, imgNatWidth - 1);
    const y = clamp(editY, 0, imgNatHeight - 1);
    const w = clamp(editW, 1, imgNatWidth - x);
    const h = clamp(editH, 1, imgNatHeight - y);
    // Update the edit fields to the clamped values
    editX = x; editY = y; editW = w; editH = h;
    // Convert back to display coords
    cropStart = { x: Math.round(x / scale), y: Math.round(y / scale) };
    cropEnd   = { x: Math.round((x + w) / scale), y: Math.round((y + h) / scale) };
    drawOverlay();
  }

  // ── Mouse / touch handlers ─────────────────────────────────────────────────

  function onMouseDown(e: MouseEvent) {
    e.preventDefault();
    isDragging = true;
    cropStart = eventPos(e);
    cropEnd = null;
  }

  function onMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    cropEnd = eventPos(e);
    drawOverlay();
  }

  function onMouseUp(e: MouseEvent) {
    if (!isDragging) return;
    isDragging = false;
    cropEnd = eventPos(e);
    drawOverlay();
    syncEditFromCrop();
  }

  function onTouchStart(e: TouchEvent) {
    e.preventDefault();
    isDragging = true;
    cropStart = touchPos(e);
    cropEnd = null;
  }

  function onTouchMove(e: TouchEvent) {
    if (!isDragging) return;
    cropEnd = touchPos(e);
    drawOverlay();
  }

  function onTouchEnd(e: TouchEvent) {
    if (!isDragging) return;
    isDragging = false;
    drawOverlay();
    syncEditFromCrop();
  }

  // ── Crop / upload ──────────────────────────────────────────────────────────

  function getCropRect() {
    if (!cropStart || !cropEnd) return null;
    const x = Math.round(Math.min(cropStart.x, cropEnd.x) * scale);
    const y = Math.round(Math.min(cropStart.y, cropEnd.y) * scale);
    const w = Math.round(Math.abs(cropEnd.x - cropStart.x) * scale);
    const h = Math.round(Math.abs(cropEnd.y - cropStart.y) * scale);
    return { x, y, w, h };
  }

  function confirmCrop() {
    const rect = getCropRect();
    if (!rect || rect.w < 1 || rect.h < 1 || !file) return;

    if (uploadAllFrames && frameCount > 1) {
      // Pass original file + crop rect — server (sharp) crops all frames
      file.arrayBuffer().then((buf) => {
        oncrop(new Blob([buf], { type: file!.type }), rect);
        close();
      });
      return;
    }

    // Client-side crop of the currently displayed frame
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = rect.w;
      c.height = rect.h;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
      URL.revokeObjectURL(url);
      c.toBlob(
        (blob) => {
          if (blob) oncrop(blob);
          close();
        },
        file!.type || 'image/png',
      );
    };
    img.src = url;
  }

  function uploadAsIs() {
    if (!file) return;
    file.arrayBuffer().then((buf) => {
      oncrop(new Blob([buf], { type: file!.type }));
      close();
    });
  }

  function cancel() {
    close();
    oncancel();
  }

  function close() {
    showModal = false;
    dialog?.close();
    cropStart = null;
    cropEnd = null;
  }

  let hasCrop = $derived(
    cropStart !== null &&
      cropEnd !== null &&
      Math.abs((cropEnd?.x ?? 0) - (cropStart?.x ?? 0)) > 4 &&
      Math.abs((cropEnd?.y ?? 0) - (cropStart?.y ?? 0)) > 4,
  );
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<dialog
  bind:this={dialog}
  onclose={() => {
    showModal = false;
  }}
  onclick={(e) => {
    if (e.target === dialog) cancel();
  }}
>
  <div class="crop-dialog">
    <h2>Crop Image</h2>
    <p class="hint">
      Drag to select a region &mdash; source: {imgNatWidth}&times;{imgNatHeight}px
    </p>

    <!-- Frame navigation -->
    {#if frameCount > 1}
      <div class="frame-nav">
        <button
          class="button small"
          disabled={currentFrame === 0 || isLoadingFrame || null}
          onclick={() => gotoFrame(-1)}
        >&lsaquo; Prev</button>
        <span class="frame-label">
          Frame {currentFrame + 1} / {frameCount}
          {#if isLoadingFrame}<span class="loading">…</span>{/if}
        </span>
        <button
          class="button small"
          disabled={currentFrame === frameCount - 1 || isLoadingFrame || null}
          onclick={() => gotoFrame(1)}
        >Next &rsaquo;</button>
      </div>
    {/if}

    <div class="canvas-wrap" style="width:{displayWidth}px; height:{displayHeight}px">
      <canvas
        bind:this={imageCanvas}
        width={displayWidth}
        height={displayHeight}
        class="img-canvas"
      ></canvas>
      <canvas
        bind:this={overlayCanvas}
        width={displayWidth}
        height={displayHeight}
        class="overlay-canvas"
        onmousedown={onMouseDown}
        onmousemove={onMouseMove}
        onmouseup={onMouseUp}
        onmouseleave={onMouseUp}
        ontouchstart={onTouchStart}
        ontouchmove={onTouchMove}
        ontouchend={onTouchEnd}
      ></canvas>
    </div>

    <!-- Editable dimensions -->
    {#if hasCrop}
      <div class="dim-fields">
        <label>
          X
          <input
            type="number" min="0" max={imgNatWidth - 1}
            bind:value={editX}
            onchange={applyEditDimensions}
            onkeydown={(e) => e.key === 'Enter' && applyEditDimensions()}
          />
        </label>
        <label>
          Y
          <input
            type="number" min="0" max={imgNatHeight - 1}
            bind:value={editY}
            onchange={applyEditDimensions}
            onkeydown={(e) => e.key === 'Enter' && applyEditDimensions()}
          />
        </label>
        <label>
          W
          <input
            type="number" min="1" max={imgNatWidth}
            bind:value={editW}
            onchange={applyEditDimensions}
            onkeydown={(e) => e.key === 'Enter' && applyEditDimensions()}
          />
        </label>
        <label>
          H
          <input
            type="number" min="1" max={imgNatHeight}
            bind:value={editH}
            onchange={applyEditDimensions}
            onkeydown={(e) => e.key === 'Enter' && applyEditDimensions()}
          />
        </label>
      </div>
    {/if}

    {#if frameCount > 1 && hasCrop}
      <label class="all-frames-toggle">
        <input type="checkbox" bind:checked={uploadAllFrames} />
        Crop all {frameCount} frames
      </label>
    {/if}

    <div class="actions">
      <button class="button" onclick={cancel}>Cancel</button>
      <button class="button" onclick={uploadAsIs}>Upload as-is</button>
      <button class="button active" disabled={!hasCrop || null} onclick={confirmCrop}>
        Crop &amp; Upload
      </button>
    </div>
  </div>
</dialog>

<style>
  dialog {
    border: none;
    border-radius: 0.3em;
    padding: 0;
    max-width: 95vw;
    max-height: 95vh;
    overflow: auto;
    background: var(--bg, #1e1e2e);
    color: var(--fg, #cdd6f4);
  }
  dialog::backdrop {
    background: rgba(0, 0, 0, 0.6);
  }
  dialog[open] {
    animation: zoom 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes zoom {
    from { transform: scale(0.95); }
    to { transform: scale(1); }
  }
  .crop-dialog {
    padding: 1em;
    display: flex;
    flex-direction: column;
    gap: 0.75em;
    align-items: flex-start;
  }
  h2 {
    margin: 0;
  }
  .hint {
    margin: 0;
    font-size: 0.85em;
    opacity: 0.7;
  }
  .canvas-wrap {
    position: relative;
    cursor: crosshair;
    line-height: 0;
  }
  .img-canvas,
  .overlay-canvas {
    position: absolute;
    top: 0;
    left: 0;
    display: block;
  }
  .overlay-canvas {
    z-index: 1;
  }
  .frame-nav {
    display: flex;
    align-items: center;
    gap: 0.6em;
  }
  .frame-label {
    font-size: 0.85em;
    min-width: 8em;
    text-align: center;
  }
  .loading {
    opacity: 0.6;
  }
  .dim-fields {
    display: flex;
    gap: 0.75em;
    flex-wrap: wrap;
    align-items: flex-end;
  }
  .dim-fields label {
    display: flex;
    flex-direction: column;
    gap: 0.2em;
    font-size: 0.8em;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .dim-fields input {
    width: 5em;
    padding: 0.25em 0.4em;
    background: var(--input-bg, #313244);
    color: inherit;
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 0.2em;
    font-size: 1em;
  }
  .dim-fields input:focus {
    outline: 1px solid rgba(255,255,255,0.5);
  }
  .all-frames-toggle {
    display: flex;
    align-items: center;
    gap: 0.5em;
    font-size: 0.9em;
    cursor: pointer;
  }
  .actions {
    display: flex;
    gap: 0.5em;
    flex-wrap: wrap;
  }
</style>
