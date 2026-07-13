<script lang="ts">
  import { onMount } from 'svelte';
  import Fa from 'svelte-fa';
  import { faChevronDown } from '@fortawesome/free-solid-svg-icons';

  let { host, onSelectionChange } = $props<{ host: string; onSelectionChange?: (ids: string[]) => void }>();


  interface Client {
    id: string;
    name?: string;
  }

  let clients: Client[] = $state([]);
  let selectedIds: string[] = $state([]);
  let showMenu = $state(false);
  let isLoading = $state(true);

  onMount(async () => {
    try {
      const res = await fetch(`${host}/clients`).then(r => r.json());
      clients = res;
      isLoading = false;
    } catch (e) {
      console.error('Failed to load clients:', e);
      isLoading = false;
    }
  });

  function toggleSelection(id: string) {
    if (selectedIds.includes(id)) {
      selectedIds = selectedIds.filter(i => i !== id);
    } else {
      selectedIds = [...selectedIds, id];
    }
    if (onSelectionChange) {
      onSelectionChange(selectedIds);
    }
  }

  function toggleMenu() {
    showMenu = !showMenu;
  }
</script>

<div class="client-selector">
  <button
    class="button small tool select-menu"
    onclick={toggleMenu}
    aria-label="Select Clients"
  >
    <Fa icon={faChevronDown} />
    {#if selectedIds.length > 0}
      <span class="badge">{selectedIds.length}</span>
    {/if}
  </button>

  {#if showMenu && !isLoading}
    <div class="menu">
      {#each clients as client}
        <label>
          <input
            type="checkbox"
            checked={selectedIds.includes(client.id)}
            onchange={() => toggleSelection(client.id)}
          />
          {client.name || client.id}
        </label>
      {/each}
    </div>
  {:else if showMenu && isLoading}
    <div class="menu">Loading...</div>
  {/if}
</div>

<style>
  .client-selector {
    position: relative;
    display: inline-block;
  }

  .select-menu {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5em;
    position: relative;
  }

  .menu {
    position: absolute;
    top: 100%;
    left: 0;
    background: #2a2a2a;
    border: 1px solid #444;
    padding: 0.5em;
    min-width: 150px;
    max-height: 300px;
    overflow-y: auto;
    z-index: 1000;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    margin-top: 0.5em;
    width: 150px;
    margin-left: 0;
  }

  .badge {
    position: absolute;
    top: -0.5em;
    right: -0.5em;
    background: #4d91ff;
    color: white;
    border-radius: 50%;
    width: 1.2em;
    height: 1.2em;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8em;
    font-weight: bold;
  }

  .menu label {
    display: flex;
    align-items: center;
    gap: 0.5em;
    padding: 0.25em 0.5em;
    cursor: pointer;
    color: #fff;
  }

  .menu label:hover {
    background: #3a3a3a;
  }

  .menu input[type="checkbox"] {
    accent-color: #4d91ff;
  }
</style>
