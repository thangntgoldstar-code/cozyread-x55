import { BookItem } from '../data/books';

export function normalizeVi(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getWordInitials(text: string): string {
  const norm = normalizeVi(text);
  if (!norm) return '';
  return norm
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('');
}

export function matchesBookSearch(book: BookItem, rawQuery: string): boolean {
  const q = normalizeVi(rawQuery).replace(/\s+/g, '');
  const qWords = normalizeVi(rawQuery);
  if (!q) return true;

  const titleNorm = normalizeVi(book.title);
  const authorNorm = normalizeVi(book.author);
  const titleInitials = getWordInitials(book.title);
  const authorInitials = getWordInitials(book.author);

  return (
    titleNorm.includes(qWords) ||
    authorNorm.includes(qWords) ||
    titleInitials.startsWith(q) ||
    titleInitials.includes(q) ||
    authorInitials.startsWith(q)
  );
}
