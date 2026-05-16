import { getPosterUrl, getPosterUrlBySize, getTitle, getYear } from '../services/api';
import type { MediaItem } from '../types';
import { SearchModal } from './SearchModal';
import { ChevronLeft, GearIcon, HeartIcon, SearchIcon } from './icons';

type CategoryPageViewProps = {
  title: string;
  items: MediaItem[];
  favorites: number[];
  loading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  onBack: () => void;
  onPageChange: (page: number) => void;
  onToggleFavorite: (id: number) => void;
  onPlayItem?: (item: MediaItem, type: 'movie' | 'tv' | 'anime') => void;
  searchOpen: boolean;
  searchQuery: string;
  searchResults: MediaItem[];
  onSearchToggle: () => void;
  onSearchChange: (query: string) => void | Promise<void>;
  onSelectSearchItem?: (item: MediaItem) => void;
  currentUserName?: string;
  onOpenSettings?: () => void;
  onLogout?: () => void;
  isItemLocked?: (item: MediaItem, type: 'movie' | 'tv' | 'anime') => boolean;
};

export function CategoryPageView({
  title,
  items,
  favorites,
  loading,
  error,
  currentPage,
  totalPages,
  onBack,
  onPageChange,
  onToggleFavorite,
  onPlayItem,
  searchOpen,
  searchQuery,
  searchResults,
  onSearchToggle,
  onSearchChange,
  onSelectSearchItem,
  currentUserName,
  onOpenSettings,
  onLogout,
  isItemLocked,
}: CategoryPageViewProps) {
  const buildPageNumbers = (): number[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
    return [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  };

  const visiblePages = buildPageNumbers();

  const handleItemClick = (item: MediaItem) => {
    if (!onPlayItem) return;
    if (item.content_type) {
      onPlayItem(item, item.content_type);
      return;
    }

    // Detectar tipo pela página atual
    let mediaType: 'movie' | 'tv' | 'anime' = 'movie';
    if (title.toLowerCase().includes('série') || title.toLowerCase().includes('serie')) mediaType = 'tv';
    if (title.toLowerCase().includes('anime')) mediaType = 'anime';

    onPlayItem(item, mediaType);
  };

  const resolveMediaType = (): 'movie' | 'tv' | 'anime' => {
    const normalized = title.toLowerCase();
    if (normalized.includes('série') || normalized.includes('serie')) return 'tv';
    if (normalized.includes('anime')) return 'anime';
    return 'movie';
  };

  const categoryMediaType = resolveMediaType();

  return (
    <div className="app-shell">
      <main className="category-page">
        <div className="category-page-topbar">
          <div className="category-page-header">
            <button className="back-btn" onClick={onBack}>
              <ChevronLeft />
              Voltar
            </button>
            <h2>{title}</h2>
          </div>

          <div className="nav-actions">
            <button
              className="circle-btn"
              onClick={onSearchToggle}
              aria-label="Buscar"
            >
              <SearchIcon />
            </button>

            {currentUserName && (
              <>
                <span className="user-chip">Ola, {currentUserName}</span>
                <button
                  className="gear-btn circle-btn"
                  aria-label="Configuracoes do perfil"
                  onClick={onOpenSettings}
                >
                  <GearIcon />
                </button>
                <button className="account-btn" onClick={onLogout}>Sair</button>
              </>
            )}
          </div>

          {searchOpen && (
            <SearchModal
              searchQuery={searchQuery}
              searchResults={searchResults}
              onSearchChange={onSearchChange}
              onSelectItem={onSelectSearchItem}
            />
          )}
        </div>

        {loading && items.length === 0 && <p className="status">Carregando titulos...</p>}
        {error && <p className="status error">{error}</p>}

        {!error && items.length > 0 && (
          <div className="category-grid">
            {items.map((item, index) => {
              const isFavorite = favorites.includes(item.id);
              const isLocked = isItemLocked?.(item, categoryMediaType) ?? false;
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
        )}

        {!loading && !error && items.length === 0 && (
          <p className="status">Nenhum titulo encontrado nessa categoria.</p>
        )}

        {!loading && !error && items.length > 0 && totalPages > 1 && (
          <div className="category-pagination" role="navigation" aria-label="Paginacao da categoria">
            <button
              type="button"
              className="category-page-btn"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              Anterior
            </button>

            {visiblePages.map((page, index) => {
              const prev = visiblePages[index - 1];
              const showGap = index > 0 && prev !== undefined && page - prev > 1;

              return (
                <span key={`page-wrap-${page}`} className="category-page-wrap">
                  {showGap && <span className="category-page-gap">...</span>}
                  <button
                    type="button"
                    className={page === currentPage ? 'category-page-btn active' : 'category-page-btn'}
                    onClick={() => onPageChange(page)}
                    aria-current={page === currentPage ? 'page' : undefined}
                  >
                    {page}
                  </button>
                </span>
              );
            })}

            <button
              type="button"
              className="category-page-btn"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              Proxima
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
