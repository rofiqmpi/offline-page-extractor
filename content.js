(() => {
  const IMAGE_EXTENSIONS = /\.(avif|gif|jpe?g|png|svg|webp|bmp|ico)(?:[?#].*)?$/i;

  function absoluteUrl(value) {
    try { return new URL(value, document.baseURI).href; } catch { return null; }
  }

  function selectorMatches(selector) {
    const cleaned = selector.trim()
      .replace(/::?(before|after|first-letter|first-line|selection|marker|backdrop|placeholder|file-selector-button)/gi, '')
      .replace(/:(hover|active|focus|focus-within|focus-visible|visited|link|target|checked|disabled|enabled|valid|invalid|required|optional|read-only|read-write|placeholder-shown|autofill|fullscreen|modal|open|playing|paused|user-invalid|user-valid)/gi, '')
      .trim();
    if (!cleaned || cleaned.startsWith('@')) return false;
    try { return !!document.querySelector(cleaned); } catch { return false; }
  }

  function splitTopLevel(value, delimiter = ',') {
    const result = []; let start = 0; let depth = 0; let quote = null;
    for (let i = 0; i < value.length; i += 1) {
      const ch = value[i];
      if (quote) { if (ch === quote && value[i - 1] !== '\\') quote = null; continue; }
      if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '(' || ch === '[') depth += 1;
      else if (ch === ')' || ch === ']') depth -= 1;
      else if (ch === delimiter && depth === 0) { result.push(value.slice(start, i)); start = i + 1; }
    }
    result.push(value.slice(start));
    return result;
  }

  function parseCssBlocks(css) {
    const blocks = []; let i = 0; let statementStart = 0; let quote = null; let comment = false;
    while (i < css.length) {
      if (comment) { if (css[i] === '*' && css[i + 1] === '/') { comment = false; i += 2; } else i += 1; continue; }
      if (css[i] === '/' && css[i + 1] === '*') { comment = true; i += 2; continue; }
      if (quote) { if (css[i] === quote && css[i - 1] !== '\\') quote = null; i += 1; continue; }
      if (css[i] === '"' || css[i] === "'") { quote = css[i]; i += 1; continue; }
      if (css[i] === '{') {
        let depth = 1; let j = i + 1; let q = null;
        while (j < css.length && depth) { if (q) { if (css[j] === q && css[j - 1] !== '\\') q = null; } else if (css[j] === '"' || css[j] === "'") q = css[j]; else if (css[j] === '{') depth += 1; else if (css[j] === '}') depth -= 1; j += 1; }
        blocks.push({ prelude: css.slice(statementStart, i).trim(), body: css.slice(i + 1, j - 1), raw: css.slice(statementStart, j) });
        i = j; statementStart = j;
      } else i += 1;
    }
    return blocks;
  }

  function usedCss(css) {
    const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const animationNames = new Set();
    document.querySelectorAll('*').forEach((el) => {
      const style = getComputedStyle(el);
      [style.animationName, style.webkitAnimationName].forEach((value) => value.split(',').map(v => v.trim()).filter(v => v && v !== 'none').forEach(v => animationNames.add(v)));
    });
    function walk(source) {
      return parseCssBlocks(source).map((block) => {
        const prelude = block.prelude.trim();
        if (!prelude) return '';
        if (/^@(media|supports|layer|container|document|scope)\b/i.test(prelude)) {
          const inner = walk(block.body);
          return inner.trim() ? `${prelude}{${inner}}` : '';
        }
        if (/^@(?:keyframes|-webkit-keyframes)\b/i.test(prelude)) {
          const match = prelude.match(/(?:keyframes|keyframes)\s+([^\s{]+)/i);
          return match && animationNames.has(match[1]) ? block.raw : '';
        }
        if (prelude.startsWith('@')) return block.raw;
        const active = splitTopLevel(prelude).filter(selectorMatches);
        return active.length ? `${active.join(',')}{${block.body.trim()}}` : '';
      }).filter(Boolean).join('\n');
    }
    return walk(cleaned);
  }

  function isRenderedElement(el) {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && rect.width > 0 && rect.height > 0;
  }

  function hasRenderedContent(el) {
    if (isRenderedElement(el)) return true;
    return [...el.children].some(hasRenderedContent);
  }

  function pruneHiddenClone(original, clone) {
    [...original.children].forEach((sourceChild, index) => {
      const cloneChild = clone.children[index];
      if (!cloneChild) return;
      if (!hasRenderedContent(sourceChild)) cloneChild.remove();
      else pruneHiddenClone(sourceChild, cloneChild);
    });
  }

  function cleanHtml(images) {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('script,noscript,iframe,template,canvas,video,audio,source,track,meta,base,link:not([rel="stylesheet"]),plasmo-csui,[id^="plasmo-"]').forEach(el => el.remove());
    if (document.body && clone.body) pruneHiddenClone(document.body, clone.body);
    clone.querySelectorAll('*').forEach(el => [...el.attributes].forEach(attr => {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
    }));
    clone.querySelectorAll('head > *').forEach(el => {
      if (el.tagName !== 'TITLE') el.remove();
    });
    const head = clone.querySelector('head');
    if (head) {
      const title = document.title || 'Offline page';
      head.innerHTML = `<title>${escapeHtml(title)}</title><link rel="stylesheet" href="style.css">`;
    }
    clone.body?.querySelectorAll('title,link[rel="stylesheet"]').forEach(el => el.remove());
    const imageByUrl = new Map(images.map(image => [image.url, image]));
    clone.querySelectorAll('img').forEach((img) => {
      const source = absoluteUrl(img.currentSrc || img.getAttribute('src') || img.getAttribute('data-src'));
      const asset = source ? imageByUrl.get(source) : null;
      img.setAttribute('data-offline-src', asset ? source : '');
      img.setAttribute('data-offline-name', asset ? asset.name : '');
      img.removeAttribute('srcset'); img.removeAttribute('sizes');
    });
    return '<!doctype html>\n' + clone.outerHTML.replace(/>\s+</g, '><').trim();
  }

  function escapeHtml(value) { return value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
  function guessExtension(url) { if (!url) return '.jpg'; const match = url.match(IMAGE_EXTENSIONS); return match ? `.${match[1].toLowerCase().replace('jpeg', 'jpg')}` : '.jpg'; }

  function collectImages() {
    const images = [];
    const seen = new Set();
    document.querySelectorAll('img').forEach((img) => {
      const url = absoluteUrl(img.currentSrc || img.src || img.getAttribute('data-src'));
      if (isRenderedElement(img) && url && !url.startsWith('data:') && !seen.has(url)) {
        seen.add(url);
        images.push({ url, name: `img_${images.length + 1}${guessExtension(url)}` });
      }
    });
    const cssUrls = [];
    document.querySelectorAll('*').forEach(el => {
      if (!isRenderedElement(el)) return;
      const bg = getComputedStyle(el).backgroundImage;
      [...bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)].forEach(match => {
        const url = absoluteUrl(match[1]);
        if (url && !url.startsWith('data:') && !seen.has(url)) { seen.add(url); cssUrls.push(url); }
      });
    });
    cssUrls.forEach((url, index) => images.push({ url, name: `bg_${index + 1}${guessExtension(url)}`, background: true }));
    return images;
  }

  function buildCss() {
    const css = [...document.styleSheets].map(sheet => {
      try { return [...sheet.cssRules].map(rule => rule.cssText).join('\n'); } catch { return ''; }
    }).join('\n');
    let output = usedCss(css);
    document.querySelectorAll('*').forEach(el => {
      const bg = getComputedStyle(el).backgroundImage;
      if (bg && bg !== 'none') { /* URLs are rewritten by the exporter. */ }
    });
    return output.replace(/\s*\n\s*/g, '');
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'COLLECT_PAGE') {
      try {
        const images = collectImages();
        sendResponse({ ok: true, html: cleanHtml(images), css: buildCss(), images, title: document.title || 'offline-page', url: location.href });
      }
      catch (error) { sendResponse({ ok: false, error: error.message }); }
    }
    return true;
  });
})();
