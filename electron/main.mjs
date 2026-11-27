import { app, BrowserWindow, ipcMain, protocol } from 'electron';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT_DIR = path.resolve(
  process.env.COZYREAD_PORT_DIR || path.dirname(app.getPath('exe'))
);
const BOOKS_DIR = path.resolve(
  process.env.COZYREAD_BOOKS_DIR || '/storage/roms/books'
);
const DIST_DIR = path.resolve(path.join(__dirname, '..', 'dist'));
const DATA_DIR = path.join(PORT_DIR, 'data');
const THUMBS_DIR = path.join(PORT_DIR, 'cache', 'thumbs');

const CACHE_FILE = path.join(DATA_DIR, 'cache.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const PROGRESS_FILE = path.join(DATA_DIR, 'progress.json');
const BACKUP_PROGRESS_FILE = path.join(BOOKS_DIR, '.cozyread_progress.json');

const SUPPORTED_BOOK_EXTS = new Set(['.epub', '.cbz', '.pdf', '.txt']);
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const FALLBACK_PALETTES = [
  { bg: '#2c3e35', accent: '#d9a441', motif: 'river', ambient: 'rgba(217, 164, 65, 0.28)' },
  { bg: '#0e1d2f', accent: '#38bdf8', motif: 'sky', ambient: 'rgba(56, 189, 248, 0.28)' },
  { bg: '#4a1820', accent: '#f4c47f', motif: 'crimson', ambient: 'rgba(244, 196, 127, 0.25)' },
  { bg: '#163024', accent: '#4ade80', motif: 'zen', ambient: 'rgba(74, 222, 128, 0.25)' },
  { bg: '#3f2316', accent: '#fb923c', motif: 'autumn', ambient: 'rgba(251, 146, 60, 0.26)' },
];

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'cozyread-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(THUMBS_DIR, { recursive: true });
  fs.mkdirSync(BOOKS_DIR, { recursive: true });
}

function isContainedPath(baseDir, targetPath) {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);
  return (
    resolvedTarget === resolvedBase ||
    resolvedTarget.startsWith(resolvedBase + path.sep)
  );
}

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(filePath, data) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, filePath);
  } catch {
    // Ignore read-only errors gracefully
  }
}

function hashId(relPath) {
  return crypto.createHash('sha1').update(relPath).digest('hex').slice(0, 16);
}

function slugFolderId(folderName) {
  if (!folderName || folderName === 'Thư mục gốc') return 'root_books';
  const ascii = folderName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `dir_${ascii || hashId(folderName).slice(0, 8)}`;
}

function cleanBookTitle(filename) {
  return path.basename(filename, path.extname(filename)).replace(/[_]+/g, ' ').trim();
}

function getMimeFromExt(ext) {
  const e = ext.toLowerCase();
  if (e === '.html' || e === '.htm') return 'text/html; charset=utf-8';
  if (e === '.js' || e === '.mjs') return 'application/javascript; charset=utf-8';
  if (e === '.css') return 'text/css; charset=utf-8';
  if (e === '.json') return 'application/json; charset=utf-8';
  if (e === '.svg') return 'image/svg+xml';
  if (e === '.png') return 'image/png';
  if (e === '.webp') return 'image/webp';
  if (e === '.woff2') return 'font/woff2';
  if (e === '.wasm') return 'application/wasm';
  return 'image/jpeg';
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function stripTagsAndSplitParagraphs(html) {
  const titleMatch = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
  const heading = titleMatch
    ? decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
    : undefined;

  let body = html;
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) body = bodyMatch[1];

  body = body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|br)\s*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  const lines = decodeHtmlEntities(body)
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0);

  return { heading, paragraphs: lines };
}

function paginateParagraphs(chapterTitle, heading, paragraphs, maxChars = 1120) {
  if (paragraphs.length === 0) return [];
  const pages = [];
  let bucket = [];
  let charCount = 0;

  for (const p of paragraphs) {
    if (p.length > maxChars && bucket.length === 0) {
      // Split unusually long single paragraph cleanly at word boundaries
      const words = p.split(/\s+/);
      let chunk = '';
      for (const w of words) {
        if ((chunk ? chunk.length + 1 : 0) + w.length > maxChars && chunk) {
          pages.push({
            chapter: chapterTitle,
            heading: pages.length === 0 ? heading : undefined,
            paragraphs: [chunk],
          });
          chunk = w;
        } else {
          chunk = chunk ? `${chunk} ${w}` : w;
        }
      }
      if (chunk) {
        pages.push({
          chapter: chapterTitle,
          heading: pages.length === 0 ? heading : undefined,
          paragraphs: [chunk],
        });
      }
      continue;
    }

    if (charCount + p.length > maxChars && bucket.length > 0) {
      pages.push({
        chapter: chapterTitle,
        heading: pages.length === 0 ? heading : undefined,
        paragraphs: bucket,
      });
      bucket = [p];
      charCount = p.length;
    } else {
      bucket.push(p);
      charCount += p.length;
    }
  }

  if (bucket.length > 0) {
    pages.push({
      chapter: chapterTitle,
      heading: pages.length === 0 ? heading : undefined,
      paragraphs: bucket,
    });
  }
  return pages;
}

