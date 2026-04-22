import { getPosterUrl, getPosterUrlBySize, getTitle, getYear } from '../services/api';
import type { MediaItem } from '../types';

type SearchModalProps = {
  searchQuery: string;
  searchResults: MediaItem[];
  onSearchChange: (query: string) => void | Promise<void>;
  onSelectItem?: (item: MediaItem) => void;
};

export function SearchModal({ searchQuery, searchResults, onSearchChange, onSelectItem }: SearchModalProps) {
  return (
    <div className="search-modal">
      <input
        type="text"
        className="search-input"
        placeholder="Buscar filmes, séries, desenhos..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        autoFocus
      />
      {searchQuery.length > 0 && (
        <div className="search-results">
          {searchResults.length > 0 ? (
            searchResults.map((item) => (
              <div
                key={`${item.id}-${item.media_type || item.content_type || 'movie'}`}
                className="search-result-item"
                role="button"
                tabIndex={0}
                onClick={() => onSelectItem?.(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectItem?.(item);
                  }
                }}
              >
                <img
                  src={getPosterUrl(item.poster_path)}
                  srcSet={`${getPosterUrlBySize(item.poster_path, 'w185')} 185w, ${getPosterUrlBySize(item.poster_path, 'w342')} 342w`}
                  sizes="50px"
                  alt={getTitle(item)}
                  loading="lazy"
                  decoding="async"
                />
                <div>
                  <p>{getTitle(item)}</p>
                  <span>{getYear(item)}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="no-results">Nenhum resultado encontrado</p>
          )}
        </div>
      )}
    </div>
  );
}
