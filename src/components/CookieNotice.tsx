import { useState } from 'react';
import './CookieNotice.css';

const NOTICE_KEY = 'tiotv_cookie_notice_v1';

export function CookieNotice() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(NOTICE_KEY) !== 'seen';
    } catch (error) {
      console.error('Não foi possível verificar o aviso de cookies:', error);
      return true;
    }
  });
  const [error, setError] = useState<string | null>(null);

  const dismiss = () => {
    try {
      localStorage.setItem(NOTICE_KEY, 'seen');
      setVisible(false);
    } catch (err) {
      console.error('Não foi possível salvar a confirmação do aviso de cookies:', err);
      setError('Não foi possível salvar sua escolha neste navegador. O aviso poderá aparecer novamente.');
    }
  };

  if (!visible) return null;

  return (
    <aside className="cookie-notice" aria-label="Aviso sobre cookies">
      <div>
        <h2>Cookies e armazenamento</h2>
        <p>
          Usamos cookies e armazenamento do navegador para manter sua sessão e lembrar favoritos e histórico.
          Serviços externos, como o player e trailers, também podem usar cookies.
        </p>
        {error && <p className="cookie-notice-error" role="alert">{error}</p>}
      </div>
      <button type="button" onClick={dismiss}>Entendi</button>
    </aside>
  );
}
