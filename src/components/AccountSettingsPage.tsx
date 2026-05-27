import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CheckIcon, GearIcon } from './icons';
import { createPagBankCheckout, createPagBankPixCheckout, verifyPagBankPayment } from '../services/payments';
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
const AUTO_VERIFY_MAX_ATTEMPTS = 10;
const AUTO_VERIFY_INTERVAL_MS = 6000;

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
  const [billingTaxId, setBillingTaxId] = useState('');
  const [upgradeSubmitting, setUpgradeSubmitting] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [upgradeSuccess, setUpgradeSuccess] = useState<string | null>(null);
  const [pixCode, setPixCode] = useState('');
  const [pixQrDataUrl, setPixQrDataUrl] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState('');
  const [pendingCheckoutId, setPendingCheckoutId] = useState('');
  const [pendingReferenceId, setPendingReferenceId] = useState('');
  const [manualOrderInput, setManualOrderInput] = useState('');
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [autoVerifyActive, setAutoVerifyActive] = useState(false);
  const [autoVerifyAttempt, setAutoVerifyAttempt] = useState(0);

  useEffect(() => {
    let mounted = true;

    if (!pixCode) {
      setPixQrDataUrl(null);
      return () => {
        mounted = false;
      };
    }

    QRCode.toDataURL(pixCode, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: 'M',
    })
      .then((dataUrl: string) => {
        if (mounted) {
          setPixQrDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (mounted) {
          setPixQrDataUrl(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, [pixCode]);

  const copyPixCode = async () => {
    if (!pixCode) return;

    try {
      await navigator.clipboard.writeText(pixCode);
      setUpgradeSuccess('Codigo PIX copiado. Pague no app do seu banco para ativar o Premium automaticamente.');
      setUpgradeError(null);
    } catch {
      setUpgradeError('Nao foi possivel copiar automaticamente. Copie manualmente o codigo PIX abaixo.');
    }
  };

  const verifyPayment = async (isAuto = false) => {
    const normalizedManualOrderId = (manualOrderInput.match(/ORDE_[A-Za-z0-9-]+/) || [])[0] || '';
    const effectiveOrderId = normalizedManualOrderId || pendingOrderId;

    if (!user.uid || (!effectiveOrderId && !pendingCheckoutId)) {
      if (!isAuto) {
        setUpgradeError('Nao foi possivel verificar: pagamento pendente nao encontrado.');
      }
      return false;
    }

    if (!isAuto) {
      setVerifySubmitting(true);
      setUpgradeError(null);
    }

    try {
      const result = await verifyPagBankPayment({
        uid: user.uid,
        orderId: effectiveOrderId || undefined,
        checkoutId: pendingCheckoutId || undefined,
        referenceId: pendingReferenceId || undefined,
      });

      if (result.paid) {
        setUpgradeSuccess('Pagamento confirmado pelo Mercado Pago. Premium ativado com sucesso.');
        setPendingOrderId('');
        setPendingCheckoutId('');
        setPendingReferenceId('');
        setManualOrderInput('');
        setPixCode('');
        setAutoVerifyActive(false);
        setAutoVerifyAttempt(0);
        onUserUpdated();
        return true;
      } else {
        if (!isAuto) {
          setUpgradeError(`Pagamento ainda nao confirmado. Status atual: ${result.status}. Se no portal estiver PAGO, cole o codigo ORDE_... e verifique novamente.`);
        }
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao verificar pagamento.';
      if (!isAuto) {
        if (/not found|resource not found/i.test(message)) {
          setUpgradeError('Nao encontrei esse pagamento no Mercado Pago. Use o codigo do pedido que comeca com ORDE_ (voce encontra na URL de detalhes da transacao no portal do Mercado Pago).');
        } else {
          setUpgradeError(message);
        }
      }
      return false;
    } finally {
      if (!isAuto) {
        setVerifySubmitting(false);
      }
    }
  };

  const handleVerifyPayment = async () => {
    await verifyPayment(false);
  };

  useEffect(() => {
    if (!autoVerifyActive || verifySubmitting || isPremium) {
      return;
    }

    if (!user.uid || (!pendingOrderId && !pendingCheckoutId)) {
      setAutoVerifyActive(false);
      return;
    }

    if (autoVerifyAttempt >= AUTO_VERIFY_MAX_ATTEMPTS) {
      setAutoVerifyActive(false);
      setUpgradeError('Pagamento ainda nao foi confirmado automaticamente. Clique em "Ja paguei, verificar agora" ou cole o ORDE_... se necessario.');
      return;
    }

    const timerId = setTimeout(() => {
      void verifyPayment(true).then((paid) => {
        if (!paid) {
          setAutoVerifyAttempt((prev) => prev + 1);
        }
      });
    }, AUTO_VERIFY_INTERVAL_MS);

    return () => {
      clearTimeout(timerId);
    };
  }, [
    autoVerifyActive,
    autoVerifyAttempt,
    isPremium,
    pendingCheckoutId,
    pendingOrderId,
    user.uid,
    verifySubmitting,
  ]);

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

  const handleUpgrade = async () => {
    if (!user.uid || !user.email) {
      setUpgradeError('Nao foi possivel iniciar pagamento sem usuario logado.');
      return;
    }

    const sanitizedTaxId = billingTaxId.replace(/\D/g, '');
    if (sanitizedTaxId.length !== 11 && sanitizedTaxId.length !== 14) {
      setUpgradeError('Informe um CPF (11 digitos) ou CNPJ (14 digitos) valido para pagamento.');
      return;
    }

    setUpgradeSubmitting(true);
    setUpgradeError(null);
    setUpgradeSuccess(null);
    setPixCode('');
    setPendingOrderId('');
    setPendingCheckoutId('');
    setPendingReferenceId('');
    setManualOrderInput('');
    setAutoVerifyActive(false);
    setAutoVerifyAttempt(0);

    try {
      const checkout = await createPagBankCheckout({
        uid: user.uid,
        email: user.email,
        name: user.displayName ?? undefined,
        taxId: sanitizedTaxId,
      });

      const paymentUrl = checkout.paymentUrl ?? null;
      const isApiProtectedUrl = Boolean(paymentUrl && /api\.pagseguro\.com/i.test(paymentUrl));

      if (checkout.pixCode) {
        setPixCode(checkout.pixCode);
        setPendingOrderId(checkout.orderId || '');
        setPendingCheckoutId('');
        setPendingReferenceId(checkout.referenceId || '');
        setAutoVerifyActive(true);
        setAutoVerifyAttempt(0);
        try {
          await navigator.clipboard.writeText(checkout.pixCode);
          setUpgradeSuccess('PIX gerado com sucesso. Codigo PIX copiado para a area de transferencia. Verificando pagamento automaticamente por alguns instantes.');
        } catch {
          setUpgradeSuccess(`PIX gerado com sucesso. Copie e pague no app do banco: ${checkout.pixCode}. Verificando pagamento automaticamente por alguns instantes.`);
        }
      } else if (paymentUrl && !isApiProtectedUrl) {
        setPixCode('');
        setPendingOrderId(checkout.orderId || '');
        setPendingCheckoutId('');
        setPendingReferenceId(checkout.referenceId || '');
        setAutoVerifyActive(true);
        setAutoVerifyAttempt(0);
        setUpgradeSuccess('Checkout criado. Abra o pagamento e conclua para ativar o Premium automaticamente.');
        window.open(paymentUrl, '_blank', 'noopener,noreferrer');
      } else {
        setPixCode('');
        setUpgradeError('Pagamento criado, mas o Mercado Pago nao retornou link publico. Tente novamente para gerar novo PIX.');
      }
    } catch (err) {
      setUpgradeError(err instanceof Error ? err.message : 'Falha ao iniciar pagamento.');
    } finally {
      setUpgradeSubmitting(false);
    }
  };

  const handlePixUpgrade = async () => {
    if (!user.uid || !user.email) {
      setUpgradeError('Nao foi possivel iniciar pagamento sem usuario logado.');
      return;
    }

    const sanitizedTaxId = billingTaxId.replace(/\D/g, '');
    if (sanitizedTaxId.length !== 11 && sanitizedTaxId.length !== 14) {
      setUpgradeError('Informe um CPF (11 digitos) ou CNPJ (14 digitos) valido para pagamento.');
      return;
    }

    setUpgradeSubmitting(true);
    setUpgradeError(null);
    setUpgradeSuccess(null);
    setPixCode('');
    setPendingOrderId('');
    setPendingCheckoutId('');
    setPendingReferenceId('');
    setManualOrderInput('');
    setAutoVerifyActive(false);
    setAutoVerifyAttempt(0);

    try {
      const checkout = await createPagBankPixCheckout({
        uid: user.uid,
        email: user.email,
        name: user.displayName ?? undefined,
        taxId: sanitizedTaxId,
      });

      setPixCode(checkout.pixCode);
      setPendingOrderId(checkout.paymentId || '');
      setPendingCheckoutId('');
      setPendingReferenceId(checkout.referenceId || '');
      setAutoVerifyActive(true);
      setAutoVerifyAttempt(0);

      if (checkout.pixQrCodeBase64) {
        setPixQrDataUrl(checkout.pixQrCodeBase64);
      }

      try {
        await navigator.clipboard.writeText(checkout.pixCode);
        setUpgradeSuccess('PIX gerado com sucesso. Codigo PIX copiado para a area de transferencia. Verificando pagamento automaticamente por alguns instantes.');
      } catch {
        setUpgradeSuccess(`PIX gerado com sucesso. Copie e pague no app do banco: ${checkout.pixCode}. Verificando pagamento automaticamente por alguns instantes.`);
      }
    } catch (err) {
      setUpgradeError(err instanceof Error ? err.message : 'Falha ao iniciar pagamento PIX.');
    } finally {
      setUpgradeSubmitting(false);
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
                    <div className="acc-field" style={{ marginTop: '10px', marginBottom: '10px' }}>
                      <label htmlFor="acc-tax-id">CPF/CNPJ para pagamento</label>
                      <input
                        id="acc-tax-id"
                        type="text"
                        value={billingTaxId}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 14);
                          setBillingTaxId(digits);
                          setUpgradeError(null);
                        }}
                        placeholder="Somente numeros"
                        autoComplete="off"
                        inputMode="numeric"
                      />
                    </div>
                    <div className="acc-payment-actions">
                      <button className="acc-upgrade-btn" type="button" onClick={handleUpgrade} disabled={upgradeSubmitting}>
                        {upgradeSubmitting ? 'Abrindo checkout...' : 'Pagar com Mercado Pago'}
                      </button>
                      <button className="acc-pix-btn" type="button" onClick={handlePixUpgrade} disabled={upgradeSubmitting}>
                        {upgradeSubmitting ? 'Gerando PIX...' : 'Pagar com PIX'}
                      </button>
                    </div>
                    {upgradeSuccess && <p className="acc-success"><CheckIcon /> {upgradeSuccess}</p>}
                    {autoVerifyActive && (
                      <p className="acc-success">
                        <CheckIcon /> Confirmacao automatica ativa ({Math.min(autoVerifyAttempt + 1, AUTO_VERIFY_MAX_ATTEMPTS)}/{AUTO_VERIFY_MAX_ATTEMPTS})...
                      </p>
                    )}
                    {upgradeError && <p className="acc-error">{upgradeError}</p>}
                    {(pendingOrderId || pendingCheckoutId) && (
                      <>
                        {pendingCheckoutId && !pendingOrderId && (
                          <div className="acc-field acc-verify-order-field">
                            <label htmlFor="acc-order-id">Se necessario, cole o codigo do pedido (ORDE_...)</label>
                            <input
                              id="acc-order-id"
                              type="text"
                              value={manualOrderInput}
                              onChange={(e) => {
                                setManualOrderInput(e.target.value);
                                setUpgradeError(null);
                              }}
                              placeholder="ORDE_XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                              autoComplete="off"
                            />
                          </div>
                        )}
                        <button
                          className="acc-verify-btn"
                          type="button"
                          onClick={handleVerifyPayment}
                          disabled={verifySubmitting}
                        >
                          {verifySubmitting ? 'Verificando pagamento...' : 'Ja paguei, verificar agora'}
                        </button>
                      </>
                    )}
                    {pixCode && (
                      <div className="acc-pix-box">
                        <p className="acc-pix-title">Escaneie o QR Code PIX</p>
                        {pixQrDataUrl ? (
                          <img className="acc-pix-qr" src={pixQrDataUrl} alt="QR Code PIX para pagamento" />
                        ) : (
                          <div className="acc-pix-qr-loading">Gerando QR Code...</div>
                        )}
                        <button className="acc-pix-copy-btn" type="button" onClick={copyPixCode}>
                          Copiar codigo PIX
                        </button>
                        <textarea
                          className="acc-pix-code"
                          value={pixCode}
                          readOnly
                          rows={3}
                          aria-label="Codigo PIX"
                        />
                      </div>
                    )}
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
