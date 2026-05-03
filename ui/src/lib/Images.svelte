<script lang="ts">
  import toast, { Toaster } from 'svelte-5-french-toast';
  import { dndzone, TRIGGERS } from 'svelte-dnd-action';
  import Fa from 'svelte-fa';
  import mirrorIcon from '../assets/mirror.svg';
  import paintbrush from '../assets/paintbrush.svg';
  import paintbucket from '../assets/paintbucket.svg';
  import multishape from '../assets/multishape.svg';
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
    faSquare,
    faCircle,
    faCheck,
    faCheckDouble,
    faXmark,
    faShapes,
    faBolt,
  } from '@fortawesome/free-solid-svg-icons';
  import {
    faSquare as faSquareReg,
    faCircle as faCircleReg,
  } from '@fortawesome/free-regular-svg-icons';

  import Modal from './Modal.svelte';
  import MouseCursor from './MouseCursor.svelte';
  import FrameCanvas from './FrameCanvas.svelte';
  import {
    flipRegionHorizontal,
    flipRegionVertical,
    getPixelSquare,
    getPixelEllipse,
  } from './ImageOperations';

  let showSaveModal = $state(false);
  let showConfirmModal = $state(false);
  let showFrameModal = $state(false);
  let confirmTitle = $state('');
  let confirmMessage = $state('');
  let confirmCancelText = $state('cancel');
  let confirmOkText = $state("Yes, I'm sure");

  let confirmAction: () => void = $state(() => {});
  const userConfirm = (confirmType: ConfirmType, action: () => void) => {
    confirmCancelText = 'cancel';
    confirmOkText = "Yes, I'm sure";
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

  const showCustomConfirm = (
    title: string,
    message: string,
    action: () => void,
    okText = 'Confirm',
    cancelText = 'Cancel',
  ) => {
    confirmTitle = title;
    confirmMessage = message;
    confirmOkText = okText;
    confirmCancelText = cancelText;
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
    selectMode: false,
    selectShape: 'rect',
    paintSquareSolid: false,
    paintSquareOutline: false,
    paintCircleSolid: false,
    paintCircleOutline: false,
  });

  const activeShapeTool:
    | 'squareSolid'
    | 'squareOutline'
    | 'circleSolid'
    | 'circleOutline'
    | null = $derived(
    tools.paintSquareSolid
      ? 'squareSolid'
      : tools.paintSquareOutline
        ? 'squareOutline'
        : tools.paintCircleSolid
          ? 'circleSolid'
          : tools.paintCircleOutline
            ? 'circleOutline'
            : null,
  );

  let shapeAnchor: { x: number; y: number } | null = $state(null);
  let shapeEnd: { x: number; y: number } | null = $state(null);
  let shapeHoverCell: { x: number; y: number } | null = $state(null);

  function clearShapeDraft() {
    shapeAnchor = null;
    shapeEnd = null;
    shapeHoverCell = null;
  }

  function setShapeTool(
    tool:
      | 'squareSolid'
      | 'squareOutline'
      | 'circleSolid'
      | 'circleOutline'
      | null,
  ) {
    tools.paintSquareSolid = tool === 'squareSolid';
    tools.paintSquareOutline = tool === 'squareOutline';
    tools.paintCircleSolid = tool === 'circleSolid';
    tools.paintCircleOutline = tool === 'circleOutline';
    clearShapeDraft();
  }

  const shapePreviewPixels: Set<string> = $derived.by(() => {
    if (!activeShapeTool || !shapeAnchor || !activeImage)
      return new Set<string>();

    const end = shapeEnd ?? shapeHoverCell ?? shapeAnchor;

    // Always show the first anchor click before hover or second corner is set.
    if (!shapeEnd && !shapeHoverCell) {
      return new Set<string>([`${shapeAnchor.x},${shapeAnchor.y}`]);
    }
    const minX = Math.min(shapeAnchor.x, end.x);
    const maxX = Math.max(shapeAnchor.x, end.x);
    const minY = Math.min(shapeAnchor.y, end.y);
    const maxY = Math.max(shapeAnchor.y, end.y);
    const hollow =
      activeShapeTool === 'squareOutline' ||
      activeShapeTool === 'circleOutline';
    const isCircle =
      activeShapeTool === 'circleSolid' || activeShapeTool === 'circleOutline';

    const cells = isCircle
      ? getPixelEllipse(activeImage, minX, maxX, minY, maxY, hollow)
      : getPixelSquare(activeImage, minX, maxX, minY, maxY, hollow);

    const outlineCells = !hollow
      ? isCircle
        ? getPixelEllipse(activeImage, minX, maxX, minY, maxY, true)
        : getPixelSquare(activeImage, minX, maxX, minY, maxY, true)
      : [];

    const s = new Set<string>();
    for (const c of cells) s.add(`${c.col},${c.row}`);
    for (const c of outlineCells) s.add(`${c.col},${c.row}`);
    return s;
  });

  type SelectionPoint = { x: number; y: number };
  type FloatingSelection = {
    currentKeys: string[];
    originByCurrent: Record<string, string>;
    framePixels: Record<number, Record<string, number>>;
    pivotX: number;
    pivotY: number;
  };

  let selectionDraftAnchor: SelectionPoint | null = $state(null);
  let selectionDraftEnd: SelectionPoint | null = $state(null);
  let selectionHoverCell: SelectionPoint | null = $state(null);
  let floatingSelection: FloatingSelection | null = $state(null);

  function buildSelectionKeys(
    anchor: SelectionPoint,
    end: SelectionPoint,
  ): string[] {
    if (!activeImage) return [];
    const minX = Math.min(anchor.x, end.x);
    const maxX = Math.max(anchor.x, end.x);
    const minY = Math.min(anchor.y, end.y);
    const maxY = Math.max(anchor.y, end.y);
    const cells =
      tools.selectShape === 'ellipse'
        ? getPixelEllipse(activeImage, minX, maxX, minY, maxY)
        : getPixelSquare(activeImage, minX, maxX, minY, maxY);
    return cells.map((c) => `${c.col},${c.row}`);
  }

  function getKeyBounds(keys: Iterable<string>) {
    const points = [...keys].map((key) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    });
    if (!points.length) return null;
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      size: Math.max(maxX - minX + 1, maxY - minY + 1),
    };
  }

  function clearSelectionState() {
    selectionDraftAnchor = null;
    selectionDraftEnd = null;
    floatingSelection = null;
  }

  function startFloatingSelectionFromKeys(keys: string[]) {
    if (!activeImage) return;
    const uniqueKeys = [...new Set(keys)];
    if (!uniqueKeys.length) {
      clearSelectionState();
      return;
    }

    const framePixels: Record<number, Record<string, number>> = {};
    const frameHeight = activeImage.meta.height;
    const originByCurrent: Record<string, string> = {};

    for (const key of uniqueKeys) {
      originByCurrent[key] = key;
    }

    const bounds = getKeyBounds(uniqueKeys);
    if (!bounds) {
      clearSelectionState();
      return;
    }
    const pivotX = (bounds.minX + bounds.maxX) / 2;
    const pivotY = (bounds.minY + bounds.maxY) / 2;

    for (
      let frameIndex = 0;
      frameIndex < activeImage.meta.frames;
      frameIndex++
    ) {
      const start = frameIndex * frameHeight;
      const pixels: Record<string, number> = {};
      for (const key of uniqueKeys) {
        const [x, y] = key.split(',').map(Number);
        pixels[key] = activeImage.rows[start + y].pixels[x];
      }
      framePixels[frameIndex] = pixels;
    }

    floatingSelection = {
      currentKeys: uniqueKeys,
      originByCurrent,
      framePixels,
      pivotX,
      pivotY,
    };
    selectionDraftAnchor = null;
    selectionDraftEnd = null;
  }

  function beginFloatingSelection(anchor: SelectionPoint, end: SelectionPoint) {
    const selectionKeys = buildSelectionKeys(anchor, end);
    startFloatingSelectionFromKeys(selectionKeys);
  }

  function toggleSelectionPixel(x: number, y: number) {
    const key = `${x},${y}`;

    if (!floatingSelection) {
      const nextKeys = new Set<string>(selectedPixels);
      if (nextKeys.has(key)) {
        nextKeys.delete(key);
      } else {
        nextKeys.add(key);
      }
      startFloatingSelectionFromKeys([...nextKeys]);
      return;
    }

    if (!activeImage) return;

    const nextKeySet = new Set<string>(floatingSelection.currentKeys);
    const nextOriginByCurrent = { ...floatingSelection.originByCurrent };
    const nextFramePixels: Record<number, Record<string, number>> = {};

    for (
      let frameIndex = 0;
      frameIndex < activeImage.meta.frames;
      frameIndex++
    ) {
      nextFramePixels[frameIndex] = {
        ...(floatingSelection.framePixels[frameIndex] ?? {}),
      };
    }

    if (nextKeySet.has(key)) {
      nextKeySet.delete(key);
      delete nextOriginByCurrent[key];
      for (
        let frameIndex = 0;
        frameIndex < activeImage.meta.frames;
        frameIndex++
      ) {
        delete nextFramePixels[frameIndex][key];
      }
    } else {
      nextKeySet.add(key);
      nextOriginByCurrent[key] = key;
      const frameHeight = activeImage.meta.height;
      const [px, py] = key.split(',').map(Number);
      for (
        let frameIndex = 0;
        frameIndex < activeImage.meta.frames;
        frameIndex++
      ) {
        const start = frameIndex * frameHeight;
        nextFramePixels[frameIndex][key] =
          activeImage.rows[start + py].pixels[px];
      }
    }

    if (!nextKeySet.size) {
      clearSelectionState();
      return;
    }

    const nextBounds = getKeyBounds(nextKeySet);
    if (!nextBounds) {
      clearSelectionState();
      return;
    }

    floatingSelection = {
      ...floatingSelection,
      currentKeys: [...nextKeySet],
      originByCurrent: nextOriginByCurrent,
      framePixels: nextFramePixels,
      pivotX: (nextBounds.minX + nextBounds.maxX) / 2,
      pivotY: (nextBounds.minY + nextBounds.maxY) / 2,
    };
  }

  const selectedPixels: Set<string> = $derived.by(() => {
    if (floatingSelection) {
      return new Set<string>(floatingSelection.currentKeys);
    }
    if (!selectionDraftAnchor || !activeImage) return new Set<string>();
    if (!selectionDraftEnd) {
      const previewEnd = selectionHoverCell ?? selectionDraftAnchor;
      return new Set<string>(
        buildSelectionKeys(selectionDraftAnchor, previewEnd),
      );
    }
    return new Set<string>(
      buildSelectionKeys(selectionDraftAnchor, selectionDraftEnd),
    );
  });

  const selectionRegion: {
    offsetX: number;
    offsetY: number;
    size: number;
  } | null = $derived.by(() => {
    const bounds = getKeyBounds(selectedPixels);
    if (!bounds) return null;
    return {
      offsetX: bounds.minX,
      offsetY: bounds.minY,
      size: bounds.size,
    };
  });

  const floatingSelectionPixels: Record<string, number> = $derived.by(() => {
    if (!floatingSelection) return {};
    return floatingSelection.framePixels[activeFrameIdx] ?? {};
  });

  const liftedSelectionPixels: Set<string> = $derived.by(() => {
    if (!floatingSelection) return new Set<string>();
    return new Set<string>(Object.values(floatingSelection.originByCurrent));
  });

  const selectionActionSuffix = $derived(
    floatingSelection ? ' on current selection' : '',
  );

  const selectionOperationBlockHint = $derived(
    floatingSelection
      ? ': confirm or cancel selection operations before proceeding'
      : '',
  );
  function transformDraggedElement(draggedEl: any, data: any, index: any) {
    draggedEl.style.borderRadius = '50%';
    draggedEl.style.height = '50px';
    draggedEl.style.width = '50px';
    draggedEl.style.overflow = 'hidden';
  }

  function applyDroppedColorToTarget(sourceId: number, targetId: number) {
    if (sourceId === targetId || !activeImage) return;
    if (sourceId < 0 || targetId < 0) return;
    if (sourceId >= currentPalette.length || targetId >= currentPalette.length)
      return;

    const sourceColor = currentPalette[sourceId];
    if (!sourceColor) return;

    currentPalette[targetId] = sourceColor;
    const targetItem = dragItems.find((item) => item.id === targetId);
    if (targetItem) {
      targetItem.color = sourceColor;
    }

    if (activePaletteIdx === targetId) {
      activePaletteColor.set('#' + sourceColor);
    }

    imageDirty = true;
    toast.success('Updated target palette color');
  }

  function handlePaletteDrop(e: {
    detail: {
      items: Item[];
      info: { trigger: TRIGGERS; id: string | number };
    };
  }) {
    const oldItems = [...dragItems];
    const newItems = e.detail.items;
    const draggedId = Number(e.detail.info.id);

    // Keep palette slot order fixed after drag interaction.
    dragItems = oldItems;

    if (e.detail.info.trigger !== TRIGGERS.DROPPED_INTO_ZONE) return;
    if (!Number.isFinite(draggedId)) return;

    const sourceIndex = oldItems.findIndex(
      (item) => Number(item.id) === draggedId,
    );
    const destinationIndex = newItems.findIndex(
      (item) => Number(item.id) === draggedId,
    );

    if (sourceIndex === -1 || destinationIndex === -1) return;
    if (sourceIndex === destinationIndex) return;

    const sourceItem = oldItems[sourceIndex];
    const targetItem = oldItems[destinationIndex];
    if (!sourceItem || !targetItem) return;
    if (sourceItem.id === targetItem.id) return;

    showCustomConfirm(
      'Update palette color?',
      `Replace #${targetItem.color.toUpperCase()} with #${sourceItem.color.toUpperCase()}?`,
      () => applyDroppedColorToTarget(sourceItem.id, targetItem.id),
      'Apply Color',
      'Keep Target',
    );
  }

  function handlePaletteSort(_e: any) {
    // Keep palette slot order fixed while dragging.
    // We still use finalize payload to infer source/target for confirmation.
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
  let showFlash: boolean = $state(true);
  let gridZoomPercent: number = $state(100);
  let gridPanXPercent: number = $state(0);
  let gridPanYPercent: number = $state(0);
  const gridZoom = $derived(gridZoomPercent / 100);
  const canPanGrid = $derived(gridZoomPercent > 100);

  $effect(() => {
    if (gridZoomPercent <= 100) {
      gridPanXPercent = 0;
      gridPanYPercent = 0;
    }
  });
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
  const getImage: (id: string) => void = (id) => {
    stopPlaying();
    closeTools();
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

  function pixelClick(
    x: number,
    y: number,
    pixel: number | null,
    event?: Event,
  ) {
    const mouseEvent = event as MouseEvent | undefined;
    const isToggleSelectionClick =
      !!mouseEvent?.ctrlKey || !!mouseEvent?.metaKey;

    if (floatingSelection) {
      if (tools.selectMode && isToggleSelectionClick) {
        toggleSelectionPixel(x, y);
        return;
      }
      if (tools.paintBrush && selectedPixels.has(`${x},${y}`)) {
        setSelectionPixelColor(x, y, activePaletteIdx);
        return;
      }
      if (
        tools.paintBucket &&
        pixel !== null &&
        selectedPixels.has(`${x},${y}`)
      ) {
        updatePaletteColorForSelection(pixel, activePaletteIdx);
      }
      if (activeShapeTool) {
        if (shapeAnchor === null || shapeEnd !== null) {
          shapeAnchor = { x, y };
          shapeEnd = null;
        } else {
          shapeEnd = { x, y };
        }
        return;
      }
      return;
    }

    if (tools.selectMode) {
      if (isToggleSelectionClick) {
        toggleSelectionPixel(x, y);
        return;
      }
      if (selectionDraftAnchor === null || selectionDraftEnd !== null) {
        selectionDraftAnchor = { x, y };
        selectionDraftEnd = null;
      } else {
        selectionDraftEnd = { x, y };
        beginFloatingSelection(selectionDraftAnchor, { x, y });
      }
      return;
    }
    if (activeShapeTool) {
      if (shapeAnchor === null || shapeEnd !== null) {
        shapeAnchor = { x, y };
        shapeEnd = null;
      } else {
        shapeEnd = { x, y };
      }
      return;
    }
    if (tools.paintBrush) {
      setPixelColor(y, x, activePaletteIdx);
    } else if (tools.paintBucket && pixel !== null) {
      updatePaletteColorForFrame(pixel, activePaletteIdx);
    } else if (pixel !== null) {
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

  function confirmShape() {
    if (!activeImage || !activeShapeTool || !shapePreviewPixels.size) return;
    if (floatingSelection) {
      const next = { ...(floatingSelection.framePixels[activeFrameIdx] ?? {}) };
      for (const key of shapePreviewPixels) {
        if (selectedPixels.has(key)) {
          next[key] = activePaletteIdx;
        }
      }
      floatingSelection = {
        ...floatingSelection,
        framePixels: {
          ...floatingSelection.framePixels,
          [activeFrameIdx]: next,
        },
      };
    } else {
      for (const key of shapePreviewPixels) {
        const [cx, cy] = key.split(',').map(Number);
        setPixelColor(cy, cx, activePaletteIdx);
      }
    }
    shapeAnchor = null;
    shapeEnd = null;
    shapeHoverCell = null;
    imageDirty = true;
  }

  function cancelShape() {
    clearShapeDraft();
  }

  function confirmSelection() {
    if (!activeImage || !floatingSelection) return;

    const image = $state.snapshot(activeImage);
    const frameHeight = image.meta.height;
    const originsToClear = new Set<string>(
      Object.values(floatingSelection.originByCurrent),
    );

    for (let frameIndex = 0; frameIndex < image.meta.frames; frameIndex++) {
      const start = frameIndex * frameHeight;

      for (const key of originsToClear) {
        const [x, y] = key.split(',').map(Number);
        image.rows[start + y].pixels[x] = 0;
      }

      const framePixels = floatingSelection.framePixels[frameIndex] ?? {};
      for (const [key, value] of Object.entries(framePixels)) {
        const [x, y] = key.split(',').map(Number);
        image.rows[start + y].pixels[x] = value;
      }
    }

    activeImage.rows = image.rows;
    imageDirty = true;
    clearSelectionState();
    tools.selectMode = false;
  }

  function cancelSelection() {
    clearSelectionState();
    tools.selectMode = false;
  }

  function closeTools() {
    const skipReset = new Set(['playing', 'selectShape']);
    for (let k of Object.keys(tools)) {
      if (skipReset.has(k)) continue;
      if (k in tools) {
        let key = k as keyof typeof tools;
        (tools as any)[key] = false;
      }
    }
    clearSelectionState();
    clearShapeDraft();
  }

  function translateFloatingSelection(dx: number, dy: number) {
    if (!floatingSelection || !activeImage) return false;

    const width = activeImage.meta.width;
    const height = activeImage.meta.height;

    const points = floatingSelection.currentKeys.map((key) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    });
    if (!points.length) return false;

    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const maxY = Math.max(...points.map((p) => p.y));

    // Stop at image edges for floating selection moves.
    const clampedDx = Math.max(-minX, Math.min(dx, width - 1 - maxX));
    const clampedDy = Math.max(-minY, Math.min(dy, height - 1 - maxY));
    if (clampedDx === 0 && clampedDy === 0) return false;

    const moved = transformFloatingSelection((x, y) => ({
      x: x + clampedDx,
      y: y + clampedDy,
    }));

    if (moved && floatingSelection) {
      floatingSelection = {
        ...floatingSelection,
        pivotX: floatingSelection.pivotX + clampedDx,
        pivotY: floatingSelection.pivotY + clampedDy,
      };
    }

    return moved;
  }

  function translateFloatingSelectionInSingleFrame(
    dx: number,
    dy: number,
    frameIndex: number,
  ) {
    if (!floatingSelection || !activeImage) return false;

    const framePixels = floatingSelection.framePixels[frameIndex] ?? {};
    const entries = Object.entries(framePixels);
    if (!entries.length) return false;

    const width = activeImage.meta.width;
    const height = activeImage.meta.height;
    const points = entries.map(([key]) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    });

    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const maxY = Math.max(...points.map((p) => p.y));

    // Clamp movement to image bounds for this frame's floating pixels.
    const clampedDx = Math.max(-minX, Math.min(dx, width - 1 - maxX));
    const clampedDy = Math.max(-minY, Math.min(dy, height - 1 - maxY));
    if (clampedDx === 0 && clampedDy === 0) return false;

    const movedFramePixels: Record<string, number> = {};
    for (const [key, value] of entries) {
      const [x, y] = key.split(',').map(Number);
      movedFramePixels[`${x + clampedDx},${y + clampedDy}`] = value;
    }

    floatingSelection = {
      ...floatingSelection,
      framePixels: {
        ...floatingSelection.framePixels,
        [frameIndex]: movedFramePixels,
      },
    };
    imageDirty = true;
    return true;
  }

  function shiftPixelsInFrame(left = true, frameIndex: number) {
    if (floatingSelection) {
      if (frameIndex === -1) {
        translateFloatingSelection(left ? -1 : 1, 0);
      } else {
        translateFloatingSelectionInSingleFrame(
          left ? -1 : 1,
          0,
          activeFrameIdx,
        );
      }
      return;
    }
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
    if (floatingSelection) {
      if (frameIndex === -1) {
        translateFloatingSelection(0, up ? -1 : 1);
      } else {
        translateFloatingSelectionInSingleFrame(0, up ? -1 : 1, activeFrameIdx);
      }
      return;
    }
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
    {
      const durations = [...(activeImage.meta.durations ?? [])];
      if (durations.length) {
        durations.splice(activeFrameIdx, 1);
      }
      while (durations.length < activeImage.meta.frames) {
        durations.push(Number(durations[durations.length - 1] ?? 420));
      }
      if (durations.length > activeImage.meta.frames) {
        durations.length = activeImage.meta.frames;
      }
      activeImage.meta.durations = durations;
    }
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
    {
      const durations = [...(activeImage.meta.durations ?? [])];
      const currentDuration = Number(durations[activeFrameIdx]);
      const fallbackDuration = Number(durations[0]);
      const insertedDuration = Number.isFinite(currentDuration)
        ? currentDuration
        : Number.isFinite(fallbackDuration)
          ? fallbackDuration
          : 420;
      while (durations.length < activeImage.meta.frames - 1) {
        durations.push(insertedDuration);
      }
      durations.splice(activeFrameIdx + 1, 0, insertedDuration);
      if (durations.length > activeImage.meta.frames) {
        durations.length = activeImage.meta.frames;
      }
      activeImage.meta.durations = durations;
    }
    activeFrameIdx++;
    imageDirty = true;
  }

  function transformFloatingSelection(
    transformPoint: (
      x: number,
      y: number,
      bounds: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
        width: number;
        height: number;
        size: number;
      },
    ) => SelectionPoint,
  ) {
    if (!floatingSelection) return false;

    const bounds = getKeyBounds(floatingSelection.currentKeys);
    if (!bounds) return false;

    const nextKeys = floatingSelection.currentKeys.map((key) => {
      const [x, y] = key.split(',').map(Number);
      const next = transformPoint(x, y, bounds);
      return `${next.x},${next.y}`;
    });

    const nextOriginByCurrent: Record<string, string> = {};
    for (const [currentKey, originKey] of Object.entries(
      floatingSelection.originByCurrent,
    )) {
      const [x, y] = currentKey.split(',').map(Number);
      const next = transformPoint(x, y, bounds);
      nextOriginByCurrent[`${next.x},${next.y}`] = originKey;
    }

    const nextFramePixels: Record<number, Record<string, number>> = {};
    for (const [frameKey, pixels] of Object.entries(
      floatingSelection.framePixels,
    )) {
      const nextPixels: Record<string, number> = {};
      for (const [key, value] of Object.entries(pixels)) {
        const [x, y] = key.split(',').map(Number);
        const next = transformPoint(x, y, bounds);
        nextPixels[`${next.x},${next.y}`] = value;
      }
      nextFramePixels[Number(frameKey)] = nextPixels;
    }

    floatingSelection = {
      ...floatingSelection,
      currentKeys: [...new Set(nextKeys)],
      originByCurrent: nextOriginByCurrent,
      framePixels: nextFramePixels,
    };

    return true;
  }

  function flipFloatingSelection(horizontal: boolean = true) {
    return transformFloatingSelection((x, y, bounds) => {
      if (horizontal) {
        return {
          x: bounds.minX + (bounds.width - 1 - (x - bounds.minX)),
          y,
        };
      }
      return {
        x,
        y: bounds.minY + (bounds.height - 1 - (y - bounds.minY)),
      };
    });
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

    if (floatingSelection) {
      flipFloatingSelection(horizontal);
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

  function rotateWithSelection(clockwise: boolean, frameIndex: number) {
    if (!floatingSelection) return false;
    const pivotX = floatingSelection.pivotX;
    const pivotY = floatingSelection.pivotY;

    return transformFloatingSelection((x, y, bounds) => {
      const dx = x - pivotX;
      const dy = y - pivotY;

      if (clockwise) {
        return {
          x: Math.round(pivotX - dy),
          y: Math.round(pivotY + dx),
        };
      }

      return {
        x: Math.round(pivotX + dy),
        y: Math.round(pivotY - dx),
      };
    });
  }

  function rotateFrame(
    clockwise: boolean = true,
    frameIndex: number,
    size: number = 0,
    offsetX: number = 0,
    offsetY: number = 0,
  ) {
    if (!activeImage) {
      toast.error('No image loaded');
      return;
    }
    // If a selection is active, use selection-aware pixel rotation
    if (floatingSelection) {
      rotateWithSelection(clockwise, frameIndex);
      return;
    }
    let image = $state.snapshot(activeImage);
    const width = image.meta.width;
    const height = image.meta.height;

    // Default to full-frame rotation; region controls can override this later.
    const startX = Math.max(0, Math.min(offsetX, width - 1));
    const startY = Math.max(0, Math.min(offsetY, height - 1));
    const maxSize = Math.min(width - startX, height - startY);
    const regionSize = Math.max(1, Math.min(size > 0 ? size : width, maxSize));

    const rotate = (
      frame: number,
      height: number,
      regionSize: number,
      offsetX: number,
      offsetY: number,
    ) => {
      const num_of_rows = height;
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

    if (frameIndex == -1) {
      for (let i = 0; i < activeImage.meta.frames; i++) {
        rotate(i, height, regionSize, startX, startY);
      }
    } else {
      rotate(frameIndex, height, regionSize, startX, startY);
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

  function applyDurationToAllFrames() {
    if (!activeImage) return;
    const selectedDuration = Number(activeImage.meta.durations[activeFrameIdx]);
    const fallbackDuration = Number(activeImage.meta.durations[0]);
    const currentDuration = Number.isFinite(selectedDuration)
      ? selectedDuration
      : Number.isFinite(fallbackDuration)
        ? fallbackDuration
        : 420;
    activeImage.meta.durations = Array.from(
      { length: activeImage.meta.frames },
      () => currentDuration,
    );
    imageDirty = true;
    toast.success('Applied current duration to all frames');
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

  function setSelectionPixelColor(x: number, y: number, newIndex: number) {
    if (!floatingSelection) return;
    const key = `${x},${y}`;
    if (!selectedPixels.has(key)) return;
    floatingSelection = {
      ...floatingSelection,
      framePixels: {
        ...floatingSelection.framePixels,
        [activeFrameIdx]: {
          ...(floatingSelection.framePixels[activeFrameIdx] ?? {}),
          [key]: newIndex,
        },
      },
    };
    imageDirty = true;
  }

  function updatePaletteColorForSelection(
    currentIndex: number,
    newIndex: number,
  ) {
    if (!floatingSelection) return;
    if (currentIndex === -1 || newIndex === -1) return;

    const framePixels = floatingSelection.framePixels[activeFrameIdx] ?? {};
    const nextFramePixels = { ...framePixels };

    for (const [key, value] of Object.entries(framePixels)) {
      nextFramePixels[key] = value === currentIndex ? newIndex : value;
    }

    floatingSelection = {
      ...floatingSelection,
      framePixels: {
        ...floatingSelection.framePixels,
        [activeFrameIdx]: nextFramePixels,
      },
    };
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
            aria-label={`Upload Image${selectionOperationBlockHint}`}
            class="button"
            disabled={!files || !files.length || !!floatingSelection || null}
            onclick={(event) => uploadImages(event, false)}>Upload</button
          >
          <button
            aria-label={`Edit Image${selectionOperationBlockHint}`}
            class="button"
            disabled={!files || !files.length || !!floatingSelection || null}
            onclick={(event) => uploadImages(event, true)}>Edit</button
          >
        </div>
        <div class="form-control inline">
          <button
            aria-label={`Insert Frame${selectionOperationBlockHint}`}
            class="button"
            disabled={!activeImage ||
              !files ||
              !files.length ||
              !!floatingSelection ||
              null}
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
            aria-label={`Create New Image${selectionOperationBlockHint}`}
            class="button"
            disabled={!wledjson.length || !!floatingSelection || null}
            onclick={(event) => loadJson(event)}>New Image</button
          >
          <button
            aria-label={`Create New Frame${selectionOperationBlockHint}`}
            class="button"
            disabled={!wledjson.length || !!floatingSelection || null}
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
          aria-label="Rectangle Selection"
          onclick={() => {
            if (
              tools.selectMode &&
              tools.selectShape === 'rect' &&
              !floatingSelection
            ) {
              tools.selectMode = false;
              clearSelectionState();
              return;
            }
            tools.selectShape = 'rect';
            tools.selectMode = true;
            shapeAnchor = null;
            shapeEnd = null;
            shapeHoverCell = null;
          }}
          class="button small tool selection-shape-btn {tools.selectShape ===
            'rect' &&
          (tools.selectMode || floatingSelection)
            ? 'active'
            : ''}"
          disabled={!!floatingSelection}
        >
          <span class="selection-shape-icon square" aria-hidden="true"></span>
        </button>
        <button
          aria-label="Ellipse Selection"
          onclick={() => {
            if (
              tools.selectMode &&
              tools.selectShape === 'ellipse' &&
              !floatingSelection
            ) {
              tools.selectMode = false;
              clearSelectionState();
              return;
            }
            tools.selectShape = 'ellipse';
            tools.selectMode = true;
            shapeAnchor = null;
            shapeEnd = null;
            shapeHoverCell = null;
          }}
          class="button small tool selection-shape-btn {tools.selectShape ===
            'ellipse' &&
          (tools.selectMode || floatingSelection)
            ? 'active'
            : ''}"
          disabled={!!floatingSelection}
        >
          <span class="selection-shape-icon circle" aria-hidden="true"></span>
        </button>
        {#if floatingSelection}
          <button
            aria-label="Confirm Selection Operations"
            onclick={() => confirmSelection()}
            class="button small tool"
            disabled={!!activeShapeTool && shapeAnchor !== null}
          >
            <Fa icon={faCheck} />
          </button>
          <button
            aria-label="Cancel Selection Operations"
            onclick={() => cancelSelection()}
            class="button small tool"
            disabled={!!activeShapeTool && shapeAnchor !== null}
          >
            <Fa icon={faXmark} />
          </button>
        {/if}
        <button
          aria-label={`Flip Image Horizontally${selectionActionSuffix}`}
          onclick={() => {
            flipFrame(
              true,
              -1,
              selectionRegion?.size ?? 0,
              selectionRegion?.offsetX ?? 0,
              selectionRegion?.offsetY ?? 0,
            );
          }}
          class="button small tool"
        >
          <img src={mirrorIcon} alt="mirror" height="20" width="20" />
          <!-- <Fa icon={faArrowsLeftRight} /> -->
        </button>
        <button
          aria-label={`Flip Image Vertically${selectionActionSuffix}`}
          onclick={() => {
            flipFrame(
              false,
              -1,
              selectionRegion?.size ?? 0,
              selectionRegion?.offsetX ?? 0,
              selectionRegion?.offsetY ?? 0,
            );
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
          aria-label={`Rotate Image Clockwise${selectionActionSuffix}`}
          onclick={() => {
            rotateFrame(
              true,
              -1,
              selectionRegion?.size ?? 0,
              selectionRegion?.offsetX ?? 0,
              selectionRegion?.offsetY ?? 0,
            );
          }}
          class="button small tool"
        >
          <Fa icon={faRotateRight} />
        </button>
        <button
          aria-label={`Rotate Image Counter Clockwise${selectionActionSuffix}`}
          onclick={() => {
            rotateFrame(
              false,
              -1,
              selectionRegion?.size ?? 0,
              selectionRegion?.offsetX ?? 0,
              selectionRegion?.offsetY ?? 0,
            );
          }}
          class="button small tool"
        >
          <Fa icon={faRotateLeft} />
        </button>
        <div
          class="move-button-wrap"
          style="--highlightcolor:{highlightColor}"
          style:backgroundColor={tools.movingAll ? 'rgba(0,0,0,0.3)' : null}
        >
          <button
            aria-label={`Pan Image${selectionActionSuffix}`}
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
            aria-label={`Move Up${selectionActionSuffix}`}
            onclick={() => {
              shiftPixelRowsInFrame(true, -1);
            }}
            class="button small tool move move-up"
            style:display={tools.movingAll ? 'block' : 'none'}
          >
            <Fa icon={faArrowUp} />
          </button>
          <button
            aria-label={`Move Down${selectionActionSuffix}`}
            onclick={() => {
              shiftPixelRowsInFrame(false, -1);
            }}
            class="button small tool move move-down"
            style:display={tools.movingAll ? 'block' : 'none'}
          >
            <Fa icon={faArrowDown} />
          </button>
          <button
            aria-label={`Move Left${selectionActionSuffix}`}
            onclick={() => {
              shiftPixelsInFrame(true, -1);
            }}
            class="button small tool move move-left"
            style:display={tools.movingAll ? 'block' : 'none'}
          >
            <Fa icon={faArrowLeft} />
          </button>
          <button
            aria-label={`Move Right${selectionActionSuffix}`}
            onclick={() => {
              shiftPixelsInFrame(false, -1);
            }}
            class="button small tool move move-right"
            style:display={tools.movingAll ? 'block' : 'none'}
          >
            <Fa icon={faArrowRight} />
          </button>
        </div>
        <button
          aria-label="Reset palette color to saved"
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
          aria-label="Show Image on WLED"
          onclick={() => {
            showImageOnWled();
          }}
          class="button small tool"
        >
          <Fa icon={faEye} />
        </button>
        <div class="grid-zoom-control" aria-label="Pixel Grid Zoom">
          <label for="gridZoomRange" class="small">Zoom</label>
          <input
            id="gridZoomRange"
            type="range"
            min="30"
            max="200"
            step="5"
            bind:value={gridZoomPercent}
          />
          <span class="small">{gridZoomPercent}%</span>
        </div>
        <div
          class="grid-pan-control"
          aria-label={`Pixel Grid Pan${
            canPanGrid ? '' : ': increase zoom above 100% to enable panning'
          }`}
        >
          <label for="gridPanXRange" class="small">X</label>
          <input
            id="gridPanXRange"
            type="range"
            min="-50"
            max="50"
            step="1"
            bind:value={gridPanXPercent}
            disabled={!canPanGrid}
          />
          <label for="gridPanYRange" class="small">Y</label>
          <input
            id="gridPanYRange"
            type="range"
            min="-50"
            max="50"
            step="1"
            bind:value={gridPanYPercent}
            disabled={!canPanGrid}
          />
        </div>
      </div>

      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="pixel-grid {tools.paintBrush
          ? 'painting paint-brush'
          : null} {tools.paintBucket
          ? 'painting paint-bucket'
          : null} {activeShapeTool ? 'painting paint-shape' : null} {showFlash
          ? ''
          : 'no-flash'}"
        tabindex="-1"
        role="grid"
        onmouseleave={() => {
          selectionHoverCell = null;
          shapeHoverCell = null;
        }}
        style:--highlightcolor={highlightColor}
        style:--paintbrushurl={`url(${paintbucket})`}
        style:--paintbucketurl={`url(${paintbrush})`}
        style:--gridzoom={gridZoom}
        style:--gridpanx={gridPanXPercent}
        style:--gridpany={gridPanYPercent}
      >
        <!-- {#each { length: activeImage.meta.frames } as _, f} -->
        <!-- class="frame{f == activeFrameIdx ? ' active' : ''}" -->
        <div class="frame active" data-frame={activeFrameIdx}>
          {#each activeFrame as row, y}
            {#each row.pixels as pixel, x}
              {@const idx = y * activeImage.meta.width + x}
              {@const key = `${x},${y}`}
              {@const previewPixel = floatingSelectionPixels[key]}
              {@const isLiftedSelectionPixel =
                floatingSelection && liftedSelectionPixels.has(key)}
              {@const displayPixel =
                previewPixel ?? (isLiftedSelectionPixel ? null : pixel)}
              {@const isShapePreview = shapePreviewPixels.has(key)}
              {@const isBlockedShapePreview =
                isShapePreview && floatingSelection && !selectedPixels.has(key)}
              <button
                class="pixel{displayPixel != null &&
                activePaletteIdx == displayPixel
                  ? ' active'
                  : ''}{selectedPixels.has(key)
                  ? ' selected'
                  : ''}{isShapePreview
                  ? ' shape-preview'
                  : ''}{isBlockedShapePreview ? ' shape-preview-blocked' : ''}"
                onmouseenter={() => {
                  if (
                    tools.selectMode &&
                    selectionDraftAnchor &&
                    !selectionDraftEnd &&
                    !floatingSelection
                  ) {
                    selectionHoverCell = { x, y };
                  }
                  if (activeShapeTool && shapeAnchor && !shapeEnd) {
                    shapeHoverCell = { x, y };
                  }
                }}
                onclick={(event) => {
                  pixelClick(x, y, displayPixel, event);
                }}
                aria-label="Pixel {idx}"
                data-pixel={idx}
                style:background-color={isShapePreview
                  ? '#' + currentPalette[activePaletteIdx]
                  : displayPixel != null && currentPalette.length > displayPixel
                    ? '#' + currentPalette[displayPixel]
                    : isLiftedSelectionPixel
                      ? '#FFFFFF'
                      : null}
                data-palette-id={displayPixel ?? ''}
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
        <div class="form-control inline frame-count-row">
          <label for="previousFrame">
            Frame {activeFrameIdx + 1} of {activeImage.meta.frames}
          </label>
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
            aria-label={`Apply Current Duration To All Frames${selectionOperationBlockHint}`}
            onclick={() => {
              applyDurationToAllFrames();
            }}
            disabled={tools.playing ||
              activeImage.meta.frames <= 1 ||
              !!floatingSelection}
            class="button small tool"
          >
            <Fa icon={faCheckDouble} />
          </button>
        </div>
        <div class="form-control inline frame-tools-row">
          <button
            aria-label={tools.playing
              ? `Pause${selectionOperationBlockHint}`
              : `Play${selectionOperationBlockHint}`}
            disabled={activeImage.meta.frames <= 1 ||
              tools.moving ||
              !!floatingSelection}
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
            id="previousFrame"
            name="previousFrame"
            aria-label={`Previous Frame${selectionOperationBlockHint}`}
            onclick={() => {
              previousFrame();
            }}
            disabled={tools.playing ||
              activeImage.meta.frames <= 1 ||
              !!floatingSelection}
            class="button small tool"><Fa icon={faArrowLeft} /></button
          >
          <button
            id="nextFrame"
            name="nextFrame"
            aria-label={`Next Frame${selectionOperationBlockHint}`}
            onclick={() => {
              nextFrame();
            }}
            disabled={tools.playing ||
              activeImage.meta.frames <= 1 ||
              !!floatingSelection}
            class="button small tool"><Fa icon={faArrowRight} /></button
          >
          <button
            aria-label={`Add Frame${selectionOperationBlockHint}`}
            onclick={() => {
              addFrameToCurrentImage();
            }}
            disabled={tools.playing || !!floatingSelection}
            class="button small tool"
          >
            <Fa icon={faAdd} />
          </button>
          <button
            aria-label={`Remove Frame${selectionOperationBlockHint}`}
            disabled={tools.playing ||
              activeImage.meta.frames <= 1 ||
              !!floatingSelection}
            onclick={() => {
              removeFrameFromCurrentImage();
            }}
            class="button small tool"
          >
            <Fa icon={faMinus} />
          </button>
        </div>
        <div class="form-control inline frame-tools-row">
          <div
            class="move-button-wrap"
            style="--highlightcolor:{highlightColor}"
            style:backgroundColor={tools.moving ? 'rgba(0,0,0,0.3)' : null}
          >
            <button
              aria-label={`Pan Frame${selectionActionSuffix}`}
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
              aria-label={`Move Up${selectionActionSuffix}`}
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
              aria-label={`Move Down${selectionActionSuffix}`}
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
              aria-label={`Move Left${selectionActionSuffix}`}
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
              aria-label={`Move Right${selectionActionSuffix}`}
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
            aria-label={`Flip Frame Horizontally${selectionActionSuffix}`}
            onclick={() => {
              flipFrame(
                true,
                activeFrameIdx,
                selectionRegion?.size ?? 0,
                selectionRegion?.offsetX ?? 0,
                selectionRegion?.offsetY ?? 0,
              );
            }}
            class="button small tool"
            disabled={tools.playing}
          >
            <img src={mirrorIcon} alt="mirror" height="20" width="20" />
            <!-- <Fa icon={faArrowsLeftRight} /> -->
          </button>
          <button
            aria-label={`Flip Frame Vertically${selectionActionSuffix}`}
            onclick={() => {
              flipFrame(
                false,
                activeFrameIdx,
                selectionRegion?.size ?? 0,
                selectionRegion?.offsetX ?? 0,
                selectionRegion?.offsetY ?? 0,
              );
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
            aria-label={`Rotate Frame Clockwise${selectionActionSuffix}`}
            onclick={() => {
              rotateFrame(
                true,
                activeFrameIdx,
                selectionRegion?.size ?? 0,
                selectionRegion?.offsetX ?? 0,
                selectionRegion?.offsetY ?? 0,
              );
            }}
            class="button small tool"
            disabled={tools.playing}
          >
            <Fa icon={faRotateRight} />
          </button>
          <button
            aria-label={`Rotate Frame Counter Clockwise${selectionActionSuffix}`}
            onclick={() => {
              rotateFrame(
                false,
                activeFrameIdx,
                selectionRegion?.size ?? 0,
                selectionRegion?.offsetX ?? 0,
                selectionRegion?.offsetY ?? 0,
              );
            }}
            class="button small tool"
            disabled={tools.playing}
          >
            <Fa icon={faRotateLeft} />
          </button>
        </div>
      </div>
      <div class="palette-tools">
        <div class="form-control inline">
          <label for="highlightcolor">Highlight Color:</label>
          <button
            aria-label="Toggle palette flash"
            class="button small tool {showFlash ? 'active' : ''}"
            onclick={() => {
              showFlash = !showFlash;
            }}
          >
            <Fa icon={faBolt} />
          </button>
          <input id="highlightcolor" type="color" bind:value={highlightColor} />
        </div>
        <div
          class="form-control inline shape-controls-row {activeShapeTool
            ? 'shape-tools-open'
            : ''}"
        >
          <button
            aria-label="Paint Brush"
            class="button small tool {tools.paintBrush ? 'active' : null}"
            disabled={activeImage == null ||
              activePaletteIdx == -1 ||
              tools.playing}
            onclick={() => {
              if (activeImage != null) {
                tools.paintBrush = !tools.paintBrush;
                tools.paintBucket = false;
                setShapeTool(null);
              }
            }}
          >
            <Fa icon={faPaintBrush} />
          </button>
          <button
            aria-label={`Paint Bucket${selectionActionSuffix}`}
            class="button small tool {tools.paintBucket ? 'active' : null}"
            disabled={activeImage == null ||
              activePaletteIdx == -1 ||
              tools.playing}
            onclick={() => {
              if (activeImage != null) {
                tools.paintBucket = !tools.paintBucket;
                tools.paintBrush = false;
                setShapeTool(null);
              }
            }}
          >
            <Fa icon={faFillDrip} />
          </button>
          <div
            class="shape-paint-wrap {activeShapeTool ? 'active' : ''}"
            style="--highlightcolor:{highlightColor}"
          >
            <button
              type="button"
              aria-label="Shape Tools"
              class="button small tool toggle {activeShapeTool ? 'active' : ''}"
              disabled={activeImage == null ||
                activePaletteIdx == -1 ||
                tools.playing}
              onclick={() => {
                const anyActive = !!activeShapeTool;
                tools.paintBrush = false;
                tools.paintBucket = false;
                setShapeTool(anyActive ? null : 'squareSolid');
              }}
            >
              <Fa icon={faShapes} />
            </button>
            <button
              type="button"
              aria-label="Paint Square Solid"
              class="button small tool shape-btn shape-up {activeShapeTool ===
              'squareSolid'
                ? 'active'
                : null}"
              style:display={activeShapeTool && shapeAnchor === null
                ? 'block'
                : 'none'}
              disabled={activeImage == null ||
                activePaletteIdx == -1 ||
                tools.playing}
              onclick={() => {
                tools.paintBrush = false;
                tools.paintBucket = false;
                setShapeTool('squareSolid');
              }}
            >
              <Fa icon={faSquare} />
            </button>
            <button
              type="button"
              aria-label="Paint Square Outline"
              class="button small tool shape-btn shape-left {activeShapeTool ===
              'squareOutline'
                ? 'active'
                : null}"
              style:display={activeShapeTool && shapeAnchor === null
                ? 'block'
                : 'none'}
              disabled={activeImage == null ||
                activePaletteIdx == -1 ||
                tools.playing}
              onclick={() => {
                tools.paintBrush = false;
                tools.paintBucket = false;
                setShapeTool('squareOutline');
              }}
            >
              <Fa icon={faSquareReg as any} />
            </button>
            <button
              type="button"
              aria-label="Paint Circle Solid"
              class="button small tool shape-btn shape-right {activeShapeTool ===
              'circleSolid'
                ? 'active'
                : null}"
              style:display={activeShapeTool && shapeAnchor === null
                ? 'block'
                : 'none'}
              disabled={activeImage == null ||
                activePaletteIdx == -1 ||
                tools.playing}
              onclick={() => {
                tools.paintBrush = false;
                tools.paintBucket = false;
                setShapeTool('circleSolid');
              }}
            >
              <Fa icon={faCircle} />
            </button>
            <button
              type="button"
              aria-label="Paint Circle Outline"
              class="button small tool shape-btn shape-down {activeShapeTool ===
              'circleOutline'
                ? 'active'
                : null}"
              style:display={activeShapeTool && shapeAnchor === null
                ? 'block'
                : 'none'}
              disabled={activeImage == null ||
                activePaletteIdx == -1 ||
                tools.playing}
              onclick={() => {
                tools.paintBrush = false;
                tools.paintBucket = false;
                setShapeTool('circleOutline');
              }}
            >
              <Fa icon={faCircleReg as any} />
            </button>
            {#if activeShapeTool && shapeAnchor !== null}
              <button
                type="button"
                aria-label="Confirm shape"
                class="button small tool shape-confirm"
                onclick={() => confirmShape()}
              >
                <Fa icon={faCheck} />
              </button>
              <button
                type="button"
                aria-label="Cancel shape"
                class="button small tool shape-cancel"
                onclick={() => cancelShape()}
              >
                <Fa icon={faXmark} />
              </button>
            {/if}
          </div>
        </div>
        <div class="form-control inline palette-add-row">
          <label for="palettecolor">Palette Color:</label>
          <input
            id="palettecolor"
            type="color"
            disabled={activePaletteIdx === -1}
            bind:value={activePaletteColor.get, activePaletteColor.set}
          />
          <button
            aria-label="Reset palette color to saved"
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
            class="button small tool add-palette-btn"
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
      <p>Current palette length: {currentPalette.length}</p>
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
<MouseCursor
  iconSrc={activeShapeTool
    ? multishape
    : tools.paintBucket
      ? paintbucket
      : paintbrush}
  containerSelector=".pixel-grid"
  showCursor={tools.paintBrush || tools.paintBucket || !!activeShapeTool}
/>
