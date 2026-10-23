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
            </div>
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
          {inProgress.length > 0 && (
            <section className="mylist-section">
              <h3>Em andamento</h3>
              {renderGrid(inProgress)}
            </section>
          )}
          {watched.length > 0 && (
            <section className="mylist-section">
              <h3>Ja assistidos</h3>
              {renderGrid(watched)}
            </section>
          )}
        </>
      )}
    </div>
  );
}
