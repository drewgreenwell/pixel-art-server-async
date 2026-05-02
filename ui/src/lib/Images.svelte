<script lang="ts">
  import toast, { Toaster } from 'svelte-5-french-toast';
  import { dndzone, TRIGGERS } from 'svelte-dnd-action';
  import Fa from 'svelte-fa';
  import mirrorIcon from '../assets/mirror.svg';
  import paintbrush from '../assets/paintbrush.svg';
  import paintbucket from '../assets/paintbucket.svg';
  import type {
    ImageStat,
    ImageData,
    UploadResult,
    ImageRow,
    Item,
    Tools,
  } from './DataTypes';
  import { ConfirmType } from './DataTypes';
  import {
    faUndo,
    faArrowRight,
    faArrowLeft,
    faCodeMerge,
    faAdd,
    faRotateRight,
    faRotateLeft,
    faMinus,
    faArrowsLeftRight,
    faPlay,
    faPause,
    faFillDrip,
    faPaintBrush,
    faSave,
    faArrowsUpDownLeftRight,
    faArrowUp,
    faArrowDown,
    faTrashCan,
    faArrowTurnUp,
    faEye,
  } from '@fortawesome/free-solid-svg-icons';

  import Modal from './Modal.svelte';
  import MouseCursor from './MouseCursor.svelte';
  import FrameCanvas from './FrameCanvas.svelte';
  import { flipRegionHorizontal, flipRegionVertical } from './ImageOperations';

  let showSaveModal = $state(false);
  let showConfirmModal = $state(false);
  let showFrameModal = $state(false);
  let confirmTitle = $state('');
  let confirmMessage = $state('');
  let confirmCancelText = $state('cancel');
  let confirmOkText = $state("Yes, I'm sure");

  let confirmAction: () => void = $state(() => {});
  const userConfirm = (confirmType: ConfirmType, action: () => void) => {
    switch (confirmType) {
      case ConfirmType.Save:
        confirmTitle = 'Unsaved changes!';
        confirmMessage = 'Are you sure you want to continue?';
        break;
      case ConfirmType.Delete:
        confirmTitle = 'Delete image?';
        confirmMessage = 'Are you sure you want to delete this image?';
        break;
      default:
        console.error(`Confirm type: ${confirmType}`);
    }
    confirmAction = action;
    showConfirmModal = true;
  };
  const closeModal = () => {
    showSaveModal = false;
    showConfirmModal = false;
    let dialogs = document.querySelectorAll('dialog');
    if (dialogs.length) {
      for (let d of dialogs) {
        d.close();
      }
    }
  };

  let { host } = $props();

  let images: ImageStat[] = $state([]);

  let activeImage: ImageData | null = $state(null);
  // temp image for frame imports
  let frameImage: ImageData | null = $state(null);

  let activeFrame: ImageRow[] = $derived.by(() => {
    let rows: ImageRow[] = [];
    if (activeImage) {
      let start = activeImage.meta.height * activeFrameIdx;
      rows = activeImage.rows.slice(start, start + activeImage.meta.height);
    }
    return rows;
  });

  const getImages: () => Promise<ImageStat[]> = () => {
    console.log('get images');
    return new Promise<ImageStat[]>((resolve, reject) => {
      fetch(host + '/images')
        .then((r) => r.json())
        .then((d) => {
          console.log({ images: d });
          images = d;
          resolve(d);
        })
        .catch((err) => {
          console.error(err);
          reject(err);
        });
    });
  };

  let tools: Tools = $state({
    moving: false,
    movingAll: false,
    playing: false,
    paintBrush: false,
    paintBucket: false,
  });
  function transformDraggedElement(draggedEl: any, data: any, index: any) {
    draggedEl.style.borderRadius = '50%';
    draggedEl.style.height = '50px';
    draggedEl.style.width = '50px';
    draggedEl.style.overflow = 'hidden';
  }

  function handlePaletteDrop(e: {
    detail: { items: Item[]; info: { trigger: any } };
  }) {
    dragItems = e.detail.items.sort((a, b) => a.id - b.id);
    // todo, add override
    console.log(e);
    return;
    const {
      detail: {
        items: newItems,
        info: { trigger },
      },
    } = e;
    console.warn({ trigger });
  }

  function handlePaletteSort(e: any) {
    console.log(e);
    dragItems = e.detail.items.sort((a: Item, b: Item) => a.id - b.id);
    return;
  }

  function setPalette(i: number) {
    if (activePaletteIdx == i) {
      activePaletteIdx = -1;
      tools.paintBrush = false;
      tools.paintBucket = false;
    } else {
      activePaletteIdx = i;
    }
    if (activePaletteIdx > -1 && activeImage != null) {
      activePaletteColor.set(currentPalette[i]);
    }
  }

  let currentPalette: string[] = $state([]);
  let highlightColor: string = $state('#0000FF');
  // let paletteSizes = [4, 8, 16, 24, 32, 48, 64, 72, 96, 128, 172, 196, 256];
  // let currentPaletteSize = $state(paletteSizes[12]);
  let activePaletteIdx = $state(-1);
  let imageDirty = $state(false);
  let dragItems: Item[] = $state([]);

  let activePaletteColor = $state({
    get: () => {
      return '#' + _activePalColor;
    },
    set: (color: string) => {
      if (activeImage == null || activePaletteIdx == -1) return color;
      let newColor = color;
      if (newColor && newColor.length) {
        if (newColor.startsWith('#')) {
          newColor = newColor.substring(1);
        }
        _activePalColor = newColor;
      }
      if (currentPalette[activePaletteIdx] != newColor) {
        currentPalette[activePaletteIdx] = newColor;
        let dragItem = dragItems.find((itm) => itm.id == activePaletteIdx);
        if (dragItem) {
          dragItem.color = newColor;
        }
        imageDirty = true;
      }
      return color;
    },
  });
  let _activePalColor = $state('#FF0000');
  let activeFrameIdx = $state(0);
  let pixelIdx = 0;

  const getImage: (id: string) => void = (id) => {
    stopPlaying();
    closeTools();
    pixelIdx = 0;
    activePaletteIdx = -1;
    activeFrameIdx = 0;
    currentPalette = [];
    dragItems = [];
    imageDirty = false;
    saveName = id;
    console.log('get images');
    fetch(`${host}/api/image/pixels?height=32&width=32&image_path=${id}`)
      .then((r) => r.json())
      .then((d) => {
        console.log(d);
        loadImage(d);
      })
      .catch((err) => {
        debugger;
        console.error(err);
      });
  };

  const deleteImage: () => void = () => {
    if (!activeImage) return;
    const path = activeImage.meta.path;
    fetch(`${host}/delete-image?image_path=${path}`, {
      method: 'DELETE',
    })
      .then((r) => r.json())
      .then((d) => {
        console.log(d);
        activeImage = null;
        const idx = images.findIndex((img) => img.id == path);
        if (idx != -1) {
          images.splice(idx, 1);
        }
        toast.success('Image Deleted');
      })
      .catch((err) => {
        debugger;
        console.error(err);
        toast.error('Could not delete image!');
      });
  };

  function addPaletteColor() {
    if (!activeImage) return;
    currentPalette.push('00FF00');
    loadPalette(currentPalette);
  }

  function pixelClick(index: number, x: number, y: number, pixel: number) {
    if (tools.paintBrush) {
      setPixelColor(y, x, activePaletteIdx);
    } else if (tools.paintBucket) {
      updatePaletteColorForFrame(pixel, activePaletteIdx);
    } else {
      setPalette(pixel);
    }
  }

  function loadPalette(p: string[]) {
    currentPalette = p;
    dragItems = currentPalette.map((color, i) => ({
      id: i,
      color: color,
    }));
  }

  function loadImage(d: ImageData) {
    loadPalette(d.palette);
    activeImage = d;
  }

  let wledjson: string = $state('');

  function loadJson(event: Event & { currentTarget: HTMLButtonElement }) {
    console.log(event);
  }

  let saveSubdir: string = $state('');
  let saveName: string = $state('');

  function upLoadJson(event: Event & { currentTarget: HTMLButtonElement }) {
    console.log(event);
    event.preventDefault();
    // build json
    let image = $state.snapshot(activeImage);
    if (image == null) {
      toast.error('Current image is null!');
      return;
    }
    let palette = $state.snapshot(currentPalette);
    if (!Array.isArray(palette)) {
      toast.error('Palette is empty or nor formatted properly!');
      return;
    }
    image.palette = palette;
    let body = {
      newname: saveName,
      subdir: saveSubdir,
      data: image,
    };
    let imgJson = JSON.stringify(body);
    // post to server
    const url = host + '/upload-json';

    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: imgJson,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((d) => {
        if (!d.success) {
          throw new Error(`Save failed: ${d.message}`);
        }
        if (!images.find((f) => f.id === d.stat.id)) {
          images.push(d.stat);
        } else {
          console.log('reload images');
          let temp = $state.snapshot(images);
          images = temp;
        }
        closeModal();
        toast.success('Image Saved');
        getImage(d.stat.id);
      })
      .catch((err) => {
        console.error(err);
        toast.error(err?.message ?? 'An error ocurred while saving');
      });
  }

  let fileInput: HTMLInputElement;
  let files: any = $state(null);
  let subdirectory = $state('');
  const uploadImages = (
    event: Event & { currentTarget: HTMLButtonElement },
    editOnly: boolean = false,
    frameInsert: boolean = false,
  ) => {
    event.preventDefault();
    if (files.length == 0) {
      return false;
    }
    let formData = new FormData();
    //for (let i = 0; i < files.length; i++) {
    //  formData.append('files', files[i]);
    //}
    formData.append('file', files[0]);
    formData.append('subdir', !editOnly ? subdirectory : '');
    const path = editOnly ? '/edit-file' : '/upload';
    fetch(host + path, {
      method: 'POST',
      body: formData,
    })
      .then((r) => r.json())
      .then((d: UploadResult) => {
        console.log(d);
        if (!d.success) {
          toast.error('Could not upload file!' + d.error);
          return;
        }
        if (editOnly) {
          if (d.stats.data) {
            if (!frameInsert) {
              loadImage(d.stats.data);
              imageDirty = true;
              saveName = d.stats.data.meta.path;
            } else {
              frameImage = d.stats.data;
              showFrameModal = true;
            }
          } else {
            toast.error('Data was not returned for edit!');
          }
        } else {
          // add image to list
          if (!images.find((f) => f.id === d.stats.id)) {
            images.push({
              id: d.stats.id,
              path: d.stats.path,
              created: new Date(),
              width: d.stats.width,
              height: d.stats.height,
              format: d.stats.format,
            });
          }
        }
        fileInput.value = '';
        toast.success(d.message);
      })
      .catch((err) => {
        console.error(err);
        toast.error('Could not upload file! ' + err.message);
      });
  };

  const editImage = (
    event: Event & { currentTarget: HTMLButtonElement },
    editOnly: boolean = false,
  ) => {
    event.preventDefault();
    if (files.length == 0) {
      return false;
    }
    let formData = new FormData();
    //for (let i = 0; i < files.length; i++) {
    //  formData.append('files', files[i]);
    //}
    formData.append('file', files[0]);
    formData.append('subdir', !editOnly ? subdirectory : '');
    const path = editOnly ? '/edit-file' : '/upload';
    fetch(host + path, {
      method: 'POST',
      body: formData,
    })
      .then((r) => r.json())
      .then((d: UploadResult) => {
        console.log(d);
        if (!d.success) {
          toast.error('Could not upload file!' + d.error);
          return;
        }
        if (d.stats.data) {
          loadImage(d.stats.data);
          imageDirty = true;
          saveName = d.stats.data.meta.path;
        } else {
          toast.error('Data was not returned for edit!');
        }

        fileInput.value = '';
        toast.success(d.message);
      })
      .catch((err) => {
        console.error(err);
        toast.error('Could not upload file! ' + err.message);
      });
  };

  function showImageOnWled() {
    if (!activeImage) return;
    // post the active image data if dirty
    let opts = imageDirty
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activeImage),
        }
      : {};
    fetch(`${host}/wled/show-image?name=${activeImage.meta.path}`, opts)
      .then((r) => r.json())
      .then((d) => {
        if (d.loaded) {
          toast.success('Showing Image!');
        } else if (d.error) {
          toast.error('Show did not succeed: ' + d.error);
        } else {
          toast.error('Show did not succeed!');
        }
      })
      .catch((e) => {
        console.error(e);
        toast.error('Failed to show!');
      });
  }

  function closeTools() {
    let exclude = 'playing';
    for (let k of Object.keys(tools)) {
      if (k === exclude) continue;
      if (k in tools) {
        let key = k as keyof typeof tools;
        tools[key] = false;
      }
    }
  }

  function shiftPixelsInFrame(left = true, frameIndex: number) {
    if (!activeImage) {
      toast.error('No image loaded');
      return;
    }
    const shift = (frame: number) => {
      if (!activeImage) return;
      const num_of_rows = activeImage.meta.height;
      let start = num_of_rows * frame;
      let end = start + num_of_rows;
      for (let i = start; i < end; i++) {
        let row = activeImage.rows[i];
        if (left) {
          row.pixels.push(row.pixels.shift() ?? 0);
        } else {
          let pxl = row.pixels.pop() ?? 0;
          row.pixels.unshift(pxl);
        }
      }
    };
    if (frameIndex == -1) {
      for (let i = 0; i < activeImage.meta.frames; i++) {
        shift(i);
      }
    } else {
      shift(frameIndex);
    }
    imageDirty = true;
  }

  function shiftPixelRowsInFrame(up = true, frameIndex: number) {
    if (!activeImage) {
      toast.error('No image loaded');
      return;
    }
    const shift = (frame: number) => {
      if (!activeImage) return;
      const num_of_rows = activeImage.meta.height;
      let start = num_of_rows * frame;
      let end = start + (num_of_rows - 1);
      let begin = up ? start : end;
      let finish = up ? end : start;
      const [row] = activeImage.rows.splice(begin, 1);
      activeImage.rows.splice(finish, 0, row);
      //activeImage.rows[start].row = start;
      //activeImage.rows[end].row = end;
    };
    if (frameIndex == -1) {
      for (let i = 0; i < activeImage.meta.frames; i++) {
        shift(i);
      }
    } else {
      shift(frameIndex);
    }
    imageDirty = true;
  }

  function removeFrameFromCurrentImage() {
    if (!activeImage) {
      toast.error('No image loaded');
      return;
    }
    let image = $state.snapshot(activeImage);
    const num_of_rows = image.meta.height;
    let start = num_of_rows * activeFrameIdx;
    //let startFrame = image.rows[start].frame;
    let new_rows = image.rows.slice(activeFrameIdx * num_of_rows, num_of_rows);
    let frame = -1;
    // for (let i = 0; i < new_rows.length; i++) {
    //   if (i % num_of_rows == 0) {
    //     frame++;
    //   }
    //   let r = new_rows[i];
    //   r.row = i;
    //   r.frame = frame;
    // }
    activeImage.meta.frames = activeImage.meta.frames - 1;
    activeImage.rows = new_rows;
    activeFrameIdx = Math.max(0, activeFrameIdx - 1);
    imageDirty = true;
  }

  function addFrameToCurrentImage() {
    if (!activeImage) {
      toast.error('No image loaded');
      return;
    }
    let image = $state.snapshot(activeImage);
    const num_of_rows = image.meta.height;
    let start = num_of_rows * activeFrameIdx;
    // let startFrame = image.rows[start].frame;
    let end = start + num_of_rows;
    let new_rows = [
      ...structuredClone(image.rows.slice(0, end)), // everything including current frame
      ...structuredClone(image.rows.slice(start, end)), // copy of current frame
      ...structuredClone(image.rows.slice(end)), // everything else
    ];
    // let frame = -1;
    // for (let i = 0; i < new_rows.length; i++) {
    //   if (i % num_of_rows == 0) {
    //     frame++;
    //   }
    //   let r = new_rows[i];
    //   r.row = i;
    //   r.frame = frame;
    // }
    activeImage.meta.frames = activeImage.meta.frames + 1;
    console.log('image now has ' + activeImage.meta.frames + ' frames');
    activeImage.rows = new_rows;
    activeFrameIdx++;
    imageDirty = true;
  }

  function flipFrame(
    horizontal: boolean = true,
    frameIndex: number,
    size: number = 0,
    offsetX: number = 0,
    offsetY: number = 0,
  ) {
    if (!activeImage) {
      toast.error('No image loaded');
      return;
    }

    const image = $state.snapshot(activeImage);
    const regionSize = size > 0 ? size : image.meta.width;

    const flip = (frame: number) => {
      const height = image.meta.height;
      const width = image.meta.width;
      const start = frame * height;

      const pixels = image.rows
        .slice(start, start + height)
        .map((r) => r.pixels);

      if (horizontal) {
        flipRegionHorizontal(pixels, offsetX, offsetY, regionSize);
      } else {
        flipRegionVertical(pixels, offsetX, offsetY, regionSize);
      }

      // write back
      for (let i = 0; i < height; i++) {
        image.rows[start + i].pixels = pixels[i];
      }
    };

    if (frameIndex === -1) {
      for (let i = 0; i < image.meta.frames; i++) {
        flip(i);
      }
    } else {
      flip(frameIndex);
    }

    activeImage.rows = image.rows;
    imageDirty = true;
  }
  // function flipFrame(horizontal: boolean = true, frameIndex: number) {
  //   if (!activeImage) {
  //     toast.error('No image loaded');
  //     return;
  //   }
  //   if (horizontal) {
  //     for (let r of activeImage.rows) {
  //       if (frameIndex == -1 || r.frame == frameIndex) {
  //         r.pixels.reverse();
  //       }
  //     }
  //   } else {
  //     const flipFrameVertical = (frame: number) => {
  //       if (!activeImage) return;
  //       const num_of_rows = activeImage.meta.height;
  //       let start = num_of_rows * frame;
  //       const rows = activeImage.rows.slice(start, start + num_of_rows);
  //       rows.reverse();
  //       for (let i = 0; i < rows.length; i++) {
  //         let r = rows[i];
  //         r.row = start + i;
  //       }
  //       activeImage.rows.splice(start, num_of_rows);
  //       activeImage.rows.splice(start, 0, ...rows);
  //     };
  //     if (frameIndex == -1) {
  //       for (let i = 0; i < activeImage.meta.frames; i++) {
  //         flipFrameVertical(i);
  //       }
  //     } else {
  //       flipFrameVertical(frameIndex);
  //     }
  //   }
  //   imageDirty = true;
  // }

  function rotateFrame(
    clockwise: boolean = true,
    frameIndex: number,
    size: number = 0,
    x: number = 0,
    y: number = 0,
  ) {
    if (!activeImage) {
      toast.error('No image loaded');
      return;
    }
    let image = $state.snapshot(activeImage);

    const rotate = (
      frame: number,
      height: number,
      width: number,
      regionSize: number = 0,
      offsetY: number = 0,
      offsetX: number = 0,
    ) => {
      const num_of_rows = height;
      const num_of_cols = width;
      let start = num_of_rows * frame;
      const rows = image.rows.slice(start, start + num_of_rows);

      const pixels = rows.map((r, i) => {
        return r.pixels;
      });
      const rotated = pixels.map((row) => [...row]);

      for (let i = offsetY; i < offsetY + regionSize; i++) {
        for (let j = offsetX; j < offsetX + regionSize; j++) {
          if (clockwise) {
            rotated[offsetY + (j - offsetX)][
              offsetX + (regionSize - 1 - (i - offsetY))
            ] = pixels[i][j];
          } else {
            rotated[offsetY + (regionSize - 1 - (j - offsetX))][
              offsetX + (i - offsetY)
            ] = pixels[i][j];
          }
        }
      }
      for (let i = start; i < start + num_of_rows; i++) {
        image.rows[i].pixels = rotated[i % num_of_rows];
      }
    };

    size > 0 ? size : image.meta.height;

    if (frameIndex == -1) {
      for (let i = 0; i < activeImage.meta.frames; i++) {
        rotate(i, image.meta.height, image.meta.width, size, x, y);
      }
    } else {
      rotate(frameIndex, image.meta.height, image.meta.width, size, x, y);
    }

    activeImage.rows = image.rows;
    imageDirty = true;
  }

  function nextFrame() {
    if (activeFrameIdx < (activeImage?.meta.frames ?? 0) - 1) {
      activeFrameIdx++;
    } else {
      activeFrameIdx = 0;
    }
  }

  function previousFrame() {
    if (activeFrameIdx > 0) {
      activeFrameIdx--;
    } else {
      activeFrameIdx = (activeImage?.meta.frames ?? 1) - 1;
    }
  }

  function numbersOnly(e: any) {
    if (e.target != null) {
      let target = <HTMLInputElement>e.target;
      let value = target.value;
      const cursorPosition = target.selectionStart || value.length;
      const originalLength = value.length;
      value = value.replace(/[^0-9]/g, '');
      target.value = value;
      const newLength = value.length;
      const lengthDifference = originalLength - newLength;
      const newCursorPosition = cursorPosition - lengthDifference;
      target.setSelectionRange(newCursorPosition, newCursorPosition);
    }
  }

  let timeout: number | null = $state(null);
  function togglePlay() {
    if (!tools.playing) {
      startPlaying();
    } else {
      stopPlaying();
    }
  }

  function startPlaying() {
    stopPlaying();
    tools.playing = true;
    frameHandler();
  }

  function stopPlaying() {
    tools.playing = false;
    if (timeout != null) {
      clearTimeout(timeout);
    }
  }
  function frameHandler() {
    if (
      activeImage == null ||
      activeImage.rows.length < activeFrameIdx * activeImage.meta.height
    ) {
      return;
    }
    timeout = setTimeout(
      () => {
        nextFrame();
        frameHandler();
      },
      activeImage.meta.durations[activeFrameIdx], // .rows[activeFrameIdx * activeImage.meta.height].duration,
    );
  }

  function setPixelColor(row: number, col: number, newIndex: number) {
    console.log({ row, col, newIndex });
    if (!activeImage || col === -1 || row === -1) return;
    console.log('ready');
    const h = activeImage.meta.height;
    if (row > h - 1 || col > activeImage.meta.width - 1) return;
    console.log('set');
    const offset = h * activeFrameIdx;
    activeImage.rows[row + offset].pixels[col] = newIndex;
    console.log('goo!', { offset, row, col, newIndex });
    imageDirty = true;
  }

  function updatePaletteColorForFrame(currentIndex: number, newIndex: number) {
    if (!activeImage) return;
    if (currentIndex === -1 || newIndex === -1) return;
    for (let y = 0; y < activeFrame.length; y++) {
      let row = activeFrame[y];
      let pixels = [];
      for (let x = 0; x < row.pixels.length; x++) {
        pixels[x] = row.pixels[x] === currentIndex ? newIndex : row.pixels[x];
      }
      let offset = activeFrameIdx * activeImage.meta.height;
      activeImage.rows[y + offset].pixels = pixels;
    }
    imageDirty = true;
  }
