import { CoverRenderer } from './cover.js';

const SAMPLE_SOURCES = ['../samples/boulevard.jpg', '../samples/pier.jpg'];
const GRADE_NAMES = {
  original: 'Clean print',
  'gta-ink': 'GTA Ink',
  'sun-bleach': 'Sun bleach',
};

const canvas = document.querySelector('#cover-canvas');
const renderer = new CoverRenderer(canvas);
const photoInput = document.querySelector('#photo-input');
const dropzone = document.querySelector('#dropzone');
const slotButtons = [...document.querySelectorAll('.slot')];
const gradeButtons = [...document.querySelectorAll('.grade-button')];
const captionInput = document.querySelector('#caption-input');
const exportButton = document.querySelector('#export-button');
const photoCount = document.querySelector('#photo-count');
const projectState = document.querySelector('#project-state');
const railStatus = document.querySelector('#rail-status');
const renderStatus = document.querySelector('#render-status');
const gradeReadout = document.querySelector('#grade-readout');

const state = {
  caption: captionInput.value,
  grade: 'gta-ink',
  selectedSlot: 0,
  images: Array.from({ length: 6 }, () => null),
  isBusy: false,
};

function setStatus(message, isError = false) {
  railStatus.textContent = message;
  railStatus.classList.toggle('is-error', isError);
}

function setRenderStatus(message) {
  renderStatus.textContent = message;
}

function render() {
  renderer.render({ images: state.images, caption: state.caption, grade: state.grade });
  gradeReadout.textContent = GRADE_NAMES[state.grade];
  setRenderStatus(`${GRADE_NAMES[state.grade]} applied locally`);
}

function updatePhotoCount() {
  const count = state.images.filter(Boolean).length;
  photoCount.textContent = `${count} / 6`;
  projectState.textContent = count === 0 ? 'Ready for a new cut' : `${count} frame${count === 1 ? '' : 's'} in the cut`;
}

function updateSlot(slotIndex) {
  const button = slotButtons[slotIndex];
  const entry = state.images[slotIndex];
  if (!button) return;
  const thumb = button.querySelector('.slot-thumb');
  const name = button.querySelector('.slot-name');
  button.classList.toggle('has-image', Boolean(entry));
  button.classList.toggle('is-active', slotIndex === state.selectedSlot);
  button.setAttribute('aria-label', `Frame ${slotIndex + 1}${slotIndex === state.selectedSlot ? ', selected' : ''}${entry ? `, ${entry.name}` : ', empty'}`);
  if (entry) {
    thumb.style.backgroundImage = `url("${entry.url || entry.src}")`;
    name.textContent = entry.name.length > 13 ? `${entry.name.slice(0, 11)}…` : entry.name;
  } else {
    thumb.style.backgroundImage = '';
    name.textContent = 'Open';
  }
}

function updateSlots() {
  slotButtons.forEach((_, index) => updateSlot(index));
  updatePhotoCount();
}

function selectSlot(slotIndex, openPicker = false) {
  state.selectedSlot = slotIndex;
  updateSlots();
  if (openPicker) photoInput.click();
}

function revokeEntry(entry) {
  if (entry?.url) URL.revokeObjectURL(entry.url);
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The image could not be opened.'));
    image.src = source;
  });
}

async function addFiles(fileList) {
  const files = [...fileList].filter((file) => file.type.startsWith('image/')).slice(0, 6);
  if (files.length === 0) {
    setStatus('Choose a JPG, PNG, or WebP image.', true);
    return;
  }

  state.isBusy = true;
  exportButton.disabled = true;
  setStatus('Loading photos locally…');
  for (const file of files) {
    const targetIndex = state.images.findIndex((entry) => !entry);
    const slotIndex = targetIndex === -1 ? state.selectedSlot : targetIndex;
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url);
      revokeEntry(state.images[slotIndex]);
      state.images[slotIndex] = { image, url, src: url, name: file.name };
      state.selectedSlot = (slotIndex + 1) % 6;
      updateSlots();
      render();
    } catch (error) {
      URL.revokeObjectURL(url);
      setStatus(error.message, true);
    }
  }
  state.isBusy = false;
  exportButton.disabled = false;
  updateSlots();
  setStatus(`${files.length} photo${files.length === 1 ? '' : 's'} ready. Keep shaping the cover.`);
}

function slugify(value) {
  return (value || 'palm-fever')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 42) || 'palm-fever';
}

function exportCover() {
  if (state.isBusy) return;
  setStatus('Preparing your PNG…');
  canvas.toBlob((blob) => {
    if (!blob) {
      setStatus('The canvas could not be exported.', true);
      return;
    }
    const link = document.createElement('a');
    link.download = `${slugify(state.caption)}-cover.png`;
    link.href = URL.createObjectURL(blob);
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    setStatus('PNG exported. Your original photos stayed local.');
  }, 'image/png');
}

photoInput.addEventListener('change', (event) => {
  addFiles(event.target.files);
  event.target.value = '';
});

dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropzone.classList.add('is-dragging');
});

dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragging'));
dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropzone.classList.remove('is-dragging');
  addFiles(event.dataTransfer.files);
});

slotButtons.forEach((button, index) => {
  button.addEventListener('click', () => selectSlot(index, true));
});

captionInput.addEventListener('input', (event) => {
  state.caption = event.target.value;
  render();
});

gradeButtons.forEach((button) => {
  button.setAttribute('aria-pressed', button.dataset.grade === state.grade ? 'true' : 'false');
  button.addEventListener('click', () => {
    state.grade = button.dataset.grade;
    gradeButtons.forEach((gradeButton) => {
      const isActive = gradeButton === button;
      gradeButton.classList.toggle('is-active', isActive);
      gradeButton.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    render();
    setStatus(`${GRADE_NAMES[state.grade]} is on the canvas.`);
  });
});

exportButton.addEventListener('click', exportCover);

async function loadSamples() {
  setStatus('Loading bundled sample photos…');
  const loaded = await Promise.all(SAMPLE_SOURCES.map(async (src) => {
    try {
      const image = await loadImage(src);
      return { image, src, name: src.split('/').pop() };
    } catch {
      return null;
    }
  }));
  loaded.forEach((entry, index) => {
    if (entry) state.images[index] = entry;
  });
  updateSlots();
  render();
  setStatus('Sample photos loaded. Drop in your own cast when ready.');
}

updateSlots();
render();
loadSamples();
