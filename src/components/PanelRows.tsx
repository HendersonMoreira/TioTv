import { useRef } from 'react';
import { isComingSoon, getBackdropUrlBySize, getTitle, getYear } from '../services/api';
import type { MediaItem, MovieGenre } from '../types';
import { ChevronRight } from './icons';

export interface PanelRow {
  id: string;
  title: string;
  items: MediaItem[];
  openCategory?: boolean;
}

interface PanelRowsProps {
  rows: PanelRow[];
  genres: MovieGenre[];
  onOpenCategory: (id: string) => void;
  onPlayItem: (item: MediaItem, type: 'movie' | 'tv' | 'anime') => void;
  isItemLocked?: (item: MediaItem, type: 'movie' | 'tv' | 'anime') => boolean;
}

const rowMediaType = (rowId: string, item: MediaItem): 'movie' | 'tv' | 'anime' => {
  if (rowId === 'series') return 'tv';
  if (rowId === 'animes' || rowId === 'desenhos') return 'anime';
  return item.content_type || 'movie';
};

function PanelTrack({ row, genres, onPlayItem, isItemLocked }: Omit<PanelRowsProps, 'rows' | 'onOpenCategory'> & { row: PanelRow }) {
  const trackRef = useRef<HTMLDivElement>(null);

  const genreText = (item: MediaItem) =>
    (item.genre_ids || [])
      .map((id) => genres.find((genre) => genre.id === id)?.name)
      .filter(Boolean)
      .slice(0, 2)
      .join(' · ');

  return (
    <div className="panel-track-wrap">
      <div className="panel-track" ref={trackRef}>
        {row.items.map((item, index) => {
          const locked = isItemLocked?.(item, rowMediaType(row.id, item)) ?? false;
          return (
            <article
              key={`${item.content_type || 'x'}-${item.id}`} data-preview-id={item.id} data-preview-type={rowMediaType(row.id, item)}
              className="panel-card"
              role="button"
              tabIndex={0}
              onClick={() => onPlayItem(item, rowMediaType(row.id, item))}
            >
              <div className="panel-card-img">
                <img
                  src={getBackdropUrlBySize(item.backdrop_path || item.poster_path, 'w500', index)}
                  alt={getTitle(item)}
                  decoding="async"
                />
                {isComingSoon(item) && <span className="soon-ribbon">Em Breve no Brasil</span>}{locked && <span className="panel-badge">Premium</span>}<div className="panel-hover"><strong>{getTitle(item)}</strong><span className="panel-play">▶ Assistir agora</span><small>{getYear(item)}{genreText(item) ? ' · ' + genreText(item) : ''}</small></div>
              </div>
              <h4>{getTitle(item)}</h4>
              <span>{genreText(item)}</span>
            </article>
          );
        })}
      </div>
      <button
        type="button"
        className="panel-next"
        aria-label="Proximos"
        onClick={() => trackRef.current?.scrollBy({ left: 620, behavior: 'smooth' })}
      >
        <ChevronRight />
      </button>
    </div>
  );
}

export function PanelRows({ rows, genres, onOpenCategory, onPlayItem, isItemLocked }: PanelRowsProps) {
  return (
    <section className="panel-rows">
      {rows.map((row) => (
        <div className="panel-row" key={row.id}>
          <div className="panel-row-title">
            <h3>{row.title}</h3>
            {row.openCategory && (
              <button type="button" onClick={() => onOpenCategory(row.id)}>
                Ver todos <ChevronRight />
              </button>
            )}
          </div>
          <PanelTrack row={row} genres={genres} onPlayItem={onPlayItem} isItemLocked={isItemLocked} />
        </div>
      ))}
    </section>
  );
}
