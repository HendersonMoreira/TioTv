import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isComingSoon, getBackdropUrlBySize, getTitle, getYear, loadTrailerKey } from '../services/api';
import type { MediaItem, MovieGenre } from '../types';

type MediaKind = 'movie' | 'tv' | 'anime';

interface HoverPreviewHostProps {
  items: MediaItem[];
  genres: MovieGenre[];
  favorites: number[];
  onToggleFavorite: (id: number) => void;
  onPlay: (item: MediaItem, type: MediaKind) => void;
  isLocked?: (item: MediaItem, type: MediaKind) => boolean;
}

type PreviewState = { item: MediaItem; type: MediaKind; rect: DOMRect };

const SHOW_DELAY = 550;
const HIDE_DELAY = 180;
const POPUP_WIDTH = 400;

export function HoverPreviewHost({ items, genres, favorites, onToggleFavorite, onPlay, isLocked }: HoverPreviewHostProps) {
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const currentEl = useRef<Element | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const previewId = preview?.item.id;
  const previewType = preview?.type;
  useEffect(() => {
    setTrailerKey(null);
    setMuted(true);
    if (previewId === undefined || !previewType) return;
    let active = true;
    loadTrailerKey(previewId, previewType).then((k) => { if (active) setTrailerKey(k); });
    return () => { active = false; };
  }, [previewId, previewType]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: next ? 'mute' : 'unMute', args: [] }), '*');
    if (!next) iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [80] }), '*');
  };
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (min-width: 900px)').matches) return;

    const clearTimers = () => {
      if (showTimer.current) window.clearTimeout(showTimer.current);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      showTimer.current = null;
      hideTimer.current = null;
    };

    const scheduleHide = () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => {
        currentEl.current = null;
        setPreview(null);
      }, HIDE_DELAY);
    };

    const onOver = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) return;

      if (popupRef.current?.contains(target)) {
        if (hideTimer.current) window.clearTimeout(hideTimer.current);
        hideTimer.current = null;
        return;
      }

      const card = target.closest('[data-preview-id]');
      if (!card) {
        if (currentEl.current || showTimer.current) {
          if (showTimer.current) window.clearTimeout(showTimer.current);
          showTimer.current = null;
          scheduleHide();
        }
        return;
      }

      if (card === currentEl.current) {
        if (hideTimer.current) window.clearTimeout(hideTimer.current);
        hideTimer.current = null;
        return;
      }

      clearTimers();
      currentEl.current = card;
      showTimer.current = window.setTimeout(() => {
        const id = Number(card.getAttribute('data-preview-id'));
        const type = (card.getAttribute('data-preview-type') || 'movie') as MediaKind;
        const item = itemsRef.current.find((entry) => entry.id === id);
        if (!item) return;
        setPreview({ item, type, rect: card.getBoundingClientRect() });
      }, SHOW_DELAY);
    };

    const onScroll = () => {
      clearTimers();
      currentEl.current = null;
      setPreview(null);
    };

    document.addEventListener('mouseover', onOver);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('mouseover', onOver);
      window.removeEventListener('scroll', onScroll);
      clearTimers();
    };
  }, []);

  if (!preview) return null;

  const { item, type, rect } = preview;
  const left = Math.min(Math.max(12, rect.left + rect.width / 2 - POPUP_WIDTH / 2), window.innerWidth - POPUP_WIDTH - 24);
  const top = Math.max(76, Math.min(rect.top - 20, window.innerHeight - 440));
  const genreText = (item.genre_ids || [])
    .map((genreId) => genres.find((genre) => genre.id === genreId)?.name)
    .filter(Boolean)
    .slice(0, 3)
    .join(' · ');
  const isFavorite = favorites.includes(item.id);
  const typeLabel = type === 'movie' ? 'Filme' : type === 'tv' ? 'Serie' : 'Anime';
  const close = () => {
    currentEl.current = null;
    setPreview(null);
  };

  return createPortal(
    <div
      ref={popupRef}
      className="hover-preview"
      style={{ left, top, width: POPUP_WIDTH }}
      onMouseLeave={() => {
        hideTimer.current = window.setTimeout(close, HIDE_DELAY);
      }}
    >
      <div className="hover-preview-img">
        <img src={getBackdropUrlBySize(item.backdrop_path || item.poster_path, 'w780')} alt={getTitle(item)} />
        {trailerKey && (
          <iframe
            ref={iframeRef}
            className="hover-preview-video"
            title={`Trailer ${getTitle(item)}`}
            src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&playsinline=1&loop=1&playlist=${trailerKey}&enablejsapi=1`}
            allow="autoplay; encrypted-media"
          />
        )}
        {trailerKey && (
          <button type="button" className="hp-sound" onClick={toggleMute} aria-label={muted ? 'Ativar som' : 'Desativar som'}>
            {muted ? '🔇 Sem som' : '🔊 Com som'}
          </button>
        )}
        {isComingSoon(item) && <span className="soon-ribbon">Em Breve no Brasil</span>}{isLocked?.(item, type) && <span className="hover-preview-tag">Premium</span>}
      </div>
      <div className="hover-preview-body">
        <h4>{getTitle(item)}</h4>
        <div className="hover-preview-actions">
          <button type="button" className="hp-play" onClick={() => { close(); onPlay(item, type); }}>▶ Assistir</button>
          <button type="button" className="hp-ghost" onClick={() => onToggleFavorite(item.id)}>
            {isFavorite ? 'Na lista ♥' : 'Favoritar ♡'}
          </button>
          <button type="button" className="hp-ghost" onClick={() => { close(); onPlay(item, type); }}>Detalhes ⓘ</button>
        </div>
        <div className="hover-preview-meta">
          <span>{getYear(item)}</span>
          <span>{typeLabel}</span>
        </div>
        {genreText && <p className="hover-preview-genres">{genreText}</p>}
      </div>
    </div>,
    document.body,
  );
}