function resolveZipPath(baseDirPosix, href) {
  const cleanHref = decodeURIComponent(href.split('#')[0]).trim();
  if (!baseDirPosix || baseDirPosix === '.') return path.posix.normalize(cleanHref);
  return path.posix.normalize(path.posix.join(baseDirPosix, cleanHref));
}

async function parseEpubMetadataAndPages(filePath, includePages) {
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);

  const findEntryCaseInsensitive = (target) => {
    const norm = target.replace(/^\/+/, '');
    if (zip.files[norm]) return zip.files[norm];
    const lower = norm.toLowerCase();
    for (const key of Object.keys(zip.files)) {
      if (key.toLowerCase() === lower) return zip.files[key];
    }
    return null;
  };

  let opfPath = '';
  const containerEntry = findEntryCaseInsensitive('META-INF/container.xml');
  if (containerEntry) {
    const containerXml = await containerEntry.async('text');
    const match = containerXml.match(/full-path=["']([^"']+)["']/i);
    if (match) opfPath = match[1];
  }

  if (!opfPath) {
    const foundOpf = Object.keys(zip.files).find((k) => k.toLowerCase().endsWith('.opf'));
    if (foundOpf) opfPath = foundOpf;
  }

  let title = cleanBookTitle(filePath);
  let author = 'Không rõ tác giả';
  let synopsis = `Tệp sách EPUB tại ${filePath}`;
  let coverBuffer = null;
  let coverExt = '.jpg';
  const spineHrefs = [];

  if (opfPath) {
    const opfEntry = findEntryCaseInsensitive(opfPath);
    if (opfEntry) {
      const opfDir = path.posix.dirname(opfPath);
      const opfXml = await opfEntry.async('text');

      const titleM = opfXml.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
      if (titleM) {
        const cleaned = decodeHtmlEntities(titleM[1].replace(/<[^>]+>/g, '')).trim();
        if (cleaned) title = cleaned;
      }
      const authorM = opfXml.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i);
      if (authorM) {
        const cleaned = decodeHtmlEntities(authorM[1].replace(/<[^>]+>/g, '')).trim();
        if (cleaned) author = cleaned;
      }
      const descM = opfXml.match(/<dc:description[^>]*>([\s\S]*?)<\/dc:description>/i);
      if (descM) {
        const cleaned = decodeHtmlEntities(descM[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
        if (cleaned) synopsis = cleaned.slice(0, 360);
      }

      // Build manifest map
      const manifest = new Map();
      const itemRegex = /<item\s+([^>]+?)\/?>/gi;
      let m;
      while ((m = itemRegex.exec(opfXml)) !== null) {
        const attrs = m[1];
        const idM = attrs.match(/\bid=["']([^"']+)["']/i);
        const hrefM = attrs.match(/\bhref=["']([^"']+)["']/i);
        const propsM = attrs.match(/\bproperties=["']([^"']+)["']/i);
        const typeM = attrs.match(/\bmedia-type=["']([^"']+)["']/i);
        if (idM && hrefM) {
          manifest.set(idM[1], {
            href: hrefM[1],
            properties: propsM ? propsM[1] : '',
            mediaType: typeM ? typeM[1] : '',
          });
        }
      }

      // Cover lookup: EPUB3 properties="cover-image" -> EPUB2 <meta name="cover" content="id"> -> id containing "cover"
      let coverHref = null;
      for (const item of manifest.values()) {
        if (item.properties.toLowerCase().includes('cover-image')) {
          coverHref = item.href;
          break;
        }
      }
      if (!coverHref) {
        const metaCover =
          opfXml.match(/<meta[^>]*name=["']cover["'][^>]*content=["']([^"']+)["']/i) ||
          opfXml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']cover["']/i);
        if (metaCover && manifest.has(metaCover[1])) {
          coverHref = manifest.get(metaCover[1]).href;
        }
      }
      if (!coverHref) {
        for (const [id, item] of manifest.entries()) {
          if (
            item.mediaType.startsWith('image/') &&
            (id.toLowerCase().includes('cover') || item.href.toLowerCase().includes('cover'))
          ) {
            coverHref = item.href;
            break;
          }
        }
      }

      if (coverHref) {
        const fullCoverPath = resolveZipPath(opfDir, coverHref);
        const coverEntry = findEntryCaseInsensitive(fullCoverPath);
        if (coverEntry) {
          coverBuffer = await coverEntry.async('nodebuffer');
          const ext = path.extname(fullCoverPath).toLowerCase();
          if (IMAGE_EXTS.has(ext)) coverExt = ext;
        }
      }

      const itemrefRegex = /<itemref[^>]*idref=["']([^"']+)["'][^>]*>/gi;
      while ((m = itemrefRegex.exec(opfXml)) !== null) {
        const item = manifest.get(m[1]);
        if (item) spineHrefs.push(resolveZipPath(opfDir, item.href));
      }
    }
  }

  if (spineHrefs.length === 0) {
    Object.keys(zip.files)
      .filter((k) => /\.(x?html?|htm)$/i.test(k) && !k.startsWith('__MACOSX'))
      .sort()
      .forEach((k) => spineHrefs.push(k));
  }

  let estimatedPages = Math.max(1, spineHrefs.length);
  let chapterCount = Math.max(1, spineHrefs.length);
  let charCount = 0;
  let wordCount = 0;
  const pages = [];

  if (includePages) {
    const uniqueChapters = new Set();
    for (let i = 0; i < spineHrefs.length; i++) {
      const entry = findEntryCaseInsensitive(spineHrefs[i]);
      if (!entry) continue;
      const html = await entry.async('text');
      const { heading, paragraphs } = stripTagsAndSplitParagraphs(html);
      const chapterTitle = heading || `Phần ${i + 1}`;
      uniqueChapters.add(chapterTitle);
      for (const p of paragraphs) {
        charCount += p.length;
        wordCount += p.trim().split(/\s+/).filter(Boolean).length;
      }
      const chunked = paginateParagraphs(chapterTitle, heading, paragraphs);
      pages.push(...chunked);
    }
    if (pages.length === 0) {
      pages.push({
        chapter: title,
        paragraphs: ['Không tìm thấy nội dung văn bản trong tệp EPUB này.'],
      });
    }
    chapterCount = Math.max(1, uniqueChapters.size);
  } else {
    let totalChars = 0;
    let totalWords = 0;
    const sampleCount = Math.min(spineHrefs.length, 40);
    for (let i = 0; i < sampleCount; i++) {
      const entry = findEntryCaseInsensitive(spineHrefs[i]);
      if (!entry) continue;
      const html = await entry.async('text');
      const plain = decodeHtmlEntities(
        html
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
      )
        .replace(/\s+/g, ' ')
        .trim();
      totalChars += plain.length;
      if (plain) totalWords += plain.split(/\s+/).length;
    }
    if (sampleCount > 0 && spineHrefs.length > sampleCount) {
      const ratio = spineHrefs.length / sampleCount;
      totalChars = Math.round(totalChars * ratio);
      totalWords = Math.round(totalWords * ratio);
    }
    charCount = totalChars;
    wordCount = totalWords;
    estimatedPages = Math.max(1, Math.round(totalChars / 1120));
  }

  return {
    title,
    author,
    synopsis,
    coverBuffer,
    coverExt,
    estimatedPages,
    chapterCount,
    charCount,
    wordCount,
    pages,
  };
}

const cbzZipCache = new Map();

async function listCbzImageEntries(filePath) {
  const cached = cbzZipCache.get(filePath);
  if (cached) return cached;

  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);
  const entries = Object.keys(zip.files)
    .filter((name) => {
      if (zip.files[name].dir) return false;
      if (name.startsWith('__MACOSX/') || path.basename(name).startsWith('._')) return false;
      return IMAGE_EXTS.has(path.extname(name).toLowerCase());
    })
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const result = { zip, entries };
  if (cbzZipCache.size >= 2) {
    const oldest = cbzZipCache.keys().next().value;
    if (oldest) cbzZipCache.delete(oldest);
  }
  cbzZipCache.set(filePath, result);
  return result;
}

