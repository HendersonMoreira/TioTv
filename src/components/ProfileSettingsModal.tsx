import { useState } from 'react';
import { CloseIcon, CheckIcon } from './icons';
import {
  getAuthErrorMessage,
  updateUserEmail,
  updateUserName,
  updateUserPassword,
  type AuthUser,
} from '../services/auth';

type Section = 'preferencias' | 'alterar-nome' | 'alterar-email' | 'alterar-senha';

interface Props {
  open: boolean;
  user: AuthUser;
  onClose: () => void;
  onUserUpdated: () => void;
}

type FieldState = { submitting: boolean; error: string | null; success: boolean };
const IDLE: FieldState = { submitting: false, error: null, success: false };

export function ProfileSettingsModal({ open, user, onClose, onUserUpdated }: Props) {
  const [section, setSection] = useState<Section>('preferencias');

  // Alterar Nome
  const [nome, setNome] = useState(user.displayName ?? '');
  const [nomeState, setNomeState] = useState<FieldState>(IDLE);

  // Alterar Email
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailState, setEmailState] = useState<FieldState>(IDLE);

  // Alterar Senha
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [senhaState, setSenhaState] = useState<FieldState>(IDLE);

  if (!open) return null;

  const handleClose = () => {
    setSection('preferencias');
    setNomeState(IDLE);
    setEmailState(IDLE);
    setSenhaState(IDLE);
    setNewEmail('');
    setEmailPassword('');
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClose();
  };

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

  const sidebarItems: { id: Section; label: string }[] = [
    { id: 'preferencias', label: 'Preferências' },
    { id: 'alterar-nome', label: 'Alterar Nome' },
    { id: 'alterar-email', label: 'Alterar E-mail' },
    { id: 'alterar-senha', label: 'Alterar Senha' },
  ];

  return (
    <div className="ps-overlay" onClick={handleOverlayClick}>
      <div className="ps-modal">
        {/* Header */}
        <div className="ps-header">
          <div className="ps-header-user">
            <div className="ps-avatar">
              {(user.displayName ?? user.email ?? 'U')[0].toUpperCase()}
            </div>
            <div>
              <p className="ps-header-name">{user.displayName || 'Sem nome'}</p>
              <p className="ps-header-email">{user.email}</p>
            </div>
          </div>
          <button className="ps-close-btn" onClick={handleClose} aria-label="Fechar">
            <CloseIcon />
          </button>
        </div>

        <div className="ps-body">
          {/* Sidebar */}
          <nav className="ps-sidebar">
            <p className="ps-sidebar-group">Geral</p>
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`ps-sidebar-item${section === item.id ? ' active' : ''}`}
                onClick={() => setSection(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Conteudo */}
          <div className="ps-content">

            {/* Preferencias */}
            {section === 'preferencias' && (
              <div className="ps-section">
                <h2 className="ps-section-title">Preferências</h2>
                <div className="ps-info-row">
                  <span className="ps-info-label">Nome</span>
                  <span className="ps-info-value">{user.displayName || '—'}</span>
                  <button className="ps-change-btn" onClick={() => setSection('alterar-nome')}>Alterar</button>
                </div>
                <div className="ps-divider" />
                <div className="ps-info-row">
                  <span className="ps-info-label">E-mail</span>
                  <span className="ps-info-value">{user.email}</span>
                  <button className="ps-change-btn" onClick={() => setSection('alterar-email')}>Alterar</button>
                </div>
                <div className="ps-divider" />
                <div className="ps-info-row">
                  <span className="ps-info-label">Senha</span>
                  <span className="ps-info-value">••••••••</span>
                  <button className="ps-change-btn" onClick={() => setSection('alterar-senha')}>Alterar</button>
                </div>
              </div>
            )}

            {/* Alterar Nome */}
            {section === 'alterar-nome' && (
              <div className="ps-section">
                <h2 className="ps-section-title">Alterar Nome</h2>
                <form className="ps-form" onSubmit={handleNome}>
                  <div className="ps-field">
                    <label htmlFor="ps-nome">Novo nome</label>
                    <input
                      id="ps-nome"
                      type="text"
                      value={nome}
                      onChange={(e) => { setNome(e.target.value); setNomeState(IDLE); }}
                      required
                      autoComplete="name"
                    />
                  </div>
                  {nomeState.error && <p className="ps-error">{nomeState.error}</p>}
                  {nomeState.success && (
                    <p className="ps-success"><CheckIcon /> Nome atualizado com sucesso!</p>
                  )}
                  <button type="submit" className="ps-submit-btn" disabled={nomeState.submitting}>
                    {nomeState.submitting ? 'Salvando...' : 'Salvar Nome'}
                  </button>
                </form>
              </div>
            )}

            {/* Alterar Email */}
            {section === 'alterar-email' && (
              <div className="ps-section">
                <h2 className="ps-section-title">Alterar E-mail</h2>
                <p className="ps-section-desc">Para alterar o e-mail, confirme sua senha atual.</p>
                <form className="ps-form" onSubmit={handleEmail}>
                  <div className="ps-field">
                    <label htmlFor="ps-new-email">Novo e-mail</label>
                    <input
                      id="ps-new-email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => { setNewEmail(e.target.value); setEmailState(IDLE); }}
                      required
                      autoComplete="email"
                    />
                  </div>
                  <div className="ps-field">
                    <label htmlFor="ps-email-pw">Senha atual</label>
                    <input
                      id="ps-email-pw"
                      type="password"
                      value={emailPassword}
                      onChange={(e) => { setEmailPassword(e.target.value); setEmailState(IDLE); }}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  {emailState.error && <p className="ps-error">{emailState.error}</p>}
                  {emailState.success && (
                    <p className="ps-success"><CheckIcon /> E-mail atualizado com sucesso!</p>
                  )}
                  <button type="submit" className="ps-submit-btn" disabled={emailState.submitting}>
                    {emailState.submitting ? 'Salvando...' : 'Salvar E-mail'}
                  </button>
                </form>
              </div>
            )}

            {/* Alterar Senha */}
            {section === 'alterar-senha' && (
              <div className="ps-section">
                <h2 className="ps-section-title">Alterar Senha</h2>
                <p className="ps-section-desc">A nova senha precisa ter no mínimo 6 caracteres.</p>
                <form className="ps-form" onSubmit={handleSenha}>
                  <div className="ps-field">
                    <label htmlFor="ps-cur-pw">Senha atual</label>
                    <input
                      id="ps-cur-pw"
                      type="password"
                      value={currentPw}
                      onChange={(e) => { setCurrentPw(e.target.value); setSenhaState(IDLE); }}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="ps-field">
                    <label htmlFor="ps-new-pw">Nova senha</label>
                    <input
                      id="ps-new-pw"
                      type="password"
                      value={newPw}
                      onChange={(e) => { setNewPw(e.target.value); setSenhaState(IDLE); }}
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="ps-field">
                    <label htmlFor="ps-conf-pw">Confirmar nova senha</label>
                    <input
                      id="ps-conf-pw"
                      type="password"
                      value={confirmPw}
                      onChange={(e) => { setConfirmPw(e.target.value); setSenhaState(IDLE); }}
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                  </div>
                  {senhaState.error && <p className="ps-error">{senhaState.error}</p>}
                  {senhaState.success && (
                    <p className="ps-success"><CheckIcon /> Senha alterada com sucesso!</p>
                  )}
                  <button type="submit" className="ps-submit-btn" disabled={senhaState.submitting}>
                    {senhaState.submitting ? 'Salvando...' : 'Salvar Senha'}
                  </button>
                </form>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
