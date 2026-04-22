import { useState } from 'react';
import { CheckIcon, GearIcon } from './icons';
import {
  getAuthErrorMessage,
  updateUserEmail,
  updateUserName,
  updateUserPassword,
  type AuthUser,
} from '../services/auth';

type Section =
  | 'preferencias'
  | 'plano'
  | 'alterar-email'
  | 'alterar-senha';

type FieldState = { submitting: boolean; error: string | null; success: boolean };
const IDLE: FieldState = { submitting: false, error: null, success: false };

interface Props {
  user: AuthUser;
  isPremium: boolean;
  premiumExpiresAt?: Date | null;
  onBack: () => void;
  onUserUpdated: () => void;
  onLogout: () => void;
}

export function AccountSettingsPage({ user, isPremium, premiumExpiresAt, onBack, onUserUpdated, onLogout }: Props) {
  const [section, setSection] = useState<Section>('preferencias');

  // Nome
  const [nome, setNome] = useState(user.displayName ?? '');
  const [nomeState, setNomeState] = useState<FieldState>(IDLE);

  // Email
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailState, setEmailState] = useState<FieldState>(IDLE);

  // Senha
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [senhaState, setSenhaState] = useState<FieldState>(IDLE);

  const handleNome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setNomeState({ submitting: true, error: null, success: false });
    try {
      await updateUserName(nome);
      setNomeState({ submitting: false, error: null, success: true });
      onUserUpdated();
    } catch (err) {
      setNomeState({ submitting: false, error: getAuthErrorMessage(err), success: false });
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !emailPassword) return;
    setEmailState({ submitting: true, error: null, success: false });
    try {
      await updateUserEmail(emailPassword, newEmail.trim());
      setEmailState({ submitting: false, error: null, success: true });
      setNewEmail('');
      setEmailPassword('');
      onUserUpdated();
    } catch (err) {
      setEmailState({ submitting: false, error: getAuthErrorMessage(err), success: false });
    }
  };

  const handleSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      setSenhaState({ submitting: false, error: 'As senhas nao coincidem.', success: false });
      return;
    }
    if (newPw.length < 6) {
      setSenhaState({ submitting: false, error: 'A nova senha precisa ter no minimo 6 caracteres.', success: false });
      return;
    }
    setSenhaState({ submitting: true, error: null, success: false });
    try {
      await updateUserPassword(currentPw, newPw);
      setSenhaState({ submitting: false, error: null, success: true });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err) {
      setSenhaState({ submitting: false, error: getAuthErrorMessage(err), success: false });
    }
  };

  const sidebarGroups = [
    {
      label: 'Geral',
      items: [
        { id: 'preferencias' as Section, label: 'Preferências' },
        { id: 'plano' as Section, label: 'Plano de Assinatura' },
      ],
    },
    {
      label: 'Conta',
      items: [
        { id: 'alterar-email' as Section, label: 'Alterar E-mail' },
        { id: 'alterar-senha' as Section, label: 'Alterar Senha' },
      ],
    },
  ];

  return (
    <div className="acc-page">
      {/* Topo */}
      <header className="acc-topbar">
        <button className="acc-back-btn" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
          Voltar
        </button>
        <span className="acc-brand">TioTV</span>
        <div className="nav-actions">
          <span className="user-chip">
            Ola, {(user.displayName || user.email || 'Usuario').split(' ')[0]}
          </span>
          <button
            className="gear-btn circle-btn"
            aria-label="Pagina de configuracoes"
            disabled
          >
            <GearIcon />
          </button>
          <button className="account-btn" onClick={onLogout}>Sair</button>
        </div>
      </header>

      <div className="acc-shell">
        {/* Sidebar */}
        <aside className="acc-sidebar">
          <h1 className="acc-page-title">Configurações da Conta</h1>

          {sidebarGroups.map((group) => (
            <div key={group.label} className="acc-nav-group">
              <p className="acc-nav-group-label">{group.label}</p>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`acc-nav-item${section === item.id ? ' active' : ''}`}
                  onClick={() => setSection(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </aside>

        {/* Conteudo principal */}
        <main className="acc-main">

          {/* ── Preferências ── */}
          {section === 'preferencias' && (
            <div className="acc-section">
              <h2 className="acc-section-title">Preferências</h2>
              <p className="acc-section-desc">Atualize seu nome de exibição.</p>

              <div className="acc-card">
                <div className="acc-card-info">
                  <div className="acc-avatar">
                    {(user.displayName ?? user.email ?? 'U')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="acc-user-name">{user.displayName || 'Sem nome'}</p>
                    <p className="acc-user-email">{user.email}</p>
                  </div>
                </div>

                <div className="acc-divider" />

                <form className="acc-form" onSubmit={handleNome}>
                  <div className="acc-field">
                    <label htmlFor="acc-nome">Nome de exibição</label>
                    <input
                      id="acc-nome"
                      type="text"
                      value={nome}
                      onChange={(e) => { setNome(e.target.value); setNomeState(IDLE); }}
                      required
                      autoComplete="name"
                      placeholder="Como você quer ser chamado"
                    />
                  </div>
                  {nomeState.error && <p className="acc-error">{nomeState.error}</p>}
                  {nomeState.success && (
                    <p className="acc-success"><CheckIcon /> Nome atualizado com sucesso!</p>
                  )}
                  <button type="submit" className="acc-submit-btn" disabled={nomeState.submitting}>
                    {nomeState.submitting ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ── Plano ── */}
          {section === 'plano' && (
            <div className="acc-section">
              <h2 className="acc-section-title">Plano de Assinatura</h2>
              <p className="acc-section-desc">Informações sobre seu plano atual.</p>

              <div className="acc-card acc-plan-card">
                {isPremium ? (
                  (()=> {
                    const daysLeft = premiumExpiresAt
                      ? Math.max(0, Math.ceil((premiumExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                      : null;
                    return (
                      <>
                        <p className="acc-plan-kicker">Premium</p>
                        <div className="acc-plan-badge premium">
                          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                            <path d="M12 1l3.09 6.26L22 8.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
                          </svg>
                          Conta Premium Ativa
                        </div>
                        <h3 className="acc-plan-title">Parabens! Sua conta Premium esta ativa.</h3>
                        <p className="acc-plan-desc">Aproveite: acesso liberado para filmes, series e animes do catalogo.</p>
                        {daysLeft !== null && (
                          <div className={`acc-plan-expiry ${daysLeft <= 5 ? 'urgent' : ''}`}>
                            {daysLeft === 0
                              ? 'Seu plano expira hoje!'
                              : daysLeft === 1
                                ? 'Falta 1 dia para expirar'
                                : `Faltam ${daysLeft} dias para expirar`}
                          </div>
                        )}
                      </>
                    );
                  })()
                ) : (
                  <>
                    <div className="acc-plan-badge free">Gratuito</div>
                    <p className="acc-plan-desc">
                      Você está no plano gratuito. Faça upgrade para acessar conteúdo exclusivo sem anúncios.
                    </p>
                    <button className="acc-upgrade-btn" type="button" disabled>
                      Em breve — Fazer Upgrade
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Alterar Email ── */}
          {section === 'alterar-email' && (
            <div className="acc-section">
              <h2 className="acc-section-title">Alterar E-mail</h2>
              <p className="acc-section-desc">
                Informe seu novo e-mail e confirme com sua senha atual.
              </p>

              <div className="acc-card">
                <p className="acc-current-label">E-mail atual</p>
                <p className="acc-current-value">{user.email}</p>
                <div className="acc-divider" />
                <form className="acc-form" onSubmit={handleEmail}>
                  <div className="acc-field">
                    <label htmlFor="acc-new-email">Novo e-mail</label>
                    <input
                      id="acc-new-email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => { setNewEmail(e.target.value); setEmailState(IDLE); }}
                      required
                      autoComplete="email"
                      placeholder="novoemail@exemplo.com"
                    />
                  </div>
                  <div className="acc-field">
                    <label htmlFor="acc-email-pw">Senha atual (confirmação)</label>
                    <input
                      id="acc-email-pw"
                      type="password"
                      value={emailPassword}
                      onChange={(e) => { setEmailPassword(e.target.value); setEmailState(IDLE); }}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                    />
                  </div>
                  {emailState.error && <p className="acc-error">{emailState.error}</p>}
                  {emailState.success && (
                    <p className="acc-success"><CheckIcon /> E-mail atualizado com sucesso!</p>
                  )}
                  <button type="submit" className="acc-submit-btn" disabled={emailState.submitting}>
                    {emailState.submitting ? 'Salvando...' : 'Salvar E-mail'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ── Alterar Senha ── */}
          {section === 'alterar-senha' && (
            <div className="acc-section">
              <h2 className="acc-section-title">Alterar Senha</h2>
              <p className="acc-section-desc">
                A nova senha precisa ter no mínimo 6 caracteres.
              </p>

              <div className="acc-card">
                <form className="acc-form" onSubmit={handleSenha}>
                  <div className="acc-field">
                    <label htmlFor="acc-cur-pw">Senha atual</label>
                    <input
                      id="acc-cur-pw"
                      type="password"
                      value={currentPw}
                      onChange={(e) => { setCurrentPw(e.target.value); setSenhaState(IDLE); }}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="acc-field">
                    <label htmlFor="acc-new-pw">Nova senha</label>
                    <input
                      id="acc-new-pw"
                      type="password"
                      value={newPw}
                      onChange={(e) => { setNewPw(e.target.value); setSenhaState(IDLE); }}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="acc-field">
                    <label htmlFor="acc-conf-pw">Confirmar nova senha</label>
                    <input
                      id="acc-conf-pw"
                      type="password"
                      value={confirmPw}
                      onChange={(e) => { setConfirmPw(e.target.value); setSenhaState(IDLE); }}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="••••••••"
                    />
                  </div>
                  {senhaState.error && <p className="acc-error">{senhaState.error}</p>}
                  {senhaState.success && (
                    <p className="acc-success"><CheckIcon /> Senha alterada com sucesso!</p>
                  )}
                  <button type="submit" className="acc-submit-btn" disabled={senhaState.submitting}>
                    {senhaState.submitting ? 'Salvando...' : 'Salvar Senha'}
                  </button>
                </form>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
