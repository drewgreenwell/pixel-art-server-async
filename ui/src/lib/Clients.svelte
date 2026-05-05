<script lang="ts">
  import toast from 'svelte-5-french-toast';
  import Fa from 'svelte-fa';
  import { faTrashCan, faAdd, faSave, faPencil, faXmark } from '@fortawesome/free-solid-svg-icons';
  import Modal from './Modal.svelte';

  let { host }: { host: string } = $props();

  interface Client {
    id: string;
    name?: string;
    width: number;
    height: number;
    pixels: number;
    imagesetId?: number;
  }

  interface Playlist {
    id: number;
    name: string;
  }

  let clients = $state<Client[]>([]);
  let playlists = $state<Playlist[]>([]);
  let loading = $state(true);

  // form state
  let editingId = $state<string | null>(null); // null = adding new
  let showForm = $state(false);
  let formId = $state('');
  let formName = $state('');
  let formWidth = $state(16);
  let formHeight = $state(16);
  let formImagesetId = $state<number | ''>('');

  // confirm delete
  let showConfirm = $state(false);
  let confirmTargetId = $state('');

  async function load() {
    loading = true;
    try {
      const [cr, pr] = await Promise.all([
        fetch(`${host}/clients`).then((r) => r.json()),
        fetch(`${host}/imagesets`).then((r) => r.json()),
      ]);
      clients = cr;
      playlists = pr;
    } catch (e) {
      toast.error('Failed to load clients');
    }
    loading = false;
  }

  load();

  function openAdd() {
    editingId = null;
    formId = '';
    formName = '';
    formWidth = 16;
    formHeight = 16;
    formImagesetId = '';
    showForm = true;
  }

  function openEdit(c: Client) {
    editingId = c.id;
    formId = c.id;
    formName = c.name ?? '';
    formWidth = c.width;
    formHeight = c.height;
    formImagesetId = c.imagesetId ?? '';
    showForm = true;
  }

  async function saveForm(e: Event) {
    e.preventDefault();
    if (!formId.trim()) { toast.error('ID is required'); return; }
    if (formWidth < 1 || formHeight < 1) { toast.error('Width and height must be > 0'); return; }

    const body: Client = {
      id: formId.trim(),
      name: formName.trim() || undefined,
      width: Number(formWidth),
      height: Number(formHeight),
      pixels: Number(formWidth) * Number(formHeight),
      imagesetId: formImagesetId !== '' ? Number(formImagesetId) : undefined,
    };

    try {
      const r = await fetch(`${host}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error ?? 'Save failed');
      toast.success(editingId ? 'Client updated' : 'Client added');
      showForm = false;
      await load();
    } catch (e: any) {
      toast.error(e.message ?? 'Save failed');
    }
  }

  function confirmDelete(id: string) {
    confirmTargetId = id;
    showConfirm = true;
  }

  async function doDelete() {
    try {
      const r = await fetch(`${host}/clients/${encodeURIComponent(confirmTargetId)}`, {
        method: 'DELETE',
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error ?? 'Delete failed');
      toast.success('Client deleted');
      await load();
    } catch (e: any) {
      toast.error(e.message ?? 'Delete failed');
    }
    showConfirm = false;
  }
</script>

<div class="clients-view">
  <div class="clients-header">
    <h2>Clients</h2>
    <button class="button small" onclick={openAdd}>
      <Fa icon={faAdd} /> Add Client
    </button>
  </div>

  {#if loading}
    <p>Loading…</p>
  {:else if clients.length === 0}
    <p class="empty">No clients yet.</p>
  {:else}
    <table class="client-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Size</th>
          <th>Pixels</th>
          <th>Playlist</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each clients as c (c.id)}
          <tr>
            <td class="id-cell">{c.id}</td>
            <td>{c.name ?? '—'}</td>
            <td>{c.width}&times;{c.height}</td>
            <td>{c.pixels}</td>
            <td>
              {playlists.find((p) => p.id === c.imagesetId)?.name ?? (c.imagesetId != null ? `#${c.imagesetId}` : '—')}
            </td>
            <td class="actions-cell">
              <button class="button small tool" aria-label="Edit client" onclick={() => openEdit(c)}>
                <Fa icon={faPencil} />
              </button>
              <button class="button small tool" aria-label="Delete client" onclick={() => confirmDelete(c.id)}>
                <Fa icon={faTrashCan} />
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<!-- Add / Edit form modal -->
<Modal showCancel={false} bind:showModal={showForm}>
  {#snippet header()}
    <h2>{editingId ? 'Edit Client' : 'Add Client'}</h2>
  {/snippet}
  <form onsubmit={saveForm}>
    <div class="form-control">
      <label for="c-id">ID <span class="small">(used by the LED device)</span></label>
      <input
        id="c-id"
        type="text"
        bind:value={formId}
        placeholder="e.g. OfficeMatrix"
        disabled={editingId !== null || null}
        required
      />
    </div>
    <div class="form-control">
      <label for="c-name">Display Name <span class="small">(optional)</span></label>
      <input id="c-name" type="text" bind:value={formName} placeholder="e.g. Office" />
    </div>
    <div class="form-control inline">
      <label for="c-width">Width</label>
      <input id="c-width" type="number" min="1" max="512" bind:value={formWidth} style="width:5em" />
    </div>
    <div class="form-control inline">
      <label for="c-height">Height</label>
      <input id="c-height" type="number" min="1" max="512" bind:value={formHeight} style="width:5em" />
    </div>
    <div class="form-control">
      <label for="c-playlist">Playlist <span class="small">(optional)</span></label>
      <select id="c-playlist" bind:value={formImagesetId}>
        <option value="">— none —</option>
        {#each playlists as p}
          <option value={p.id}>{p.name ?? `Playlist ${p.id}`}</option>
        {/each}
      </select>
    </div>
    <div class="form-control inline" style="justify-content:flex-end; gap:.5em">
      <button type="button" class="button" onclick={() => (showForm = false)}>
        <Fa icon={faXmark} /> Cancel
      </button>
      <button type="submit" class="button active">
        <Fa icon={faSave} /> Save
      </button>
    </div>
  </form>
</Modal>

<!-- Delete confirm modal -->
<Modal showCancel={false} bind:showModal={showConfirm}>
  {#snippet header()}
    <h2>Delete client?</h2>
  {/snippet}
  <p>Remove <strong>{confirmTargetId}</strong> from the client list?</p>
  <div class="form-control inline" style="justify-content:flex-end; gap:.5em">
    <button class="button" onclick={() => (showConfirm = false)}>Cancel</button>
    <button class="button active" onclick={doDelete}>Delete</button>
  </div>
</Modal>

<style>
  .clients-view {
    width: 100%;
    padding: 1em 0;
  }
  .clients-header {
    display: flex;
    align-items: center;
    gap: 1em;
    margin-bottom: 1em;
  }
  .clients-header h2 {
    margin: 0;
  }
  .empty {
    opacity: 0.6;
  }
  .client-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9em;
  }
  .client-table th,
  .client-table td {
    text-align: left;
    padding: 0.4em 0.6em;
    border-bottom: 1px solid rgba(128, 128, 128, 0.25);
  }
  .client-table th {
    font-size: 0.8em;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.7;
  }
  .id-cell {
    font-family: monospace;
  }
  .actions-cell {
    display: flex;
    gap: 0.25em;
    justify-content: flex-end;
  }
  select {
    padding: 0.3em 0.5em;
    border-radius: 4px;
    font-size: 1em;
    width: 100%;
    max-width: 90%;
  }
</style>
