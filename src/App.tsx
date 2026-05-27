import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchTVShowDetails,
  getBackdropUrlBySize,
  getTitle,
  loadCatalog,
  loadCatalogPage,
  loadMovieGenres,
} from './services/api';
import { searchTmdbContent } from './services/tmdb';
import type { CatalogType, MediaItem, MovieGenre, PlayerContent } from './types';
import { CategoryPageView } from './components/CategoryPageView';
import { ContentRow } from './components/ContentRow';
import { GenresOverlay } from './components/GenresOverlay';
import { KidsPageView } from './components/KidsPageView';
import { ForgotPasswordPage } from './components/ForgotPasswordPage';
import { LoginModal } from './components/LoginModal';
import { PlayerPage } from './components/PlayerPage';
import { RegisterModal } from './components/RegisterModal';
import { SearchModal } from './components/SearchModal';
import { AccountSettingsPage } from './components/AccountSettingsPage';
import { UpdatesPage } from './components/UpdatesPage.tsx';
import { GearIcon, SearchIcon } from './components/icons';
import { logout, startAuthSessionTracking, subscribeToAuth, type AuthUser } from './services/auth';
import { doc, onSnapshot, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from './services/firebase';

type RowDefinition = {
  id: string;
  title: string;
  items: MediaItem[];
  openCategory?: boolean;
};

type CategoryPageId = 'terror' | 'familia' | 'desenhos' | 'series' | 'animes' | 'adulto';

type CategoryConfig = {
  title: string;
  type: CatalogType;
  genre?: string;
};

const MAX_CATEGORY_PAGES = 1000;
const ADULT_PIN = '1425';
const ADULT_SESSION_KEY = 'tiotv_adult_unlocked';
const FREE_TIER_YEAR = '2025';
const WATCH_HISTORY_STORAGE_KEY = 'tiotv_watch_history_v1';
const RECOMMENDATION_STOP_WORDS = new Set([
  'para',
  'com',
  'uma',
  'das',
  'dos',
  'the',
  'and',
  'que',
  'por',
  'sem',
  'mais',
  'seu',
  'sua',
  'uma',
  'filme',
  'serie',
  'anime',
  'temporada',
  'episodio',
]);

type WatchHistoryEntry = {
  key: string;
  type: 'movie' | 'tv' | 'anime';
  contentId: number;
  season?: number;
  episode?: number;
  completed: boolean;
  updatedAt: string;
  item: MediaItem;
};

const getWatchHistoryStorageKey = (uid: string) => `${WATCH_HISTORY_STORAGE_KEY}:${uid}`;

const extractRecommendationTerms = (item: MediaItem): string[] => {
  const source = normalizeText(`${item.title || ''} ${item.name || ''} ${item.overview || ''}`);

  return source
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 4 && !RECOMMENDATION_STOP_WORDS.has(term));
};

const CATEGORY_MAP: Record<CategoryPageId, CategoryConfig> = {
  terror: { title: 'Filmes de Terror', type: 'filmes', genre: 'terror' },
  familia: { title: 'Filmes pra Familia', type: 'filmes', genre: 'familia' },
  desenhos: { title: 'Desenhos e Animes', type: 'animes' },
  series: { title: 'Series para Maratonar', type: 'series' },
  animes: { title: 'Animes', type: 'animes' },
  adulto: { title: 'Area Adulto (+18)', type: 'filmes' },
};

