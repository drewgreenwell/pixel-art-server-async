<script lang="ts">
  import toast from 'svelte-5-french-toast';
  import Fa from 'svelte-fa';
  import {
    faAdd,
    faSave,
    faTrashCan,
    faChevronUp,
    faChevronDown,
    faXmark,
    faPlus,
  } from '@fortawesome/free-solid-svg-icons';

  let { host }: { host: string } = $props();

  interface Playlist {
    id: number;
    name: string;
    images: string[];
    duration: number;
    brightness: number;
    backgroundColor: string;
    imageDurations?: (number | null)[];
  }

  interface ImageStat {
    id: string;
    path: string;
    width: number;
    height: number;
    format: string;
    pages?: number;
  }

  let playlists = $state<Playlist[]>([]);
  let allImages = $state<ImageStat[]>([]);
  let loading = $state(true);

  // Currently selected playlist id
  let selectedId = $state<number | null>(null);

  // Working-copy form fields
  let editName = $state('');
  let editDuration = $state(10);
  let editBrightness = $state(25);
  let editBgColor = $state('#ffffff');
  let editImages = $state<string[]>([]);
  let editImageDurations = $state<(number | null)[]>([]);
  let isNew = $state(false);

  // Delete confirm
  let showConfirm = $state(false);

  const selected = $derived(playlists.find((p) => p.id === selectedId) ?? null);

  async function load() {
    loading = true;
    try {
      const [pr, ir] = await Promise.all([
        fetch(`${host}/imagesets`).then((r) => r.json()),
        fetch(`${host}/images`).then((r) => r.json()),
      ]);
      playlists = pr;
      allImages = ir;
    } catch (e) {
      toast.error('Failed to load playlists');
    }
    loading = false;
  }

  load();

  function selectPlaylist(p: Playlist) {
    selectedId = p.id;
    editName = p.name ?? '';
    editDuration = p.duration ?? 10;
    editBrightness = p.brightness ?? 25;
    editBgColor = p.backgroundColor ?? '#ffffff';
    editImages = [...(p.images ?? [])];
    editImageDurations = (p.images ?? []).map((_, i) => p.imageDurations?.[i] ?? null);
    isNew = false;
  }

  function newPlaylist() {
    const nextId = playlists.length ? Math.max(...playlists.map((p) => p.id)) + 1 : 1;
    selectedId = nextId;
    editName = '';
    editDuration = 10;
    editBrightness = 25;
    editBgColor = '#ffffff';
    editImages = [];
    editImageDurations = [];
    isNew = true;
  }

  async function save() {
    if (!editName.trim()) { toast.error('Playlist name is required'); return; }

    const payload: Playlist = {
      id: selectedId!,
      name: editName.trim(),
      duration: Number(editDuration),
      brightness: Number(editBrightness),
      backgroundColor: editBgColor,
      images: editImages,
      imageDurations: editImageDurations.map((d) => (d != null && d > 0 ? Number(d) : null)),
    };

    try {
      const r = await fetch(`${host}/imageset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error ?? 'Save failed');
      toast.success('Playlist saved');
      await load();
      isNew = false;
    } catch (e: any) {
      toast.error(e.message ?? 'Save failed');
    }
  }

  async function doDelete() {
    try {
      const r = await fetch(`${host}/imageset`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: selectedId }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error ?? 'Delete failed');
      toast.success('Playlist deleted');
      selectedId = null;
      showConfirm = false;
      await load();
    } catch (e: any) {
      toast.error(e.message ?? 'Delete failed');
      showConfirm = false;
    }
  }

  // Playlist image management
  function addImage(id: string) {
    editImages = [...editImages, id];
    editImageDurations = [...editImageDurations, null];
  }

  function removeImage(index: number) {
    editImages = editImages.filter((_, i) => i !== index);
    editImageDurations = editImageDurations.filter((_, i) => i !== index);
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const arr = [...editImages];
    const dur = [...editImageDurations];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    [dur[index - 1], dur[index]] = [dur[index], dur[index - 1]];
    editImages = arr;
    editImageDurations = dur;
  }

  function moveDown(index: number) {
    if (index >= editImages.length - 1) return;
    const arr = [...editImages];
    const dur = [...editImageDurations];
    [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
    [dur[index], dur[index + 1]] = [dur[index + 1], dur[index]];
    editImages = arr;
    editImageDurations = dur;
  }

  function thumbUrl(id: string) {
    return `${host}/image-preview/${encodeURIComponent(id)}`;
  }

  // Images NOT yet in the current playlist (unique set for the picker)
  const inPlaylistSet = $derived(new Set(editImages));
</script>

<div class="playlists-view">
  <!-- Sidebar -->
  <aside class="playlist-sidebar">
    <div class="sidebar-header">
      <h2>Playlists</h2>
      <button class="button small" onclick={newPlaylist}><Fa icon={faAdd} /> New</button>
    </div>

    {#if loading}
      <p class="hint">Loading…</p>
    {:else if playlists.length === 0}
      <p class="hint">No playlists yet.</p>
    {:else}
      <ul class="playlist-list">
        {#each playlists as p (p.id)}
          <li>
            <button
              class="playlist-item {selectedId === p.id ? 'active' : ''}"
              onclick={() => selectPlaylist(p)}
            >
              <span class="pl-name">{p.name || `Playlist ${p.id}`}</span>
              <span class="pl-count">{p.images?.length ?? 0} img</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </aside>

  <!-- Detail panel -->
  {#if selectedId !== null}
    <section class="playlist-detail">
      <div class="detail-header">
        <h2>{isNew ? 'New Playlist' : editName || `Playlist ${selectedId}`}</h2>
        <div class="detail-actions">
          {#if !isNew}
            <button class="button small" onclick={() => (showConfirm = true)}>
              <Fa icon={faTrashCan} /> Delete
            </button>
          {/if}
          <button class="button small active" onclick={save}>
            <Fa icon={faSave} /> Save
          </button>
        </div>
      </div>

      <!-- Settings row -->
      <div class="settings-row">
        <div class="form-control">
          <label for="pl-name">Name</label>
          <input id="pl-name" type="text" bind:value={editName} placeholder="Playlist name" />
        </div>
        <div class="form-control inline">
          <label for="pl-dur">Seconds per image</label>
          <input id="pl-dur" type="number" min="1" max="3600" bind:value={editDuration} style="width:5em" />
        </div>
        <div class="form-control inline">
          <label for="pl-bright">Brightness</label>
          <input id="pl-bright" type="range" min="0" max="255" bind:value={editBrightness} style="width:7em" />
          <input type="number" min="0" max="255" bind:value={editBrightness} style="width:3.5em" />
        </div>
        <div class="form-control inline">
          <label for="pl-bg">Background</label>
          <input id="pl-bg" type="color" bind:value={editBgColor} style="width:3em;height:2em" />
          <input type="text" bind:value={editBgColor} style="width:6em;font-family:monospace" maxlength="7" />
        </div>
      </div>

      <!-- Playlist images -->
      <div class="images-section">
        <h3>Images in playlist <span class="count">({editImages.length})</span></h3>

        {#if editImages.length === 0}
          <p class="hint">No images added yet. Pick from the library below.</p>
        {:else}
          <div class="playlist-images">
            {#each editImages as imgId, i (i + ':' + imgId)}
              <div class="playlist-thumb-row">
                <img
                  src={thumbUrl(imgId)}
                  alt={imgId}
                  class="thumb"
                  title={imgId}
                  loading="lazy"
                />
                <span class="thumb-name" title={imgId}>{imgId}</span>
                <label class="dur-label" title="Override seconds for this image (leave blank to use playlist default)">
                  <span class="dur-hint">s</span>
                  <input
                    class="dur-input"
                    type="number"
                    min="1"
                    max="3600"
                    placeholder={String(editDuration)}
                    value={editImageDurations[i] ?? ''}
                    oninput={(e) => {
                      const val = (e.target as HTMLInputElement).value;
                      const arr = [...editImageDurations];
                      arr[i] = val === '' ? null : Number(val);
                      editImageDurations = arr;
                    }}
                  />
                </label>
                <div class="thumb-controls">
                  <button
                    class="button small tool"
                    aria-label="Move up"
                    onclick={() => moveUp(i)}
                    disabled={i === 0 || null}
                  ><Fa icon={faChevronUp} /></button>
                  <button
                    class="button small tool"
                    aria-label="Move down"
                    onclick={() => moveDown(i)}
                    disabled={i === editImages.length - 1 || null}
                  ><Fa icon={faChevronDown} /></button>
                  <button
                    class="button small tool"
                    aria-label="Remove"
                    onclick={() => removeImage(i)}
                  ><Fa icon={faXmark} /></button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Image library picker -->
      <div class="images-section">
        <h3>Image library <span class="count">({allImages.length})</span></h3>
        <div class="image-grid">
          {#each allImages as img (img.id)}
            <button
              class="grid-thumb {inPlaylistSet.has(img.id) ? 'in-playlist' : ''}"
              title={img.id}
              onclick={() => addImage(img.id)}
            >
              <img src={thumbUrl(img.id)} alt={img.id} loading="lazy" />
              <span class="grid-thumb-badge"><Fa icon={faPlus} /></span>
              {#if inPlaylistSet.has(img.id)}
                <span class="in-playlist-indicator">✓</span>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    </section>
  {:else}
    <div class="no-selection">
      <p>Select a playlist to edit, or create a new one.</p>
    </div>
  {/if}
</div>

<!-- Delete confirm -->
{#if showConfirm}
  <div
    class="confirm-backdrop"
    role="button"
    tabindex="-1"
    aria-label="Close"
    onclick={() => (showConfirm = false)}
    onkeydown={(e) => e.key === 'Escape' && (showConfirm = false)}
  >
    <div
      class="confirm-box"
      role="dialog"
      aria-modal="true"
      onclick={(e) => e.stopPropagation()}
      onkeydown={() => {}}
    >
      <h3>Delete playlist?</h3>
      <p>Remove <strong>{editName || `Playlist ${selectedId}`}</strong>?</p>
      <div class="confirm-actions">
        <button class="button" onclick={() => (showConfirm = false)}>Cancel</button>
        <button class="button active" onclick={doDelete}>Delete</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .playlists-view {
    display: flex;
    gap: 1em;
    width: 100%;
    min-height: 60vh;
    padding: 1em 0;
  }

  /* Sidebar */
  .playlist-sidebar {
    width: 200px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5em;
  }
  .sidebar-header {
    display: flex;
    align-items: center;
    gap: 0.5em;
    justify-content: space-between;
  }
  .sidebar-header h2 {
    margin: 0;
    font-size: 1em;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.7;
  }
  .playlist-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .playlist-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 0.4em 0.6em;
    border-radius: 4px;
    border: none;
    background: transparent;
    cursor: pointer;
    text-align: left;
    gap: 0.5em;
    color: inherit;
    font-size: 0.9em;
  }
  .playlist-item:hover {
    background: rgba(128, 128, 128, 0.15);
  }
  .playlist-item.active {
    background: rgba(128, 128, 128, 0.25);
    font-weight: bold;
  }
  .pl-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pl-count {
    flex-shrink: 0;
    font-size: 0.75em;
    opacity: 0.6;
  }

  /* Detail panel */
  .playlist-detail {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1em;
  }
  .detail-header {
    display: flex;
    align-items: center;
    gap: 1em;
    justify-content: space-between;
  }
  .detail-header h2 {
    margin: 0;
  }
  .detail-actions {
    display: flex;
    gap: 0.5em;
  }
  .settings-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75em 1.5em;
    align-items: flex-end;
    padding: 0.75em;
    border-radius: 6px;
    background: rgba(128, 128, 128, 0.07);
  }
  .no-selection {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.5;
  }

  /* Images section */
  .images-section {
    display: flex;
    flex-direction: column;
    gap: 0.5em;
  }
  .images-section h3 {
    margin: 0;
    font-size: 0.85em;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.7;
  }
  .count {
    font-weight: normal;
  }

  /* Playlist ordered list */
  .playlist-images {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 300px;
    overflow-y: auto;
  }
  .playlist-thumb-row {
    display: flex;
    align-items: center;
    gap: 0.5em;
    padding: 3px 4px;
    border-radius: 4px;
    background: rgba(128, 128, 128, 0.07);
  }
  .thumb {
    width: 40px;
    height: 40px;
    object-fit: contain;
    image-rendering: pixelated;
    flex-shrink: 0;
    border-radius: 2px;
    background: #111;
  }
  .thumb-name {
    flex: 1;
    font-size: 0.8em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
    opacity: 0.8;
  }
  .dur-label {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }
  .dur-hint {
    font-size: 0.75em;
    opacity: 0.55;
  }
  .dur-input {
    width: 4em;
    padding: 0.15em 0.3em;
    font-size: 0.85em;
    border-radius: 4px;
    text-align: right;
  }
  .thumb-controls {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  /* Image library grid */
  .image-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-height: 320px;
    overflow-y: auto;
    padding: 4px;
  }
  .grid-thumb {
    position: relative;
    width: 56px;
    height: 56px;
    padding: 0;
    border: 2px solid transparent;
    border-radius: 4px;
    background: #111;
    cursor: pointer;
    overflow: hidden;
    flex-shrink: 0;
    transition: border-color 0.15s;
  }
  .grid-thumb img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    image-rendering: pixelated;
    display: block;
  }
  .grid-thumb-badge {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    opacity: 0;
    transition: opacity 0.15s;
    font-size: 1.2em;
  }
  .grid-thumb:hover .grid-thumb-badge {
    opacity: 1;
  }
  .grid-thumb.in-playlist {
    border-color: rgba(100, 200, 100, 0.6);
  }
  .in-playlist-indicator {
    position: absolute;
    top: 2px;
    right: 3px;
    font-size: 0.7em;
    color: #6d6;
    font-weight: bold;
    text-shadow: 0 0 3px #000;
    pointer-events: none;
  }

  /* Confirm dialog */
  .confirm-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .confirm-box {
    background: var(--bg, #1a1a1a);
    border-radius: 6px;
    padding: 1.5em;
    min-width: 280px;
    max-width: 400px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }
  .confirm-box h3 {
    margin: 0 0 0.5em;
  }
  .confirm-actions {
    display: flex;
    gap: 0.5em;
    justify-content: flex-end;
    margin-top: 1em;
  }
  .hint {
    opacity: 0.55;
    font-size: 0.9em;
  }
</style>
