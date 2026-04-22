import { useState } from 'react';
import { CloseIcon } from './icons';
import { getAuthErrorMessage, registerWithEmail } from '../services/auth';

interface RegisterModalProps {
  open: boolean;
  onClose: () => void;
  onLogin: () => void;
  onSuccess?: () => void;
}

export function RegisterModal({ open, onClose, onLogin, onSuccess }: RegisterModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await registerWithEmail(name, email, password);
      setPassword('');
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="register-overlay" onClick={handleOverlayClick}>
      <div className="register-modal">
        <button type="button" className="register-close-btn" onClick={onClose} aria-label="Fechar">
          <CloseIcon />
        </button>

        <div className="register-header">
          <h2 className="register-brand">TioTV</h2>
          <p className="register-subtitle">Crie sua conta e aproveite o melhor do entretenimento</p>
        </div>

        <form className="register-form" onSubmit={handleSubmit}>
          <div className="register-field">
            <label htmlFor="reg-name">Nome</label>
            <input
              id="reg-name"
              type="text"
              placeholder="Seu nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>

          <div className="register-field">
            <label htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              type="email"
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="register-field">
            <label htmlFor="reg-password">Senha</label>
            <div className="register-password-wrap">
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Minimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="register-toggle-pw"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button type="submit" className="register-submit-btn" disabled={submitting}>
            {submitting ? 'Criando...' : 'Criar Conta'}
          </button>
          {error && <p className="register-error">{error}</p>}
        </form>

        <p className="register-footer">
          Ja tem uma conta?{' '}
          <button
            type="button"
            className="register-link"
            onClick={() => { onClose(); onLogin(); }}
          >
            Entrar
          </button>
        </p>
      </div>
    </div>
  );
}
