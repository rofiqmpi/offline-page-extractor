const $ = (selector) => document.querySelector(selector);
const button = $('#visualExport');
const status = $('#status');
const assetCount = $('#assetCount');
const size = $('#size');

function setStatus(text, error = false) { status.textContent = text; status.classList.toggle('error', error); }
function safeName(value) { return (value || 'page').toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'page'; }
function extFromType(type) { return ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/avif': '.avif' })[type] || '.jpg'; }
async function tab() { return (await chrome.tabs.query({ active: true, currentWindow: true }))[0]; }
async function ask(tabId, type, data = {}) { try { return await chrome.tabs.sendMessage(tabId, { type, ...data }); } catch { await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }); return chrome.tabs.sendMessage(tabId, { type, ...data }); } }
function dataUrlBlob(url) { const [meta, data] = url.split(','); return new Blob([Uint8Array.from(atob(data), c => c.charCodeAt(0))], { type: meta.match(/:(.*?);/)[1] }); }
async function captureFullPage(currentTab, metrics) {
  const first = await chrome.tabs.captureVisibleTab(currentTab.windowId, { format: 'png' });
  const image = new Image(); image.src = first; await image.decode();
  const scale = image.naturalWidth / metrics.viewportWidth;
  const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = Math.ceil(metrics.height * scale);
  const ctx = canvas.getContext('2d'); const maxY = Math.max(0, metrics.height - metrics.viewportHeight);
  for (let y = 0; y <= maxY; y += metrics.viewportHeight) {
    const position = Math.min(y, maxY); await ask(currentTab.id, 'SCROLL_TO', { y: position }); await new Promise(resolve => setTimeout(resolve, 140));
    const shot = await chrome.tabs.captureVisibleTab(currentTab.windowId, { format: 'png' }); const part = new Image(); part.src = shot; await part.decode();
    ctx.drawImage(part, 0, Math.round(position * scale), image.naturalWidth, part.naturalHeight);
    setStatus(`Capturing screenshot ${Math.min(100, Math.round(((position + metrics.viewportHeight) / metrics.height) * 100))}%…`);
    if (position === maxY) break;
  }
  const restored = Math.min(metrics.scrollY, maxY); await ask(currentTab.id, 'SCROLL_TO', { y: restored });
  return await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}
async function downloadImages(images) {
  const unique = [...new Map(images.map(item => [item.url, item])).values()];
  const result = [];
  for (const image of unique) {
    try { const response = await fetch(image.url, { credentials: 'include' }); if (!response.ok) continue; const blob = await response.blob(); if (image.name.endsWith('.jpg') && blob.type && blob.type !== 'image/jpeg') image.name = `asset_${result.length + 1}${extFromType(blob.type)}`; result.push({ image, blob }); } catch {}
  }
  return result;
}
function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function projectFiles(title, visual, assets) {
  const assetMap = new Map(assets.map(({ image }) => [image.url, `images/${image.name}`]));
  const headerEnd = Math.min(180, visual.height * .12); const footerStart = Math.max(headerEnd + 100, visual.height - 150);
  const groups = { header: [], main: [], footer: [] };
  const ordered = visual.elements.filter((element, index, all) => index < 220 && !(element.tag === 'box' && all.some(other => other !== element && other.tag !== 'box' && other.x >= element.x && other.y >= element.y && other.x + other.width <= element.x + element.width && other.y + other.height <= element.y + element.height))).sort((a, b) => (a.tag === 'box' ? -1 : 1) - (b.tag === 'box' ? -1 : 1));
  ordered.forEach(element => { const group = element.y < headerEnd ? 'header' : element.y >= footerStart ? 'footer' : 'main'; groups[group].push(element); });
  const render = element => {
    const style = `left:${element.x}px;top:${element.y}px;width:${element.width}px;height:${element.height}px;color:${element.color};background:${element.background || 'transparent'};font-size:${element.fontSize};font-weight:${element.fontWeight};border-radius:${element.radius || '0'}`;
    if (element.tag === 'img' && assetMap.has(element.image)) return `<img class="visual-image" src="${assetMap.get(element.image)}" alt="" style="${style}">`;
    if (element.tag === 'text') return `<span class="visual-text" style="${style}">${escapeHtml(element.text)}</span>`;
    return `<div class="visual-box" style="${style}"></div>`;
  };
  const section = (name, items) => `<section class="${name}">${items.map(render).join('')}</section>`;
  return {
    html: `<!doctype html>\n<html lang="bn">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>${escapeHtml(title)}</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div class="design-page">\n    <header>${section('header-layer', groups.header)}</header>\n    <main>${section('main-layer', groups.main)}</main>\n    <footer>${section('footer-layer', groups.footer)}</footer>\n  </div>\n</body>\n</html>`,
    css: `* { box-sizing: border-box; }\nhtml, body { margin: 0; background: #ffffff; }\n.design-page { position: relative; width: ${visual.width}px; min-height: ${visual.height}px; overflow: hidden; }\n.design-page header, .design-page main, .design-page footer { position: absolute; inset: 0; width: 100%; height: 100%; }\n.header-layer, .main-layer, .footer-layer { position: absolute; inset: 0; width: 100%; height: 100%; }\n.visual-box, .visual-text, .visual-image { position: absolute; display: block; overflow: hidden; }\n.visual-text { white-space: nowrap; line-height: 1.2; }\n.visual-image { object-fit: cover; }`
  };
}
button.addEventListener('click', async () => {
  button.disabled = true; size.textContent = '—';
  try {
    const currentTab = await tab(); if (!currentTab?.id) throw new Error('No active tab found.');
    const metrics = await ask(currentTab.id, 'PAGE_METRICS'); if (!metrics?.ok) throw new Error('Could not measure this page.');
    const page = await ask(currentTab.id, 'COLLECT_PAGE');
    const screenshot = await captureFullPage(currentTab, metrics);
    setStatus('Building compact visual HTML/CSS…'); const visual = await ask(currentTab.id, 'VISUAL_ELEMENTS');
    setStatus('Saving visible page images…'); const assets = await downloadImages(page?.images || []);
    const files = projectFiles(page?.title || 'Screenshot design', visual.visual, assets); const zip = new JSZip(); zip.file('index.html', files.html); zip.file('style.css', files.css);
    assets.forEach(({ image, blob }) => zip.file(`images/${image.name}`, blob)); assetCount.textContent = `${assets.length} images`;
    setStatus('Creating compact ZIP…'); const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } }); size.textContent = `${(blob.size / 1024).toFixed(1)} KB`;
    const url = URL.createObjectURL(blob); await chrome.downloads.download({ url, filename: `${safeName(page?.title)}-design.zip`, saveAs: true }); setStatus('Done — screenshot design ZIP downloaded.'); setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch (error) { setStatus(error.message || 'Export failed.', true); }
  finally { button.disabled = false; }
});