function findSidecarCover(bookPath) {
  const dir = path.dirname(bookPath);
  const base = path.basename(bookPath, path.extname(bookPath)).toLowerCase();
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.startsWith('.')) continue;
      const ext = path.extname(file).toLowerCase();
      if (!IMAGE_EXTS.has(ext)) continue;
      const stem = path.basename(file, ext).toLowerCase();
      if (stem === base) {
        return path.join(dir, file);
      }
    }
  } catch {
    // Ignore directory read failure
  }
  return null;
}

function writeThumbFile(bookId, buffer, ext) {
  const safeExt = IMAGE_EXTS.has(ext.toLowerCase()) ? ext.toLowerCase() : '.jpg';
  const filename = `${bookId}${safeExt}`;
  const fullPath = path.join(THUMBS_DIR, filename);
  if (!isContainedPath(THUMBS_DIR, fullPath)) return undefined;
  fs.writeFileSync(fullPath, buffer);
  return `cozyread-media://thumb/${filename}`;
}

function collectBookFiles(rootDir) {
  const results = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === '__MACOSX') continue;
      const fullPath = path.join(dir, entry.name);
      if (!isContainedPath(rootDir, fullPath)) continue;
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_BOOK_EXTS.has(ext)) {
          results.push(fullPath);
        }
      }
    }
  };
  walk(rootDir);
  return results;
}

// In-memory index of scanned book metadata (keyed by bookId)
let cachedBookIndex = new Map();

