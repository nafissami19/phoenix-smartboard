import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { toArrayBuffer } from './buffer';

// XML and DOM Helpers
const children = (node: Element | Document | undefined, name: string): Element[] =>
  node ? Array.from(node.getElementsByTagNameNS('*', name)) : [];

const first = (node: Element | Document | undefined, name: string): Element | undefined =>
  children(node, name)[0];

const direct = (node: Element | undefined, name: string): Element | undefined =>
  node ? Array.from(node.children).find((e) => e.localName === name) : undefined;

const attr = (node: Element | undefined, name: string): string => {
  if (!node) return '';
  const a = Array.from(node.attributes).find((at) => at.localName === name);
  return a ? a.value : '';
};

const numeric = (val: string | null | undefined, fallback = 0): number => {
  if (!val) return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
};

function parseXml(xmlStr: string): Document {
  if (xmlStr.length > 30 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(xmlStr)) {
    throw new Error('Unsupported or oversized Office XML');
  }
  const doc = new DOMParser().parseFromString(xmlStr, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('The Office document contains invalid XML');
  }
  return doc;
}

function resolvePath(base: string, target: string): string {
  const parts = base.split('/');
  parts.pop();
  for (const part of target.split('/')) {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }
  return parts.join('/');
}

// Color Resolver
type ColorPalette = Record<string, string>;

function extractThemePalette(themeDoc: Document | undefined): ColorPalette {
  const palette: ColorPalette = {
    dk1: '#000000',
    lt1: '#ffffff',
    dk2: '#1f2937',
    lt2: '#f3f4f6',
    accent1: '#0062ff',
    accent2: '#e63946',
    accent3: '#2a9d8f',
    accent4: '#e76f51',
    accent5: '#f4a261',
    accent6: '#8338ec',
    hlink: '#2563eb',
    folHlink: '#7c3aed',
  };

  if (!themeDoc) return palette;

  const clrScheme = first(themeDoc, 'clrScheme');
  if (!clrScheme) return palette;

  for (const child of Array.from(clrScheme.children)) {
    const slotName = child.localName;
    const srgb = first(child, 'srgbClr');
    const sys = first(child, 'sysClr');
    if (srgb && /^[0-9a-f]{6}$/i.test(attr(srgb, 'val'))) {
      palette[slotName] = '#' + attr(srgb, 'val');
    } else if (sys) {
      const val = attr(sys, 'lastClr') || attr(sys, 'val');
      if (/^[0-9a-f]{6}$/i.test(val)) {
        palette[slotName] = '#' + val;
      }
    }
  }

  return palette;
}

function resolveColor(fillElement: Element | undefined, palette: ColorPalette, fallback = '#000000'): string {
  if (!fillElement) return fallback;
  const srgb = first(fillElement, 'srgbClr');
  if (srgb && /^[0-9a-f]{6}$/i.test(attr(srgb, 'val'))) {
    return '#' + attr(srgb, 'val');
  }
  const scheme = attr(first(fillElement, 'schemeClr'), 'val');
  if (scheme) {
    const mapped: Record<string, string> = {
      bg1: 'lt1',
      tx1: 'dk1',
      bg2: 'lt2',
      tx2: 'dk2',
    };
    const key = mapped[scheme] || scheme;
    return palette[key] || fallback;
  }
  return fallback;
}

// Bounding Box calculation
interface TransformBox {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
}

function parseTransform(node: Element, parentBox?: TransformBox): TransformBox {
  const spPr = direct(node, 'spPr') || first(node, 'spPr') || node;
  const xfrm = direct(spPr, 'xfrm') || first(spPr, 'xfrm') || first(node, 'xfrm');
  const off = direct(xfrm, 'off') || first(xfrm, 'off');
  const ext = direct(xfrm, 'ext') || first(xfrm, 'ext');

  let x = numeric(attr(off, 'x')) / 9525;
  let y = numeric(attr(off, 'y')) / 9525;
  let w = numeric(attr(ext, 'cx'), 1905000) / 9525;
  let h = numeric(attr(ext, 'cy'), 952500) / 9525;
  let rotation = (numeric(attr(xfrm, 'rot')) / 60000) * (Math.PI / 180);
  const flipH = ['1', 'true'].includes(attr(xfrm, 'flipH'));
  const flipV = ['1', 'true'].includes(attr(xfrm, 'flipV'));

  if (parentBox) {
    x += parentBox.x;
    y += parentBox.y;
  }

  return { x, y, w, h, rotation, flipH, flipV };
}

