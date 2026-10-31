import { useEffect, useMemo, useRef, useState } from 'react';
import type { Episode, PlayerContent } from '../types';
import { loadMovieRuntimeSeconds } from '../services/api';
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
    positionSec?: number;
    durationSec?: number;
  }) => void;
};

function readTimeFromMessage(raw: unknown): { position: number; duration?: number } | null {
  let data: unknown = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const inner = (obj.data && typeof obj.data === 'object' ? obj.data : obj) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  const progress = (inner.progress && typeof inner.progress === 'object' ? inner.progress : {}) as Record<string, unknown>;
  const position =
    num(inner.currentTime) ?? num(inner.current_time) ?? num(inner.time) ?? num(inner.position) ??
    num(inner.timestamp) ?? num(progress.watched);
  if (position === undefined) return null;
  return { position, duration: num(inner.duration) ?? num(inner.totalTime) ?? num(progress.duration) };
}

const MYEMBED_BUILDERS = {
  movie: (id: number) => `https://myembed.biz/filme/${id}`,
  tv: (id: number, season: number, episode: number) => `https://myembed.biz/serie/${id}/${season}/${episode}`,
  anime: (id: number, season: number, episode: number) => `https://myembed.biz/serie/${id}/${season}/${episode}`,
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
  const [currentSeason, setCurrentSeason] = useState(1);
  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [showEpisodeList, setShowEpisodeList] = useState(false);
  const [showNoSourceHint, setShowNoSourceHint] = useState(false);
  const [resumePromptOpen, setResumePromptOpen] = useState(false);
  const [resumeCandidate, setResumeCandidate] = useState<SavedProgress | null>(null);
  const [resumeChecked, setResumeChecked] = useState(false);
  const [playerFullscreen, setPlayerFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timeRef = useRef<{ position: number; duration?: number; real: boolean }>({ position: 0, real: false });
  const progressBase = useRef<{ season?: number; episode?: number; completed: boolean }>({ completed: false });
  const [movieRuntime, setMovieRuntime] = useState<number | null>(null);

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

  const playerUrl = MYEMBED_BUILDERS[type](
    contentId,
    currentSeason,
    currentEpisode,
  );
  const isWatchplay = true;

  useEffect(() => {
    setMovieRuntime(null);
    if (type !== 'movie') return;
    let active = true;
    loadMovieRuntimeSeconds(contentId).then((sec) => { if (active) setMovieRuntime(sec); });
    return () => { active = false; };
  }, [type, contentId]);

  // O tempo real vem do player via postMessage; se ele nao enviar, conta o tempo com o video aberto
  useEffect(() => {
    timeRef.current = { position: 0, real: false };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const parsed = readTimeFromMessage(event.data);
      if (!parsed) return;
      timeRef.current = { position: parsed.position, duration: parsed.duration ?? timeRef.current.duration, real: true };
    };

    const tick = window.setInterval(() => {
      if (timeRef.current.real || document.hidden) return;
      timeRef.current.position += 1;
    }, 1000);

    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      window.clearInterval(tick);
    };
  }, [playerUrl]);

  const flushProgress = () => {
    if (!onProgressChange) return;
    const real = timeRef.current.real;
    const pos = timeRef.current.position;
    const dur = timeRef.current.duration ?? (type === 'movie' ? movieRuntime ?? undefined : undefined);
    const watchedMost = real && dur ? pos >= dur * 0.9 : false;
    const base = progressBase.current;
    onProgressChange({
      type,
      contentId,
      season: base.season,
      episode: base.episode,
      completed: type === 'movie' ? watchedMost : base.completed && (dur && real ? watchedMost : true),
      updatedAt: new Date().toISOString(),
      item: content,
      positionSec: real && pos > 5 ? Math.round(pos) : undefined,
      durationSec: dur ? Math.round(dur) : undefined,
    });
  };
  const flushRef = useRef(flushProgress);
  flushRef.current = flushProgress;

  useEffect(() => {
    const id = window.setInterval(() => flushRef.current(), 5000);
    return () => {
      window.clearInterval(id);
      flushRef.current();
    };
  }, [playerUrl]);

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
    const updateFullscreenState = () => {
      setPlayerFullscreen(document.fullscreenElement === videoContainerRef.current);
    };

    document.addEventListener('fullscreenchange', updateFullscreenState);
    return () => document.removeEventListener('fullscreenchange', updateFullscreenState);
  }, []);

  const toggleWatchplayFullscreen = async () => {
    const videoContainer = videoContainerRef.current;
    if (!videoContainer) return;

    setFullscreenError('');

    try {
      if (document.fullscreenElement === videoContainer) {
        await document.exitFullscreen();
      } else if (videoContainer.requestFullscreen) {
        await videoContainer.requestFullscreen();
      } else {
        setFullscreenError('Este navegador nao permite ativar tela cheia por este botao.');
      }
    } catch (error) {
      console.error('Falha ao alternar tela cheia do Watchplay:', error);
      setFullscreenError('Nao foi possivel ativar tela cheia. Tente novamente.');
    }
  };

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
        completed: false,
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
    progressBase.current = { season: currentSeason, episode: currentEpisode, completed };

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
            <div className="video-container" ref={videoContainerRef}>
              <iframe
                ref={iframeRef}
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
              {isWatchplay && (
                <button
                  type="button"
                  className="watchplay-fullscreen-btn"
                  onClick={toggleWatchplayFullscreen}
                  aria-label={playerFullscreen ? 'Sair da tela cheia' : 'Ativar tela cheia'}
                >
                  {playerFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                </button>
              )}
            </div>
            {isWatchplay && fullscreenError && (
              <p className="watchplay-fullscreen-error" role="alert">
                {fullscreenError}
              </p>
            )}

            {/* Player Info */}
            <div className="player-info">
              <div className="episode-header">
                <div>
                  <div className="player-title-row">
                    <h3 className="player-title">{title}</h3>
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
