import type { MovieGenre } from '../types';
import { CloseIcon } from './icons';

type GenresOverlayProps = {
  open: boolean;
  genres: MovieGenre[];
  onClose: () => void;
  onSelectGenre: (genreId: number) => void;
};

export function GenresOverlay({ open, genres, onClose, onSelectGenre }: GenresOverlayProps) {
  if (!open) return null;

  return (
    <div className="genres-overlay" onClick={onClose}>
      <aside className="genres-panel" aria-label="Lista de generos" onClick={(event) => event.stopPropagation()}>
        <div className="genres-drawer-header">
          <h3>Generos</h3>
          <button type="button" className="genres-close-btn" onClick={onClose} aria-label="Fechar generos">
            <CloseIcon />
          </button>
        </div>
        <div className="genres-list">
          {genres.map((genre) => (
            <button
              key={genre.id}
              type="button"
              className="genre-chip"
              onClick={() => onSelectGenre(genre.id)}
            >
              {genre.name}
            </button>
          ))}
          {genres.length === 0 && <p className="status">Carregando generos...</p>}
        </div>
      </aside>
    </div>
  );
}
