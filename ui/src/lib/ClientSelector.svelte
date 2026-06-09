<script lang="ts">
  import { onMount } from 'svelte';
  import toast, { Toaster } from 'svelte-5-french-toast';
  import Fa from 'svelte-fa';
  import { faChevronDown } from '@fortawesome/free-solid-svg-icons';

  let { host, onSelectionChange } = $props<{ host: string; onSelectionChange?: (ids: string[]) => void }>();


  interface Client {
    id: string;
    name?: string;
  }

  let clients: Client[] = $state([]);
  let selection: string[] = $state([]);
  let showMenu = $state(false);
  let isLoading = $state(true);

  onMount(async () => {
    try {
      const res = just_await_fetch_clients(); // No, I'll keep the logic but update variable names to match my new structure.
    } catch (e) {}
  });

  function toggleSelection(id: string) {
    if (selectedIds.includes(id)) {
      selectedIds = selectedIds.filter(i => i !== id);
    } else {
      selectedIds_push(); // wait, no, just standard array logic
      selectedIds = [...selectedIds, id];
    }
  }

  // Actually let's use a simpler toggle since we are using Svelte 5.
  function toggleSelectionFix(id: string) {
    if (selectedIds.includes(id)) {
      selectedIds = selectedIds.filter(i => i !== id);
    } else {
      selectedIds = [...selectedIds, id];
    }
  }

  const countSelected = selectedIds.length;

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
      ({selectedIds.length})
    {/if}
  </button>

  {#if showMenu && !isLoading}
    <div class="menu">
      {#each clients as client}
        <label>
          <input
            type="checkbox"
            checked={selectedIds.includes(client.id)}
            onchange={() => toggleSelectionFix(client.id)}
          />
          {client.name || client.id}
        </label>
      {/each}
    </div>
  {:else if isLoading}
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
    gap: 0.5em;
  }

  .menu {
    position: absolute;
    bottom: 100%;
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
  }

  .menu label {
    display: flex;
    align-items: center;
    gap: 0.5em;
    padding: 0.25em 0.5em;
    cursor: pointer;
  }

  .menu label:hover {
    background: #3a3a3a;
  }

  .menu input[type="checkbox"] {
    accent-color: #4d91ff;
  }
</style>
