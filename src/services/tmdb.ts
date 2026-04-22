import type { MediaItem } from '../types';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';

type TMDBSearchMovie = {
  id: number;
  title?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
};

type TMDBSearchTV = {
  id: number;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
};

type TMDBSearchResponse<T> = {
  results?: T[];
};

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const scoreTitle = (queryRaw: string, item: MediaItem): number => {
  const query = normalize(queryRaw);
  const title = normalize(item.title || item.name || '');
  if (!query || !title) return -1;

  let score = 0;
  if (title === query) score += 1000;
  else if (title.startsWith(query)) score += 700;
  else if (title.includes(query)) score += 450;

  for (const part of query.split(/\s+/)) {
    if (part.length < 2) continue;
    if (title.includes(part)) score += 90;
  }

  return score;
};

const mapMovie = (item: TMDBSearchMovie): MediaItem => ({
  id: item.id,
  title: item.title || 'Sem titulo',
  name: item.title || 'Sem titulo',
  overview: item.overview || 'Descricao nao disponivel',
  poster_path: item.poster_path || undefined,
  backdrop_path: item.backdrop_path || undefined,
  release_date: item.release_date || '',
  first_air_date: item.release_date || '',
  media_type: 'movie',
  content_type: 'movie',
});

const mapTV = (item: TMDBSearchTV): MediaItem => ({
  id: item.id,
  title: item.name || 'Sem titulo',
  name: item.name || 'Sem titulo',
  overview: item.overview || 'Descricao nao disponivel',
  poster_path: item.poster_path || undefined,
  backdrop_path: item.backdrop_path || undefined,
  release_date: item.first_air_date || '',
  first_air_date: item.first_air_date || '',
  media_type: 'tv',
  content_type: 'tv',
});

async function searchMovies(query: string, page: number, language: string): Promise<TMDBSearchMovie[]> {
  const url =
    `${TMDB_BASE_URL}/search/movie?api_key=${encodeURIComponent(TMDB_API_KEY)}` +
    `&language=${encodeURIComponent(language)}` +
    `&query=${encodeURIComponent(query)}` +
    `&include_adult=false&page=${page}`;

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) return [];
  const data = (await response.json()) as TMDBSearchResponse<TMDBSearchMovie>;
  return Array.isArray(data.results) ? data.results : [];
}

async function searchTV(query: string, page: number, language: string): Promise<TMDBSearchTV[]> {
  const url =
    `${TMDB_BASE_URL}/search/tv?api_key=${encodeURIComponent(TMDB_API_KEY)}` +
    `&language=${encodeURIComponent(language)}` +
    `&query=${encodeURIComponent(query)}` +
    `&include_adult=false&page=${page}`;

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) return [];
  const data = (await response.json()) as TMDBSearchResponse<TMDBSearchTV>;
  return Array.isArray(data.results) ? data.results : [];
}

export async function searchTmdbContent(query: string, pages = 5): Promise<MediaItem[]> {
  const normalized = query.trim();
  if (!normalized) return [];

  if (!TMDB_API_KEY) {
    console.warn('VITE_TMDB_API_KEY nao configurada; busca TMDB desativada.');
    return [];
  }

  const safePages = Math.min(Math.max(pages, 1), 8);

  const runSearch = async (language: string) => {
    const tasks: Array<Promise<MediaItem[]>> = [];

    for (let page = 1; page <= safePages; page += 1) {
      tasks.push(searchMovies(normalized, page, language).then((items) => items.map(mapMovie)));
      tasks.push(searchTV(normalized, page, language).then((items) => items.map(mapTV)));
    }

    const chunks = await Promise.all(tasks);
    return chunks.flat();
  };

  let results = await runSearch('pt-BR');
  if (results.length === 0) {
    results = await runSearch('en-US');
  }

  const deduped = results.filter((item, index, arr) => {
    const mediaType = item.media_type || item.content_type || 'movie';
    return index === arr.findIndex((ref) => ref.id === item.id && (ref.media_type || ref.content_type || 'movie') === mediaType);
  });

  return deduped
    .map((item) => ({
      item,
      score: scoreTitle(normalized, item),
    }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}
