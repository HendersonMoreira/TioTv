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

function buildCatalogUrl(type: CatalogType, page: number, genre?: string, genreId?: number): string {
  const key = encodeURIComponent(TMDB_API_KEY);

  if (type === 'filmes') {
    const gid = genreId ?? (genre ? GENRE_MAP[genre] : undefined);
    if (gid) {
      return `${TMDB_BASE}/discover/movie?api_key=${key}&language=pt-BR&with_genres=${gid}&page=${page}`;
    }
    return `${TMDB_BASE}/movie/popular?api_key=${key}&language=pt-BR&page=${page}`;
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
): Promise<CatalogPageResult> {
  const url = buildCatalogUrl(type, page, genre, genreId);

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
  const seasonsToFetch = Math.min(totalSeasons, 5);

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
