<script lang="ts">
  const serverUrl = 'http://192.168.1.35:8080';
  import toast, { Toaster } from 'svelte-5-french-toast';
  import Fa from 'svelte-fa';
  import { faPlay, faStop, faSun } from '@fortawesome/free-solid-svg-icons';
  import svelteLogo from './assets/svelte.svg';
  import viteLogo from '/vite.svg';
  import Counter from './lib/Counter.svelte';
  import Images from './lib/Images.svelte';
  import Clients from './lib/Clients.svelte';
  import Playlists from './lib/Playlists.svelte';

  const views = ['images', 'clients', 'playlists'];
  let activeView = $state(views[0]);
  let brightness = $state(128);

  function changeView(i: number) {
    activeView = views[i];
  }

  function startWledServer(time = -1) {
    fetch(`${serverUrl}/wled/start`)
      .then((r) => r.json())
      .then((d) => {
        if (d.started) {
          toast.success('Running');
        } else {
          toast.error('Not running!');
        }
      })
      .catch((e) => {
        console.error(e);
        toast.error('Failed to start!');
      });
  }

  function stopWledServer(time = -1) {
    fetch(`${serverUrl}/wled/stop`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.started) {
          toast.success('Stopped');
        } else {
          toast.error('Still running!');
        }
      })
      .catch((e) => {
        console.error(e);
        toast.error('Failed to stop!');
      });
  }

  function setBrightness(val = 128) {
    fetch(`${serverUrl}/wled/brightness?brightness=${val}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.updated) {
          toast.success('Brightness set');
        } else {
          toast.error('Brightness not set!');
        }
      })
      .catch((e) => {
        console.error(e);
        toast.error('Failed to set brightness!');
      });
  }
</script>

<section class="header">
  <h1>Pixel Art Server Admin</h1>
  <div class="wled-global">
    <button
      aria-label="Start Playing on WLED"
      onclick={() => {
        startWledServer();
      }}
      class="button small tool"
    >
      <Fa icon={faPlay} />
    </button>
    <button
      aria-label="Stop Playing on WLED"
      onclick={() => {
        stopWledServer();
      }}
      class="button small tool"
    >
      <Fa icon={faStop} />
    </button>

    <input type="range" min="0" max="255" bind:value={brightness} />
    <button
      aria-label="Set WLED Brightness"
      onclick={() => {
        setBrightness(brightness);
      }}
      class="button small tool"
    >
      <Fa icon={faSun} />
    </button>
  </div>
  <nav>
    {#each views as v, i}
      <button
        onclick={() => changeView(i)}
        class="nav-item button {activeView == v ? 'active' : ''}">{v}</button
      >
    {/each}
  </nav>
</section>
<main data-view={activeView}>
  <section class="views">
    <div
      class="view{activeView == 'images' ? ' active' : ''}"
      data-view="images"
    >
      <Images host={serverUrl} />
    </div>
    <div
      class="view{activeView == 'clients' ? ' active' : ''}"
      data-view="clients"
    >
      <Clients host={serverUrl} />
    </div>
    <div
      class="view{activeView == 'playlists' ? ' active' : ''}"
      data-view="playlists"
    >
      <Playlists host={serverUrl} />
    </div>
  </section>
</main>

<Toaster />

<style>
</style>
