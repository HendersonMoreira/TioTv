import { useEffect, useState } from 'react';
import { getBackdropUrlBySize, getPosterUrlBySize, getTitle, getYear } from '../services/api';
import type { MediaItem, MovieGenre } from '../types';

interface AnimeFeatureProps {
  title: string;
  items: MediaItem[];
  genres: MovieGenre[];
  favorites: number[];
  onToggleFavorite: (id: number) => void;
  onPlayItem: (item: MediaItem, type: 'movie' | 'tv' | 'anime') => void;
  onViewAll: () => void;
}

export function AnimeFeature({ title, items, genres, favorites, onToggleFavorite, onPlayItem, onViewAll }: AnimeFeatureProps) {
  const list = items.filter((item) => item.backdrop_path).slice(0, 8);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    list.forEach((entry) => {
      new Image().src = getBackdropUrlBySize(entry.backdrop_path, 'w1280');
    });
  }, [list]);

  useEffect(() => {
    if (list.length < 2) return;
    const timer = window.setInterval(() => setIndex((prev) => (prev + 1) % list.length), 8000);
    return () => window.clearInterval(timer);
  }, [list.length]);

  if (list.length === 0) return null;
  const item = list[index % list.length];
  const genreNames = (item.genre_ids || [])
    .map((id) => genres.find((genre) => genre.id === id)?.name)
    .filter(Boolean)
    .slice(0, 3) as string[];
  const overview = item.overview && item.overview.length > 230 ? item.overview.slice(0, 230).trim() + ' ...' : item.overview;
  const isFav = favorites.includes(item.id);

  return (
    <section className="anime-feature">
      <div className="anime-feature-head">
        <h3>{title}</h3>
        <button type="button" onClick={onViewAll}>Ver todos</button>
      </div>
      <div className="anime-feature-card">
        <img
          key={item.id}
          className="anime-feature-bg"
          src={getBackdropUrlBySize(item.backdrop_path, 'w1280')}
          alt={getTitle(item)}
        />
        <div className="anime-feature-shade" />
        <div className="anime-feature-info">
          <h2>{getTitle(item)}</h2>
          <div className="anime-feature-chips">
            <span>{getYear(item)}</span>
            <span>Anime</span>
          </div>
          {genreNames.length > 0 && (
            <div className="anime-feature-genres">
              {genreNames.map((name) => <span key={name}>{name}</span>)}
            </div>
          )}
          {overview && <p>{overview}</p>}
          <div className="anime-feature-actions">
            <button type="button" className="af-play" onClick={() => onPlayItem(item, 'anime')}>Assistir agora ▶</button>
            <button type="button" className="af-ghost" onClick={() => onPlayItem(item, 'anime')}>Mais info</button>
            <button
              type="button"
              className="af-ghost af-plus"
              aria-label={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              onClick={() => onToggleFavorite(item.id)}
            >
              {isFav ? '✓' : '+'}
            </button>
          </div>
        </div>
        <div className="anime-feature-thumbs">
          {list.map((entry, i) => (
            <button
              key={entry.id}
              type="button"
              className={i === index ? 'active' : ''}
              onClick={() => setIndex(i)}
              aria-label={getTitle(entry)}
            >
              <img src={getPosterUrlBySize(entry.poster_path, 'w185', i)} alt="" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
