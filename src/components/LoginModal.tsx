import { useState } from 'react';
import { CloseIcon } from './icons';
import { getAuthErrorMessage, loginWithEmail } from '../services/auth';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onRegister: () => void;
  onForgotPassword: () => void;
  onSuccess?: () => void;
}

export function LoginModal({ open, onClose, onRegister, onForgotPassword, onSuccess }: LoginModalProps) {
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
      await loginWithEmail(email, password);
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
          <p className="register-subtitle">Bem-vindo de volta! Entre na sua conta</p>
        </div>

        <form className="register-form" onSubmit={handleSubmit}>
          <div className="register-field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="register-field">
            <label htmlFor="login-password">Senha</label>
            <div className="register-password-wrap">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
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
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
          {error && <p className="register-error">{error}</p>}

          <button type="button" className="register-link login-forgot-link" onClick={onForgotPassword}>
            Esqueci minha senha
          </button>
        </form>

        <p className="register-footer">
          Nao tem uma conta?{' '}
          <button
            type="button"
            className="register-link"
            onClick={() => { onClose(); onRegister(); }}
          >
            Criar Conta
          </button>
        </p>
      </div>
    </div>
  );
}