// Slide Renderer on HTML5 Canvas
interface RenderContext {
  ctx: CanvasRenderingContext2D;
  scale: number;
  palette: ColorPalette;
  mediaMap: Map<string, string>;
  imageElements: Map<string, HTMLImageElement>;
}

function drawShape(box: TransformBox, spNode: Element, rc: RenderContext) {
  const { ctx, palette } = rc;
  const spPr = direct(spNode, 'spPr');
  if (!spPr) return;

  const solidFill = direct(spPr, 'solidFill');
  const gradFill = direct(spPr, 'gradFill');
  const ln = direct(spPr, 'ln');
  const prstGeom = direct(spPr, 'prstGeom');
  const preset = attr(prstGeom, 'prst') || 'rect';

  ctx.save();
  ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
  if (box.rotation) ctx.rotate(box.rotation);
  if (box.flipH || box.flipV) ctx.scale(box.flipH ? -1 : 1, box.flipV ? -1 : 1);
  ctx.translate(-box.w / 2, -box.h / 2);

  let fillStyle: string | CanvasGradient | null = null;
  const blipFill = direct(spPr, 'blipFill') || first(spPr, 'blipFill');
  if (blipFill) {
    const blip = first(blipFill, 'blip');
    const embedId = blip ? (attr(blip, 'embed') || attr(blip, 'link')) : '';
    const mediaPath = rc.mediaMap.get(embedId);
    if (mediaPath) {
      const img = rc.imageElements.get(mediaPath);
      if (img) {
        ctx.drawImage(img, 0, 0, box.w, box.h);
      }
    }
  }

  if (solidFill) {
    fillStyle = resolveColor(solidFill, palette, '#ffffff');
  } else if (gradFill) {
    const stops = children(gradFill, 'gs');
    if (stops.length > 0) {
      const grad = ctx.createLinearGradient(0, 0, box.w, box.h);
      for (const stop of stops) {
        const pos = numeric(attr(stop, 'pos')) / 100000;
        const color = resolveColor(stop, palette, '#ffffff');
        grad.addColorStop(Math.min(1, Math.max(0, pos)), color);
      }
      fillStyle = grad;
    }
  }

  let strokeStyle: string | null = null;
  let lineWidth = 0;
  if (ln) {
    lineWidth = numeric(attr(ln, 'w'), 19050) / 9525;
    strokeStyle = resolveColor(direct(ln, 'solidFill') || ln, palette, '#2f3542');
  }

  ctx.beginPath();
  if (preset === 'ellipse') {
    ctx.ellipse(box.w / 2, box.h / 2, box.w / 2, box.h / 2, 0, 0, Math.PI * 2);
  } else if (preset === 'roundRect') {
    const r = Math.min(box.w, box.h) * 0.12;
    ctx.roundRect(0, 0, box.w, box.h, r);
  } else if (preset === 'triangle') {
    ctx.moveTo(box.w / 2, 0);
    ctx.lineTo(box.w, box.h);
    ctx.lineTo(0, box.h);
    ctx.closePath();
  } else if (preset === 'diamond') {
    ctx.moveTo(box.w / 2, 0);
    ctx.lineTo(box.w, box.h / 2);
    ctx.lineTo(box.w / 2, box.h);
    ctx.lineTo(0, box.h / 2);
    ctx.closePath();
  } else if (preset === 'line') {
    ctx.moveTo(0, box.h / 2);
    ctx.lineTo(box.w, box.h / 2);
  } else {
    // Default rectangle
    ctx.rect(0, 0, box.w, box.h);
  }

  if (fillStyle && preset !== 'line') {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }

  if (strokeStyle && lineWidth > 0) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  ctx.restore();
}

