import React from 'react';
import { BookItem } from '../data/books';

interface BookCoverProps {
  book: BookItem;
  className?: string;
  showProgress?: boolean;
  isSelected?: boolean;
  isReflection?: boolean;
}

export const BookCover: React.FC<BookCoverProps> = ({
  book,
  className = '',
  showProgress = true,
  isSelected = false,
  isReflection = false,
}) => {
  const [imgFailed, setImgFailed] = React.useState(false);
  const progressPct = Math.round(((book.currentPage + 1) / Math.max(1, book.totalPages)) * 100);
  const hasStarted = book.currentPage > 0;

  return (
    <div
      className={`relative overflow-hidden select-none ${className}`}
      style={{
        backgroundColor: book.fallbackStyle.bg,
      }}
    >
      {/* Pure Cover Artwork — NO overlaid text on image covers so printed PDF/EPUB art never clashes */}
      {book.coverImage && !imgFailed ? (
        <img
          src={book.coverImage}
          alt={book.title}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div
          className="relative flex h-full w-full flex-col justify-between p-3 text-left"
          style={{
            background: `linear-gradient(155deg, ${book.fallbackStyle.bg} 0%, #0b0e14 100%)`,
          }}
        >
          {/* Minimalist embossed geometric emblem */}
          <svg
            viewBox="0 0 120 160"
            className="pointer-events-none absolute inset-0 h-full w-full opacity-35"
            preserveAspectRatio="xMidYMid slice"
          >
            {book.fallbackStyle.motif === 'crimson' && (
              <>
                <circle cx="88" cy="44" r="34" fill="none" stroke={book.fallbackStyle.accent} strokeWidth="1.4" />
                <line x1="18" y1="122" x2="102" y2="122" stroke={book.fallbackStyle.accent} strokeWidth="1" />
              </>
            )}
            {book.fallbackStyle.motif === 'sky' && (
              <>
                <circle cx="60" cy="70" r="34" fill="none" stroke={book.fallbackStyle.accent} strokeWidth="1.2" strokeDasharray="3 3" />
                <circle cx="60" cy="70" r="18" fill="none" stroke={book.fallbackStyle.accent} strokeWidth="1" />
              </>
            )}
            {book.fallbackStyle.motif === 'autumn' && (
              <>
                <path d="M15 110 Q60 65 105 110" fill="none" stroke={book.fallbackStyle.accent} strokeWidth="1.5" />
                <circle cx="76" cy="46" r="18" fill={book.fallbackStyle.accent} fillOpacity="0.24" />
              </>
            )}
            {(book.fallbackStyle.motif === 'zen' || book.fallbackStyle.motif === 'river') && (
              <>
                <rect x="18" y="20" width="84" height="120" fill="none" stroke={book.fallbackStyle.accent} strokeWidth="1" opacity="0.65" />
                <circle cx="60" cy="78" r="22" fill="none" stroke={book.fallbackStyle.accent} strokeWidth="1.2" />
              </>
            )}
          </svg>

          <div className="relative z-10 text-[9px] font-medium tracking-widest text-white/55 uppercase">
            {book.format}
          </div>

          <div className="relative z-10 my-auto">
            <div className="font-display text-xs leading-snug font-semibold text-white/95 line-clamp-3">
              {book.title}
            </div>
          </div>

          <div className="relative z-10 h-0.5 w-7 rounded-full" style={{ backgroundColor: book.fallbackStyle.accent }} />
        </div>
      )}

      {/* Book spine crease & specular highlight */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/55 via-white/15 to-transparent" />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/15" />

      {/* Favorite star mark */}
      {!isReflection && book.favorite && (
        <div className="pointer-events-none absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-[9px] text-amber-300 backdrop-blur-xs">
          ★
        </div>
      )}

      {/* Subtle reading progress bar at bottom edge of cover only when not reflected */}
      {!isReflection && showProgress && hasStarted && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-black/55">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${progressPct}%`,
              backgroundColor: isSelected ? '#38bdf8' : '#f59e0b',
            }}
          />
        </div>
      )}
    </div>
  );
};