function buildFolderTabsFromBooks(books) {
  const baseTabs = [
    { id: 'all', label: 'Tất cả' },
    { id: 'reading', label: 'Đang đọc' },
    { id: 'favorites', label: '★ Yêu thích' },
  ];
  const seen = new Map();
  for (const b of books) {
    if (!seen.has(b.folderId)) {
      seen.set(b.folderId, b.folderName);
    }
  }
  const dirTabs = Array.from(seen.entries()).map(([id, label]) => ({ id, label }));
  return {
    folders: [...baseTabs, ...dirTabs],
    folderCount: seen.size,
  };
}

function applySavedProgressToBooks(rawBooks, progressMap) {
  return rawBooks.map((book) => {
    const saved = progressMap?.[book.id];
    const totalPages = Math.max(1, book.totalPages || 1);
    const rawPage = Math.max(0, saved?.currentPage ?? 0);
    return {
      ...book,
      currentPage: book.needsPdfMeta
        ? rawPage
        : saved
          ? Math.min(totalPages - 1, rawPage)
          : 0,
      hasOpened: Boolean(saved?.hasOpened || rawPage > 0),
      lastOpenedAt: typeof saved?.lastOpenedAt === 'number' ? saved.lastOpenedAt : undefined,
      readingSeconds: typeof saved?.readingSeconds === 'number' ? Math.max(0, saved.readingSeconds) : 0,
      favorite: saved ? Boolean(saved.favorite) : false,
      bookmarks:
        saved && Array.isArray(saved.bookmarks)
          ? book.needsPdfMeta
            ? saved.bookmarks.filter((p) => p >= 0)
            : saved.bookmarks.filter((p) => p >= 0 && p < totalPages)
          : [],
    };
  });
}

