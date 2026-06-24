import type { CatalogType, Episode, MediaItem, MovieGenre } from '../types';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
const MAX_PAGES = 1000;

const GENRE_MAP: Record<string, number> = {
  terror: 27,
  familia: 10751,
};

const fallbackPosters = [
  'https://images.unsplash.com/photo-1489599809927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=900&q=80',
];

export const getPosterUrl = (path?: string, index = 0): string => {
  if (path) {
    return `https://image.tmdb.org/t/p/w342${path}`;
  }
  return fallbackPosters[index % fallbackPosters.length];
};

export const getPosterUrlBySize = (path?: string, size = 'w342', index = 0): string => {
  if (path) {
    return `https://image.tmdb.org/t/p/${size}${path}`;
  }
  return fallbackPosters[index % fallbackPosters.length];
};

export const getBackdropUrl = (path?: string, index = 0): string => {
  if (path) {
    return `https://image.tmdb.org/t/p/w1280${path}`;
  }
  return fallbackPosters[index % fallbackPosters.length];
};

export const getBackdropUrlBySize = (path?: string, size = 'w1280', index = 0): string => {
  if (path) {
    return `https://image.tmdb.org/t/p/${size}${path}`;
  }
  return fallbackPosters[index % fallbackPosters.length];
};

export const getTitle = (item: MediaItem): string => item.title || item.name || 'Sem titulo';

export const getYear = (item: MediaItem): string => {
  const raw = item.release_date || item.first_air_date;
  if (!raw) return '---';
  return raw.slice(0, 4);
};

type TMDBListResponse = {
  page?: number;
  total_pages?: number;
  results?: MediaItem[];
};

type CatalogPageResult = {
  items: MediaItem[];
  hasMore: boolean;
  totalPages: number;
};

type TMDBReleaseItem = {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  adult?: boolean;
  genre_ids?: number[];
};

const ADULT_SEARCH_TERMS = ['hentai', 'porn', 'erotic', 'ecchi'];

function buildCatalogUrl(type: CatalogType, page: number, genre?: string, genreId?: number, includeAdult = false): string {
  const key = encodeURIComponent(TMDB_API_KEY);
  const includeAdultFlag = includeAdult ? 'true' : 'false';

  if (type === 'filmes') {
    const gid = genreId ?? (genre ? GENRE_MAP[genre] : undefined);
    if (gid) {
      return `${TMDB_BASE}/discover/movie?api_key=${key}&language=pt-BR&with_genres=${gid}&include_adult=${includeAdultFlag}&page=${page}`;
    }
    return `${TMDB_BASE}/discover/movie?api_key=${key}&language=pt-BR&sort_by=popularity.desc&include_adult=${includeAdultFlag}&page=${page}`;
  }

  if (type === 'animes') {
    return `${TMDB_BASE}/discover/tv?api_key=${key}&language=pt-BR&with_genres=16&with_origin_country=JP&page=${page}`;
  }

  // series — exclui animação (genre 16) para não misturar com animes
  return `${TMDB_BASE}/discover/tv?api_key=${key}&language=pt-BR&without_genres=16&page=${page}`;
}

export async function loadCatalogPage(
  type: CatalogType,
  page = 1,
  genre?: string,
  genreId?: number,
  includeAdult = false,
): Promise<CatalogPageResult> {
  const url = buildCatalogUrl(type, page, genre, genreId, includeAdult);

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 12000);
  const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
  window.clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`Falha ao carregar ${type} (${response.status})`);
  }

  const data = (await response.json()) as TMDBListResponse;
  const items = (Array.isArray(data.results) ? data.results : []).slice(0, 20);
  const totalPagesRaw = Math.min(Number(data.total_pages ?? 1), MAX_PAGES);
  const totalPages = Number.isFinite(totalPagesRaw) && totalPagesRaw > 0 ? Math.floor(totalPagesRaw) : 1;
  const hasMore = page < totalPages && items.length > 0;

  return { items, hasMore, totalPages };
}

export async function loadCatalog(
  type: CatalogType,
  page = 1,
  genre?: string,
): Promise<MediaItem[]> {
  const data = await loadCatalogPage(type, page, genre);
  return data.items;
}

function getReleaseWindow(daysAhead: number) {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + daysAhead);

  const formatDate = (value: Date) => value.toISOString().slice(0, 10);

  return {
    from: formatDate(now),
    to: formatDate(end),
  };
}