const parseCategoryFromHash = (): CategoryPageId | null => {
  const match = window.location.hash.match(/^#\/categoria\/(terror|familia|desenhos|series|animes|adulto)$/);
  if (!match) return null;
  return match[1] as CategoryPageId;
};

const parseGenreFromHash = (): number | null => {
  const match = window.location.hash.match(/^#\/genero\/(\d+)$/);
  if (!match) return null;
  const id = Number.parseInt(match[1], 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
};

const isKidsHash = (): boolean => window.location.hash === '#/kids';
const isSettingsHash = (): boolean => window.location.hash === '#/configuracoes';
const isUpdatesHash = (): boolean => window.location.hash === '#/atualizacoes';
const isForgotPasswordHash = (): boolean => window.location.hash === '#/esqueci-senha';
const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const getMediaYear = (item: MediaItem): string => {
  const rawDate = item.release_date || item.first_air_date || '';
  return rawDate.slice(0, 4);
};

const isAllowedForFreeTier = (
  item: MediaItem,
  mediaType: 'movie' | 'tv' | 'anime',
): boolean => {
  if (mediaType === 'anime') {
    return false;
  }

  return getMediaYear(item) === FREE_TIER_YEAR;
};

const KIDS_BLOCKED_TERMS = [
  'terror',
  'horror',
  'slasher',
  'morte',
  'matar',
  'assassin',
  'sangue',
  'sexo',
  'erot',
  'adult',
  'crime pesado',
  'demonio',
  'demoni',
  'gore',
];

const KIDS_ALLOWED_HINTS = [
  'famil',
  'kids',
  'infantil',
  'crianca',
  'desenho',
  'animacao',
  'anime',
  'aventura',
  'comedia',
  'magia',
];

const ADULT_CONTENT_TERMS = [
  '+18',
  '18 anos',
  'adulto',
  'adult',
  'porn',
  'porno',
  'pornografia',
  'sexo',
  'nude',
  'nudity',
  'hentai',
  'ecchi',
  'doujin',
  'yaoi',
  'yuri',
  'erot',
  'erotico',
  'sexual',
  'nsfw',
];

const ADULT_CONTENT_TOKEN_TERMS = [
  'adulto',
  'adult',
  'porn',
  'porno',
  'pornografia',
  'sexo',
  'nude',
  'nudity',
  'hentai',
  'ecchi',
  'doujin',
  'yaoi',
  'yuri',
  'erotico',
  'sexual',
  'nsfw',
];

const ADULT_CONTENT_PHRASE_TERMS = [
  '+18',
  '18 anos',
  'conteudo adulto',
  'adult content',
  'sem censura',
];

const STRICT_ADULT_HIGH_CONFIDENCE_TOKENS = new Set([
  'porn',
  'porno',
  'pornografia',
  'hentai',
  'ecchi',
  'doujin',
  'yaoi',
  'yuri',
  'nsfw',
]);

const ADULT_FORCED_TITLE_TERMS = [
  'overflow',
  'high school dxd',
  'highschool dxd',
  'boku no pico',
  'redo of healer',
  'kaiyari',
  'harem in the labyrinth',
  'futoku no guild',
  'shoujo ramune',
];

const ADULT_TITLE_EXCEPTIONS = [
  'euphoria',
  'lei & ordem: unidade de vitimas especiais',
  'law & order: special victims unit',
  'shameless',
  'the tonight show com jimmy fallon',
  'the tonight show starring jimmy fallon',
];

const isAdultContentItem = (item: MediaItem): boolean => {
  if (item.adult) {
    return true;
  }

  const title = normalizeText(`${item.title || ''} ${item.name || ''}`);
  if (ADULT_TITLE_EXCEPTIONS.some((term) => title.includes(term))) {
    return false;
  }

  if (ADULT_FORCED_TITLE_TERMS.some((term) => title.includes(term))) {
    return true;
  }

  const text = normalizeText(`${item.title || ''} ${item.name || ''} ${item.overview || ''}`);
  if (ADULT_CONTENT_PHRASE_TERMS.some((term) => text.includes(term))) {
    return true;
  }

  const textTokens = text.split(/[^a-z0-9]+/).filter(Boolean);
  if (ADULT_CONTENT_TOKEN_TERMS.some((term) => textTokens.includes(term))) {
    return true;
  }

  return ADULT_CONTENT_TERMS.some((term) => text.includes(term));
};

const isStrictAdultAreaItem = (item: MediaItem): boolean => {
  if (item.adult) {
    return true;
  }

  const title = normalizeText(`${item.title || ''} ${item.name || ''}`);
  if (ADULT_TITLE_EXCEPTIONS.some((term) => title.includes(term))) {
    return false;
  }

  if (ADULT_FORCED_TITLE_TERMS.some((term) => title.includes(term))) {
    return true;
  }

  const text = normalizeText(`${item.title || ''} ${item.name || ''} ${item.overview || ''}`);
  const hasPhraseSignal = ADULT_CONTENT_PHRASE_TERMS.some((term) => text.includes(term));
  const textTokens = text.split(/[^a-z0-9]+/).filter(Boolean);

  const matchedTokens = ADULT_CONTENT_TOKEN_TERMS.filter((term) => textTokens.includes(term));
  const hasHighConfidenceToken = matchedTokens.some((token) => STRICT_ADULT_HIGH_CONFIDENCE_TOKENS.has(token));

  if (hasHighConfidenceToken) {
    return true;
  }

  if (hasPhraseSignal && matchedTokens.length >= 1) {
    return true;
  }

  return matchedTokens.length >= 2;
};

const sanitizeCatalogItems = (items: MediaItem[]): MediaItem[] => items.filter((item) => !isAdultContentItem(item));

const tagCatalogItems = (items: MediaItem[], type: 'movie' | 'tv' | 'anime'): MediaItem[] =>
  items.map((item) => ({ ...item, content_type: type }));

const dedupeByTypeAndId = (items: MediaItem[]): MediaItem[] =>
  items.filter((item, index, arr) => {
    const mediaType = item.content_type || item.media_type || 'movie';
    return index === arr.findIndex((ref) => ref.id === item.id && (ref.content_type || ref.media_type || 'movie') === mediaType);
  });

const isKidsSafeItem = (item: MediaItem): boolean => {
  const text = normalizeText(`${item.title || ''} ${item.name || ''} ${item.overview || ''}`);
  if (!text) return true;

  if (KIDS_BLOCKED_TERMS.some((term) => text.includes(term))) {
    return false;
  }

  return true;
};

const prioritizeKidsItems = (items: MediaItem[]): MediaItem[] => {
  return [...items].sort((a, b) => {
    const textA = normalizeText(`${a.title || ''} ${a.name || ''} ${a.overview || ''}`);
    const textB = normalizeText(`${b.title || ''} ${b.name || ''} ${b.overview || ''}`);

    const scoreA = KIDS_ALLOWED_HINTS.reduce((acc, hint) => (textA.includes(hint) ? acc + 1 : acc), 0);
    const scoreB = KIDS_ALLOWED_HINTS.reduce((acc, hint) => (textB.includes(hint) ? acc + 1 : acc), 0);

    return scoreB - scoreA;
  });
};

const levenshteinDistance = (a: string, b: string): number => {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[a.length][b.length];
};

const computeSearchScore = (queryRaw: string, titleRaw: string): number => {
  const query = normalizeText(queryRaw);
  const title = normalizeText(titleRaw);
  if (!query || !title) return -1;

  if (title === query) return 100;
  if (title.startsWith(query)) return 90;

  const words = title.split(/\s+/).filter(Boolean);
  if (words.some((word) => word.startsWith(query))) return 80;

  if (title.includes(query)) return 72;

  if (query.length === 1) {
    return title.includes(query) ? 65 : -1;
  }

  let bestDistance = Infinity;
  for (const word of words) {
    const distance = levenshteinDistance(query, word);
    if (distance < bestDistance) bestDistance = distance;
  }
  bestDistance = Math.min(bestDistance, levenshteinDistance(query, title));

  const tolerance = query.length <= 4 ? 1 : 2;
  if (bestDistance <= tolerance) {
    return 60 - bestDistance * 8;
  }

  return -1;
};

type SearchIntent = {
  wantsMovies: boolean;
  wantsSeries: boolean;
  wantsAnimes: boolean;
  wantsCartoons: boolean;
  wantsDisney: boolean;
  wantsOld: boolean;
  minYear?: number;
  maxYear?: number;
};

const MOVIE_HINTS = ['filme', 'filmes', 'movie', 'movies', 'cinema'];
const SERIES_HINTS = ['serie', 'series', 'seriado', 'seriados', 'tv'];
const ANIME_HINTS = ['anime', 'animes', 'manga', 'otaku'];
const CARTOON_HINTS = ['desenho', 'desenhos', 'animacao', 'animacoes', 'cartoon', 'cartoons', 'animado', 'animados'];
const DISNEY_HINTS = ['disney', 'disney+', 'disney plus', 'pixar', 'marvel', 'star wars'];
const OLD_HINTS = ['antigo', 'antiga', 'antigos', 'antigas', 'classico', 'classicos', 'retro', 'nostalgia', 'velho', 'velhos'];
const ANIMATION_GENRE_ID = 16;
const DISNEY_CONTENT_TERMS = [
  'disney',
  'pixar',
  'marvel',
  'star wars',
  'avengers',
  'mickey',
  'minnie',
  'frozen',
  'moana',
  'toy story',
  'princesa',
  'princess',
];
const SEARCH_FILLER_TERMS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'ou', 'a', 'o', 'as', 'os', 'um', 'uma', 'pra', 'para', 'com',
  ...MOVIE_HINTS,
  ...SERIES_HINTS,
  ...ANIME_HINTS,
  ...CARTOON_HINTS,
  ...OLD_HINTS,
]);
const OLD_CONTENT_YEAR_CUTOFF = 2012;

const includesAnyHint = (text: string, hints: string[]): boolean => hints.some((hint) => text.includes(hint));

const parseSearchYearRange = (query: string): { minYear?: number; maxYear?: number } => {
  const explicitYears = Array.from(query.matchAll(/\b(19\d{2}|20\d{2})\b/g))
    .map((match) => Number.parseInt(match[1], 10))
    .filter((year) => Number.isFinite(year));

  if (explicitYears.length >= 2) {
    const sorted = [...explicitYears].sort((a, b) => a - b);
    return { minYear: sorted[0], maxYear: sorted[sorted.length - 1] };
  }

  if (explicitYears.length === 1) {
    return { minYear: explicitYears[0], maxYear: explicitYears[0] };
  }

  const decadeMatch = query.match(/anos?\s*(60|70|80|90|2000|2010)/);
  if (decadeMatch) {
    const decade = Number.parseInt(decadeMatch[1], 10);
    if (Number.isFinite(decade)) {
      return { minYear: decade, maxYear: decade + 9 };
    }
  }

  return {};
};

const detectSearchIntent = (queryRaw: string): SearchIntent => {
  const query = normalizeText(queryRaw);
  const yearRange = parseSearchYearRange(query);

  return {
    wantsMovies: includesAnyHint(query, MOVIE_HINTS),
    wantsSeries: includesAnyHint(query, SERIES_HINTS),
    wantsAnimes: includesAnyHint(query, ANIME_HINTS),
    wantsCartoons: includesAnyHint(query, CARTOON_HINTS),
    wantsDisney: includesAnyHint(query, DISNEY_HINTS),
    wantsOld: includesAnyHint(query, OLD_HINTS),
    minYear: yearRange.minYear,
    maxYear: yearRange.maxYear,
  };
};

const isLikelyAnimeItem = (item: MediaItem): boolean => {
  if (item.content_type === 'anime') {
    return true;
  }

  const mediaType = item.content_type || item.media_type || 'movie';
  const genres = Array.isArray(item.genre_ids) ? item.genre_ids : [];
  return mediaType === 'tv' && genres.includes(ANIMATION_GENRE_ID);
};

const isLikelyCartoonItem = (item: MediaItem): boolean => {
  const genres = Array.isArray(item.genre_ids) ? item.genre_ids : [];
  return genres.includes(ANIMATION_GENRE_ID);
};

const getItemMediaKind = (item: MediaItem): 'movie' | 'tv' | 'anime' => {
  if (isLikelyAnimeItem(item)) {
    return 'anime';
  }

  const mediaType = item.content_type || item.media_type || 'movie';
  return mediaType === 'tv' ? 'tv' : 'movie';
};

const applySearchIntentFilters = (items: MediaItem[], intent: SearchIntent): MediaItem[] => {
  let filtered = [...items];

  if (intent.wantsAnimes) {
    filtered = filtered.filter((item) => isLikelyAnimeItem(item));
  } else if (intent.wantsCartoons) {
    // desenhos = conteúdo animado (filmes e séries), mas não animes
    filtered = filtered.filter((item) => isLikelyCartoonItem(item) && !isLikelyAnimeItem(item));
  } else {
    if (intent.wantsMovies && !intent.wantsSeries) {
      filtered = filtered.filter((item) => getItemMediaKind(item) === 'movie');
    }

    if (intent.wantsSeries && !intent.wantsMovies) {
      filtered = filtered.filter((item) => getItemMediaKind(item) === 'tv');
    }
  }

  if (intent.wantsDisney) {
    filtered = filtered.filter((item) => {
      const text = normalizeText(`${item.title || ''} ${item.name || ''} ${item.overview || ''}`);
      return DISNEY_CONTENT_TERMS.some((term) => text.includes(term));
    });
  }

  if (intent.minYear !== undefined || intent.maxYear !== undefined || intent.wantsOld) {
    const minYear = intent.minYear;
    const maxYear = intent.maxYear ?? (intent.wantsOld ? OLD_CONTENT_YEAR_CUTOFF : undefined);

    filtered = filtered.filter((item) => {
      const year = Number.parseInt(getMediaYear(item), 10);
      if (!Number.isFinite(year)) {
        return false;
      }

      if (minYear !== undefined && year < minYear) {
        return false;
      }

      if (maxYear !== undefined && year > maxYear) {
        return false;
      }

      return true;
    });
  }

  return filtered;
};

const extractSearchTokens = (queryRaw: string): string[] => {
  const query = normalizeText(queryRaw);

  return query
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !SEARCH_FILLER_TERMS.has(token));
};

