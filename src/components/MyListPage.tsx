import { isComingSoon, getPosterUrl, getPosterUrlBySize, getTitle, getYear } from '../services/api';
import type { MediaItem } from '../types';
import { ChevronLeft, GearIcon } from './icons';

type MediaKind = 'movie' | 'tv' | 'anime';

export interface MyListEntry {
  key: string;
  type: MediaKind;
  contentId: number;
  season?: number;
  episode?: number;
  completed: boolean;
  updatedAt: string;
  item: MediaItem;
  positionSec?: number;
  durationSec?: number;
}

interface MyListPageProps {
  entries: MyListEntry[];
  loggedIn: boolean;
  onBack: () => void;
  onLogin: () => void;
  onPlayItem: (item: MediaItem, type: MediaKind) => void;
  onRemove: (entry: MyListEntry) => void;
  currentUserName?: string;
  onOpenSettings?: () => void;
  onLogout?: () => void;
  isItemLocked?: (item: MediaItem, type: MediaKind) => boolean;
}

function formatMovieTime(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`;
  return m > 0 ? `${m}min` : `${total}s`;
}

function formatEpisodeTime(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}s`;
  return s > 0 ? `${m}min ${String(s).padStart(2, '0')}s` : `${m}min`;
}

const TYPE_LABELS: Record<MediaKind, string> = {
  movie: 'Filme',
  tv: 'Serie',
  anime: 'Anime',
};

export function MyListPage({
  entries,
  loggedIn,
  onBack,
  onLogin,
  onPlayItem,
  onRemove,
  currentUserName,
  onOpenSettings,
  onLogout,
  isItemLocked,
}: MyListPageProps) {
  const sorted = [...entries].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  const inProgress = sorted.filter((entry) => !entry.completed);
  const seriesInProgress = inProgress.filter((entry) => entry.type !== 'movie');
  const moviesInProgress = inProgress.filter((entry) => entry.type === 'movie');
  const watched = sorted.filter((entry) => entry.completed);

  const renderGrid = (list: MyListEntry[]) => (
    <div className="mylist-grid">
      {list.map((entry, index) => {
        const item = { ...entry.item, id: entry.contentId, content_type: entry.type };
        const isLocked = isItemLocked?.(item, entry.type) ?? false;
        const progress =
          entry.type === 'movie' || !entry.season || !entry.episode
            ? TYPE_LABELS[entry.type]
            : `T${entry.season} · Ep ${entry.episode}`;
        const hasTime = !entry.completed && typeof entry.positionSec === 'number' && entry.positionSec > 0;
        const timeText = entry.completed
          ? 'Concluido'
          : entry.type === 'movie'
            ? hasTime
              ? `Parou em ${formatMovieTime(entry.positionSec as number)}${entry.durationSec ? ' de ' + formatMovieTime(entry.durationSec) : ''}`
              : 'Assistindo agora'
            : hasTime
              ? `Parou na temporada ${entry.season ?? 1}, ep ${entry.episode ?? 1} · ${formatEpisodeTime(entry.positionSec as number)}`
              : `Parou na temporada ${entry.season ?? 1}, ep ${entry.episode ?? 1}`;
        const percent = hasTime && entry.durationSec ? Math.min(100, Math.round(((entry.positionSec as number) / entry.durationSec) * 100)) : 0;

        return (
          <article
            key={entry.key}
            className={isLocked ? 'movie-card locked' : 'movie-card'}
            onClick={() => onPlayItem(item, entry.type)}
            role="button"
            tabIndex={0}
          >
            {isComingSoon(item) && <span className="soon-ribbon">Em Breve no Brasil</span>}
            <img
              src={getPosterUrl(item.poster_path, index)}
              srcSet={`${getPosterUrlBySize(item.poster_path, 'w342', index)} 342w, ${getPosterUrlBySize(item.poster_path, 'w500', index)} 500w`}
              sizes="(max-width: 768px) 42vw, 200px"
              alt={getTitle(item)}
              loading="lazy"
              decoding="async"
            />
            <button
              type="button"
              className="remove-row-item-btn"
              onClick={(event) => {
                event.stopPropagation();
                onRemove(entry);
              }}
              aria-label={`Remover ${getTitle(item)} da lista`}
              title="Remover da lista"
            >
              ×
            </button>
            <div className="card-gradient" />
            <div className="card-meta">
              <h4>{getTitle(item)}</h4>
              <span>
                {progress} · {getYear(item)}
              </span>
              <small className="mylist-time">{timeText}</small>
            </div>
            {percent > 0 && <div className="mylist-bar"><span style={{ width: `${percent}%` }} /></div>}
            {isLocked && <span className="premium-lock-badge">Premium</span>}
          </article>
        );
      })}
    </div>
  );

  return (
    <div className="mylist-page">
      <header className="mylist-header">
        <div className="mylist-header-top">
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

        <h2>Minha lista</h2>
        <p>Filmes, series e animes que voce esta assistindo ou ja assistiu</p>
      </header>

      {!loggedIn ? (
        <div className="mylist-empty">
          <p>Entre na sua conta para ver o que voce esta assistindo.</p>
          <button type="button" className="account-btn" onClick={onLogin}>Entrar</button>
        </div>
      ) : entries.length === 0 ? (
        <div className="mylist-empty">
          <p>Voce ainda nao assistiu nada. Escolha um titulo e comece a assistir!</p>
          <button type="button" className="account-btn" onClick={onBack}>Explorar catalogo</button>
        </div>
      ) : (
        <>
          {seriesInProgress.length > 0 && (
            <section className="mylist-section">
              <h3>Series que estou vendo</h3>
              {renderGrid(seriesInProgress)}
            </section>
          )}
          {moviesInProgress.length > 0 && (
            <section className="mylist-section">
              <h3>Filmes que estou vendo</h3>
              {renderGrid(moviesInProgress)}
            </section>
          )}
          {watched.length > 0 && (
            <section className="mylist-section">
              <h3>Ja terminei de assistir</h3>
              {renderGrid(watched)}
            </section>
          )}
        </>
      )}
    </div>
  );
}
