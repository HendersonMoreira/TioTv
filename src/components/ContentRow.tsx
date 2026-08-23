import { useEffect, useRef } from 'react';
import Glider from 'glider-js';
import 'glider-js/glider.min.css';
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
  isItemLocked?: (item: MediaItem, type: 'movie' | 'tv' | 'anime') => boolean;
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
  isItemLocked,
}: ContentRowProps) {
  const gliderElRef = useRef<HTMLDivElement | null>(null);
  const prevArrowRef = useRef<HTMLButtonElement | null>(null);
  const nextArrowRef = useRef<HTMLButtonElement | null>(null);
  const gliderRef = useRef<Glider | null>(null);

  useEffect(() => {
    const el = gliderElRef.current;
    if (!el) return;

    if (!gliderRef.current) {
      // skipTrack: a track (`.glider-track`) ja e renderizada pelo React, o Glider so deve usa-la
      gliderRef.current = new Glider(el, {
        skipTrack: true,
        slidesToShow: 2.3,
        slidesToScroll: 2,
        draggable: true,
        dragVelocity: 2,
        arrows: {
          prev: prevArrowRef.current,
          next: nextArrowRef.current,
        },
        responsive: [
          { breakpoint: 480, settings: { slidesToShow: 3.2, slidesToScroll: 3 } },
          { breakpoint: 768, settings: { slidesToShow: 4.2, slidesToScroll: 4 } },
          { breakpoint: 1100, settings: { slidesToShow: 5, slidesToScroll: 5 } },
        ],
      });
    } else {
      gliderRef.current.refresh(true);
    }
  }, [items]);

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
        <button ref={prevArrowRef} className="row-arrow left" aria-label={`Voltar ${title}`}>
          <ChevronLeft />
        </button>

        <div className="row-track" ref={gliderElRef}>
          <div className="glider-track">
          {items.map((item, index) => {
            const isFavorite = favorites.includes(item.id);
            let mediaType: 'movie' | 'tv' | 'anime' = item.content_type || 'movie';
            if (id === 'series' || id === 'ficcao') mediaType = 'tv';
            if (id === 'desenhos' || id === 'animes') mediaType = 'anime';
            const isLocked = isItemLocked?.(item, mediaType) ?? false;

            return (
              <article 
                className={isLocked ? 'movie-card locked' : 'movie-card'}
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

                {isLocked && <span className="premium-lock-badge">Premium</span>}
              </article>
            );
          })}
          </div>
        </div>

        <button ref={nextArrowRef} className="row-arrow right" aria-label={`Avancar ${title}`}>
          <ChevronRight />
        </button>
      </div>
    </section>
  );
}