</script>

<div class="images subview active">
  <div class="image-selector">
    {#await getImages()}
      loading..
    {:then result}
      <div class="image-list">
        {#each images as img, i}
          <button
            onclick={() => {
              imageDirty
                ? userConfirm(ConfirmType.Save, () => {
                    getImage(img.id);
                  })
                : getImage(img.id);
            }}
            class="image-item"
          >
            <img src={host + img.path} alt={img.id} loading="lazy" />
          </button>
        {/each}
      </div>
    {/await}
    <div class="add-image">
      <form>
        <h2>Add an image</h2>
        <div class="form-control">
          <label for="subdir"
            >Subdirectory <span class="small">(optional)</span></label
          >
          <input
            id="subdir"
            name="subdir"
            type="text"
            placeholder="Folder for grouping"
            bind:value={subdirectory}
          />
        </div>
        <div class="form-control">
          <label for="imageUpload">Select Image</label>
          <input
            id="imageUpload"
            name="imageUpload"
            type="file"
            bind:files
            bind:this={fileInput}
            autocomplete="off"
            tabindex="-1"
          />
        </div>
        <!-- <div class="filedropzone" onclick={() => {fileInput.click()}}>
        <input 
          multiple 
          type="file"
           bind:files
           bind:this={fileInput}
           style="display: none;"
           autocomplete="off" 
           tabindex="-1" />
        <div class="c-filedropzone-inner">
          <p>Drag files here, or click to select files</p>
          <div class="upload"></div>
        </div>
      </div> -->
        <div class="form-control inline">
          <button
            class="button"
            disabled={!files || !files.length || null}
            onclick={(event) => uploadImages(event, false)}>Upload</button
          >
          <button
            class="button"
            disabled={!files || !files.length || null}
            onclick={(event) => uploadImages(event, true)}>Edit</button
          >
        </div>
        <div class="form-control inline">
          <button
            class="button"
            disabled={!activeImage || !files || !files.length || null}
            onclick={(event) => uploadImages(event, true, true)}
            >Insert Frame</button
          >
        </div>
      </form>
    </div>
    <div class="add-json">
      <form>
        <h2>Import WLED JSON</h2>
        <div class="form-control">
          <label for="wledjson" class="small">
            Import JSON directly from WLED.
          </label>
          <textarea
            id="wledjson"
            name="wledjson"
            placeholder="Paste JSON"
            bind:value={wledjson}
          ></textarea>
        </div>
        <!-- <div class="filedropzone" onclick={() => {fileInput.click()}}>
        <input 
          multiple 
          type="file"
           bind:files
           bind:this={fileInput}
           style="display: none;"
           autocomplete="off" 
           tabindex="-1" />
        <div class="c-filedropzone-inner">
          <p>Drag files here, or click to select files</p>
          <div class="upload"></div>
        </div>
      </div> -->
        <div class="form-control inline small">
          <button
            class="button"
            disabled={!wledjson.length || null}
            onclick={(event) => loadJson(event)}>New Image</button
          >
          <button
            class="button"
            disabled={!wledjson.length || null}
            onclick={(event) => loadJson(event)}>New Frame</button
          >
        </div>
      </form>
    </div>
  </div>
  <div class="image-main">
    {#if activeImage}
      <div class="image-tools">
        <button
          aria-label="Flip Image Horizontally"
          onclick={() => {
            flipFrame(true, -1);
          }}
          class="button small tool"
        >
          <img src={mirrorIcon} alt="mirror" height="20" width="20" />
          <!-- <Fa icon={faArrowsLeftRight} /> -->
        </button>
        <button
          aria-label="Flip Image Vertically"
          onclick={() => {
            flipFrame(false, -1);
          }}
          class="button small tool"
        >
          <!-- <Fa icon={faArrowsLeftRight} rotate="-90" /> -->
          <img
            class="rotate-90"
            src={mirrorIcon}
            alt="mirror"
            height="20"
            width="20"
          />
        </button>
        <button
          aria-label="Rotate Image Clockwise"
          onclick={() => {
            rotateFrame(true, -1, 10, 10, 10);
          }}
          class="button small tool"
        >
          <Fa icon={faRotateRight} />
        </button>
        <button
          aria-label="Rotate Image Counter Clockwise"
          onclick={() => {
            rotateFrame(false, -1);
          }}
          class="button small tool"
        >
          <Fa icon={faRotateLeft} />
        </button>
        <div class="form-control inline">
          <div
            class="move-button-wrap"
            style="--highlightcolor:{highlightColor}"
            style:backgroundColor={tools.movingAll ? 'rgba(0,0,0,0.3)' : null}
          >
            <button
              aria-label="Pan Frame"
              onclick={() => {
                tools.movingAll = !tools.movingAll;
                //if (tools.movingAll) {
                //  stopPlaying();
                //}
              }}
              class="button small tool toggle {tools.movingAll ? 'active' : ''}"
            >
              <Fa icon={faArrowsUpDownLeftRight} />
            </button>
            <button
              aria-label="Move Up"
              onclick={() => {
                shiftPixelRowsInFrame(true, -1);
              }}
              class="button small tool move move-up"
              style:display={tools.movingAll ? 'block' : 'none'}
            >
              <Fa icon={faArrowUp} />
            </button>
            <button
              aria-label="Move Down"
              onclick={() => {
                shiftPixelRowsInFrame(false, -1);
              }}
              class="button small tool move move-down"
              style:display={tools.movingAll ? 'block' : 'none'}
            >
              <Fa icon={faArrowDown} />
            </button>
            <button
              aria-label="Move Left"
              onclick={() => {
                shiftPixelsInFrame(true, -1);
              }}
              class="button small tool move move-left"
              style:display={tools.movingAll ? 'block' : 'none'}
            >
              <Fa icon={faArrowLeft} />
            </button>
            <button
              aria-label="Move Right"
              onclick={() => {
                shiftPixelsInFrame(false, -1);
              }}
              class="button small tool move move-right"
              style:display={tools.movingAll ? 'block' : 'none'}
            >
              <Fa icon={faArrowRight} />
            </button>
          </div>
        </div>
        <button
          class="button small tool"
          disabled={activeImage == null ||
            activePaletteIdx == -1 ||
            currentPalette[activePaletteIdx] ==
              activeImage.palette[activePaletteIdx]}
          onclick={() => {
            if (activeImage != null) {
              currentPalette[activePaletteIdx] =
                activeImage.palette[activePaletteIdx];
            }
          }}
        >
          <Fa rotate="-90" icon={faArrowTurnUp} />
        </button>
        <button
          aria-label="Save Image"
          onclick={() => {
            showSaveModal = true;
          }}
          class="button small tool"
          disabled={tools.playing || !imageDirty}
        >
          <Fa icon={faSave} />
        </button>
        <button
          aria-label="Delete Image"
          onclick={() => {
            userConfirm(ConfirmType.Delete, () => deleteImage());
          }}
          class="button small tool"
          disabled={tools.playing}
        >
          <Fa icon={faTrashCan} />
        </button>
        <button
          aria-label="Delete Image"
          onclick={() => {
            showImageOnWled();
          }}
          class="button small tool"
        >
          <Fa icon={faEye} />
        </button>
      </div>

      <div
        class="pixel-grid {tools.paintBrush
          ? 'painting paint-brush'
          : null} {tools.paintBucket ? 'painting paint-bucket' : null}"
        style="--highlightcolor:{highlightColor}; --paintbrushurl:url({paintbucket}); --paintbucketurl:url({paintbrush});"
      >
        <!-- {#each { length: activeImage.meta.frames } as _, f} -->
        <!-- class="frame{f == activeFrameIdx ? ' active' : ''}" -->
        <div class="frame active" data-frame={activeFrameIdx}>
          {#each activeFrame as row, y}
            {#each row.pixels as pixel, x}
              {@const idx = pixelIdx++}
              <button
                class="pixel{activePaletteIdx == pixel ? ' active' : null}"
                onclick={() => {
                  pixelClick(pixelIdx, x, y, pixel);
                }}
                aria-label="Pixel {idx}"
                data-pixel={idx}
                style:background-color={currentPalette.length > pixel
                  ? '#' + currentPalette[pixel]
                  : null}
                data-palette-id={pixel}
              >
                &nbsp;
              </button>
            {/each}
          {/each}
        </div>
        <!-- {/each} -->
      </div>
    {/if}
  </div>
  <div class="image-options small">
    {#if activeImage != null}
      <div class="animation-tools">
        <div class="form-control inline">
          <label for="previousFrame">
            Frame {activeFrameIdx + 1} of {activeImage.meta.frames}
          </label>
          <button
            id="previousFrame"
            name="previousFrame"
            onclick={() => {
              previousFrame();
            }}
            disabled={tools.playing || activeImage.meta.frames <= 1}
            class="button small tool"><Fa icon={faArrowLeft} /></button
          >
          <button
            id="nextFrame"
            name="nextFrame"
            onclick={() => {
              nextFrame();
            }}
            disabled={tools.playing || activeImage.meta.frames <= 1}
            class="button small tool"><Fa icon={faArrowRight} /></button
          >
          <button
            aria-label="Add Frame"
            onclick={() => {
              addFrameToCurrentImage();
            }}
            disabled={tools.playing}
            class="button small tool"
          >
            <Fa icon={faAdd} />
          </button>
        </div>
        <div class="form-control inline">
          <label for="frameduration"> Duration (ms) </label>
          <input
            class="small"
            type="text"
            oninput={(e) => {
              numbersOnly(e);
            }}
            placeholder="420"
            disabled={tools.playing || activeImage.meta.frames <= 1}
            onchange={() => (imageDirty = true)}
            bind:value={activeImage.meta.durations[activeFrameIdx]}
          />
          <button
            aria-label={tools.playing ? 'Pause' : 'Play'}
            disabled={activeImage.meta.frames <= 1 || tools.moving}
            onclick={() => {
              togglePlay();
            }}
            class="button small tool"
          >
            {#if tools.playing}
              <Fa icon={faPause} />
            {:else}
              <Fa icon={faPlay} />
            {/if}
          </button>
          <button
            aria-label="Remove Frame"
            disabled={tools.playing || activeImage.meta.frames <= 1}
            onclick={() => {
              removeFrameFromCurrentImage();
            }}
            class="button small tool"
          >
            <Fa icon={faMinus} />
          </button>
        </div>
        <div class="form-control inline">
          <div
            class="move-button-wrap"
            style="--highlightcolor:{highlightColor}"
            style:backgroundColor={tools.moving ? 'rgba(0,0,0,0.3)' : null}
          >
            <button
              aria-label="Pan Frame"
              onclick={() => {
                tools.moving = !tools.moving;
                if (tools.moving) {
                  stopPlaying();
                }
              }}
              class="button small tool toggle {tools.moving ? 'active' : ''}"
              disabled={tools.playing}
            >
              <Fa icon={faArrowsUpDownLeftRight} />
            </button>
            <button
              aria-label="Move Up"
              onclick={() => {
                shiftPixelRowsInFrame(true, activeFrameIdx);
              }}
              class="button small tool move move-up"
              style:display={tools.moving ? 'block' : 'none'}
              disabled={tools.playing}
            >
              <Fa icon={faArrowUp} />
            </button>
            <button
              aria-label="Move Down"
              onclick={() => {
                shiftPixelRowsInFrame(false, activeFrameIdx);
              }}
              class="button small tool move move-down"
              style:display={tools.moving ? 'block' : 'none'}
              disabled={tools.playing}
            >
              <Fa icon={faArrowDown} />
            </button>
            <button
              aria-label="Move Left"
              onclick={() => {
                shiftPixelsInFrame(true, activeFrameIdx);
              }}
              class="button small tool move move-left"
              style:display={tools.moving ? 'block' : 'none'}
              disabled={tools.playing}
            >
              <Fa icon={faArrowLeft} />
            </button>
            <button
              aria-label="Move Right"
              onclick={() => {
                shiftPixelsInFrame(false, activeFrameIdx);
              }}
              class="button small tool move move-right"
              style:display={tools.moving ? 'block' : 'none'}
              disabled={tools.playing}
            >
              <Fa icon={faArrowRight} />
            </button>
          </div>
          <button
            aria-label="Flip Frame Horizontally"
            onclick={() => {
              flipFrame(true, activeFrameIdx);
            }}
            class="button small tool"
            disabled={tools.playing}
          >
            <img src={mirrorIcon} alt="mirror" height="20" width="20" />
            <!-- <Fa icon={faArrowsLeftRight} /> -->
          </button>
          <button
            aria-label="Flip Frame Vertically"
            onclick={() => {
              flipFrame(false, activeFrameIdx);
            }}
            class="button small tool"
            disabled={tools.playing}
          >
            <!-- <Fa icon={faArrowsLeftRight} rotate="-90" /> -->
            <img
              class="rotate-90"
              src={mirrorIcon}
              alt="mirror"
              height="20"
              width="20"
            />
          </button>
          <button
            aria-label="Rotate Frame Clockwise"
            onclick={() => {
              rotateFrame(true, activeFrameIdx);
            }}
            class="button small tool"
            disabled={tools.playing}
          >
            <Fa icon={faRotateRight} />
          </button>
          <button
            aria-label="Rotate Frame Counter Clockwise"
            onclick={() => {
              rotateFrame(false, activeFrameIdx);
            }}
            class="button small tool"
            disabled={tools.playing}
          >
            <Fa icon={faRotateLeft} />
          </button>
          <button
            aria-label="Save Image"
            onclick={() => {
              showSaveModal = true;
            }}
            class="button small tool"
            disabled={tools.playing || !imageDirty}
          >
            <Fa icon={faSave} />
          </button>
        </div>
      </div>
      <div class="palette-tools">
        <p>Current palette length: {currentPalette.length}</p>
        <div class="form-control inline">
          <label for="highlightcolor">Highlight Color:</label>
          <input id="highlightcolor" type="color" bind:value={highlightColor} />
        </div>
        <div class="form-control inline">
          <label for="palettecolor">Palette Color:</label>
          <button
            class="button small tool {tools.paintBrush ? 'active' : null}"
            disabled={activeImage == null ||
              activePaletteIdx == -1 ||
              tools.playing}
            onclick={() => {
              if (activeImage != null) {
                tools.paintBrush = !tools.paintBrush;
                tools.paintBucket = false;
              }
            }}
          >
            <Fa icon={faPaintBrush} />
          </button>
          <button
            class="button small tool {tools.paintBucket ? 'active' : null}"
            disabled={activeImage == null ||
              activePaletteIdx == -1 ||
              tools.playing}
            onclick={() => {
              if (activeImage != null) {
                tools.paintBucket = !tools.paintBucket;
                tools.paintBrush = false;
              }
            }}
          >
            <Fa icon={faFillDrip} />
          </button>
          <button
            class="button small tool"
            disabled={activeImage == null ||
              activePaletteIdx == -1 ||
              currentPalette[activePaletteIdx] ==
                activeImage.palette[activePaletteIdx]}
            onclick={() => {
              if (activeImage != null) {
                currentPalette[activePaletteIdx] =
                  activeImage.palette[activePaletteIdx];
              }
            }}
          >
            <Fa rotate="-90" icon={faArrowTurnUp} />
          </button>
          <input
            id="palettecolor"
            type="color"
            disabled={activePaletteIdx === -1}
            bind:value={activePaletteColor.get, activePaletteColor.set}
          />
        </div>
        <div class="form-control inline">
          <button
            class="button small tool"
            aria-label="Add palette color"
            disabled={activeImage == null}
            onclick={() => {
              if (activeImage != null) {
                addPaletteColor();
              }
            }}
          >
            <Fa icon={faAdd} />
          </button>
        </div>
      </div>

      <div
        class="image-palette"
        style="--highlightcolor:{highlightColor}"
        use:dndzone={{
          items: dragItems,
          flipDurationMs: 200,
          dropFromOthersDisabled: true,
          morphDisabled: true,
          useCursorForDetection: true,
          centreDraggedOnCursor: true,
          transformDraggedElement,
        }}
        onconsider={handlePaletteSort}
        onfinalize={handlePaletteDrop}
      >
        {#each dragItems as item (item.id)}
          <button
            class={activePaletteIdx == item.id ? 'active' : ''}
            data-palette-id={item.id}
            onclick={() => {
              setPalette(item.id);
            }}
            style:background-color={'#' + item.color}
          >
            {'#' + item.color.toUpperCase()}
          </button>
        {/each}
      </div>
    {/if}
    <div class="preview-image"></div>
  </div>
</div>

<Modal showCancel={false} bind:showModal={showConfirmModal}>
  {#snippet header()}
    <h2>{confirmTitle}</h2>
  {/snippet}
  <p>
    {confirmMessage}
  </p>
  <div class="form-control confirm">
    <button
      class="button medium"
      onclick={(e) => {
        e.preventDefault();
        closeModal();
      }}>{confirmCancelText}</button
    >
    <button
      class="button medium active"
      onclick={(e) => {
        e.preventDefault();
        closeModal();
        confirmAction();
      }}>{confirmOkText}</button
    >
  </div>
</Modal>

<Modal showCancel={false} bind:showModal={showSaveModal}>
  {#snippet header()}
    <h2>Save Image Changes</h2>
  {/snippet}
  <p>Save changes to this image to the server.</p>
  <form>
    <div class="form-control">
      <label for="savesubdir">Subdirectory (optional)</label>
      <input
        type="text"
        id="savesubdir"
        name="savesubdir"
        bind:value={saveSubdir}
      />
    </div>
    <div class="form-control">
      <label for="savesubdir">Image Name</label>
      <input
        type="text"
        placeholder="example.gif"
        id="savesubdir"
        name="savesubdir"
        bind:value={saveName}
      />
    </div>
    <div class="form-control inline">
      <button
        onclick={(e) => {
          e.preventDefault();
          closeModal();
        }}
        class="button">Cancel</button
      >
      <button onclick={(e) => upLoadJson(e)} class="button active"
        >Save Changes</button
      >
    </div>
  </form>
</Modal>

<Modal showCancel={false} bind:showModal={showFrameModal}>
  {#snippet header()}
    <h2>Insert Frame</h2>
  {/snippet}
  <p>Select frames to insert</p>
  <form>
    <div class="form-control inline">
      {#if frameImage != null}
        {#each { length: frameImage.meta.frames } as _, i}
          <input type="checkbox" id="inputFrame{i}" class="frame-checkbox" />
          <label for="inputFrame{i}">
            <FrameCanvas
              height="64"
              width="64"
              frameId={i}
              data={frameImage.rows.slice(
                i * frameImage.meta.height,
                frameImage.meta.height,
              )}
              palette={frameImage.palette}
            ></FrameCanvas>
          </label>
        {/each}
      {/if}
      <div class="form-control inline">
        <button
          onclick={(e) => {
            e.preventDefault();
            closeModal();
          }}
          class="button">Cancel</button
        >
        <button onclick={(e) => upLoadJson(e)} class="button active"
          >Save Changes</button
        >
      </div>
    </div>
  </form>
</Modal>
<!-- <MouseCursor
  cursorType={tools.paintBucket ? 'square' : 'circle'}
  {highlightColor}
  containerSelector="body"
  showCursor={tools.paintBrush || tools.paintBucket}
></MouseCursor> -->
