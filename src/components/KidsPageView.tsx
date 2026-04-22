import { useMemo, useState } from 'react';
import { getPosterUrl, getPosterUrlBySize, getTitle, getYear } from '../services/api';
import type { MediaItem } from '../types';
import { ChevronLeft, GearIcon, HeartIcon } from './icons';

interface KidsPageViewProps {
  cartoons: MediaItem[];
  family: MediaItem[];
  favorites: number[];
  onBack: () => void;
  onToggleFavorite: (id: number) => void;
  onPlayItem?: (item: MediaItem, type: 'movie' | 'tv' | 'anime') => void;
  currentUserName?: string;
  onOpenSettings?: () => void;
  onLogout?: () => void;
}

export function KidsPageView({
  cartoons,
  family,
  favorites,
  onBack,
  onToggleFavorite,
  onPlayItem,
  currentUserName,
  onOpenSettings,
  onLogout,
}: KidsPageViewProps) {
  const ITEMS_PER_PAGE = 12;
  const [cartoonsPage, setCartoonsPage] = useState(1);
  const [familyPage, setFamilyPage] = useState(1);

  const cartoonsTotalPages = Math.max(1, Math.ceil(cartoons.length / ITEMS_PER_PAGE));
  const familyTotalPages = Math.max(1, Math.ceil(family.length / ITEMS_PER_PAGE));

  const pagedCartoons = useMemo(() => {
    const start = (cartoonsPage - 1) * ITEMS_PER_PAGE;
    return cartoons.slice(start, start + ITEMS_PER_PAGE);
  }, [cartoons, cartoonsPage]);

  const pagedFamily = useMemo(() => {
    const start = (familyPage - 1) * ITEMS_PER_PAGE;
    return family.slice(start, start + ITEMS_PER_PAGE);
  }, [family, familyPage]);

  const renderPagination = (
    currentPage: number,
    totalPages: number,
    onPageChange: (page: number) => void
  ) => {
    if (totalPages <= 1) return null;

    return (
      <div className="kids-pagination" role="navigation" aria-label="Paginacao da lista kids">
        {Array.from({ length: totalPages }, (_, index) => {
          const page = index + 1;
          return (
            <button
              key={page}
              type="button"
              className={page === currentPage ? 'kids-page-btn active' : 'kids-page-btn'}
              onClick={() => onPageChange(page)}
              aria-label={`Ir para pagina ${page}`}
              aria-current={page === currentPage ? 'page' : undefined}
            >
              {page}
            </button>
          );
        })}
      </div>
    );
  };

  const handleItemClick = (item: MediaItem, type: 'movie' | 'tv' | 'anime') => {
    if (!onPlayItem) return;
    onPlayItem(item, type);
  };

  return (
    <div className="kids-page">
      <header className="kids-header">
        <div className="kids-header-top">
          <button type="button" className="back-btn" onClick={onBack}>
            <ChevronLeft />
            Voltar
          </button>

          {currentUserName && (
            <div className="nav-actions">
              <span className="user-chip">Ola, {currentUserName}</span>
              <button
                className="gear-btn circle-btn"
                aria-label="Configuracoes do perfil"
                onClick={onOpenSettings}
              >
                <GearIcon />
              </button>
              <button className="account-btn" onClick={onLogout}>Sair</button>
            </div>
          )}
        </div>

        <h2>Espaco Kids</h2>
        <p>Conteudo infantil selecionado para criancas</p>
      </header>

      <section className="kids-section">
        <h3>Desenhos e Animes</h3>
        <div className="kids-grid">
          {pagedCartoons.map((item, index) => (
            <article 
              key={`cartoon-${item.id}`} 
              className="movie-card"
              onClick={() => handleItemClick(item, 'anime')}
              role="button"
              tabIndex={0}
            >
              <img
                src={getPosterUrl(item.poster_path, index)}
                srcSet={`${getPosterUrlBySize(item.poster_path, 'w185', index)} 185w, ${getPosterUrlBySize(item.poster_path, 'w342', index)} 342w, ${getPosterUrlBySize(item.poster_path, 'w500', index)} 500w`}
                sizes="(max-width: 768px) 42vw, 180px"
                alt={getTitle(item)}
                loading="lazy"
                decoding="async"
              />
              <div className="card-gradient" />
              <div className="card-meta">
                <h4>{getTitle(item)}</h4>
                <span>{getYear(item)}</span>
              </div>
              <button
                type="button"
                className={favorites.includes(item.id) ? 'fav-btn active' : 'fav-btn'}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(item.id);
                }}
                aria-label={`Favoritar ${getTitle(item)}`}
              >
                <HeartIcon />
              </button>
            </article>
          ))}
        </div>
        {renderPagination(cartoonsPage, cartoonsTotalPages, setCartoonsPage)}
      </section>

      <section className="kids-section">
        <h3>Filmes para Familia</h3>
        <div className="kids-grid">
          {pagedFamily.map((item, index) => (
            <article 
              key={`family-${item.id}`} 
              className="movie-card"
              onClick={() => handleItemClick(item, 'movie')}
              role="button"
              tabIndex={0}
            >
              <img
                src={getPosterUrl(item.poster_path, index)}
                srcSet={`${getPosterUrlBySize(item.poster_path, 'w185', index)} 185w, ${getPosterUrlBySize(item.poster_path, 'w342', index)} 342w, ${getPosterUrlBySize(item.poster_path, 'w500', index)} 500w`}
                sizes="(max-width: 768px) 42vw, 180px"
                alt={getTitle(item)}
                loading="lazy"
                decoding="async"
              />
              <div className="card-gradient" />
              <div className="card-meta">
                <h4>{getTitle(item)}</h4>
                <span>{getYear(item)}</span>
              </div>
              <button
                type="button"
                className={favorites.includes(item.id) ? 'fav-btn active' : 'fav-btn'}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(item.id);
                }}
                aria-label={`Favoritar ${getTitle(item)}`}
              >
                <HeartIcon />
              </button>
            </article>
          ))}
        </div>
        {renderPagination(familyPage, familyTotalPages, setFamilyPage)}
      </section>
    </div>
  );
}
