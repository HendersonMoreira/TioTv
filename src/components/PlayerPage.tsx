import { useEffect, useMemo, useState } from 'react';
import type { Episode, PlayerContent } from '../types';
import { ChevronLeft, ChevronRight, GearIcon } from './icons';
import '../styles/player.css';

type PlayerPageProps = {
  type: 'movie' | 'tv' | 'anime';
  contentId: number;
  content: PlayerContent;
  onBack: () => void;
  currentUserName?: string;
  onOpenSettings?: () => void;
  onLogout?: () => void;
  onProgressChange?: (progress: {
    type: 'movie' | 'tv' | 'anime';
    contentId: number;
    season?: number;
    episode?: number;
    completed: boolean;
    updatedAt: string;
    item: PlayerContent;
  }) => void;
};

const EMBED_PROVIDERS = {
  movie: (id: number) => `https://vidsrc.to/embed/movie/${id}`,
  tv: (id: number, season: number, episode: number) =>
    `https://vidsrc.to/embed/tv/${id}/${season}/${episode}`,
  anime: (id: number, season: number, episode: number) =>
    `https://vidsrc.to/embed/tv/${id}/${season}/${episode}`,
};

const PLAYER_SERVER_KEY = 'tiotv_player_server_v1';

type PlayerServer = 'vidsrc' | 'myembed';

type ServerOption = {
  value: PlayerServer;
  label: string;
};

const SERVER_OPTIONS: ServerOption[] = [
  { value: 'vidsrc', label: 'Vidsrc (Padrao)' },
  { value: 'myembed', label: 'MyEmbed (PT-BR)' },
];

const SERVER_EMBED_BUILDERS: Record<PlayerServer, {
  movie: (id: number, season: number, episode: number) => string;
  tv: (id: number, season: number, episode: number) => string;
  anime: (id: number, season: number, episode: number) => string;
}> = {
  vidsrc: {
    movie: (id: number) => EMBED_PROVIDERS.movie(id),
    tv: (id: number, season: number, episode: number) => EMBED_PROVIDERS.tv(id, season, episode),
    anime: (id: number, season: number, episode: number) => EMBED_PROVIDERS.anime(id, season, episode),
  },
  myembed: {
    movie: (id: number) => `https://myembed.biz/filme/${id}`,
    tv: (id: number, season: number, episode: number) => `https://myembed.biz/serie/${id}/${season}/${episode}`,
    anime: (id: number, season: number, episode: number) => `https://myembed.biz/serie/${id}/${season}/${episode}`,
  },
};

const PLAYER_PROGRESS_KEY_PREFIX = 'tiotv_player_progress_v1';

type SavedProgress = {
  season: number;
  episode: number;
  updatedAt: string;
};

function getProgressStorageKey(type: 'movie' | 'tv' | 'anime', contentId: number) {
  return `${PLAYER_PROGRESS_KEY_PREFIX}:${type}:${contentId}`;
}

