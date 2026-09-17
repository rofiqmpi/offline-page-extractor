const $ = (selector) => document.querySelector(selector);
const visualButton = $('#visualExport');
const cleanButton = $('#cleanExport');
const status = $('#status');
const assetCount = $('#assetCount');
const size = $('#size');

function setStatus(text, error = false) { status.textContent = text; status.classList.toggle('error', error); }
function safeName(value) { return (value || 'offline-page').toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'offline-page'; }
function extFromContentType(type) { return ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/avif': '.avif', 'image/bmp': '.bmp', 'image/x-icon': '.ico' })[type] || '.jpg'; }
async function getCurrentTab() { return (await chrome.tabs.query({ active: true, currentWindow: true }))[0]; }
async function collect(tabId, type = 'COLLECT_PAGE') {
  try { return await chrome.tabs.sendMessage(tabId, { type }); }
  catch { await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }); return chrome.tabs.sendMessage(tabId, { type }); }
}
async function downloadImage(image) {
  try { const response = await fetch(image.url, { credentials: 'include' }); if (!response.ok) throw new Error(); const blob = await response.blob(); if (image.name.endsWith('.jpg') && blob.type && blob.type !== 'image/jpeg') image.name = `img_${crypto.randomUUID().slice(0, 8)}${extFromContentType(blob.type)}`; return { image, blob }; } catch { return null; }
}
function rewriteAssets(html, css, images, baseUrl) {
  const map = new Map(images.map(image => [image.url, `images/${image.name}`]));
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('img[data-offline-src]').forEach(img => { const mapped = map.get(img.getAttribute('data-offline-src')); img.removeAttribute('data-offline-src'); img.removeAttribute('data-offline-name'); if (mapped) img.src = mapped; else img.removeAttribute('src'); });
  const rewrittenCss = css.replace(/url\((['"]?)([^'"()]+)\1\)/g, (full, quote, original) => { let absolute = original; try { absolute = new URL(original, baseUrl).href; } catch {} return map.has(absolute) || map.has(original) ? `url("${map.get(absolute) || map.get(original)}")` : full; });
  return { html: '<!doctype html>\n' + doc.documentElement.outerHTML, css: rewrittenCss };
}
function dataUrlToBlob(dataUrl) { const [meta, data] = dataUrl.split(','); const bytes = Uint8Array.from(atob(data), char => char.charCodeAt(0)); return new Blob([bytes], { type: meta.match(/:(.*?);/)[1] }); }
function visualProject(data, screenshotPath) {
  const palette = data.visual.background || '#ffffff';
  return {
    html: `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>${data.title}</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <main class="visual-page">\n    <img class="reference" src="${screenshotPath}" alt="Static screenshot of the exported viewport">\n  </main>\n</body>\n</html>`,
    css: `:root { --page-background: ${palette}; }\n* { box-sizing: border-box; }\nhtml, body { margin: 0; min-width: ${data.visual.width}px; min-height: ${data.visual.height}px; background: var(--page-background); }\n.visual-page { width: ${data.visual.width}px; height: ${data.visual.height}px; overflow: hidden; background: var(--page-background); }\n.reference { display: block; width: 100%; height: 100%; object-fit: cover; }`
  };
}
async function createCleanZip(tab) {
  setStatus('Reading the visible page and active styles…');
  const result = await collect(tab.id);
  if (!result?.ok) throw new Error(result?.error || 'Could not read this page.');
  const images = [...new Map(result.images.map(item => [item.url, item])).values()]; assetCount.textContent = `${images.length} assets`;
  setStatus(`Downloading ${images.length} rendered image${images.length === 1 ? '' : 's'}…`);
  const downloaded = (await Promise.all(images.map(downloadImage))).filter(Boolean); const finalImages = downloaded.map(item => item.image);
  const rewritten = rewriteAssets(result.html, result.css, finalImages, result.url); const zip = new JSZip(); zip.file('index.html', rewritten.html); zip.file('style.css', rewritten.css || '/* No active stylesheet rules were found. */');
  finalImages.forEach((image, index) => zip.file(`images/${image.name}`, downloaded[index].blob)); return { zip, title: result.title };
}
async function createVisualZip(tab) {
  setStatus('Capturing the open viewport screenshot…');
  const data = await collect(tab.id, 'VISUAL_DATA');
  const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  setStatus('Downloading images visible in the screenshot…');
  const page = await collect(tab.id, 'COLLECT_PAGE');
  const images = [...new Map((page.images || []).map(item => [item.url, item])).values()];
  const downloaded = (await Promise.all(images.map(downloadImage))).filter(Boolean);
  const project = visualProject(data, 'screenshot.png');
  const zip = new JSZip();
  zip.file('index.html', project.html);
  zip.file('style.css', project.css);
  zip.file('screenshot.png', dataUrlToBlob(screenshot));
  downloaded.forEach(({ image, blob }) => zip.file(`images/${image.name}`, blob));
  assetCount.textContent = `${downloaded.length} visible images`;
  return { zip, title: data.title };
}
async function run(mode) {
  visualButton.disabled = true; cleanButton.disabled = true; size.textContent = '—';
  try { const tab = await getCurrentTab(); if (!tab?.id) throw new Error('No active tab found.'); const result = mode === 'visual' ? await createVisualZip(tab) : await createCleanZip(tab); setStatus('Compressing the offline project…'); const blob = await result.zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } }); size.textContent = `${(blob.size / 1024).toFixed(1)} KB`; const url = URL.createObjectURL(blob); const filename = `${safeName(result.title)}-${mode}.zip`; await chrome.downloads.download({ url, filename, saveAs: true }); setStatus(`Done — ${filename}`); setTimeout(() => URL.revokeObjectURL(url), 30000); } catch (error) { setStatus(error.message || 'Export failed. Try a normal website tab.', true); } finally { visualButton.disabled = false; cleanButton.disabled = false; }
}
visualButton.addEventListener('click', () => run('visual'));
cleanButton.addEventListener('click', () => run('clean'));