function drawPicture(box: TransformBox, picNode: Element, rc: RenderContext) {
  const { ctx, mediaMap, imageElements } = rc;
  const blip = first(picNode, 'blip');
  if (!blip) return;

  const embedId = attr(blip, 'embed') || attr(blip, 'link');
  const mediaPath = mediaMap.get(embedId);
  if (!mediaPath) return;

  const img = imageElements.get(mediaPath);
  if (!img) return;

  ctx.save();
  ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
  if (box.rotation) ctx.rotate(box.rotation);
  if (box.flipH || box.flipV) ctx.scale(box.flipH ? -1 : 1, box.flipV ? -1 : 1);
  ctx.drawImage(img, -box.w / 2, -box.h / 2, box.w, box.h);
  ctx.restore();
}

function drawText(box: TransformBox, spNode: Element, rc: RenderContext) {
  const { ctx, palette } = rc;
  const txBody = direct(spNode, 'txBody');
  if (!txBody) return;

  const bodyPr = direct(txBody, 'bodyPr');
  const lIns = numeric(attr(bodyPr, 'lIns'), 91440) / 9525;
  const rIns = numeric(attr(bodyPr, 'rIns'), 91440) / 9525;
  const tIns = numeric(attr(bodyPr, 'tIns'), 45720) / 9525;
  const anchor = attr(bodyPr, 'anchor') || 't';

  const paragraphs = children(txBody, 'p');
  if (paragraphs.length === 0) return;

  const availableWidth = Math.max(1, box.w - lIns - rIns);

  // Line measurement and gathering
  interface TextLine {
    text: string;
    fontSize: number;
    fontFamily: string;
    bold: boolean;
    italic: boolean;
    color: string;
    align: string;
    width: number;
  }

  const lines: TextLine[] = [];

  for (const p of paragraphs) {
    const pPr = direct(p, 'pPr');
    const align = attr(pPr, 'algn') || 'l';
    const runs = children(p, 'r');

    if (runs.length === 0) {
      // Empty line / paragraph break
      lines.push({
        text: '',
        fontSize: 16,
        fontFamily: 'system-ui, sans-serif',
        bold: false,
        italic: false,
        color: palette.dk1,
        align,
        width: 0,
      });
      continue;
    }

    let pText = '';
    let pSize = 16;
    let pFont = 'system-ui, sans-serif';
    let pBold = false;
    let pItalic = false;
    let pColor = palette.dk1;

    for (const r of runs) {
      const rPr = direct(r, 'rPr');
      const t = direct(r, 't')?.textContent || '';
      if (!t) continue;

      const sz = numeric(attr(rPr, 'sz'));
      if (sz > 0) pSize = (sz / 100) * (96 / 72);

      const latin = direct(rPr, 'latin');
      const typeface = attr(latin, 'typeface');
      if (typeface && !typeface.startsWith('+')) pFont = typeface;

      pBold = ['1', 'true'].includes(attr(rPr, 'b'));
      pItalic = ['1', 'true'].includes(attr(rPr, 'i'));

      const solidFill = direct(rPr, 'solidFill');
      if (solidFill) pColor = resolveColor(solidFill, palette, pColor);

      pText += t;
    }

    // Word wrap
    ctx.font = `${pItalic ? 'italic ' : ''}${pBold ? '700 ' : '400 '}${pSize}px "${pFont}", sans-serif`;
    const words = pText.split(/(\s+)/);
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine + word;
      const testWidth = ctx.measureText(testLine).width;
      if (testWidth > availableWidth && currentLine.trim().length > 0) {
        lines.push({
          text: currentLine,
          fontSize: pSize,
          fontFamily: pFont,
          bold: pBold,
          italic: pItalic,
          color: pColor,
          align,
          width: ctx.measureText(currentLine).width,
        });
        currentLine = word.trimStart();
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine.length > 0) {
      lines.push({
        text: currentLine,
        fontSize: pSize,
        fontFamily: pFont,
        bold: pBold,
        italic: pItalic,
        color: pColor,
        align,
        width: ctx.measureText(currentLine).width,
      });
    }
  }

  // Calculate total height
  let totalTextHeight = 0;
  for (const l of lines) {
    totalTextHeight += Math.max(l.fontSize * 1.25, 12);
  }

  // Vertical alignment
  let startY = box.y + tIns;
  if (anchor === 'ctr') {
    startY = box.y + Math.max(tIns, (box.h - totalTextHeight) / 2);
  } else if (anchor === 'b') {
    startY = box.y + Math.max(tIns, box.h - totalTextHeight - tIns);
  }

  // Render lines
  ctx.save();
  if (box.rotation) {
    ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
    ctx.rotate(box.rotation);
    ctx.translate(-box.w / 2, -box.h / 2);
  }

  let curY = startY;
  for (const l of lines) {
    if (!l.text) {
      curY += l.fontSize * 0.8;
      continue;
    }

    ctx.font = `${l.italic ? 'italic ' : ''}${l.bold ? '700 ' : '400 '}${l.fontSize}px "${l.fontFamily}", sans-serif`;
    ctx.fillStyle = l.color;
    ctx.textBaseline = 'top';

    let curX = box.x + lIns;
    if (l.align === 'ctr') {
      curX = box.x + lIns + Math.max(0, (availableWidth - l.width) / 2);
    } else if (l.align === 'r') {
      curX = box.x + lIns + Math.max(0, availableWidth - l.width);
    }

    ctx.fillText(l.text, curX, curY);
    curY += Math.max(l.fontSize * 1.25, 12);
  }

  ctx.restore();
}

