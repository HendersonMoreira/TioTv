import { useRef } from 'react';
import { getPosterUrl, getPosterUrlBySize, getTitle, getYear } from '../services/api';
import type { MediaItem } from '../types';
import { ChevronLeft, ChevronRight, HeartIcon } from './icons';

type ContentRowProps = {
  id: string;
  title: string;
  items: MediaItem[];
  favorites: number[];
  onToggleFavorite: (id: number) => void;
  onOpenCategory?: (id: string) => void;
  onPlayItem?: (item: MediaItem, type: 'movie' | 'tv' | 'anime') => void;
  onRemoveItem?: (item: MediaItem) => void;
};

export function ContentRow({
  id,
  title,
  items,
  favorites,
  onToggleFavorite,
  onOpenCategory,
  onPlayItem,
  onRemoveItem,
}: ContentRowProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  const scrollByCard = (direction: 'left' | 'right') => {
    const track = trackRef.current;
    if (!track) return;
    const cardSize = window.innerWidth < 768 ? 170 : 220;
    track.scrollBy({
      left: direction === 'left' ? -cardSize * 2 : cardSize * 2,
      behavior: 'smooth',
    });
  };

  const handleItemClick = (item: MediaItem) => {
    if (!onPlayItem) return;
    // Determinar tipo baseado no ID da row
    let mediaType: 'movie' | 'tv' | 'anime' = item.content_type || 'movie';
    if (id === 'series' || id === 'ficcao') mediaType = 'tv';
    if (id === 'desenhos' || id === 'animes') mediaType = 'anime';

    onPlayItem(item, mediaType);
  };

  return (
    <section className="content-row" id={`row-${id}`}>
      <div className="row-header">
        <h3>{title}</h3>
        {onOpenCategory && (
          <button className="see-all-btn" onClick={() => onOpenCategory(id)}>
            Ver Todos
          </button>
        )}
      </div>

      <div className="row-wrapper">
        <button className="row-arrow left" onClick={() => scrollByCard('left')} aria-label={`Voltar ${title}`}>
          <ChevronLeft />
        </button>

        <div className="row-track" ref={trackRef}>
          {items.map((item, index) => {
            const isFavorite = favorites.includes(item.id);
            return (
              <article 
                className="movie-card" 
                key={`${item.id}-${index}`}
                onClick={() => handleItemClick(item)}
                role="button"
                tabIndex={0}
              >
                <img
                  src={getPosterUrl(item.poster_path, index)}
                  srcSet={`${getPosterUrlBySize(item.poster_path, 'w342', index)} 342w, ${getPosterUrlBySize(item.poster_path, 'w500', index)} 500w`}
                  sizes="(max-width: 768px) 38vw, 170px"
                  alt={getTitle(item)}
                  loading="lazy"
                  decoding="async"
                />

                {onRemoveItem && (
                  <button
                    className="remove-row-item-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveItem(item);
                    }}
                    aria-label={`Remover ${getTitle(item)} de ${title}`}
                    title="Remover da lista"
                  >
                    ×
                  </button>
                )}

                <button
                  className={isFavorite ? 'fav-btn active' : 'fav-btn'}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(item.id);
                  }}
                  aria-label={isFavorite ? 'Remover dos favoritos' : 'Salvar para assistir depois'}
                >
                  <HeartIcon />
                </button>

                <div className="card-gradient" />
                <div className="card-meta">
                  <h4>{getTitle(item)}</h4>
                  <span>{getYear(item)}</span>
                </div>
              </article>
            );
          })}
        </div>

        <button className="row-arrow right" onClick={() => scrollByCard('right')} aria-label={`Avancar ${title}`}>
          <ChevronRight />
        </button>
      </div>
    </section>
  );
}