export function PlayerPage({
  type,
  contentId,
  content,
  onBack,
  currentUserName,
  onOpenSettings,
  onLogout,
  onProgressChange,
}: PlayerPageProps) {
  const [selectedServer, setSelectedServer] = useState<PlayerServer>(() => {
    const saved = window.localStorage.getItem(PLAYER_SERVER_KEY);
    if (saved === 'vidsrc' || saved === 'myembed') {
      return saved;
    }
    return 'vidsrc';
  });
  const [currentSeason, setCurrentSeason] = useState(1);
  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [showEpisodeList, setShowEpisodeList] = useState(false);
  const [showNoSourceHint, setShowNoSourceHint] = useState(false);
  const [resumePromptOpen, setResumePromptOpen] = useState(false);
  const [resumeCandidate, setResumeCandidate] = useState<SavedProgress | null>(null);
  const [resumeChecked, setResumeChecked] = useState(false);

  const episodes = useMemo(() => {
    if (!content.episodes || type === 'movie') {
      console.log('PlayerPage: Sem episódios (tipo:', type, ', episodes:', content.episodes ? 'exists' : 'undefined', ')');
      return [];
    }

    console.log('=== PLAYERPAGE: Processando episódios ===');
    console.log('Total de episódios recebidos:', content.episodes.length);
    console.log('Episódios:', content.episodes);
    
    const grouped: Record<number, Episode[]> = {};
    content.episodes.forEach((ep) => {
      if (!grouped[ep.season]) {
        grouped[ep.season] = [];
      }
      grouped[ep.season].push(ep);
    });

    console.log('Episódios agrupados por temporada:');
    Object.entries(grouped).forEach(([season, eps]) => {
      console.log(`  Temporada ${season}: ${eps.length} episódios`);
    });
    console.log('Estrutura final:', grouped);
    
    return grouped;
  }, [content.episodes, type]);

  const currentSeasonEpisodes = episodes[currentSeason] || [];
  const currentEpisodeData = currentSeasonEpisodes.find(
    (ep) => ep.episode === currentEpisode,
  );

  const playerUrl = SERVER_EMBED_BUILDERS[selectedServer][type](
    contentId,
    currentSeason,
    currentEpisode,
  );

  const seasons = useMemo(() => Object.keys(episodes).map(Number).sort((a, b) => a - b), [episodes]);

  useEffect(() => {
    setCurrentSeason(1);
    setCurrentEpisode(1);
    setShowEpisodeList(false);
    setShowNoSourceHint(false);
    setResumePromptOpen(false);
    setResumeCandidate(null);
    setResumeChecked(false);
  }, [contentId, type]);

  useEffect(() => {
    setShowNoSourceHint(false);
  }, [playerUrl]);

  useEffect(() => {
    if (!showNoSourceHint) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowNoSourceHint(false);
    }, 4000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [showNoSourceHint]);

  useEffect(() => {
    window.localStorage.setItem(PLAYER_SERVER_KEY, selectedServer);
  }, [selectedServer]);

  useEffect(() => {
    if (type === 'movie' || resumeChecked || seasons.length === 0) {
      return;
    }

    const key = getProgressStorageKey(type, contentId);
    const raw = window.localStorage.getItem(key);

    if (!raw) {
      setResumeChecked(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as SavedProgress;
      const hasSeason = seasons.includes(parsed.season);
      const seasonEpisodes = episodes[parsed.season] || [];
      const hasEpisode = seasonEpisodes.some((ep) => ep.episode === parsed.episode);

      if (hasSeason && hasEpisode && (parsed.season !== 1 || parsed.episode !== 1)) {
        setResumeCandidate(parsed);
        setResumePromptOpen(true);
      }
    } catch (err) {
      console.warn('Falha ao ler progresso salvo do player:', err);
    }

    setResumeChecked(true);
  }, [type, contentId, seasons, episodes, resumeChecked]);

  useEffect(() => {
    if (type === 'movie' || !resumeChecked || resumePromptOpen) {
      return;
    }

    const key = getProgressStorageKey(type, contentId);
    const payload: SavedProgress = {
      season: currentSeason,
      episode: currentEpisode,
      updatedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(key, JSON.stringify(payload));
  }, [type, contentId, currentSeason, currentEpisode, resumeChecked, resumePromptOpen]);

  useEffect(() => {
    if (!onProgressChange) {
      return;
    }

    const updatedAt = new Date().toISOString();

    if (type === 'movie') {
      onProgressChange({
        type,
        contentId,
        completed: true,
        updatedAt,
        item: content,
      });
      return;
    }

    if (seasons.length === 0 || currentSeasonEpisodes.length === 0) {
      return;
    }

    const lastSeason = seasons[seasons.length - 1];
    const lastSeasonEpisodes = episodes[lastSeason] || [];
    const lastEpisodeNumber = lastSeasonEpisodes[lastSeasonEpisodes.length - 1]?.episode;
    const completed = currentSeason === lastSeason && currentEpisode === lastEpisodeNumber;

    onProgressChange({
      type,
      contentId,
      season: currentSeason,
      episode: currentEpisode,
      completed,
      updatedAt,
      item: content,
    });
  }, [
    content,
    contentId,
    currentEpisode,
    currentSeason,
    currentSeasonEpisodes.length,
    episodes,
    onProgressChange,
    seasons,
    type,
  ]);

  const resumeFromSavedProgress = () => {
    if (resumeCandidate) {
      setCurrentSeason(resumeCandidate.season);
      setCurrentEpisode(resumeCandidate.episode);
    }
    setResumePromptOpen(false);
  };

  const startFromBeginning = () => {
    setCurrentSeason(1);
    setCurrentEpisode(1);
    setResumePromptOpen(false);
  };

  const goToNextEpisode = () => {
    const maxEpisode = currentSeasonEpisodes.length;
    if (currentEpisode < maxEpisode) {
      setCurrentEpisode(currentEpisode + 1);
    } else if (currentSeason < seasons[seasons.length - 1]) {
      const nextSeason = seasons[seasons.indexOf(currentSeason) + 1];
      setCurrentSeason(nextSeason);
      setCurrentEpisode(1);
    }
  };

  const goToPreviousEpisode = () => {
    if (currentEpisode > 1) {
      setCurrentEpisode(currentEpisode - 1);
    } else if (currentSeason > 1) {
      const prevSeasonIdx = seasons.indexOf(currentSeason) - 1;
      const prevSeason = seasons[prevSeasonIdx];
      const prevSeasonEpisodes = episodes[prevSeason];
      setCurrentSeason(prevSeason);
      setCurrentEpisode(prevSeasonEpisodes?.length || 1);
    }
  };

  const goToEpisode = (season: number, episode: number) => {
    setCurrentSeason(season);
    setCurrentEpisode(episode);
    setShowEpisodeList(false);
  };

  const title = content.title || content.name || 'Sem título';

  const getEpisodeThumb = (ep: Episode) => {
    if (ep.still_path) {
      return `https://image.tmdb.org/t/p/w300${ep.still_path}`;
    }

    if (content.backdrop_path) {
      return `https://image.tmdb.org/t/p/w300${content.backdrop_path}`;
    }

    if (content.poster_path) {
      return `https://image.tmdb.org/t/p/w300${content.poster_path}`;
    }

    return '';
  };

  return (
    <div className="player-page">
      {resumePromptOpen && resumeCandidate && (
        <div className="resume-overlay" role="dialog" aria-modal="true">
          <div className="resume-card">
            <h4>Continuar de onde parou?</h4>
            <p>
              Encontramos progresso salvo na Temporada {resumeCandidate.season}, Episódio {resumeCandidate.episode}.
            </p>
            <div className="resume-actions">
              <button className="control-btn secondary" onClick={startFromBeginning}>
                Nao, comecar do inicio
              </button>
              <button className="control-btn" onClick={resumeFromSavedProgress}>
                Sim, continuar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="player-topbar">
        <button className="player-back-btn" onClick={onBack}>
          <ChevronLeft />
          <span>Voltar</span>
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

      <div className="player-layout">
        {/* Main Player Section */}
        <div className="player-main">
          {/* Video Player */}
          <div className="player-wrapper">
            <div className="video-container">
              <iframe
                src={playerUrl}
                allowFullScreen
                sandbox="allow-same-origin allow-scripts allow-forms allow-presentation"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="fullscreen; picture-in-picture; encrypted-media"
                title={`${title} - ${currentSeasonEpisodes[currentEpisode - 1]?.title || 'Assistindo'}`}
                onError={(e) => {
                  console.error('Player error:', e);
                }}
              />
            </div>

            {/* Player Info */}
            <div className="player-info">
              <div className="episode-header">
                <div>
                  <div className="player-title-row">
                    <h3 className="player-title">{title}</h3>
                    <label className="server-select-wrap">
                      <span>Escolha o servidor</span>
                      <select
                        value={selectedServer}
                        onChange={(e) => setSelectedServer(e.target.value as PlayerServer)}
                        aria-label="Escolha o servidor de reproducao"
                      >
                        {SERVER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {type !== 'movie' && (
                    <p className="episode-label">
                      Temporada {currentSeason} • Episódio {currentEpisode}
                    </p>
                  )}
                  {currentEpisodeData?.title && (
                    <p className="episode-title">{currentEpisodeData.title}</p>
                  )}
                </div>
              </div>

              {currentEpisodeData?.overview && (
                <p className="episode-description">{currentEpisodeData.overview}</p>
              )}

              {/* Controls */}
              <div className="player-controls">
                {type !== 'movie' && (
                  <>
                    <button
                      className="control-btn secondary"
                      onClick={goToPreviousEpisode}
                      disabled={
                        currentEpisode === 1 &&
                        currentSeason === seasons[0]
                      }
                    >
                      <ChevronLeft />
                      Anterior
                    </button>

                    <button
                      className="control-btn secondary"
                      onClick={goToNextEpisode}
                      disabled={
                        currentEpisode === currentSeasonEpisodes.length &&
                        currentSeason === seasons[seasons.length - 1]
                      }
                    >
                      Próximo
                      <ChevronRight />
                    </button>
                  </>
                )}

                {type !== 'movie' && (
                  <button
                    className="control-btn secondary"
                    onClick={() => setShowEpisodeList(!showEpisodeList)}
                  >
                    <span>📺</span>
                    Eps ({currentSeasonEpisodes.length})
                  </button>
                )}

                <button
                  className="control-btn secondary"
                  onClick={() => setShowNoSourceHint((prev) => !prev)}
                >
                  Nao carregou?
                </button>
              </div>

              {showNoSourceHint && (
                <div className="player-no-source-hint" role="status" aria-live="polite">
                  <button
                    type="button"
                    className="close-no-source-hint"
                    aria-label="Fechar aviso"
                    onClick={() => setShowNoSourceHint(false)}
                  >
                    x
                  </button>
                  <img
                    src="https://media1.tenor.com/m/D--yGsQy2EsAAAAd/crying-girl-anime.gif"
                    alt="Anime triste"
                    loading="lazy"
                  />
                  <div>
                    <p>Ops, parece que essa fonte nao encontrou o video agora.</p>
                    <small>Tente trocar o servidor ou abrir outro titulo.</small>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Episodes Sidebar */}
          {type !== 'movie' && (
            <div className={`episodes-sidebar ${showEpisodeList ? 'open' : ''}`}>
              <div className="episodes-header">
                <h4>Episódios</h4>
                <button
                  className="close-episodes"
                  onClick={() => setShowEpisodeList(false)}
                >
                  ✕
                </button>
              </div>

              {/* Season Selector */}
              <div className="season-selector">
                <label>Temporada:</label>
                <select
                  value={currentSeason}
                  onChange={(e) => {
                    setCurrentSeason(Number(e.target.value));
                    setCurrentEpisode(1);
                  }}
                >
                  {seasons.map((season) => (
                    <option key={season} value={season}>
                      Temporada {season}
                    </option>
                  ))}
                </select>
              </div>

              {/* Episode List */}
              <div className="episodes-list">
                {currentSeasonEpisodes.map((ep) => (
                  <button
                    key={`${ep.season}-${ep.episode}`}
                    className={`episode-item ${
                      ep.episode === currentEpisode ? 'active' : ''
                    }`}
                    onClick={() => goToEpisode(ep.season, ep.episode)}
                  >
                    <div className="episode-thumb-wrap">
                      {getEpisodeThumb(ep) ? (
                        <img
                          className="episode-thumb"
                          src={getEpisodeThumb(ep)}
                          alt={`Capa do episódio ${ep.episode}`}
                          loading="lazy"
                        />
                      ) : (
                        <div className="episode-thumb fallback">Sem imagem</div>
                      )}
                    </div>

                    <div className="episode-meta">
                      <div className="episode-number">{ep.episode}º Episódio</div>
                      <div className="episode-item-title">{ep.title}</div>
                      {ep.air_date && (
                        <div className="episode-date">
                          {new Date(ep.air_date).toLocaleDateString('pt-BR')}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