function drawTable(box: TransformBox, tblNode: Element, rc: RenderContext) {
  const { ctx, palette } = rc;
  const tblGrid = direct(tblNode, 'tblGrid');
  const cols = children(tblGrid, 'gridCol');
  const rows = children(tblNode, 'tr');
  if (rows.length === 0 || cols.length === 0) return;

  const colWidths = cols.map((c) => numeric(attr(c, 'w')) / 9525);
  let curY = box.y;

  for (const tr of rows) {
    const rowH = numeric(attr(tr, 'h'), 285750) / 9525;
    const cells = children(tr, 'tc');
    let curX = box.x;

    for (let cIdx = 0; cIdx < cells.length; cIdx++) {
      const tc = cells[cIdx];
      const cellW = colWidths[cIdx] || box.w / cells.length;
      const tcPr = direct(tc, 'tcPr');

      // Cell Background Fill
      const solidFill = direct(tcPr, 'solidFill');
      const cellBg = solidFill ? resolveColor(solidFill, palette, '#ffffff') : '#ffffff';

      ctx.fillStyle = cellBg;
      ctx.fillRect(curX, curY, cellW, rowH);

      // Cell Border
      ctx.strokeStyle = palette.lt2 || '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.strokeRect(curX, curY, cellW, rowH);

      // Cell Text
      const txBody = direct(tc, 'txBody');
      if (txBody) {
        drawText(
          {
            x: curX + 4,
            y: curY + 2,
            w: cellW - 8,
            h: rowH - 4,
            rotation: 0,
            flipH: false,
            flipV: false,
          },
          tc,
          rc,
        );
      }

      curX += cellW;
    }

    curY += rowH;
  }
}

function drawGroup(grpNode: Element, rc: RenderContext, parentBox?: TransformBox) {
  const grpBox = parseTransform(grpNode, parentBox);
  for (const child of Array.from(grpNode.children)) {
    if (child.localName === 'sp') {
      const box = parseTransform(child, grpBox);
      drawShape(box, child, rc);
      drawText(box, child, rc);
    } else if (child.localName === 'pic') {
      const box = parseTransform(child, grpBox);
      drawPicture(box, child, rc);
    } else if (child.localName === 'grpSp') {
      drawGroup(child, rc, grpBox);
    }
  }
}

/**
 * High-Fidelity Client-Side PPTX to PDF Converter.
 * Unzips the PPTX, extracts layouts, theme colors, media, shapes, tables, and typography,
 * renders each slide into high-definition 2x snapshots, and compiles them into a clean PDF.
 */
