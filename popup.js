const $ = (selector) => document.querySelector(selector);
const button = $('#export');
const status = $('#status');
const assetCount = $('#assetCount');
const size = $('#size');

function setStatus(text, error = false) { status.textContent = text; status.classList.toggle('error', error); }
function safeName(value) { return (value || 'offline-page').toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'offline-page'; }
function extFromContentType(type) {
  const map = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/avif': '.avif', 'image/bmp': '.bmp', 'image/x-icon': '.ico' };
  return map[type] || '.jpg';
}
function rewriteAssets(html, css, images, baseUrl) {
  const map = new Map();
  images.forEach(image => map.set(image.url, `images/${image.name}`));
  const htmlDoc = new DOMParser().parseFromString(html, 'text/html');
  htmlDoc.querySelectorAll('img[data-offline-src]').forEach(img => {
    const original = img.getAttribute('data-offline-src');
    const mapped = map.get(original);
    img.removeAttribute('data-offline-src'); img.removeAttribute('data-offline-name');
    if (mapped) img.setAttribute('src', mapped); else img.removeAttribute('src');
  });
  const rewrittenCss = css.replace(/url\((['"]?)([^'"()]+)\1\)/g, (full, quote, original) => {
    let absolute = original;
    try { absolute = new URL(original, baseUrl).href; } catch { /* keep the source URL */ }
    const mapped = map.get(absolute) || map.get(original);
    return mapped ? `url("${mapped}")` : full;
  });
  return { html: '<!doctype html>\n' + htmlDoc.documentElement.outerHTML, css: rewrittenCss };
}
async function getCurrentTab() { return (await chrome.tabs.query({ active: true, currentWindow: true }))[0]; }
async function collect(tabId) {
  try { return await chrome.tabs.sendMessage(tabId, { type: 'COLLECT_PAGE' }); }
  catch { return await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }).then(() => chrome.tabs.sendMessage(tabId, { type: 'COLLECT_PAGE' })); }
}
async function downloadImage(image) {
  try {
    const response = await fetch(image.url, { credentials: 'include' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    if (image.name.endsWith('.jpg') && blob.type && blob.type !== 'image/jpeg') image.name = `img_${crypto.randomUUID().slice(0, 8)}${extFromContentType(blob.type)}`;
    return { image, blob };
  } catch { return null; }
}

button.addEventListener('click', async () => {
  button.disabled = true; assetCount.textContent = 'Scanning…'; size.textContent = '—'; setStatus('Reading the current page and active styles…');
  try {
    const tab = await getCurrentTab();
    if (!tab?.id) throw new Error('No active tab found.');
    const result = await collect(tab.id);
    if (!result?.ok) throw new Error(result?.error || 'Could not read this page.');
    const images = [...new Map(result.images.map(item => [item.url, item])).values()];
    assetCount.textContent = `${images.length} assets`;
    setStatus(`Downloading ${images.length} image asset${images.length === 1 ? '' : 's'}…`);
    const downloaded = (await Promise.all(images.map(downloadImage))).filter(Boolean);
    const finalImages = downloaded.map(item => item.image);
    const rewritten = rewriteAssets(result.html, result.css, finalImages, result.url);
    const zip = new JSZip();
    zip.file('index.html', rewritten.html);
    zip.file('style.css', rewritten.css || '/* No active stylesheet rules were found. */');
    finalImages.forEach((image, index) => zip.file(`images/${image.name}`, downloaded[index].blob));
    setStatus('Compressing the clean offline project…');
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });
    size.textContent = `${(blob.size / 1024).toFixed(1)} KB`;
    const url = URL.createObjectURL(blob);
    const filename = `${safeName(result.title)}-offline.zip`;
    await chrome.downloads.download({ url, filename, saveAs: true });
    setStatus(`Done — ${filename}`);
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  } catch (error) { setStatus(error.message || 'Export failed. Try a normal website tab.', true); }
  finally { button.disabled = false; }
});
