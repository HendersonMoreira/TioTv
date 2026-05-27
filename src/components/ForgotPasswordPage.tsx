import { useEffect, useMemo, useState } from 'react';
import { CloseIcon } from './icons';
import {
  completePasswordReset,
  getAuthErrorMessage,
  requestPasswordReset,
  verifyPasswordResetLink,
} from '../services/auth';

type ForgotPasswordPageProps = {
  onBackToLogin: () => void;
};

const getResetCodeFromUrl = (): string | null => {
  const searchParams = new URLSearchParams(window.location.search);
  const fromSearch = searchParams.get('oobCode');
  if (fromSearch) return fromSearch;

  const hash = window.location.hash;
  const match = hash.match(/[?&]oobCode=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

const getContinueUrl = (): string => {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}?from=reset#/esqueci-senha`;
};

export function ForgotPasswordPage({ onBackToLogin }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetEmail, setTargetEmail] = useState<string | null>(null);
  const [oobCode, setOobCode] = useState<string | null>(() => getResetCodeFromUrl());

  const hasResetCode = Boolean(oobCode);

  useEffect(() => {
    if (!oobCode) {
      return;
    }

    let mounted = true;
    verifyPasswordResetLink(oobCode)
      .then((resolvedEmail) => {
        if (!mounted) return;
        setTargetEmail(resolvedEmail);
        setMessage('Codigo de recuperacao validado. Agora escolha sua nova senha.');
      })
      .catch((err) => {
        if (!mounted) return;
        setError(getAuthErrorMessage(err));
        setOobCode(null);
      });

    return () => {
      mounted = false;
    };
  }, [oobCode]);

  const helperText = useMemo(() => {
    if (hasResetCode) {
      return 'Digite a nova senha e confirme abaixo.';
    }

    return 'Informe seu email para receber o link de redefinicao.';
  }, [hasResetCode]);

  const handleRequestReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setRequesting(true);
    setError(null);
    setMessage(null);

    try {
      await requestPasswordReset(email.trim(), getContinueUrl());
      setMessage('Enviamos um link para o seu email. Abra o email e volte aqui para concluir a troca de senha.');
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setRequesting(false);
    }
  };

  const handleCompleteReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setResetting(true);
    setError(null);
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setError('As senhas nao coincidem.');
      setResetting(false);
      return;
    }

    if (newPassword.length < 6) {
      setError('A nova senha precisa ter no minimo 6 caracteres.');
      setResetting(false);
      return;
    }

    if (!oobCode) {
      setError('Codigo de redefinicao invalido ou expirado.');
      setResetting(false);
      return;
    }

    try {
      await completePasswordReset(oobCode, newPassword);
      setMessage('Senha alterada com sucesso. Agora voce pode entrar com a nova senha.');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        window.location.hash = '';
        onBackToLogin();
      }, 1400);
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="register-overlay">
      <div className="register-modal forgot-password-modal">
        <button type="button" className="register-close-btn" onClick={onBackToLogin} aria-label="Fechar">
          <CloseIcon />
        </button>

        <div className="register-header">
          <h2 className="register-brand">TioTV</h2>
          <p className="register-subtitle">Esqueci minha senha</p>
          <p className="register-helper">{helperText}</p>
        </div>

        {!hasResetCode ? (
          <form className="register-form" onSubmit={handleRequestReset}>
            <div className="register-field">
              <label htmlFor="reset-email">Email</label>
              <input
                id="reset-email"
                type="email"
                placeholder="seuemail@exemplo.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <button type="submit" className="register-submit-btn" disabled={requesting}>
              {requesting ? 'Enviando...' : 'Enviar link de redefinicao'}
            </button>

            {message && <p className="register-success">{message}</p>}
            {error && <p className="register-error">{error}</p>}
          </form>
        ) : (
          <form className="register-form" onSubmit={handleCompleteReset}>
            <div className="register-field">
              <label htmlFor="reset-target-email">Email</label>
              <input
                id="reset-target-email"
                type="email"
                value={targetEmail ?? email}
                disabled
                readOnly
              />
            </div>

            <div className="register-field">
              <label htmlFor="reset-new-password">Nova senha</label>
              <input
                id="reset-new-password"
                type="password"
                placeholder="Digite a nova senha"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <div className="register-field">
              <label htmlFor="reset-confirm-password">Confirmar nova senha</label>
              <input
                id="reset-confirm-password"
                type="password"
                placeholder="Confirme a nova senha"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <button type="submit" className="register-submit-btn" disabled={resetting}>
              {resetting ? 'Alterando...' : 'Salvar nova senha'}
            </button>

            {message && <p className="register-success">{message}</p>}
            {error && <p className="register-error">{error}</p>}
          </form>
        )}

        <p className="register-footer">
          <button type="button" className="register-link" onClick={onBackToLogin}>
            Voltar para o login
          </button>
        </p>
      </div>
    </div>
  );
}