export async function convertPptxToPdf(
  fileInput: File | Blob | ArrayBuffer,
  onProgress?: (current: number, total: number) => void,
): Promise<{ pdfBlob: Blob; title: string; slideCount: number }> {
  const buffer = await toArrayBuffer(fileInput);
  if (buffer.byteLength > 60 * 1024 * 1024) {
    throw new Error('Please choose a presentation under 60 MB.');
  }

  const fileName = (fileInput as File)?.name || 'Presentation.pptx';
  const cleanTitle = fileName.replace(/\.[^/.]+$/, '').trim() || 'Class Lesson';

  const zip = await JSZip.loadAsync(buffer);

  // 1. Parse Presentation Dimensions
  const presEntry = zip.file('ppt/presentation.xml');
  if (!presEntry) {
    throw new Error('Invalid presentation file (missing ppt/presentation.xml).');
  }

  const presDoc = parseXml(await presEntry.async('string'));
  const sldSz = first(presDoc, 'sldSz');
  // PowerPoint EMU conversion:
  // 1 inch = 914,400 EMU. At 96 DPI (canvas coordinates): 914400 / 96 = 9525 EMU per pixel.
  // At 72 DPI (PDF units): 914400 / 72 = 12700 EMU per point.
  const slideWidthPx = Math.max(200, Math.round(numeric(attr(sldSz, 'cx'), 12192000) / 9525));
  const slideHeightPx = Math.max(150, Math.round(numeric(attr(sldSz, 'cy'), 6858000) / 9525));

  const slideWidthPt = Math.max(150, numeric(attr(sldSz, 'cx'), 12192000) / 12700);
  const slideHeightPt = Math.max(100, numeric(attr(sldSz, 'cy'), 6858000) / 12700);

  // 2. Map Slide Order & Relationships
  const presRelsEntry = zip.file('ppt/_rels/presentation.xml.rels');
  const presRelsDoc = presRelsEntry ? parseXml(await presRelsEntry.async('string')) : undefined;
  const relMap = new Map<string, string>();

  if (presRelsDoc) {
    for (const rel of children(presRelsDoc, 'Relationship')) {
      const id = attr(rel, 'Id');
      const target = attr(rel, 'Target');
      relMap.set(id, resolvePath('ppt/presentation.xml', target));
    }
  }

  const sldIdNodes = children(presDoc, 'sldId');
  const slidePaths = sldIdNodes
    .map((node) => {
      const rId =
        node.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ||
        attr(node, 'id');
      return relMap.get(rId);
    })
    .filter((p): p is string => !!p && zip.file(p) !== null);

  const finalSlidePaths =
    slidePaths.length > 0
      ? slidePaths
      : Object.keys(zip.files)
          .filter((k) => /^ppt\/slides\/slide\d+\.xml$/i.test(k))
          .sort((a, b) => {
            const na = parseInt(a.replace(/\D/g, ''), 10) || 0;
            const nb = parseInt(b.replace(/\D/g, ''), 10) || 0;
            return na - nb;
          });

  if (finalSlidePaths.length === 0) {
    throw new Error('No slides found in presentation.');
  }

  // 3. Theme Colors
  const themeEntry = zip.file('ppt/theme/theme1.xml');
  const themeDoc = themeEntry ? parseXml(await themeEntry.async('string')) : undefined;
  const palette = extractThemePalette(themeDoc);

  // 4. Preload Media Assets
  const mediaMap = new Map<string, string>();
  const imageElements = new Map<string, HTMLImageElement>();
  const objectUrls: string[] = [];

  for (const path of Object.keys(zip.files)) {
    if (path.startsWith('ppt/media/')) {
      const entry = zip.file(path);
      if (entry) {
        const bytes = await entry.async('uint8array');
        const ext = path.split('.').pop()?.toLowerCase() || 'png';
        const mime =
          ext === 'jpg' || ext === 'jpeg'
            ? 'image/jpeg'
            : ext === 'png'
            ? 'image/png'
            : ext === 'webp'
            ? 'image/webp'
            : ext === 'svg'
            ? 'image/svg+xml'
            : 'image/png';
        const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime });
        const url = URL.createObjectURL(blob);
        objectUrls.push(url);

        const img = new Image();
        img.src = url;
        await img.decode().catch(() => {});
        imageElements.set(path, img);
      }
    }
  }

  // 5. Setup jsPDF Instance
  const orientation = slideWidthPt >= slideHeightPt ? 'landscape' : 'portrait';
  const pdf = new jsPDF({
    orientation,
    unit: 'pt',
    format: [slideWidthPt, slideHeightPt],
    compress: true,
  });

  // 2x Retina scale for crisp lines and text matching slide pixel dimensions exactly
  const renderScale = 2;
  const canvasWidth = Math.round(slideWidthPx * renderScale);
  const canvasHeight = Math.round(slideHeightPx * renderScale);

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not initialize canvas rendering context.');

  const totalSlides = finalSlidePaths.length;

  try {
    for (let i = 0; i < totalSlides; i++) {
      onProgress?.(i + 1, totalSlides);
      const slidePath = finalSlidePaths[i];
      const slideFile = zip.file(slidePath);
      if (!slideFile) continue;

      const slideDoc = parseXml(await slideFile.async('string'));

      // Slide Relationships (Media, Layout)
      const slideRelsPath = resolvePath(slidePath, `_rels/${slidePath.split('/').pop()}.rels`);
      const slideRelsFile = zip.file(slideRelsPath);
      const slideMediaMap = new Map<string, string>();
      let layoutDoc: Document | undefined;

      if (slideRelsFile) {
        const relsDoc = parseXml(await slideRelsFile.async('string'));
        for (const rel of children(relsDoc, 'Relationship')) {
          const rId = attr(rel, 'Id');
          const target = attr(rel, 'Target');
          const resolved = resolvePath(slidePath, target);
          slideMediaMap.set(rId, resolved);

          if (target.includes('slideLayout')) {
            const lf = zip.file(resolved);
            if (lf) layoutDoc = parseXml(await lf.async('string'));
          }
        }
      }

      // Reset canvas for current slide
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.scale(renderScale, renderScale);

      // Background Rendering (Slide -> Layout -> Default White)
      const bgNode = first(slideDoc, 'bg') || (layoutDoc ? first(layoutDoc, 'bg') : undefined);
      let bgColor = '#ffffff';
      if (bgNode) {
        const solidFill = first(bgNode, 'solidFill');
        if (solidFill) {
          bgColor = resolveColor(solidFill, palette, '#ffffff');
          ctx.fillStyle = bgColor;
          ctx.fillRect(0, 0, slideWidthPx, slideHeightPx);
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, slideWidthPx, slideHeightPx);
        }

        const blipFill = first(bgNode, 'blipFill');
        if (blipFill) {
          const blip = first(blipFill, 'blip');
          const embedId = blip ? (attr(blip, 'embed') || attr(blip, 'link')) : '';
          const mediaPath = slideMediaMap.get(embedId);
          if (mediaPath) {
            const bgImg = imageElements.get(mediaPath);
            if (bgImg) {
              ctx.drawImage(bgImg, 0, 0, slideWidthPx, slideHeightPx);
            }
          }
        }
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, slideWidthPx, slideHeightPx);
      }

      // Render Context for elements
      const rc: RenderContext = {
        ctx,
        scale: renderScale,
        palette,
        mediaMap: slideMediaMap,
        imageElements,
      };

      // Render Layout Background Elements if available
      if (layoutDoc) {
        for (const sp of children(layoutDoc, 'sp')) {
          const box = parseTransform(sp);
          drawShape(box, sp, rc);
          drawText(box, sp, rc);
        }
      }

      // Render Slide Elements
      const spTree = first(slideDoc, 'spTree');
      const elements = spTree ? Array.from(spTree.children) : children(slideDoc, 'sp');

      for (const el of elements) {
        if (el.localName === 'sp') {
          const box = parseTransform(el);
          drawShape(box, el, rc);
          drawText(box, el, rc);
        } else if (el.localName === 'pic') {
          const box = parseTransform(el);
          drawPicture(box, el, rc);
        } else if (el.localName === 'grpSp') {
          drawGroup(el, rc);
        } else if (el.localName === 'graphicFrame') {
          const tbl = first(el, 'tbl');
          if (tbl) {
            const box = parseTransform(el);
            drawTable(box, tbl, rc);
          }
        }
      }

      // Snapshot slide into PDF
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      if (i > 0) {
        pdf.addPage([slideWidthPt, slideHeightPt], orientation);
      }
      pdf.addImage(imgData, 'JPEG', 0, 0, slideWidthPt, slideHeightPt, undefined, 'FAST');
    }
  } finally {
    // Cleanup temporary resources
    canvas.width = 0;
    canvas.height = 0;
    for (const url of objectUrls) {
      URL.revokeObjectURL(url);
    }
  }

  const pdfBlob = pdf.output('blob');
  return {
    pdfBlob,
    title: cleanTitle,
    slideCount: totalSlides,
  };
}