const computeItemSearchScore = (queryRaw: string, item: MediaItem): number => {
  const title = getTitle(item);
  const normalizedTitle = normalizeText(title);
  const normalizedOverview = normalizeText(item.overview || '');
  const tokens = extractSearchTokens(queryRaw);

  let bestScore = computeSearchScore(queryRaw, title);
  for (const token of tokens) {
    bestScore = Math.max(bestScore, computeSearchScore(token, title));
  }

  const tokenHits = tokens.reduce((acc, token) => {
    let bonus = 0;
    if (normalizedTitle.includes(token)) {
      bonus += 8;
    }
    if (normalizedOverview.includes(token)) {
      bonus += 4;
    }
    return acc + bonus;
  }, 0);

  if (bestScore < 0 && tokenHits === 0) {
    return -1;
  }

  return Math.max(bestScore, 30) + tokenHits;
};

function App() {
  const [catalog, setCatalog] = useState<Record<CatalogType | 'terror' | 'familia', MediaItem[]>>({
    filmes: [],
    animes: [],
    series: [],
    terror: [],
    familia: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const searchRequestIdRef = useRef(0);
  const [currentCategory, setCurrentCategory] = useState<CategoryPageId | null>(() => parseCategoryFromHash());
  const [currentGenreId, setCurrentGenreId] = useState<number | null>(() => parseGenreFromHash());
  const [kidsPageOpen, setKidsPageOpen] = useState<boolean>(() => isKidsHash());
  const [movieGenres, setMovieGenres] = useState<MovieGenre[]>([]);
  const [genresOpen, setGenresOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerContextMessage, setRegisterContextMessage] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState<boolean>(() => isForgotPasswordHash());
  const [settingsOpen, setSettingsOpen] = useState<boolean>(() => isSettingsHash());
  const [updatesOpen, setUpdatesOpen] = useState<boolean>(() => isUpdatesHash());
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const [, setIsPremiumPlusUser] = useState(false);
  const [premiumExpiresAt, setPremiumExpiresAt] = useState<Date | null>(null);
  const [premiumUpsellOpen, setPremiumUpsellOpen] = useState(false);
  const [premiumUpsellMessage, setPremiumUpsellMessage] = useState('Seja Premium e desbloqueie todo o catalogo. Nao perca essa chance. Assine nosso plano premium.');
  const [adultPinModalOpen, setAdultPinModalOpen] = useState(false);
  const [adultPinInput, setAdultPinInput] = useState('');
  const [adultPinError, setAdultPinError] = useState<string | null>(null);
  const [adultUnlocked, setAdultUnlocked] = useState<boolean>(() => window.sessionStorage.getItem(ADULT_SESSION_KEY) === '1');
  const [categoryItems, setCategoryItems] = useState<MediaItem[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [adultCatalogPool, setAdultCatalogPool] = useState<MediaItem[]>([]);
  const [categoryPage, setCategoryPage] = useState(1);
  const [categoryTotalPages, setCategoryTotalPages] = useState(1);
  const [playerContent, setPlayerContent] = useState<{
    type: 'movie' | 'tv' | 'anime';
    contentId: number;
    data: PlayerContent;
  } | null>(null);
  const [favorites, setFavorites] = useState<number[]>(() => {
    const saved = localStorage.getItem('tiotv_favorites');
    if (!saved) return [];
    try {
      return JSON.parse(saved) as number[];
    } catch {
      return [];
    }
  });
  const [watchHistory, setWatchHistory] = useState<WatchHistoryEntry[]>([]);

  useEffect(() => {
    localStorage.setItem('tiotv_favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setAuthUser(user);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authUser?.uid) {
      setIsPremiumUser(false);
      setIsPremiumPlusUser(false);
      return;
    }

    const userRef = doc(db, 'Users', authUser.uid);
    const unsubscribeProfile = onSnapshot(
      userRef,
      (snapshot) => {
        const data = snapshot.data() as {
          isPremium?: boolean;
          isPremiumPlus?: boolean;
          premiumExpiresAt?: Timestamp | null;
          premiumActivatedAt?: Timestamp | null;
        } | undefined;

        const rawPremium = Boolean(data?.isPremium);
        const rawPremiumPlus = Boolean(data?.isPremiumPlus);

        if (snapshot.exists() && data?.isPremiumPlus === undefined) {
          updateDoc(userRef, {
            isPremiumPlus: false,
          }).catch((err) => {
            console.error('Falha ao definir padrao de premium plus', err);
          });
        }

        // Determinar data de expiracao
        let expiresAt: Date | null = null;

        if (rawPremium) {
          if (data?.premiumExpiresAt) {
            // Ja tem data de expiracao salva
            expiresAt = data.premiumExpiresAt.toDate();
          } else {
            // Premium sem data — define agora como ativado hoje + 30 dias
            const now = new Date();
            expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            updateDoc(userRef, {
              premiumActivatedAt: Timestamp.fromDate(now),
              premiumExpiresAt: Timestamp.fromDate(expiresAt),
            }).catch((err) => {
              console.error('Falha ao salvar data de expiracao do premium', err);
            });
          }

          // Verificar se ja expirou
          if (expiresAt <= new Date()) {
            setIsPremiumUser(false);
            setIsPremiumPlusUser(false);
            setPremiumExpiresAt(null);
            updateDoc(userRef, {
              isPremium: false,
              isPremiumPlus: false,
              premiumExpiresAt: null,
            }).catch((err) => {
              console.error('Falha ao expirar premium', err);
            });
            return;
          }
        }

        // Premium Plus segue a mesma validade do Premium.
        if (!rawPremium && rawPremiumPlus) {
          updateDoc(userRef, {
            isPremiumPlus: false,
          }).catch((err) => {
            console.error('Falha ao sincronizar premium plus com premium', err);
          });
        }

        const effectivePremiumPlus = rawPremium && rawPremiumPlus;

        setIsPremiumUser(rawPremium);
        setIsPremiumPlusUser(effectivePremiumPlus);
        setPremiumExpiresAt(rawPremium ? expiresAt : null);
      },
      () => {
        setIsPremiumUser(false);
        setIsPremiumPlusUser(false);
        setPremiumExpiresAt(null);
      },
    );

    return () => {
      unsubscribeProfile();
    };
  }, [authUser?.uid]);

  const shouldRestrictByPlan = Boolean(authUser && !isPremiumUser);

  const isItemPremiumLocked = (
    item: MediaItem,
    mediaType: 'movie' | 'tv' | 'anime',
  ): boolean => shouldRestrictByPlan && !isAllowedForFreeTier(item, mediaType);

  useEffect(() => {
    if (!authUser) return;

    const stopTracking = startAuthSessionTracking();
    return () => {
      stopTracking();
    };
  }, [authUser?.uid]);

  useEffect(() => {
    if (!authUser?.uid) {
      setWatchHistory([]);
      return;
    }

    const saved = localStorage.getItem(getWatchHistoryStorageKey(authUser.uid));
    if (!saved) {
      setWatchHistory([]);
      return;
    }

    try {
      const parsed = JSON.parse(saved) as WatchHistoryEntry[];
      if (!Array.isArray(parsed)) {
        setWatchHistory([]);
        return;
      }

      setWatchHistory(
        parsed.filter((entry) =>
          entry &&
          typeof entry.contentId === 'number' &&
          typeof entry.type === 'string' &&
          typeof entry.updatedAt === 'string' &&
          typeof entry.item === 'object'
        )
      );
    } catch {
      setWatchHistory([]);
    }
  }, [authUser?.uid]);

  useEffect(() => {
    if (!authUser?.uid) {
      return;
    }

    localStorage.setItem(getWatchHistoryStorageKey(authUser.uid), JSON.stringify(watchHistory));
  }, [authUser?.uid, watchHistory]);

  useEffect(() => {
    const onHashChange = () => {
      const nextCategory = parseCategoryFromHash();
      if (nextCategory === 'adulto' && !adultUnlocked) {
        setAdultPinModalOpen(true);
        setAdultPinError('Area protegida. Fale comigo para receber o PIN de 4 digitos.');
        setAdultPinInput('');
        window.location.hash = '';
        return;
      }

      setCurrentCategory(parseCategoryFromHash());
      setCurrentGenreId(parseGenreFromHash());
      setKidsPageOpen(isKidsHash());
      setForgotPasswordOpen(isForgotPasswordHash());
      setSettingsOpen(isSettingsHash());
      setUpdatesOpen(isUpdatesHash());
      setGenresOpen(false);
    };

    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  }, [adultUnlocked]);

  useEffect(() => {
    let isMounted = true;

    const loadGenres = async () => {
      try {
        const genres = await loadMovieGenres();
        if (!isMounted) return;
        setMovieGenres(genres);
      } catch {
        if (!isMounted) return;
        setMovieGenres([]);
      }
    };

    loadGenres();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadAll = async () => {
      try {
        setLoading(true);
        const [filmes, terror, familia, animes, series] = await Promise.all([
          loadCatalog('filmes'),
          loadCatalog('filmes', 1, 'terror'),
          loadCatalog('filmes', 1, 'familia'),
          loadCatalog('animes'),
          loadCatalog('series'),
        ]);

        if (!isMounted) return;
        const taggedFilmes = tagCatalogItems(filmes, 'movie');
        const taggedTerror = tagCatalogItems(terror, 'movie');
        const taggedFamilia = tagCatalogItems(familia, 'movie');
        const taggedAnimes = tagCatalogItems(animes, 'anime');
        const taggedSeries = tagCatalogItems(series, 'tv');

        const adultPool = dedupeByTypeAndId(
          [
            ...taggedFilmes,
            ...taggedTerror,
            ...taggedFamilia,
            ...taggedAnimes,
            ...taggedSeries,
          ].filter(isStrictAdultAreaItem),
        );

        setAdultCatalogPool(adultPool);
        setCatalog({
          filmes: sanitizeCatalogItems(taggedFilmes),
          terror: sanitizeCatalogItems(taggedTerror),
          familia: sanitizeCatalogItems(taggedFamilia),
          animes: sanitizeCatalogItems(taggedAnimes),
          series: sanitizeCatalogItems(taggedSeries),
        });
        setError(null);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Erro inesperado');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadAll();
    return () => {
      isMounted = false;
    };
  }, []);

  const heroItems = useMemo(() => catalog.filmes.slice(0, 5), [catalog.filmes]);
  const firstHero = heroItems[0];
  const firstHeroSrc = firstHero ? getBackdropUrlBySize(firstHero.backdrop_path, 'w1280', 0) : '';
  const firstHeroSrcSet = firstHero
    ? `${getBackdropUrlBySize(firstHero.backdrop_path, 'w500', 0)} 500w, ${getBackdropUrlBySize(firstHero.backdrop_path, 'w780', 0)} 780w, ${getBackdropUrlBySize(firstHero.backdrop_path, 'w1280', 0)} 1280w`
    : '';

  useEffect(() => {
    if (!firstHeroSrc) return;

    const preloadLink = document.createElement('link');
    preloadLink.rel = 'preload';
    preloadLink.as = 'image';
    preloadLink.href = firstHeroSrc;
    preloadLink.setAttribute('data-hero-lcp-preload', 'true');
    preloadLink.setAttribute('imagesrcset', firstHeroSrcSet);
    preloadLink.setAttribute('imagesizes', '100vw');
    document.head.appendChild(preloadLink);

    return () => {
      preloadLink.remove();
    };
  }, [firstHeroSrc, firstHeroSrcSet]);

  useEffect(() => {
    if (heroItems.length === 0) {
      setHeroIndex(0);
      return;
    }

    setHeroIndex((prev) => (prev >= heroItems.length ? 0 : prev));
  }, [heroItems.length]);

  const rows = useMemo<RowDefinition[]>(() => {
    const catalogLookup = new Map<string, MediaItem>();
    const registerItem = (item: MediaItem, type: 'movie' | 'tv' | 'anime') => {
      catalogLookup.set(`${type}:${item.id}`, { ...item, content_type: type });
    };

    catalog.filmes.forEach((item) => registerItem(item, 'movie'));
    catalog.terror.forEach((item) => registerItem(item, 'movie'));
    catalog.familia.forEach((item) => registerItem(item, 'movie'));
    catalog.animes.forEach((item) => registerItem(item, 'anime'));
    catalog.series.forEach((item) => registerItem(item, 'tv'));

    const userHistory = authUser ? watchHistory : [];

    const continueWatching = userHistory
      .filter((entry) => entry.type === 'movie' || !entry.completed)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((entry) => {
        const fallbackItem = {
          ...entry.item,
          id: entry.contentId,
          content_type: entry.type,
        } satisfies MediaItem;

        return catalogLookup.get(entry.key) || fallbackItem;
      })
      .filter((item, index, arr) => {
        const itemType = item.content_type || 'movie';
        return index === arr.findIndex((ref) => ref.id === item.id && (ref.content_type || 'movie') === itemType);
      })
      .slice(0, 18);

    const watchedKeys = new Set(userHistory.map((entry) => entry.key));
    const recommendationTerms = userHistory.reduce<Map<string, number>>((acc, entry) => {
      const terms = extractRecommendationTerms(entry.item);
      terms.forEach((term) => {
        acc.set(term, (acc.get(term) || 0) + 1);
      });
      return acc;
    }, new Map<string, number>());

    const recommendationSources: Array<{ item: MediaItem; type: 'movie' | 'tv' }> = [
      ...catalog.filmes.map((item) => ({ item, type: 'movie' as const })),
      ...catalog.series.map((item) => ({ item, type: 'tv' as const })),
    ];

    const recommendationScored: Array<{ item: MediaItem; score: number }> = [];

    recommendationSources.forEach(({ item, type }) => {
      const key = `${type}:${item.id}`;
      if (watchedKeys.has(key)) {
        return;
      }

      const candidateItem: MediaItem = { ...item, content_type: type };
      const terms = extractRecommendationTerms(candidateItem);
      const score = terms.reduce((acc, term) => acc + (recommendationTerms.get(term) || 0), 0);

      if (score <= 0) {
        return;
      }

      recommendationScored.push({ item: candidateItem, score });
    });

    const recommendationCandidates = recommendationScored
      .sort((a, b) => b.score - a.score)
      .filter((entry, index, arr) => index === arr.findIndex((ref) => ref.item.id === entry.item.id && ref.item.content_type === entry.item.content_type))
      .slice(0, 18)
      .map((entry) => entry.item);

    const desenhos = catalog.animes.slice(0, 18);
    const series = catalog.series.slice(0, 18);

    const nextRows: RowDefinition[] = [];

    if (authUser && continueWatching.length > 0) {
      nextRows.push({ id: 'continue-watching', title: 'Assistidos e em andamento', items: continueWatching, openCategory: false });
    }

    if (authUser && recommendationCandidates.length > 0) {
      nextRows.push({ id: 'recommended-history', title: 'Filmes e series para voce', items: recommendationCandidates, openCategory: false });
    }

    nextRows.push(
      { id: 'terror', title: 'Filmes de Terror', items: catalog.terror.slice(0, 18), openCategory: true },
      { id: 'familia', title: 'Filmes pra Familia', items: catalog.familia.slice(0, 18), openCategory: true },
      { id: 'series', title: 'Series para Maratonar', items: series, openCategory: true },
    );

    nextRows.splice(2, 0, { id: 'animes', title: 'Animes', items: desenhos, openCategory: true });

    return nextRows;
  }, [authUser, catalog, watchHistory]);

  useEffect(() => {
    if (!currentCategory && !currentGenreId) return;

    setCategoryItems([]);
    setCategoryError(null);
    setCategoryPage(1);
    setCategoryTotalPages(1);
  }, [currentCategory, currentGenreId]);

  useEffect(() => {
    if (!currentCategory && !currentGenreId) return;
    if (categoryPage > MAX_CATEGORY_PAGES) {
      return;
    }

    let isMounted = true;
    const config = currentCategory ? CATEGORY_MAP[currentCategory] : null;
    
    const loadCategoryPage = async () => {
      try {
        setCategoryLoading(true);

        if (currentCategory === 'adulto') {
          const pageSize = 20;
          const totalAdultPages = Math.max(1, Math.ceil(adultCatalogPool.length / pageSize));
          const normalizedPage = Math.min(Math.max(categoryPage, 1), totalAdultPages);
          if (normalizedPage !== categoryPage) {
            setCategoryPage(normalizedPage);
          }
          const start = (normalizedPage - 1) * pageSize;
          const end = start + pageSize;

          setCategoryItems(adultCatalogPool.slice(start, end));
          setCategoryTotalPages(totalAdultPages);
          setCategoryError(null);
          return;
        }

        const data = await loadCatalogPage(
          config?.type ?? 'filmes',
          categoryPage,
          config?.genre,
          currentGenreId ?? undefined
        );

        if (!isMounted) {
          return;
        }

        const categoryContentType: 'movie' | 'tv' | 'anime' =
          config?.type === 'series' ? 'tv' : config?.type === 'animes' ? 'anime' : 'movie';
        const taggedCategoryItems = data.items.map((item) => ({
          ...item,
          content_type: categoryContentType,
        }));
        const adultFromCategory = taggedCategoryItems.filter(isStrictAdultAreaItem);
        if (adultFromCategory.length > 0) {
          setAdultCatalogPool((prev) => {
            const merged = dedupeByTypeAndId([...prev, ...adultFromCategory]);
            if (merged.length === prev.length) {
              return prev;
            }
            return merged;
          });
        }

        setCategoryItems(sanitizeCatalogItems(taggedCategoryItems));
        const safeTotalPages = Math.min(Math.max(data.totalPages, 1), MAX_CATEGORY_PAGES);
        setCategoryTotalPages(safeTotalPages);
        setCategoryError(null);
      } catch (err) {
        if (!isMounted) return;
        const errorMsg = err instanceof Error ? err.message : 'Erro ao carregar categoria';
        setCategoryError(errorMsg);
      } finally {
        if (isMounted) {
          setCategoryLoading(false);
        }
      }
    };

    loadCategoryPage();
    return () => {
      isMounted = false;
    };
  }, [currentCategory, currentGenreId, categoryPage, adultCatalogPool]);

  const goToCategoryPage = (page: number) => {
    if (categoryLoading) return;
    if (!Number.isFinite(page)) return;

    const nextPage = Math.min(Math.max(Math.floor(page), 1), categoryTotalPages);
    if (nextPage === categoryPage) return;
    setCategoryPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    const normalizedQuery = normalizeText(query);
    if (normalizedQuery.length === 0) {
      searchRequestIdRef.current += 1;
      setSearchResults([]);
      return;
    }

    const searchIntent = detectSearchIntent(normalizedQuery);
    const titleTokens = extractSearchTokens(normalizedQuery);

    // Quando a busca é SOMENTE palavras de intenção (ex: "desenhos antigos", "animes",
    // "filmes 2000"), não existe título para comparar — tratamos como navegação por
    // categoria e mostramos os itens do catálogo que satisfazem os filtros de intenção.
    const isPureCategoryQuery = titleTokens.length === 0;

    const allItems = [
      ...catalog.filmes,
      ...catalog.terror,
      ...catalog.familia,
      ...catalog.animes,
      ...catalog.series,
    ];

    const uniqueItems = allItems.filter((item, index, arr) => index === arr.findIndex((ref) => ref.id === item.id));
    const filteredLocalItems = applySearchIntentFilters(uniqueItems, searchIntent);

    let localResults: MediaItem[];

    if (isPureCategoryQuery) {
      // Sem título para buscar: retorna todos os itens que bateram nos filtros de
      // intenção, ordenados por mais recente quando não há filtro de ano, ou por
      // mais antigo quando o usuário quer conteúdo antigo.
      const sorted = [...filteredLocalItems].sort((a, b) => {
        const yA = Number.parseInt(getMediaYear(a), 10) || 0;
        const yB = Number.parseInt(getMediaYear(b), 10) || 0;
        return searchIntent.wantsOld ? yA - yB : yB - yA;
      });
      localResults = sorted.slice(0, 20);
    } else {
      const ranked = filteredLocalItems
        .map((item) => ({
          item,
          score: computeItemSearchScore(normalizedQuery, item),
        }))
        .filter((entry) => entry.score >= 0)
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.item);

      localResults = ranked.slice(0, 20);
    }

    setSearchResults(localResults);

    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;

    // Para buscas puramente por categoria, não faz sentido buscar no TMDB por título.
    if (isPureCategoryQuery) {
      return;
    }

    try {
      const remoteResults = await searchTmdbContent(query, 5);
      if (searchRequestIdRef.current !== requestId) {
        return;
      }

      const merged = [...localResults, ...remoteResults].filter(
        (item, index, arr) =>
          index ===
          arr.findIndex(
            (ref) =>
              ref.id === item.id &&
              (ref.media_type || ref.content_type || 'movie') ===
                (item.media_type || item.content_type || 'movie')
          )
      );

      const safeMerged = merged.filter((item) => !isAdultContentItem(item));
      const filteredMerged = applySearchIntentFilters(safeMerged, searchIntent);

      const reranked = filteredMerged
        .map((item) => ({
          item,
          score: computeItemSearchScore(normalizedQuery, item),
        }))
        .filter((entry) => entry.score >= 0)
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.item)
        .slice(0, 80);

      setSearchResults(reranked);
    } catch (err) {
      if (searchRequestIdRef.current !== requestId) {
        return;
      }
      console.warn('Falha na busca remota:', err);
    }
  };

  const handleSearchItemSelect = (item: MediaItem) => {
    const resolvedType: 'movie' | 'tv' | 'anime' =
      item.content_type || (item.media_type === 'tv' ? 'tv' : 'movie');

    setSearchOpen(false);
    void playContent(item, resolvedType);
  };

  const toggleFavorite = (id: number) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const removeFromContinueWatching = (item: MediaItem) => {
    const itemType = item.content_type || item.media_type || 'movie';
    const key = `${itemType}:${item.id}`;
    setWatchHistory((prev) => prev.filter((entry) => entry.key !== key));
  };

  const openCategoryPage = (id: CategoryPageId) => {
    window.location.hash = `#/categoria/${id}`;
  };

  const openGenrePage = (genreId: number) => {
    window.location.hash = `#/genero/${genreId}`;
  };

  const openAdultPage = () => {
    setGenresOpen(false);

    if (adultUnlocked) {
      window.location.hash = '#/categoria/adulto';
      return;
    }

    setAdultPinModalOpen(true);
    setAdultPinInput('');
    setAdultPinError(null);
  };

  const closeAdultPinModal = () => {
    setAdultPinModalOpen(false);
    setAdultPinInput('');
    setAdultPinError(null);
  };

  const submitAdultPin = () => {
    if (adultPinInput !== ADULT_PIN) {
      setAdultPinError('PIN incorreto. Entre em contato comigo para receber o acesso.');
      return;
    }

    window.sessionStorage.setItem(ADULT_SESSION_KEY, '1');
    setAdultUnlocked(true);
    setAdultPinModalOpen(false);
    setAdultPinInput('');
    setAdultPinError(null);
    window.location.hash = '#/categoria/adulto';
  };

  const closeCategoryPage = () => {
    window.location.hash = '';
  };

  const openKidsPage = () => {
    window.location.hash = '#/kids';
  };

  const scrollToRow = (rowId: string) => {
    const section = document.getElementById(`row-${rowId}`);
    if (!section) return;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const navigateToHomeSection = (rowId?: string) => {
    const scrollAction = () => {
      if (rowId) {
        scrollToRow(rowId);
        return;
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (window.location.hash) {
      window.location.hash = '';
      window.setTimeout(scrollAction, 90);
      return;
    }

    scrollAction();
  };

  const goToInicio = () => {
    navigateToHomeSection();
  };

  const goToFilmes = () => {
    navigateToHomeSection('terror');
  };

  const goToSeries = () => {
    navigateToHomeSection('series');
  };

  const openUpdatesPage = () => {
    window.location.hash = '#/atualizacoes';
  };

  const openLoginModal = () => {
    setRegisterOpen(false);
    setRegisterContextMessage(null);
    window.location.hash = '';
    setLoginOpen(true);
  };

  const openForgotPasswordPage = () => {
    setRegisterOpen(false);
    setLoginOpen(false);
    window.location.hash = '#/esqueci-senha';
  };

  const backToLoginFromForgotPassword = () => {
    window.location.hash = '';
    setForgotPasswordOpen(false);
    setLoginOpen(true);
  };

  const openRegisterModal = (message?: string) => {
    setLoginOpen(false);
    setRegisterContextMessage(message ?? null);
    setRegisterOpen(true);
  };

  const closeRegisterModal = () => {
    setRegisterOpen(false);
    setRegisterContextMessage(null);
  };

  const onAuthSuccess = () => {
    closeRegisterModal();
    setLoginOpen(false);
  };

  const onUserUpdated = () => {
    // subscribeToAuth vai disparar e atualizar authUser automaticamente
  };

  const openSettingsPage = () => {
    window.location.hash = '#/configuracoes';
  };

  const playContent = async (item: MediaItem, mediaType: 'movie' | 'tv' | 'anime') => {
    if (!authUser) {
      openRegisterModal('Voce precisa criar uma conta para assistir aos filmes e series.');
      return;
    }

    if (isItemPremiumLocked(item, mediaType)) {
      setPremiumUpsellMessage('Seja Premium e desbloqueie todo o catalogo. Nao perca essa chance. Assine nosso plano premium.');
      setPremiumUpsellOpen(true);
      return;
    }

    try {
      let playerData: PlayerContent = item;
      const contentId = item.id;

      console.log('=== INICIANDO PLAYER ===');
      console.log('Tipo de mídia:', mediaType);
      console.log('ID de conteúdo:', contentId);
      console.log('Nome:', item.title || item.name);
      console.log('Item completo:', item);

      // Buscar episódios para séries/animes
      if (mediaType !== 'movie') {
        try {
          console.log(`Buscando episódios para ID ${contentId}...`);
          const details = await fetchTVShowDetails(contentId);
          console.log('=== RESPOSTA DA API ===');
          console.log('Status:', details.success ? 'Sucesso' : 'Erro');
          console.log('Resposta completa:', details);
          
          if (details.success && details.data) {
            const episodes = details.data.episodes || [];
            const totalSeasons = details.data.total_seasons || details.data.number_of_seasons || 1;
            console.log(`✓ Episódios carregados para ${contentId}: ${episodes.length} episódios em ${totalSeasons} temporadas`);
            
            if (episodes.length > 0) {
              console.log('Primeiros episódios:', episodes.slice(0, 3));
            } else {
              console.warn('⚠ Array de episódios está vazio!');
              console.log('Data recebida:', details.data);
            }
            
            playerData = {
              ...item,
              episodes: episodes,
              total_seasons: totalSeasons,
            };
          } else {
            console.warn('⚠ Resposta inválida da API:', details);
            console.log('Success flag:', details.success);
            console.log('Data:', details.data);
          }
        } catch (err) {
          console.error('❌ Erro ao buscar detalhes de episódios:', err);
          if (err instanceof Error) {
            console.error('Mensagem:', err.message);
            console.error('Stack:', err.stack);
          }
          // Continuar mesmo sem episódios - mostrar player sem lista
        }
      }

      console.log('=== ABRINDO PLAYER ===');
      console.log('Dados do player:', playerData);
      setPlayerContent({
        type: mediaType,
        contentId,
        data: { ...playerData, content_type: mediaType },
      });
    } catch (err) {
      console.error('❌ Erro ao abrir player:', err);
      if (err instanceof Error) {
        console.error('Mensagem:', err.message);
        console.error('Stack:', err.stack);
      }
    }
  };

  const closePlayer = () => {
    setPlayerContent(null);
  };

  const handlePlayerProgressChange = useCallback((progress: {
    type: 'movie' | 'tv' | 'anime';
    contentId: number;
    season?: number;
    episode?: number;
    completed: boolean;
    updatedAt: string;
    item: PlayerContent;
  }) => {
    if (!authUser?.uid) {
      return;
    }

    setWatchHistory((prev) => {
      const key = `${progress.type}:${progress.contentId}`;
      const nextEntry: WatchHistoryEntry = {
        key,
        type: progress.type,
        contentId: progress.contentId,
        season: progress.season,
        episode: progress.episode,
        completed: progress.completed,
        updatedAt: progress.updatedAt,
        item: {
          id: progress.contentId,
          title: progress.item.title,
          name: progress.item.name,
          overview: progress.item.overview,
          poster_path: progress.item.poster_path,
          backdrop_path: progress.item.backdrop_path,
          release_date: progress.item.release_date,
          first_air_date: progress.item.first_air_date,
          media_type: progress.item.media_type,
          content_type: progress.type,
        },
      };

      const filtered = prev.filter((entry) => entry.key !== key);
      return [nextEntry, ...filtered].slice(0, 50);
    });
  }, [authUser?.uid]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Falha ao sair da conta', err);
    }
  };

  const userFirstName = authUser
    ? (authUser.displayName || authUser.email || 'Usuario').split(' ')[0]
    : undefined;

  const currentHero = heroItems[heroIndex];
  const currentHeroSrc = currentHero ? getBackdropUrlBySize(currentHero.backdrop_path, 'w780', heroIndex) : '';
  const currentHeroSrcSet = currentHero
    ? `${getBackdropUrlBySize(currentHero.backdrop_path, 'w500', heroIndex)} 500w, ${getBackdropUrlBySize(currentHero.backdrop_path, 'w780', heroIndex)} 780w, ${getBackdropUrlBySize(currentHero.backdrop_path, 'w1280', heroIndex)} 1280w`
    : '';
  const isLcpHero = heroIndex === 0;

  // Renderizar player se aberto
  if (playerContent) {
    return (
      <PlayerPage
        type={playerContent.type}
        contentId={playerContent.contentId}
        content={playerContent.data}
        onBack={closePlayer}
        currentUserName={userFirstName}
        onOpenSettings={openSettingsPage}
        onLogout={handleLogout}
        onProgressChange={handlePlayerProgressChange}
      />
    );
  }

  if (currentCategory || currentGenreId) {
    const pageConfig = currentCategory ? CATEGORY_MAP[currentCategory] : null;
    const currentGenreName = currentGenreId
      ? movieGenres.find((genre) => genre.id === currentGenreId)?.name ?? `Genero ${currentGenreId}`
      : null;
    return (
      <>
        <CategoryPageView
          title={pageConfig?.title ?? `Filmes de ${currentGenreName}`}
          items={categoryItems}
          favorites={favorites}
          loading={categoryLoading}
          error={categoryError}
          currentPage={categoryPage}
          totalPages={categoryTotalPages}
          onBack={closeCategoryPage}
          onPageChange={goToCategoryPage}
          onToggleFavorite={toggleFavorite}
          onPlayItem={playContent}
          searchOpen={searchOpen}
          searchQuery={searchQuery}
          searchResults={searchResults}
          onSearchToggle={() => setSearchOpen((prev) => !prev)}
          onSearchChange={handleSearch}
          onSelectSearchItem={handleSearchItemSelect}
          currentUserName={userFirstName}
          onOpenSettings={openSettingsPage}
          onLogout={handleLogout}
          isItemLocked={isItemPremiumLocked}
        />
        {premiumUpsellOpen && (
          <div className="premium-upsell-overlay" onClick={() => setPremiumUpsellOpen(false)}>
            <div className="premium-upsell-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Conteudo Premium</h3>
              <p>{premiumUpsellMessage}</p>
              <div className="premium-upsell-actions">
                <button type="button" className="ghost-account-btn" onClick={() => setPremiumUpsellOpen(false)}>
                  Agora nao
                </button>
                <button
                  type="button"
                  className="account-btn"
                  onClick={() => {
                    setPremiumUpsellOpen(false);
                    openUpdatesPage();
                  }}
                >
                  Quero ser Premium
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (kidsPageOpen) {
    const safeCartoons = prioritizeKidsItems(catalog.animes.filter(isKidsSafeItem));
    const safeFamily = prioritizeKidsItems(catalog.familia.filter(isKidsSafeItem));

    return (
      <>
        <KidsPageView
          cartoons={safeCartoons}
          family={safeFamily}
          favorites={favorites}
          onBack={closeCategoryPage}
          onToggleFavorite={toggleFavorite}
          onPlayItem={playContent}
          currentUserName={userFirstName}
          onOpenSettings={openSettingsPage}
          onLogout={handleLogout}
          isItemLocked={isItemPremiumLocked}
        />
        {premiumUpsellOpen && (
          <div className="premium-upsell-overlay" onClick={() => setPremiumUpsellOpen(false)}>
            <div className="premium-upsell-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Conteudo Premium</h3>
              <p>{premiumUpsellMessage}</p>
              <div className="premium-upsell-actions">
                <button type="button" className="ghost-account-btn" onClick={() => setPremiumUpsellOpen(false)}>
                  Agora nao
                </button>
                <button
                  type="button"
                  className="account-btn"
                  onClick={() => {
                    setPremiumUpsellOpen(false);
                    openUpdatesPage();
                  }}
                >
                  Quero ser Premium
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (settingsOpen && authUser) {
    return (
      <AccountSettingsPage
        user={authUser}
        isPremium={isPremiumUser}
        premiumExpiresAt={premiumExpiresAt}
        onBack={() => { window.location.hash = ''; }}
        onUserUpdated={onUserUpdated}
        onLogout={handleLogout}
      />
    );
  }

  if (forgotPasswordOpen) {
    return (
      <ForgotPasswordPage
        onBackToLogin={backToLoginFromForgotPassword}
      />
    );
  }

  if (updatesOpen) {
    return (
      <div className="app-shell updates-page-shell">
        <header className="top-nav">
          <h1 className="brand">TioTV</h1>
          <nav className="main-nav">
            <button type="button" className="genres-nav-btn" onClick={goToInicio}>
              Inicio
            </button>
            <button type="button" className="genres-nav-btn" onClick={goToFilmes}>
              Filmes
            </button>
            <button type="button" className="genres-nav-btn" onClick={goToSeries}>
              Series
            </button>
            <button type="button" className="genres-nav-btn" onClick={openKidsPage}>
              Kids
            </button>
            <button
              type="button"
              className="genres-nav-btn"
              onClick={() => setGenresOpen((prev) => !prev)}
              aria-expanded={genresOpen}
            >
              Generos
            </button>
            <button
              type="button"
              className="genres-nav-btn active"
              onClick={openUpdatesPage}
            >
              Atualizacoes
            </button>
          </nav>
          <div className="nav-actions">
            <button
              className="circle-btn"
              onClick={() => setSearchOpen(!searchOpen)}
              aria-label="Buscar"
            >
              <SearchIcon />
            </button>
            {authUser ? (
              <>
                <span className="user-chip">
                  Ola, {userFirstName}
                </span>
                <button
                  className="gear-btn circle-btn"
                  aria-label="Configuracoes do perfil"
                  onClick={openSettingsPage}
                >
                  <GearIcon />
                </button>
                <button className="account-btn" onClick={handleLogout}>Sair</button>
              </>
            ) : (
              <>
                <button className="ghost-account-btn" onClick={openLoginModal}>Entrar</button>
                <button className="account-btn" onClick={() => openRegisterModal()}>Criar Conta</button>
              </>
            )}
          </div>

          {searchOpen && (
            <SearchModal
              searchQuery={searchQuery}
              searchResults={searchResults}
              onSearchChange={handleSearch}
              onSelectItem={handleSearchItemSelect}
            />
          )}
        </header>

        <GenresOverlay
          open={genresOpen}
          genres={movieGenres}
          onClose={() => setGenresOpen(false)}
          onSelectGenre={openGenrePage}
          onOpenAdultArea={openAdultPage}
        />

        {adultPinModalOpen && (
          <div className="adult-pin-overlay" onClick={closeAdultPinModal}>
            <div className="adult-pin-modal" onClick={(event) => event.stopPropagation()}>
              <h3>Area Adulto (+18)</h3>
              <p>
                Conteudo restrito para privacidade e protecao das criancas. Para entrar, informe o PIN de 4 digitos.
              </p>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={adultPinInput}
                onChange={(event) => {
                  const next = event.target.value.replace(/\D/g, '').slice(0, 4);
                  setAdultPinInput(next);
                }}
                className="adult-pin-input"
                placeholder="Digite o PIN"
                aria-label="PIN de 4 digitos"
              />
              {adultPinError && <p className="adult-pin-error">{adultPinError}</p>}
              <div className="adult-pin-actions">
                <button type="button" className="ghost-account-btn" onClick={closeAdultPinModal}>
                  Cancelar
                </button>
                <button type="button" className="account-btn" onClick={submitAdultPin}>
                  Entrar
                </button>
              </div>
            </div>
          </div>
        )}

        <UpdatesPage />

        <RegisterModal
          open={registerOpen}
          contextMessage={registerContextMessage}
          onClose={closeRegisterModal}
          onLogin={openLoginModal}
          onSuccess={onAuthSuccess}
        />
        <LoginModal
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          onRegister={() => openRegisterModal()}
          onForgotPassword={openForgotPasswordPage}
          onSuccess={onAuthSuccess}
        />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <section className="hero-section">
        {currentHero && (
          <>
            <img
              className="hero-bg"
              src={currentHeroSrc}
              srcSet={currentHeroSrcSet}
              sizes="100vw"
              alt={getTitle(currentHero)}
              loading={isLcpHero ? 'eager' : 'lazy'}
              fetchPriority={isLcpHero ? 'high' : 'auto'}
              decoding="async"
            />
            <div className="hero-overlay" />
            <div className="hero-vignette" />
          </>
        )}

        <header className="top-nav">
          <h1 className="brand">TioTV</h1>
          <nav className="main-nav">
            <button type="button" className="genres-nav-btn" onClick={goToInicio}>
              Inicio
            </button>
            <button type="button" className="genres-nav-btn" onClick={goToFilmes}>
              Filmes
            </button>
            <button type="button" className="genres-nav-btn" onClick={goToSeries}>
              Series
            </button>
            <button type="button" className="genres-nav-btn" onClick={openKidsPage}>
              Kids
            </button>
            <button
              type="button"
              className="genres-nav-btn"
              onClick={() => setGenresOpen((prev) => !prev)}
              aria-expanded={genresOpen}
            >
              Generos
            </button>
            <button
              type="button"
              className="genres-nav-btn"
              onClick={openUpdatesPage}
            >
              Atualizacoes
            </button>
          </nav>
          <div className="nav-actions">
            <button
              className="circle-btn"
              onClick={() => setSearchOpen(!searchOpen)}
              aria-label="Buscar"
            >
              <SearchIcon />
            </button>
            {authUser ? (
              <>
                <span className="user-chip">
                  Ola, {userFirstName}
                </span>
                <button
                  className="gear-btn circle-btn"
                  aria-label="Configuracoes do perfil"
                  onClick={openSettingsPage}
                >
                  <GearIcon />
                </button>
                <button className="account-btn" onClick={handleLogout}>Sair</button>
              </>
            ) : (
              <>
                <button className="ghost-account-btn" onClick={openLoginModal}>Entrar</button>
                <button className="account-btn" onClick={() => openRegisterModal()}>Criar Conta</button>
              </>
            )}
          </div>

          {searchOpen && (
            <SearchModal
              searchQuery={searchQuery}
              searchResults={searchResults}
              onSearchChange={handleSearch}
              onSelectItem={handleSearchItemSelect}
            />
          )}
        </header>

        <GenresOverlay
          open={genresOpen}
          genres={movieGenres}
          onClose={() => setGenresOpen(false)}
          onSelectGenre={openGenrePage}
          onOpenAdultArea={openAdultPage}
        />

        {adultPinModalOpen && (
          <div className="adult-pin-overlay" onClick={closeAdultPinModal}>
            <div className="adult-pin-modal" onClick={(event) => event.stopPropagation()}>
              <h3>Area Adulto (+18)</h3>
              <p>
                Conteudo restrito para privacidade e protecao das criancas. Para entrar, informe o PIN de 4 digitos.
              </p>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={adultPinInput}
                onChange={(event) => {
                  const next = event.target.value.replace(/\D/g, '').slice(0, 4);
                  setAdultPinInput(next);
                }}
                className="adult-pin-input"
                placeholder="Digite o PIN"
                aria-label="PIN de 4 digitos"
              />
              {adultPinError && <p className="adult-pin-error">{adultPinError}</p>}
              <div className="adult-pin-actions">
                <button type="button" className="ghost-account-btn" onClick={closeAdultPinModal}>
                  Cancelar
                </button>
                <button type="button" className="account-btn" onClick={submitAdultPin}>
                  Entrar
                </button>
              </div>
            </div>
          </div>
        )}

        <RegisterModal
          open={registerOpen}
          contextMessage={registerContextMessage}
          onClose={closeRegisterModal}
          onLogin={openLoginModal}
          onSuccess={onAuthSuccess}
        />
        <LoginModal
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          onRegister={() => openRegisterModal()}
          onForgotPassword={openForgotPasswordPage}
          onSuccess={onAuthSuccess}
        />

        {premiumUpsellOpen && (
          <div className="premium-upsell-overlay" onClick={() => setPremiumUpsellOpen(false)}>
            <div className="premium-upsell-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Conteudo Premium</h3>
              <p>{premiumUpsellMessage}</p>
              <div className="premium-upsell-actions">
                <button type="button" className="ghost-account-btn" onClick={() => setPremiumUpsellOpen(false)}>
                  Agora nao
                </button>
                <button
                  type="button"
                  className="account-btn"
                  onClick={() => {
                    setPremiumUpsellOpen(false);
                    openUpdatesPage();
                  }}
                >
                  Quero ser Premium
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="hero-content">
          <p className="hero-kicker">Filmes Top 5</p>
          <h2>{currentHero ? getTitle(currentHero) : 'Carregando destaque...'}</h2>
          <p className="hero-subtext">Assistir agora</p>
          <button className="hero-play-btn">Ver Filmes</button>
        </div>

        <div className="hero-dots" role="tablist" aria-label="Selecionar destaque">
          {heroItems.map((item, index) => (
            <button
              key={item.id}
              className={index === heroIndex ? 'dot active' : 'dot'}
              onClick={() => setHeroIndex(index)}
              aria-label={`Abrir ${getTitle(item)}`}
            />
          ))}
        </div>
      </section>

      <main className="catalog-layout">
        {loading && <p className="status">Carregando catalogo...</p>}
        {error && <p className="status error">{error}</p>}

        {!loading &&
          !error &&
          rows.map((row) => (
            <ContentRow
              key={row.id}
              id={row.id}
              title={row.title}
              items={row.items}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
              onOpenCategory={row.openCategory ? (id) => openCategoryPage(id as CategoryPageId) : undefined}
              onPlayItem={playContent}
              onRemoveItem={row.id === 'continue-watching' ? removeFromContinueWatching : undefined}
              isItemLocked={isItemPremiumLocked}
            />
          ))}
      </main>
    </div>
  );
}

export default App;
