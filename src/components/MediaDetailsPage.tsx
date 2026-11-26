import { useEffect, useState } from 'react';
import { getBackdropUrlBySize, getPosterUrlBySize, getTitle, isComingSoon, loadMediaDetails, loadTrailerKey, type MediaDetails } from '../services/api';
import type { MediaItem } from '../types';
import { ChevronLeft, HeartIcon } from './icons';
import './MediaDetailsPage.css';

type Props = {
  id: number;
  type: 'movie' | 'tv' | 'anime';
  initialItem?: MediaItem;
  isFavorite: boolean;
  onBack: () => void;
  onPlay: (item: MediaItem, type: 'movie' | 'tv' | 'anime') => void;
  onToggleFavorite: (id: number) => void;
};

export function MediaDetailsPage({ id, type, initialItem, isFavorite, onBack, onPlay, onToggleFavorite }: Props) {
  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadMediaDetails(id, type)
      .then((result) => {
        if (!active) return;
        setDetails(result);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        console.error('Falha ao carregar detalhes:', err);
        setError('Não foi possível carregar todos os detalhes. Tente novamente.');
        setLoading(false);
      });
    return () => { active = false; };
  }, [id, type, attempt]);

  useEffect(() => {
    let active = true;
    loadTrailerKey(id, type).then((key) => {
      if (active) setTrailerKey(key);
    });
    return () => { active = false; };
  }, [id, type]);

  const item: MediaDetails | null = details
    ? { ...initialItem, ...details, coming_soon: initialItem?.coming_soon }
    : initialItem ?? null;
  const title = item ? getTitle(item) : '';
  const year = (item?.release_date || item?.first_air_date || '').slice(0, 4);
  const runtime = item?.runtime;
  const duration = runtime && runtime > 0
    ? `${Math.floor(runtime / 60) ? `${Math.floor(runtime / 60)}h ` : ''}${runtime % 60 ? `${runtime % 60}min` : ''}`.trim()
    : '';
  const rating = details?.vote_count && details.vote_average ? details.vote_average.toFixed(1) : '';
  const date = item?.release_date || item?.first_air_date || '';
  const formattedDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`
    : '';
  const originalTitle = details?.original_title || details?.original_name;
  const statusLabels: Record<string, string> = {
    Released: 'Lançado',
    'Returning Series': 'Em andamento',
    Ended: 'Finalizada',
    Canceled: 'Cancelada',
    'In Production': 'Em produção',
    Planned: 'Planejado',
    'Post Production': 'Pós-produção',
  };
  const status = details?.status ? statusLabels[details.status] : undefined;
  const companies = details?.production_companies?.slice(0, 3).map((company) => company.name).join(', ');

  return (
    <main className="media-details-page">
      {item?.backdrop_path && (
        <div className="media-details-backdrop" aria-hidden="true">
          <img src={getBackdropUrlBySize(item.backdrop_path, 'w1280')} alt="" />
        </div>
      )}
      <div className="media-details-inner">
        <button type="button" className="media-details-back" onClick={onBack}>
          <ChevronLeft /> Voltar
        </button>
        {loading && !item && <p className="media-details-status" role="status">Carregando informações...</p>}
        {error && (
          <div className="media-details-status" role="alert">
            {error}{' '}
            <button type="button" onClick={() => { setError(null); setLoading(true); setAttempt((value) => value + 1); }}>
              Tentar novamente
            </button>
          </div>
        )}
        {item && (
          <div className="media-details-layout">
            <div className="media-details-poster">
              {item.poster_path
                ? <img src={getPosterUrlBySize(item.poster_path, 'w500')} alt={`Cartaz de ${title}`} />
                : <div className="media-details-poster-fallback">Cartaz indisponível</div>}
            </div>
            <div className="media-details-content">
              <span className="media-details-eyebrow">TioTV · {type === 'movie' ? 'Filme' : type === 'anime' ? 'Anime' : 'Série'}</span>
              <h1>{title}</h1>
              <div className="media-details-meta">
                {year && <span>{year}</span>}
                {duration && <span>{duration}</span>}
                {details?.number_of_seasons ? <span>{details.number_of_seasons} {details.number_of_seasons === 1 ? 'temporada' : 'temporadas'}</span> : null}
                {details?.number_of_episodes ? <span>{details.number_of_episodes} episódios</span> : null}
                {rating && <span className="media-details-rating">★ {rating} / 10</span>}
              </div>
              {type === 'movie' && isComingSoon(item) && <span className="media-details-soon">Em breve no Brasil</span>}
              <div className="media-details-actions">
                <button type="button" className="media-details-play" onClick={() => onPlay(item, type)}>
                  <span aria-hidden="true">▶</span> Assistir agora
                </button>
                <button type="button" className="media-details-favorite" aria-pressed={isFavorite} onClick={() => onToggleFavorite(id)}>
                  <HeartIcon /> {isFavorite ? 'Nos favoritos' : 'Adicionar aos favoritos'}
                </button>
                {trailerKey && (
                  <a className="media-details-trailer" href={`https://www.youtube.com/watch?v=${encodeURIComponent(trailerKey)}`} target="_blank" rel="noopener noreferrer">
                    ▶ Ver trailer
                  </a>
                )}
              </div>
              <div className="media-details-synopsis">
                <h2>Sinopse</h2>
                <p>{item.overview || 'Sinopse indisponível para este título.'}</p>
              </div>
              {loading && <p className="media-details-loading" role="status">Carregando mais informações...</p>}
            </div>
            <aside className="media-details-facts" aria-label="Informações do título">
              <h2>Informações</h2>
              <dl>
                <div><dt>Tipo</dt><dd>{type === 'movie' ? 'Filme' : type === 'anime' ? 'Anime' : 'Série'}</dd></div>
                {originalTitle && originalTitle !== title && <div><dt>Título original</dt><dd>{originalTitle}</dd></div>}
                {formattedDate && <div><dt>Lançamento</dt><dd>{formattedDate}</dd></div>}
                {status && <div><dt>Status</dt><dd>{status}</dd></div>}
                {duration && <div><dt>Duração</dt><dd>{duration}</dd></div>}
                {details?.number_of_seasons ? <div><dt>Temporadas</dt><dd>{details.number_of_seasons}</dd></div> : null}
                {details?.number_of_episodes ? <div><dt>Episódios</dt><dd>{details.number_of_episodes}</dd></div> : null}
                {companies && <div><dt>Produção</dt><dd>{companies}</dd></div>}
                {details?.genres && details.genres.length > 0 && (
                  <div>
                    <dt>Gêneros</dt>
                    <dd className="media-details-genres">
                      {details.genres.map((genre) => <span key={genre.id}>{genre.name}</span>)}
                    </dd>
                  </div>
                )}
              </dl>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