async function scanBooksDirectory(previousCache = []) {
  ensureDirs();
  cbzZipCache.clear();
  const prevByRel = new Map(previousCache.map((b) => [b.relPath, b]));
  const filePaths = collectBookFiles(BOOKS_DIR);
  const scanned = [];
  const activeThumbNames = new Set();

  for (let idx = 0; idx < filePaths.length; idx++) {
    const fullPath = filePaths[idx];
    const relPath = path.relative(BOOKS_DIR, fullPath);
    const stat = fs.statSync(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const format =
      ext === '.epub' ? 'EPUB' : ext === '.cbz' ? 'CBZ' : ext === '.pdf' ? 'PDF' : 'TXT';

    const parts = relPath.split(path.sep);
    const folderName = parts.length > 1 ? parts[0] : 'Thư mục gốc';
    const folderId = slugFolderId(folderName);
    const id = hashId(relPath);
    const palette = FALLBACK_PALETTES[idx % FALLBACK_PALETTES.length];

    const prev = prevByRel.get(relPath);
    const isUnchanged =
      prev && prev.mtimeMs === stat.mtimeMs && prev.size === stat.size;

    const sidecarPath = findSidecarCover(fullPath);
    let coverImage;
    if (sidecarPath) {
      const buf = fs.readFileSync(sidecarPath);
      coverImage = writeThumbFile(id, buf, path.extname(sidecarPath));
    }

    const reusedThumbFile =
      prev?.coverImage && prev.coverImage.startsWith('cozyread-media://thumb/')
        ? prev.coverImage.replace('cozyread-media://thumb/', '')
        : null;
    const reusedThumbExists =
      reusedThumbFile !== null && fs.existsSync(path.join(THUMBS_DIR, reusedThumbFile));

    if (
      isUnchanged &&
      !prev.needsPdfMeta &&
      prev.fileSize !== undefined &&
      (format === 'PDF' || prev.chapterCount !== undefined) &&
      (!reusedThumbFile || reusedThumbExists)
    ) {
      const reusedCover = coverImage || prev.coverImage;
      if (reusedCover && reusedCover.startsWith('cozyread-media://thumb/')) {
        activeThumbNames.add(reusedCover.replace('cozyread-media://thumb/', ''));
      }
      scanned.push({
        ...prev,
        id,
        folderId,
        folderName,
        filePath: fullPath,
        fileSize: prev.fileSize ?? stat.size,
        coverImage: reusedCover,
      });
      continue;
    }

    let title = cleanBookTitle(fullPath);
    let author = folderName;
    let synopsis = `Tệp ${format} trong thư mục ${folderName}`;
    let totalPages = 1;
    let needsPdfMeta = false;
    let chapterCount = 1;
    let charCount = 0;
    let wordCount = 0;

    try {
      if (format === 'EPUB') {
        const epubInfo = await parseEpubMetadataAndPages(fullPath, false);
        title = epubInfo.title || title;
        author = epubInfo.author || author;
        synopsis = epubInfo.synopsis || synopsis;
        totalPages = epubInfo.estimatedPages;
        chapterCount = epubInfo.chapterCount || 1;
        charCount = epubInfo.charCount || 0;
        wordCount = epubInfo.wordCount || 0;
        if (!coverImage && epubInfo.coverBuffer) {
          coverImage = writeThumbFile(id, epubInfo.coverBuffer, epubInfo.coverExt);
        }
      } else if (format === 'CBZ') {
        const { zip, entries } = await listCbzImageEntries(fullPath);
        totalPages = Math.max(1, entries.length);
        const cbzFolders = new Set(
          entries
            .map((e) => path.posix.dirname(e))
            .filter((d) => d && d !== '.')
        );
        chapterCount = Math.max(1, cbzFolders.size);
        author = 'Truyện Tranh';
        synopsis = `Truyện tranh CBZ gồm ${totalPages} trang hình ảnh.`;
        if (!coverImage && entries.length > 0) {
          const firstImg = await zip.files[entries[0]].async('nodebuffer');
          coverImage = writeThumbFile(id, firstImg, path.extname(entries[0]));
        }
      } else if (format === 'TXT') {
        const text = fs.readFileSync(fullPath, 'utf-8');
        totalPages = Math.max(1, Math.ceil(text.length / 1120));
        charCount = text.length;
        const trimmed = text.trim();
        wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
        chapterCount = 1;
        author = 'Văn bản TXT';
        synopsis = text.slice(0, 240).replace(/\s+/g, ' ').trim() || synopsis;
      } else if (format === 'PDF') {
        author = 'Tài liệu PDF';
        needsPdfMeta = true;
      }
    } catch {
      // Keep graceful defaults if an archive is malformed
    }

    if (coverImage && coverImage.startsWith('cozyread-media://thumb/')) {
      activeThumbNames.add(coverImage.replace('cozyread-media://thumb/', ''));
    }

    scanned.push({
      id,
      relPath,
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      fileSize: stat.size,
      title,
      author,
      folderId,
      folderName,
      filePath: fullPath,
      format,
      coverImage,
      fallbackStyle: {
        bg: palette.bg,
        accent: palette.accent,
        motif: palette.motif,
      },
      ambientColor: palette.ambient,
      synopsis,
      totalPages,
      chapterCount,
      charCount,
      wordCount,
      currentPage: 0,
      favorite: false,
      bookmarks: [],
      pages: [],
      needsPdfMeta,
    });
  }

  // Cleanup orphaned thumbnails so cache never accumulates junk
  try {
    const thumbFiles = fs.readdirSync(THUMBS_DIR);
    for (const file of thumbFiles) {
      if (!activeThumbNames.has(file)) {
        const target = path.join(THUMBS_DIR, file);
        if (isContainedPath(THUMBS_DIR, target)) {
          fs.unlinkSync(target);
        }
      }
    }
  } catch {
    // Ignore cleanup errors
  }

  writeJsonAtomic(CACHE_FILE, { version: 1, books: scanned });
  cachedBookIndex = new Map(scanned.map((b) => [b.id, b]));
  return scanned;
}

function readBatterySysfs() {
  const psRoot = '/sys/class/power_supply';
  try {
    if (!fs.existsSync(psRoot)) return { level: 88, charging: false };
    const supplies = fs.readdirSync(psRoot);

    // Check if any external AC/USB charger power_supply reports online=1
    let externalPowerOnline = false;
    for (const name of supplies) {
      const typePath = path.join(psRoot, name, 'type');
      const onlinePath = path.join(psRoot, name, 'online');
      if (!fs.existsSync(onlinePath)) continue;
      const supplyType = fs.existsSync(typePath)
        ? fs.readFileSync(typePath, 'utf-8').trim().toLowerCase()
        : '';
      if (supplyType !== 'battery') {
        const onlineRaw = fs.readFileSync(onlinePath, 'utf-8').trim();
        if (onlineRaw === '1') externalPowerOnline = true;
      }
    }

    // Prefer entries explicitly marked type === "Battery" and present !== "0"
    const ordered = [...supplies].sort((a, b) => {
      const aIsBat = a.toLowerCase().includes('bat') ? 0 : 1;
      const bIsBat = b.toLowerCase().includes('bat') ? 0 : 1;
      return aIsBat - bIsBat || a.localeCompare(b);
    });

    for (const name of ordered) {
      const dir = path.join(psRoot, name);
      const typePath = path.join(dir, 'type');
      if (fs.existsSync(typePath)) {
        const typeVal = fs.readFileSync(typePath, 'utf-8').trim().toLowerCase();
        if (typeVal && typeVal !== 'battery') continue;
      }
      const presentPath = path.join(dir, 'present');
      if (fs.existsSync(presentPath)) {
        if (fs.readFileSync(presentPath, 'utf-8').trim() === '0') continue;
      }
      const capPath = path.join(dir, 'capacity');
      if (!fs.existsSync(capPath)) continue;
      const capRaw = fs.readFileSync(capPath, 'utf-8').trim();
      const level = Math.max(0, Math.min(100, parseInt(capRaw, 10)));
      if (Number.isNaN(level)) continue;

      let charging = externalPowerOnline;
      const statusPath = path.join(dir, 'status');
      if (fs.existsSync(statusPath)) {
        const statusRaw = fs.readFileSync(statusPath, 'utf-8').trim().toLowerCase();
        if (statusRaw === 'charging') {
          charging = true;
        } else if (statusRaw === 'discharging') {
          charging = false;
        } else if (statusRaw === 'full' || statusRaw === 'not charging') {
          charging = externalPowerOnline;
        }
      }
      return { level, charging };
    }
  } catch {
    // Fallback if sysfs is inaccessible
  }
  return { level: 88, charging: false };
}

function loadPersistedBundle() {
  const settingsData = readJsonSafe(SETTINGS_FILE, {});
  let progressData = readJsonSafe(PROGRESS_FILE, null);
  if (!progressData) {
    progressData = readJsonSafe(BACKUP_PROGRESS_FILE, {});
  }
  return {
    settings: settingsData.settings || {},
    activeFolder: settingsData.activeFolder,
    viewMode: settingsData.viewMode,
    selectedIndex: settingsData.selectedIndex,
    selectedBookId: settingsData.selectedBookId ?? null,
    activeBookId: settingsData.activeBookId ?? null,
    sphereTilt: typeof settingsData.sphereTilt === 'number' ? settingsData.sphereTilt : 0,
    showReaderHud: Boolean(settingsData.showReaderHud),
    books: progressData.books || {},
  };
}

let mainWindow = null;
const evdevStreams = [];
let hasNativeGamepad = false;

const EVDEV_KEY_MAP = {
  304: 'B', // BTN_SOUTH (bottom button on Powkiddy X55)
  305: 'A', // BTN_EAST (right button on Powkiddy X55)
  307: 'X', // BTN_NORTH (top button on Powkiddy X55)
  308: 'Y', // BTN_WEST (left button on Powkiddy X55)
  310: 'L1', // BTN_TL
  311: 'R1', // BTN_TR
  312: 'L2', // BTN_TL2
  313: 'R2', // BTN_TR2
  314: 'SELECT', // BTN_SELECT
  315: 'START', // BTN_START
  318: 'R3', // BTN_THUMBR
  544: 'UP', // BTN_DPAD_UP
  545: 'DOWN', // BTN_DPAD_DOWN
  546: 'LEFT', // BTN_DPAD_LEFT
  547: 'RIGHT', // BTN_DPAD_RIGHT
};

function emitNativeButton(btn) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('cozyread:native-button', btn);
  }
}

