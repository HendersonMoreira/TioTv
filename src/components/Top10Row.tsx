import { useRef } from 'react';
import { isComingSoon, getPosterUrlBySize, getTitle } from '../services/api';
import type { MediaItem } from '../types';
import { ChevronLeft, ChevronRight } from './icons';

interface Top10RowProps {
  title: string;
  items: MediaItem[];
  mediaType?: 'movie' | 'tv' | 'anime';
  onPlayItem: (item: MediaItem, type: 'movie' | 'tv' | 'anime') => void;
}

export function Top10Row({ title, items, mediaType = 'tv', onPlayItem }: Top10RowProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => trackRef.current?.scrollBy({ left: dir * 640, behavior: 'smooth' });

  return (
    <section className="top10-row">
      <h3>{title}</h3>
      <div className="top10-wrap">
        <button type="button" className="top10-arrow left" aria-label="Anterior" onClick={() => scroll(-1)}>
          <ChevronLeft />
        </button>
        <div className="top10-track" ref={trackRef}>
          {items.slice(0, 10).map((item, index) => (
            <article
              key={item.id}
              className="top10-card"
              role="button"
              tabIndex={0}
              data-preview-id={item.id}
              data-preview-type={mediaType}
              onClick={() => onPlayItem(item, mediaType)}
            >
              <span className="top10-number">{index + 1}</span>
              <div className="top10-poster">
                <img src={getPosterUrlBySize(item.poster_path, 'w342', index)} alt={getTitle(item)} decoding="async" />{isComingSoon(item) && <span className="soon-ribbon">Em Breve no Brasil</span>}
              </div>
            </article>
          ))}
        </div>
        <button type="button" className="top10-arrow right" aria-label="Proximo" onClick={() => scroll(1)}>
          <ChevronRight />
        </button>
      </div>
    </section>
  );
}
