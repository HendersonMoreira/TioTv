import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  confirmPasswordReset,
  sendPasswordResetEmail,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  verifyPasswordResetCode,
  signOut,
  updateEmail,
  updatePassword,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

const SESSION_COOKIE_NAME = 'tiotv_auth_session';
const SESSION_TTL_SECONDS = 24 * 60 * 60;
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;
const AUTH_FLOW_GRACE_MS = 15 * 1000;
const DEVICE_SESSION_KEY = 'tiotv_device_session_id';
const MAX_ACTIVE_SESSIONS = 2;

let authFlowStartedAt = 0;

const markAuthFlowStart = (): void => {
  authFlowStartedAt = Date.now();
};

const markAuthFlowEnd = (): void => {
  authFlowStartedAt = 0;
};

const isAuthFlowInGraceWindow = (): boolean => {
  return authFlowStartedAt > 0 && Date.now() - authFlowStartedAt <= AUTH_FLOW_GRACE_MS;
};

const readCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';').map((part) => part.trim());
  const target = cookies.find((part) => part.startsWith(`${name}=`));
  if (!target) return null;
  return target.slice(name.length + 1);
};

const writeSessionCookie = (timestamp: number): void => {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_COOKIE_NAME}=${timestamp}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; SameSite=Lax`;
};

const clearSessionCookie = (): void => {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
};

const hasValidSessionCookie = (): boolean => {
  const raw = readCookie(SESSION_COOKIE_NAME);
  if (!raw) return false;

  const timestamp = Number.parseInt(raw, 10);
  if (!Number.isFinite(timestamp)) {
    clearSessionCookie();
    return false;
  }

  if (Date.now() - timestamp > SESSION_TTL_MS) {
    clearSessionCookie();
    return false;
  }

  return true;
};

export const touchAuthSession = (): void => {
  writeSessionCookie(Date.now());
};

export const startAuthSessionTracking = (): (() => void) => {
  if (typeof window === 'undefined') return () => {};

  let lastTouch = 0;
  const touchWithThrottle = () => {
    const now = Date.now();
    if (now - lastTouch < 60 * 1000) return;
    lastTouch = now;
    touchAuthSession();

    if (auth.currentUser?.uid) {
      syncSessionHeartbeat(auth.currentUser.uid).catch((err) => {
        console.error('Falha ao sincronizar heartbeat da sessao', err);
      });
    }
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      touchWithThrottle();
    }
  };

  const events: Array<keyof WindowEventMap> = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
  events.forEach((eventName) => {
    window.addEventListener(eventName, touchWithThrottle);
  });
  document.addEventListener('visibilitychange', onVisibilityChange);

  touchAuthSession();

  return () => {
    events.forEach((eventName) => {
      window.removeEventListener(eventName, touchWithThrottle);
    });
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
};

export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

const toAuthUser = (user: User | null): AuthUser | null => {
  if (!user) return null;

  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
  };
};

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'Este email ja esta em uso.',
  'auth/invalid-email': 'Email invalido.',
  'auth/invalid-credential': 'Email ou senha invalidos.',
  'auth/invalid-login-credentials': 'Email ou senha invalidos.',
  'auth/user-not-found': 'Usuario nao encontrado.',
  'auth/wrong-password': 'Senha incorreta.',
  'auth/requires-recent-login': 'Para alterar o e-mail, saia e entre novamente na conta e tente de novo.',
  'auth/credential-already-in-use': 'Este e-mail ja esta vinculado a outra conta.',
  'auth/email-change-needs-verification': 'Seu provedor exige verificacao para trocar o e-mail.',
  'auth/operation-not-allowed': 'Alteracao de e-mail nao permitida no Firebase. Verifique se o login por email e senha esta habilitado.',
  'auth/api-key-not-valid': 'Configuracao do Firebase invalida. Verifique a chave publica do frontend.',
  'auth/network-request-failed': 'Falha de rede ao falar com o Firebase. Verifique sua conexao.',
  'auth/weak-password': 'A senha precisa ter no minimo 6 caracteres.',
  'auth/too-many-requests': 'Muitas tentativas. Tente novamente em alguns minutos.',
  'auth/session-limit-exceeded': 'Muitas pessoas estao usando esta conta. Desconecte de outros dispositivos para continuar.',
  'permission-denied': 'Sem permissao para gravar no banco. Verifique as regras do Firestore.',
};

const isFirestorePermissionDenied = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }

  const code = String((error as { code: string }).code || '').toLowerCase();
  return code === 'permission-denied' || code === 'firestore/permission-denied';
};

const getOrCreateDeviceSessionId = (): string => {
  if (typeof window === 'undefined') {
    return 'server-session';
  }

  const saved = window.localStorage.getItem(DEVICE_SESSION_KEY);
  if (saved) {
    return saved;
  }

  const generated =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.localStorage.setItem(DEVICE_SESSION_KEY, generated);
  return generated;
};

const sanitizeActiveSessions = (raw: unknown): Record<string, number> => {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const normalized: Record<string, number> = {};
  for (const [sessionId, ts] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof ts === 'number' && Number.isFinite(ts)) {
      normalized[sessionId] = ts;
    }
  }

  return normalized;
};

const pruneExpiredSessions = (sessions: Record<string, number>, nowMs: number): Record<string, number> => {
  const cleaned: Record<string, number> = {};
  for (const [sessionId, timestampMs] of Object.entries(sessions)) {
    if (nowMs - timestampMs <= SESSION_TTL_MS) {
      cleaned[sessionId] = timestampMs;
    }
  }
  return cleaned;
};

const syncSessionHeartbeat = async (userId: string | null | undefined): Promise<void> => {
  if (!userId) {
    return;
  }

  const sessionId = getOrCreateDeviceSessionId();
  const userRef = doc(db, 'Users', userId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    const data = snap.data() as { activeSessions?: unknown } | undefined;
    const nowMs = Date.now();
    const activeSessions = pruneExpiredSessions(sanitizeActiveSessions(data?.activeSessions), nowMs);

    activeSessions[sessionId] = nowMs;
    tx.set(
      userRef,
      {
        activeSessions,
      },
      { merge: true }
    );
  });
};

const reserveSessionSlot = async (user: User): Promise<void> => {
  const userRef = doc(db, 'Users', user.uid);
  const sessionId = getOrCreateDeviceSessionId();

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    const data = snap.data() as { activeSessions?: unknown } | undefined;

    const nowMs = Date.now();
    const activeSessions = pruneExpiredSessions(sanitizeActiveSessions(data?.activeSessions), nowMs);
    const alreadyActive = Object.prototype.hasOwnProperty.call(activeSessions, sessionId);

    if (!alreadyActive && Object.keys(activeSessions).length >= MAX_ACTIVE_SESSIONS) {
      throw Object.assign(new Error('Session limit exceeded'), {
        code: 'auth/session-limit-exceeded',
      });
    }

    activeSessions[sessionId] = nowMs;
    tx.set(
      userRef,
      {
        activeSessions,
      },
      { merge: true }
    );
  });
};

const releaseSessionSlot = async (userId: string | null | undefined): Promise<void> => {
  if (!userId) {
    return;
  }

  const sessionId = getOrCreateDeviceSessionId();
  const userRef = doc(db, 'Users', userId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) {
      return;
    }

    const data = snap.data() as { activeSessions?: unknown } | undefined;
    const activeSessions = sanitizeActiveSessions(data?.activeSessions);

    if (!Object.prototype.hasOwnProperty.call(activeSessions, sessionId)) {
      return;
    }

    delete activeSessions[sessionId];
    tx.set(
      userRef,
      {
        activeSessions,
      },
      { merge: true }
    );
  });
};

const upsertUserProfile = async (user: User, preferredName?: string): Promise<void> => {
  const normalizedName = preferredName?.trim() || user.displayName || '';
  const userRef = doc(db, 'Users', user.uid);
  const userSnap = await getDoc(userRef);

  const payload: Record<string, unknown> = {
    uid: user.uid,
    nome: normalizedName,
    email: user.email ?? '',
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  };

  // Define defaults apenas na criacao do documento; nao sobrescreve plano existente.
  if (!userSnap.exists()) {
    payload.isPremium = false;
    payload.createdAt = serverTimestamp();
  }

  await setDoc(
    userRef,
    payload,
    { merge: true }
  );
};

export const getAuthErrorMessage = (error: unknown): string => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String((error as { code: string }).code);
    const mapped = AUTH_ERROR_MESSAGES[code];
    if (mapped) {
      return mapped;
    }

    const fallbackMessage =
      typeof (error as { message?: string }).message === 'string'
        ? (error as { message?: string }).message
        : null;

    return fallbackMessage ? `${fallbackMessage} (${code})` : `Nao foi possivel autenticar agora. (${code})`;
  }

  return 'Nao foi possivel autenticar agora.';
};

export const registerWithEmail = async (name: string, email: string, password: string): Promise<AuthUser> => {
  markAuthFlowStart();
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const trimmedName = name.trim();

  // Cria a sessao antes de qualquer operacao extra para evitar corrida no onAuthStateChanged.
  touchAuthSession();

  if (trimmedName.length > 0) {
    await updateProfile(credential.user, { displayName: trimmedName });
  }

  try {
    await reserveSessionSlot(credential.user);
  } catch (err) {
    if (!isFirestorePermissionDenied(err)) {
      throw err;
    }
    console.warn('Firestore bloqueou reserveSessionSlot no cadastro; seguindo com login local.', err);
  }

  // Nao bloqueia o login/cadastro caso o Firestore demore ou falhe.
  upsertUserProfile(credential.user, trimmedName).catch((err) => {
    console.error('Falha ao salvar perfil no Firestore apos cadastro', err);
  });

  const result = toAuthUser(credential.user) as AuthUser;
  markAuthFlowEnd();
  return result;
};

export const loginWithEmail = async (email: string, password: string): Promise<AuthUser> => {
  markAuthFlowStart();
  const credential = await signInWithEmailAndPassword(auth, email, password);

  // Cria a sessao antes de qualquer operacao extra para evitar corrida no onAuthStateChanged.
  touchAuthSession();

  try {
    await reserveSessionSlot(credential.user);
  } catch (err) {
    if (!isFirestorePermissionDenied(err)) {
      clearSessionCookie();
      await signOut(auth);
      throw err;
    }
    console.warn('Firestore bloqueou reserveSessionSlot no login; seguindo com sessao local.', err);
  }

  // Nao bloqueia o login caso o Firestore demore ou falhe.
  upsertUserProfile(credential.user).catch((err) => {
    console.error('Falha ao sincronizar perfil no Firestore apos login', err);
  });

  const result = toAuthUser(credential.user) as AuthUser;
  markAuthFlowEnd();
  return result;
};

export const logout = async (): Promise<void> => {
  try {
    await releaseSessionSlot(auth.currentUser?.uid);
  } catch (err) {
    console.error('Falha ao liberar sessao durante logout', err);
  }

  clearSessionCookie();
  await signOut(auth);
};

const reauth = async (currentPassword: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('Nao autenticado.');
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
};

export const updateUserName = async (newName: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Nao autenticado.');
  const trimmed = newName.trim();
  await updateProfile(user, { displayName: trimmed });
  await setDoc(doc(db, 'Users', user.uid), { nome: trimmed, updatedAt: serverTimestamp() }, { merge: true });
};

export const updateUserEmail = async (currentPassword: string, newEmail: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Nao autenticado.');
  try {
    await reauth(currentPassword);
    await updateEmail(user, newEmail);
    await setDoc(doc(db, 'Users', user.uid), { email: newEmail, updatedAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err) {
      const code = String((err as { code: string }).code);
      if (code === 'auth/requires-recent-login') {
        throw Object.assign(new Error('Para alterar o e-mail, saia e entre novamente na conta e tente de novo.'), { code });
      }
    }
    throw err;
  }
};

export const updateUserPassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Nao autenticado.');
  await reauth(currentPassword);
  await updatePassword(user, newPassword);
};

export const requestPasswordReset = async (email: string, continueUrl: string): Promise<void> => {
  await sendPasswordResetEmail(auth, email, {
    url: continueUrl,
    handleCodeInApp: true,
  });
};

export const verifyPasswordResetLink = async (oobCode: string): Promise<string> => {
  return verifyPasswordResetCode(auth, oobCode);
};

export const completePasswordReset = async (oobCode: string, newPassword: string): Promise<void> => {
  await confirmPasswordReset(auth, oobCode, newPassword);
};

export const subscribeToAuth = (callback: (user: AuthUser | null) => void): (() => void) =>
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      callback(null);
      return;
    }

    if (!hasValidSessionCookie()) {
      if (isAuthFlowInGraceWindow()) {
        touchAuthSession();
        syncSessionHeartbeat(user.uid).catch((err) => {
          console.error('Falha ao restaurar heartbeat da sessao', err);
        });
      } else {
        clearSessionCookie();
        releaseSessionSlot(user.uid).catch((err) => {
          console.error('Falha ao liberar sessao expirada', err);
        });
        signOut(auth).catch((err) => {
          console.error('Falha ao encerrar sessao expirada', err);
        });
        callback(null);
        return;
      }
    }

    touchAuthSession();
    syncSessionHeartbeat(user.uid).catch((err) => {
      console.error('Falha ao sincronizar sessao ativa', err);
    });

    if (user) {
      upsertUserProfile(user).catch((err) => {
        console.error('Falha ao sincronizar perfil no Firestore', err);
      });
    }

    callback(toAuthUser(user));
  });

export const clearAuthFlowStateForDebug = (): void => {
  markAuthFlowEnd();
};