function mapReleaseItem(item: TMDBReleaseItem, contentType: 'movie' | 'tv' | 'anime'): MediaItem {
  const releaseDate = item.release_date || item.first_air_date || '';

  return {
    id: item.id,
    title: item.title || item.name || 'Sem titulo',
    name: item.title || item.name || 'Sem titulo',
    overview: item.overview || 'Descricao nao disponivel',
    poster_path: item.poster_path || undefined,
    backdrop_path: item.backdrop_path || undefined,
    release_date: releaseDate,
    first_air_date: releaseDate,
    adult: Boolean(item.adult),
    genre_ids: Array.isArray(item.genre_ids) ? item.genre_ids : undefined,
    media_type: contentType === 'movie' ? 'movie' : 'tv',
    content_type: contentType,
  };
}

export async function loadUpcomingReleases(daysAhead = 5): Promise<MediaItem[]> {
  if (!TMDB_API_KEY) {
    console.warn('VITE_TMDB_API_KEY nao configurada; notificacoes de lancamentos desativadas.');
    return [];
  }

  const { from, to } = getReleaseWindow(daysAhead);
  const key = encodeURIComponent(TMDB_API_KEY);

  const urls = [
    `${TMDB_BASE}/discover/movie?api_key=${key}&language=pt-BR&sort_by=primary_release_date.asc&primary_release_date_gte=${from}&primary_release_date_lte=${to}&include_adult=false&page=1`,
    `${TMDB_BASE}/discover/tv?api_key=${key}&language=pt-BR&without_genres=16&first_air_date_gte=${from}&first_air_date_lte=${to}&page=1`,
    `${TMDB_BASE}/discover/tv?api_key=${key}&language=pt-BR&with_genres=16&with_origin_country=JP&first_air_date_gte=${from}&first_air_date_lte=${to}&page=1`,
  ];

  const responses = await Promise.all(
    urls.map((url, index) =>
      fetch(url, { cache: 'no-store' })
        .then(async (response) => {
          if (!response.ok) {
            return [] as TMDBReleaseItem[];
          }

          const data = (await response.json()) as TMDBListResponse;
          return Array.isArray(data.results) ? (data.results as TMDBReleaseItem[]) : [];
        })
        .then((items) => {
          if (index === 0) return items.map((item) => mapReleaseItem(item, 'movie'));
          if (index === 1) return items.map((item) => mapReleaseItem(item, 'tv'));
          return items.map((item) => mapReleaseItem(item, 'anime'));
        })
        .catch(() => [] as MediaItem[]),
    ),
  );

  const merged = responses.flat();
  const unique = merged.filter((item, index, arr) => index === arr.findIndex((ref) => ref.id === item.id && ref.content_type === item.content_type));

  return unique.sort((a, b) => {
    const left = a.release_date || a.first_air_date || '';
    const right = b.release_date || b.first_air_date || '';
    return left.localeCompare(right);
  });
}

async function searchAdultMoviesByLanguage(page: number, language: string): Promise<CatalogPageResult> {
  const key = encodeURIComponent(TMDB_API_KEY);

  const requests = ADULT_SEARCH_TERMS.map((term) => {
    const url =
      `${TMDB_BASE}/search/movie?api_key=${key}` +
      `&language=${encodeURIComponent(language)}` +
      `&query=${encodeURIComponent(term)}` +
      `&include_adult=true&page=${page}`;
    return fetch(url, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          return { results: [] as MediaItem[], total_pages: 1 };
        }
        const data = (await response.json()) as TMDBListResponse;
        return {
          results: Array.isArray(data.results) ? data.results : [],
          total_pages: Number(data.total_pages ?? 1),
        };
      })
      .catch(() => ({ results: [] as MediaItem[], total_pages: 1 }));
  });

  const responses = await Promise.all(requests);
  const merged = responses.flatMap((entry) => entry.results);
  const unique = merged.filter((item, index, arr) => index === arr.findIndex((ref) => ref.id === item.id));
  const totalPagesRaw = Math.min(
    Math.max(...responses.map((entry) => (Number.isFinite(entry.total_pages) ? entry.total_pages : 1)), 1),
    MAX_PAGES,
  );
  const totalPages = Number.isFinite(totalPagesRaw) && totalPagesRaw > 0 ? Math.floor(totalPagesRaw) : 1;
  const hasMore = page < totalPages && unique.length > 0;

  return {
    items: unique.slice(0, 30),
    hasMore,
    totalPages,
  };
}

