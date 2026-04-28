import { useState } from 'react';
import { ChevronLeft, ChevronRight, GearIcon } from './icons';
import '../styles/player.css';

type LiveFootballPageProps = {
  onBack: () => void;
  currentUserName?: string;
  onOpenSettings?: () => void;
  onLogout?: () => void;
};

type LiveChannel = {
  name: string;
  url: string;
};

const LIVE_CHANNELS: LiveChannel[] = [
  { name: 'Sportv', url: 'https://3embeddecanais.xyz/sportv/' },
  { name: 'Premiere 2', url: 'https://3embeddecanais.xyz/premiereclubes/' },
  { name: 'TNT', url: 'https://3embeddecanais.xyz/tnt/' },
  { name: 'BandSports', url: 'https://3embeddecanais.xyz/bandsports/' },
  { name: 'Cartoon Network', url: 'https://3embeddecanais.xyz/cartoonnetwork/' },
];

export function LiveFootballPage({
  onBack,
  currentUserName,
  onOpenSettings,
  onLogout,
}: LiveFootballPageProps) {
  const [currentChannelIndex, setCurrentChannelIndex] = useState(0);
  const currentChannel = LIVE_CHANNELS[currentChannelIndex];

  const goToPreviousChannel = () => {
    setCurrentChannelIndex((prev) => (prev - 1 + LIVE_CHANNELS.length) % LIVE_CHANNELS.length);
  };

  const goToNextChannel = () => {
    setCurrentChannelIndex((prev) => (prev + 1) % LIVE_CHANNELS.length);
  };

  return (
    <div className="player-page live-football-page">
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

      <div className="live-channel-wrapper">
        <div className="live-channel-header">
          <h2>Futebol Aberto</h2>
          <p>Canal ao vivo para voce assistir direto no player.</p>
          <div className="live-channel-nav" role="group" aria-label="Trocar canal ao vivo">
            <button type="button" className="live-channel-arrow-btn" onClick={goToPreviousChannel}>
              <ChevronLeft />
              Canal anterior
            </button>
            <span className="live-channel-current">{currentChannel.name}</span>
            <button type="button" className="live-channel-arrow-btn" onClick={goToNextChannel}>
              Proximo canal
              <ChevronRight />
            </button>
          </div>
        </div>

        <div className="video-container live-channel-video">
          <iframe
            key={currentChannel.url}
            src={currentChannel.url}
            allow="autoplay; fullscreen; encrypted-media"
            allowFullScreen
            sandbox="allow-same-origin allow-scripts allow-presentation"
            loading="lazy"
            title={`Canal ${currentChannel.name}`}
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </div>
    </div>
  );
}
