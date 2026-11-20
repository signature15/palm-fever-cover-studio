const CANVAS_SIZE = 1080;
const MARGIN = 34;
const TITLE_HEIGHT = 112;
const GRID_TOP = 170;
const GRID_GAP = 18;
const PANEL_WIDTH = Math.floor((CANVAS_SIZE - MARGIN * 2 - GRID_GAP) / 2);
const PANEL_HEIGHT = Math.floor((CANVAS_SIZE - GRID_TOP - MARGIN * 2 - GRID_GAP * 2) / 3);
const COLORS = {
  paper: '#e8deca',
  ink: '#101416',
  coral: '#eb5b46',
  yellow: '#e5b64f',
  moss: '#7e927c',
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function luminance(r, g, b) {
  return r * 0.299 + g * 0.587 + b * 0.114;
}

function fitText(ctx, text, maxWidth, startSize, family = 'Arial Narrow, Arial, sans-serif') {
  let size = startSize;
  while (size > 18) {
    ctx.font = `900 ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  }
  return size;
}

function drawCoverImage(ctx, image, width, height) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#263034';
  ctx.fillRect(0, 0, width, height);

  if (!image || !image.naturalWidth) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#9b4c42');
    gradient.addColorStop(0.56, '#e0a14e');
    gradient.addColorStop(1, '#3f5b58');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(16, 20, 22, 0.28)';
    ctx.fillRect(0, height * 0.64, width, height * 0.36);
    ctx.beginPath();
    ctx.arc(width * 0.73, height * 0.33, height * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(235, 91, 70, 0.84)';
    ctx.fill();
    return;
  }

  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;
  let sourceX = 0;
  let sourceY = 0;

  if (sourceRatio > targetRatio) {
    sourceWidth = image.naturalHeight * targetRatio;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = image.naturalWidth / targetRatio;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }

  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
}

function applyGtaInk(ctx, width, height) {
  const frame = ctx.getImageData(0, 0, width, height);
  const source = new Uint8ClampedArray(frame.data);
  const pixels = frame.data;
  const levels = 6;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const red = source[index];
      const green = source[index + 1];
      const blue = source[index + 2];
      const left = (y * width + Math.max(0, x - 1)) * 4;
      const right = (y * width + Math.min(width - 1, x + 1)) * 4;
      const up = (Math.max(0, y - 1) * width + x) * 4;
      const down = (Math.min(height - 1, y + 1) * width + x) * 4;
      const currentLum = luminance(red, green, blue);
      const horizontal = Math.abs(currentLum - luminance(source[left], source[left + 1], source[left + 2]));
      const horizontalRight = Math.abs(currentLum - luminance(source[right], source[right + 1], source[right + 2]));
      const vertical = Math.abs(currentLum - luminance(source[up], source[up + 1], source[up + 2]));
      const verticalDown = Math.abs(currentLum - luminance(source[down], source[down + 1], source[down + 2]));
      const edge = Math.max(horizontal, horizontalRight, vertical, verticalDown);
      const contrast = (value) => clamp((value - 128) * 1.16 + 128, 0, 255);
      const posterize = (value) => Math.round(contrast(value) / 255 * (levels - 1)) * (255 / (levels - 1));
      const ink = edge > 34 ? 0 : edge > 21 ? 24 : 255;
      const edgeMix = edge > 21 ? clamp((edge - 21) / 18, 0, 1) : 0;

      pixels[index] = clamp(posterize(red) * (1 - edgeMix) + ink * edgeMix, 0, 255);
      pixels[index + 1] = clamp(posterize(green) * (1 - edgeMix) + ink * edgeMix, 0, 255);
      pixels[index + 2] = clamp(posterize(blue) * (1 - edgeMix) + ink * edgeMix, 0, 255);
    }
  }

  ctx.putImageData(frame, 0, 0);
}

function applySunBleach(ctx, width, height) {
  const frame = ctx.getImageData(0, 0, width, height);
  const pixels = frame.data;
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = clamp(pixels[index] * 1.08 + 16, 0, 255);
    pixels[index + 1] = clamp(pixels[index + 1] * 0.96 + 14, 0, 255);
    pixels[index + 2] = clamp(pixels[index + 2] * 0.74 + 10, 0, 255);
  }
  ctx.putImageData(frame, 0, 0);
}

function drawPaperTexture(ctx) {
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = COLORS.ink;
  for (let index = 0; index < 680; index += 1) {
    const x = (index * 83) % CANVAS_SIZE;
    const y = (index * 47) % CANVAS_SIZE;
    const width = 1 + (index % 4);
    ctx.fillRect(x, y, width, 1);
  }
  ctx.restore();
}

function drawBillboard(ctx, title) {
  const safeTitle = (title || 'Palm Fever').trim() || 'Palm Fever';
  const titleText = safeTitle.toUpperCase();
  ctx.save();
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(MARGIN + 9, MARGIN + 10, CANVAS_SIZE - MARGIN * 2, TITLE_HEIGHT);
  ctx.fillStyle = COLORS.coral;
  ctx.fillRect(MARGIN, MARGIN, CANVAS_SIZE - MARGIN * 2, TITLE_HEIGHT);

  const titleSize = fitText(ctx, titleText, 760, 92);
  ctx.font = `900 ${titleSize}px Arial Narrow, Arial, sans-serif`;
  ctx.fillStyle = COLORS.ink;
  ctx.textBaseline = 'middle';
  ctx.fillText(titleText, MARGIN + 24, MARGIN + 51);

  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(CANVAS_SIZE - MARGIN - 186, MARGIN + 17, 162, 78);
  ctx.fillStyle = COLORS.ink;
  ctx.font = '900 15px Arial Narrow, Arial, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('PALM FEVER', CANVAS_SIZE - MARGIN - 171, MARGIN + 42);
  ctx.font = '700 12px Arial, sans-serif';
  ctx.fillText('NIGHT SHIFT / 06', CANVAS_SIZE - MARGIN - 171, MARGIN + 64);
  ctx.font = '700 10px Arial, sans-serif';
  ctx.fillStyle = COLORS.coral;
  ctx.fillText('LOCAL CUT', CANVAS_SIZE - MARGIN - 171, MARGIN + 83);
  ctx.restore();
}

export class CoverRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d', { alpha: false });
    this.buffer = document.createElement('canvas');
    this.buffer.width = PANEL_WIDTH;
    this.buffer.height = PANEL_HEIGHT;
    this.bufferContext = this.buffer.getContext('2d', { alpha: false });
  }

  render({ images = [], caption = 'Palm Fever', grade = 'gta-ink' } = {}) {
    const ctx = this.context;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    drawBillboard(ctx, caption);

    for (let index = 0; index < 6; index += 1) {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = MARGIN + column * (PANEL_WIDTH + GRID_GAP);
      const y = GRID_TOP + row * (PANEL_HEIGHT + GRID_GAP);
      const image = images[index]?.image ?? images[index % 2]?.image ?? null;
      drawCoverImage(this.bufferContext, image, PANEL_WIDTH, PANEL_HEIGHT);
      if (grade === 'gta-ink') applyGtaInk(this.bufferContext, PANEL_WIDTH, PANEL_HEIGHT);
      if (grade === 'sun-bleach') applySunBleach(this.bufferContext, PANEL_WIDTH, PANEL_HEIGHT);
      ctx.drawImage(this.buffer, x, y, PANEL_WIDTH, PANEL_HEIGHT);

      ctx.save();
      ctx.strokeStyle = COLORS.paper;
      ctx.lineWidth = 5;
      ctx.strokeRect(x + 2.5, y + 2.5, PANEL_WIDTH - 5, PANEL_HEIGHT - 5);
      ctx.fillStyle = COLORS.paper;
      ctx.fillRect(x + 13, y + PANEL_HEIGHT - 33, 42, 20);
      ctx.fillStyle = COLORS.ink;
      ctx.font = '900 12px Arial Narrow, Arial, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(index + 1).padStart(2, '0'), x + 22, y + PANEL_HEIGHT - 23);
      ctx.restore();
    }

    drawPaperTexture(ctx);
    return this.canvas;
  }
}