export async function loadAdultCatalogPage(page = 1): Promise<CatalogPageResult> {
  const pt = await searchAdultMoviesByLanguage(page, 'pt-BR');
  if (pt.items.length > 0) {
    return pt;
  }

  return searchAdultMoviesByLanguage(page, 'en-US');
}

export async function loadMovieGenres(): Promise<MovieGenre[]> {
  const key = encodeURIComponent(TMDB_API_KEY);
  const url = `${TMDB_BASE}/genre/movie/list?api_key=${key}&language=pt-BR`;
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Falha ao carregar generos (${response.status})`);
  }

  const data = (await response.json()) as { genres?: MovieGenre[] };
  return Array.isArray(data.genres) ? data.genres : [];
}

type TMDBShowDetails = {
  id: number;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  first_air_date?: string;
  vote_average?: number;
  number_of_seasons?: number;
  next_episode_to_air?: {
    air_date: string;
    episode_number: number;
    name: string;
    season_number: number;
  } | null;
};

export type UpcomingEpisodeRelease = {
  id: number;
  title: string;
  release_date: string;
  first_air_date: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  content_type: 'tv' | 'anime';
  season_number?: number;
  episode_number?: number;
  episode_name?: string;
};
export async function loadUpcomingEpisodeReleases(
  items: MediaItem[],
  daysAhead = 15,
): Promise<UpcomingEpisodeRelease[]> {
  if (!TMDB_API_KEY) {
    console.warn('VITE_TMDB_API_KEY nao configurada; notificacoes de episodios desativadas.');
    return [];
  }

  const { from, to } = getReleaseWindow(daysAhead);
  const key = encodeURIComponent(TMDB_API_KEY);

  // Séries/cartoons globais em exibição agora (on_the_air cobre os próximos 7 dias)
  type SourceDef = { url: string; type: 'tv' | 'anime' };

  const sourceDefs: SourceDef[] = [
    { url: `${TMDB_BASE}/tv/on_the_air?api_key=${key}&language=pt-BR&page=1`, type: 'tv' },
    { url: `${TMDB_BASE}/tv/on_the_air?api_key=${key}&language=pt-BR&page=2`, type: 'tv' },
    // Animes JP com episódio dentro da janela de datas (air_date filter)
    {
      url: `${TMDB_BASE}/discover/tv?api_key=${key}&language=pt-BR&with_genres=16&with_origin_country=JP&air_date.gte=${from}&air_date.lte=${to}&sort_by=popularity.desc&page=1`,
      type: 'anime',
    },
    {
      url: `${TMDB_BASE}/discover/tv?api_key=${key}&language=pt-BR&with_genres=16&with_origin_country=JP&air_date.gte=${from}&air_date.lte=${to}&sort_by=popularity.desc&page=2`,
      type: 'anime',
    },
    // Animes de outras origens (CN, KR etc.)
    {
      url: `${TMDB_BASE}/discover/tv?api_key=${key}&language=pt-BR&with_genres=16&without_keywords=210024&air_date.gte=${from}&air_date.lte=${to}&sort_by=popularity.desc&page=1`,
      type: 'anime',
    },
  ];

  const onAirResults = await Promise.all(
    sourceDefs.map(({ url, type }) =>
      fetch(url, { cache: 'no-store' })
        .then(async (r) => {
          if (!r.ok) return [] as TMDBReleaseItem[];
          const d = (await r.json()) as TMDBListResponse;
          return Array.isArray(d.results) ? (d.results as TMDBReleaseItem[]) : [];
        })
        .then((rawItems) =>
          rawItems.map((raw): MediaItem => ({
            id: raw.id,
            title: raw.name ?? raw.title ?? 'Sem titulo',
            name: raw.name ?? raw.title ?? 'Sem titulo',
            overview: raw.overview ?? '',
            poster_path: raw.poster_path ?? undefined,
            backdrop_path: raw.backdrop_path ?? undefined,
            release_date: raw.first_air_date ?? raw.release_date ?? '',
            first_air_date: raw.first_air_date ?? raw.release_date ?? '',
            adult: false,
            genre_ids: Array.isArray(raw.genre_ids) ? raw.genre_ids : undefined,
            media_type: 'tv' as const,
            content_type: type,
          }))
        )
        .catch(() => [] as MediaItem[]),
    ),
  );

  const extraItems: MediaItem[] = onAirResults.flat();

  // O Map usa "content_type:id" como chave.
  // Itens do catálogo têm prioridade pois vêm primeiro no spread;
  // o content_type do catálogo (ex: 'anime') NÃO é sobrescrito pelo on_the_air ('tv').
  const candidates = Array.from(
    new Map(
      [...items, ...extraItems]
        .filter((item) => item.content_type === 'tv' || item.content_type === 'anime')
        .map((item) => [`${item.content_type}:${item.id}`, item]),
    ).values(),
  );

  const releases = await Promise.all(
    candidates.map(async (item) => {
      const response = await fetch(
        `${TMDB_BASE}/tv/${item.id}?api_key=${key}&language=pt-BR`,
        { cache: 'no-store' },
      );

      if (!response.ok) {
        return null;
      }

      const show = (await response.json()) as TMDBShowDetails;
      const nextEpisode = show.next_episode_to_air;

      if (!nextEpisode?.air_date || nextEpisode.air_date < from || nextEpisode.air_date > to) {
        return null;
      }

      return {
        id: show.id,
        title: show.name ?? item.title ?? item.name ?? 'Sem titulo',
        release_date: nextEpisode.air_date,
        first_air_date: nextEpisode.air_date,
        poster_path: show.poster_path ?? item.poster_path ?? null,
        backdrop_path: show.backdrop_path ?? item.backdrop_path ?? null,
        content_type: item.content_type === 'anime' ? 'anime' : 'tv',
        season_number: nextEpisode.season_number,
        episode_number: nextEpisode.episode_number,
        episode_name: nextEpisode.name,
      } as UpcomingEpisodeRelease;
    }),
  );

  return releases
    .filter((release): release is UpcomingEpisodeRelease => Boolean(release))
    .sort((left, right) => left.release_date.localeCompare(right.release_date));
}

type TMDBSeasonDetails = {
  episodes?: Array<{
    episode_number?: number;
    name?: string;
    overview?: string;
    air_date?: string;
    still_path?: string | null;
    vote_average?: number;
  }>;
};

export async function fetchTVShowDetails(contentId: number) {
  const key = encodeURIComponent(TMDB_API_KEY);

  const showRes = await fetch(
    `${TMDB_BASE}/tv/${contentId}?api_key=${key}&language=pt-BR`,
    { cache: 'no-store' },
  );

  if (!showRes.ok) {
    return { success: false, data: null };
  }

  const show = (await showRes.json()) as TMDBShowDetails;
  const totalSeasons = show.number_of_seasons ?? 0;
  const seasonsToFetch = totalSeasons;

  const seasonResults = await Promise.all(
    Array.from({ length: seasonsToFetch }, (_, i) =>
      fetch(`${TMDB_BASE}/tv/${contentId}/season/${i + 1}?api_key=${key}&language=pt-BR`, {
        cache: 'no-store',
      })
        .then((r) => (r.ok ? (r.json() as Promise<TMDBSeasonDetails>) : null))
        .then((d) => ({ season: i + 1, data: d }))
        .catch(() => ({ season: i + 1, data: null })),
    ),
  );

  const episodes: Episode[] = [];
  for (const { season, data } of seasonResults) {
    if (!data?.episodes) continue;
    for (const ep of data.episodes) {
      episodes.push({
        season,
        episode: ep.episode_number ?? 0,
        title: ep.name ?? `Episódio ${ep.episode_number}`,
        overview: ep.overview ?? '',
        air_date: ep.air_date ?? '',
        still_path: ep.still_path ?? undefined,
        vote_average: ep.vote_average ?? 0,
      });
    }
  }

  episodes.sort((a, b) =>
    a.season !== b.season ? a.season - b.season : a.episode - b.episode,
  );

  return {
    success: true,
    data: {
      id: show.id,
      name: show.name ?? 'Sem título',
      title: show.name ?? 'Sem título',
      overview: show.overview ?? '',
      poster_path: show.poster_path ?? null,
      backdrop_path: show.backdrop_path ?? null,
      first_air_date: show.first_air_date ?? '',
      vote_average: show.vote_average ?? 0,
      total_seasons: totalSeasons,
      number_of_seasons: totalSeasons,
      episodes,
      next_episode_to_air: show.next_episode_to_air ?? null,
    },
  };
}