function startNativeEvdevGamepad() {
  if (process.platform !== 'linux') return;
  try {
    if (!fs.existsSync('/proc/bus/input/devices')) return;
    const raw = fs.readFileSync('/proc/bus/input/devices', 'utf-8');
    const blocks = raw.split(/\n\s*\n/);
    const candidates = [];

    for (const block of blocks) {
      const nameMatch = block.match(/^N:\s*Name="([^"]+)"/m);
      const handlersMatch = block.match(/^H:\s*Handlers=(.+)$/m);
      if (!handlersMatch) continue;
      const name = (nameMatch?.[1] || '').toLowerCase();
      const handlers = handlersMatch[1];
      const eventMatch = handlers.match(/\b(event\d+)\b/);
      if (!eventMatch) continue;
      const hasJs = /\bjs\d+\b/.test(handlers);
      const looksLikeJoypad =
        hasJs ||
        /x55|powkiddy|joypad|gamepad|controller|retrogame|adc-joystick|xbox|playstation/.test(name);
      if (looksLikeJoypad) {
        candidates.push(`/dev/input/${eventMatch[1]}`);
      }
    }

    const evdevPressed = new Set();
    let triggerComboLock = false;

    for (const devPath of candidates) {
      try {
        const stream = fs.createReadStream(devPath, { highWaterMark: 24 * 16 });
        let leftover = Buffer.alloc(0);
        let hatX = 0;
        let hatY = 0;

        stream.on('data', (chunk) => {
          const buf = leftover.length > 0 ? Buffer.concat([leftover, chunk]) : chunk;
          const eventSize = 24; // 64-bit Linux struct input_event
          const count = Math.floor(buf.length / eventSize);
          for (let i = 0; i < count; i++) {
            const offset = i * eventSize;
            const type = buf.readUInt16LE(offset + 16);
            const code = buf.readUInt16LE(offset + 18);
            const value = buf.readInt32LE(offset + 20);

            if (type === 1) {
              const btn = EVDEV_KEY_MAP[code];
              if (!btn) continue;
              if (value === 1) {
                evdevPressed.add(btn);
                if (
                  (btn === 'L2' || btn === 'R2') &&
                  evdevPressed.has('L2') &&
                  evdevPressed.has('R2')
                ) {
                  triggerComboLock = true;
                  emitNativeButton('L2_R2');
                } else {
                  emitNativeButton(btn);
                }
              } else if (value === 2) {
                if (triggerComboLock && (btn === 'L2' || btn === 'R2')) {
                  continue;
                }
                emitNativeButton(btn);
              } else if (value === 0) {
                evdevPressed.delete(btn);
                if (!evdevPressed.has('L2') && !evdevPressed.has('R2')) {
                  triggerComboLock = false;
                }
              }
            } else if (type === 3) {
              if (code === 16) {
                const next = value < 0 ? -1 : value > 0 ? 1 : 0;
                if (next !== hatX) {
                  hatX = next;
                  if (hatX === -1) emitNativeButton('LEFT');
                  else if (hatX === 1) emitNativeButton('RIGHT');
                }
              } else if (code === 17) {
                const next = value < 0 ? -1 : value > 0 ? 1 : 0;
                if (next !== hatY) {
                  hatY = next;
                  if (hatY === -1) emitNativeButton('UP');
                  else if (hatY === 1) emitNativeButton('DOWN');
                }
              }
            }
          }
          const rem = buf.length % eventSize;
          leftover = rem > 0 ? Buffer.from(buf.subarray(buf.length - rem)) : Buffer.alloc(0);
        });

        stream.on('error', () => {
          // Ignore disconnect / permission errors gracefully
        });

        evdevStreams.push(stream);
        hasNativeGamepad = true;
      } catch {
        // Ignore inaccessible event devices
      }
    }
  } catch {
    // Fallback to Chromium Web Gamepad API
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: true,
    frame: false,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#04060b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });
  mainWindow.loadURL('cozyread-media://app/index.html');
}

