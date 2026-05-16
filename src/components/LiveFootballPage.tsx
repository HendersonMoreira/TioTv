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
  { name: 'Sportv', url: 'https://w2.embedtv.lat/sportv' },
  { name: 'Premiere', url: 'https://w2.embedtv.lat/premiere' },
  { name: 'Gloob', url: 'https://w2.embedtv.lat/gloob' },
  { name: 'SBT RJ', url: 'https://w2.embedtv.lat/sbtrj' },
  { name: 'Globo RJ', url: 'https://w2.embedtv.lat/globorj' },
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

        <div className="live-channel-open-card">
          <p className="live-channel-open-info">
            Clique no botao abaixo para assistir o canal <strong>{currentChannel.name}</strong> em uma nova aba.
          </p>
          <a
            href={currentChannel.url}
            target="_blank"
            rel="noopener noreferrer"
            className="live-channel-open-btn"
          >
            Assistir {currentChannel.name} ▶
          </a>
        </div>
      </div>
    </div>
  );
}