app.whenReady().then(() => {
  ensureDirs();
  startNativeEvdevGamepad();

  // Serve app bundle, cached cover thumbnails, and CBZ internal pages on a single secure origin
  protocol.handle('cozyread-media', async (request) => {
    try {
      const url = new URL(request.url);
      if (url.hostname === 'app') {
        let relPath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
        if (!relPath) relPath = 'index.html';
        const fullPath = path.join(DIST_DIR, relPath);
        if (!isContainedPath(DIST_DIR, fullPath) || !fs.existsSync(fullPath)) {
          return new Response('Not found', { status: 404 });
        }
        const buf = fs.readFileSync(fullPath);
        return new Response(buf, {
          headers: {
            'Content-Type': getMimeFromExt(path.extname(fullPath)),
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      if (url.hostname === 'thumb') {
        const fileName = path.basename(decodeURIComponent(url.pathname));
        const fullPath = path.join(THUMBS_DIR, fileName);
        if (!isContainedPath(THUMBS_DIR, fullPath) || !fs.existsSync(fullPath)) {
          return new Response('Not found', { status: 404 });
        }
        const buf = fs.readFileSync(fullPath);
        return new Response(buf, {
          headers: {
            'Content-Type': getMimeFromExt(path.extname(fileName)),
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      if (url.hostname === 'cbz') {
        const parts = url.pathname.replace(/^\/+/, '').split('/');
        const bookId = parts[0];
        const pageIdx = parseInt(parts[1] || '0', 10);
        const book = cachedBookIndex.get(bookId);
        if (!book || !isContainedPath(BOOKS_DIR, book.filePath) || !fs.existsSync(book.filePath)) {
          return new Response('Not found', { status: 404 });
        }
        const { zip, entries } = await listCbzImageEntries(book.filePath);
        const entryName = entries[pageIdx];
        if (!entryName) return new Response('Not found', { status: 404 });
        const buf = await zip.files[entryName].async('nodebuffer');
        return new Response(buf, {
          headers: {
            'Content-Type': getMimeFromExt(path.extname(entryName)),
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      return new Response('Bad request', { status: 400 });
    } catch {
      return new Response('Error', { status: 500 });
    }
  });

  ipcMain.handle('cozyread:init', async () => {
    ensureDirs();
    const persisted = loadPersistedBundle();
    const existingCache = readJsonSafe(CACHE_FILE, null);
    let rawBooks = Array.isArray(existingCache?.books) ? existingCache.books : null;
    let firstScanPerformed = false;

    if (!rawBooks || rawBooks.length === 0) {
      rawBooks = await scanBooksDirectory(rawBooks || []);
      firstScanPerformed = true;
    } else {
      cachedBookIndex = new Map(rawBooks.map((b) => [b.id, b]));
    }

    const books = applySavedProgressToBooks(rawBooks, persisted.books);
    const { folders } = buildFolderTabsFromBooks(books);

    return {
      books,
      folders,
      persisted,
      battery: readBatterySysfs(),
      booksDir: BOOKS_DIR,
      dataDir: DATA_DIR,
      firstScanPerformed,
      hasNativeGamepad,
    };
  });

  ipcMain.handle('cozyread:rescan', async () => {
    const persisted = loadPersistedBundle();
    const existingCache = readJsonSafe(CACHE_FILE, null);
    const prevList = Array.isArray(existingCache?.books) ? existingCache.books : [];
    const rawBooks = await scanBooksDirectory(prevList);
    const books = applySavedProgressToBooks(rawBooks, persisted.books);
    const { folders, folderCount } = buildFolderTabsFromBooks(books);
    return { books, folders, folderCount };
  });

  ipcMain.handle('cozyread:save-state', async (_event, payload) => {
    if (!payload || typeof payload !== 'object') return false;
    writeJsonAtomic(SETTINGS_FILE, {
      settings: payload.settings || {},
      activeFolder: payload.activeFolder || 'all',
      viewMode: payload.viewMode || 'coverflow',
      selectedIndex: typeof payload.selectedIndex === 'number' ? payload.selectedIndex : 0,
      selectedBookId: payload.selectedBookId ?? null,
      activeBookId: payload.activeBookId ?? null,
      sphereTilt: typeof payload.sphereTilt === 'number' ? payload.sphereTilt : 0,
      showReaderHud: Boolean(payload.showReaderHud),
    });
    const progressPayload = { books: payload.books || {} };
    writeJsonAtomic(PROGRESS_FILE, progressPayload);
    writeJsonAtomic(BACKUP_PROGRESS_FILE, progressPayload);
    return true;
  });

  ipcMain.handle('cozyread:load-pages', async (_event, bookId) => {
    const book = cachedBookIndex.get(String(bookId));
    if (!book || !isContainedPath(BOOKS_DIR, book.filePath) || !fs.existsSync(book.filePath)) {
      return [];
    }

    if (book.format === 'EPUB') {
      const parsed = await parseEpubMetadataAndPages(book.filePath, true);
      return parsed.pages;
    }

    if (book.format === 'CBZ') {
      const { entries } = await listCbzImageEntries(book.filePath);
      return entries.map((entryName, idx) => {
        const dirName = path.posix.dirname(entryName);
        return {
          chapter: dirName && dirName !== '.' ? path.posix.basename(dirName) : `Trang ${idx + 1}`,
          imageUrl: `cozyread-media://cbz/${book.id}/${idx}`,
        };
      });
    }

    if (book.format === 'TXT') {
      const text = fs.readFileSync(book.filePath, 'utf-8').replace(/\r\n/g, '\n');
      const paras = text
        .split(/\n\s*\n+/)
        .map((p) => p.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      return paginateParagraphs(book.title, book.title, paras);
    }

    return [];
  });

  ipcMain.handle('cozyread:read-bytes', async (_event, bookId) => {
    const book = cachedBookIndex.get(String(bookId));
    if (!book || !isContainedPath(BOOKS_DIR, book.filePath) || !fs.existsSync(book.filePath)) {
      throw new Error('Book file not found');
    }
    return new Uint8Array(fs.readFileSync(book.filePath));
  });

  ipcMain.handle('cozyread:save-pdf-meta', async (_event, payload) => {
    const bookId = String(payload?.id || '');
    const book = cachedBookIndex.get(bookId);
    if (!book) return {};

    let coverImage = book.coverImage;
    if (
      !coverImage &&
      typeof payload?.thumbDataUrl === 'string' &&
      payload.thumbDataUrl.startsWith('data:image/jpeg;base64,')
    ) {
      const base64 = payload.thumbDataUrl.replace(/^data:image\/jpeg;base64,/, '');
      const buf = Buffer.from(base64, 'base64');
      coverImage = writeThumbFile(bookId, buf, '.jpg');
    }

    const pdfChapters = Array.isArray(payload?.pdfChapters)
      ? payload.pdfChapters
      : book.pdfChapters;
    const pdfMeta =
      payload?.pdfMeta && typeof payload.pdfMeta === 'object'
        ? payload.pdfMeta
        : book.pdfMeta;
    const totalPages = Math.max(1, Number(payload?.totalPages) || book.totalPages);

    const updated = {
      ...book,
      totalPages,
      chapterCount:
        pdfChapters && pdfChapters.length > 0
          ? pdfChapters.length
          : book.chapterCount || 1,
      title:
        typeof payload?.title === 'string' && payload.title.trim()
          ? payload.title.trim()
          : book.title,
      author:
        typeof payload?.author === 'string' && payload.author.trim()
          ? payload.author.trim()
          : book.author,
      coverImage,
      pdfMeta,
      pdfChapters,
      needsPdfMeta: false,
    };

    cachedBookIndex.set(bookId, updated);
    const existingCache = readJsonSafe(CACHE_FILE, { version: 1, books: [] });
    if (Array.isArray(existingCache.books)) {
      existingCache.books = existingCache.books.map((b) => (b.id === bookId ? updated : b));
      writeJsonAtomic(CACHE_FILE, existingCache);
    }

    return { coverImage };
  });

  ipcMain.handle('cozyread:battery', async () => readBatterySysfs());

  ipcMain.handle('cozyread:quit', async () => {
    app.quit();
  });

  createWindow();
});

app.on('will-quit', () => {
  for (const s of evdevStreams) {
    try {
      s.destroy();
    } catch {
      // Ignore cleanup errors
    }
  }
});

app.on('window-all-closed', () => {
  app.quit();
});
