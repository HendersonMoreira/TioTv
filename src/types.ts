export type CatalogType = 'filmes' | 'animes' | 'series';

export interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date?: string;
  first_air_date?: string;
  adult?: boolean;
  genre_ids?: number[];
  media_type?: 'movie' | 'tv';
  content_type?: 'movie' | 'tv' | 'anime';
}

export interface MovieGenre {
  id: number;
  name: string;
}

export interface LoadContentResponse {
  success: boolean;
  items: MediaItem[];
  has_more?: boolean;
  page?: number;
  total_pages?: number;
}

export interface Episode {
  season: number;
  episode: number;
  title: string;
  overview?: string;
  air_date?: string;
  still_path?: string;
  vote_average?: number;
}

export interface PlayerContent extends MediaItem {
  episodes?: Episode[];
  total_seasons?: number;
  next_episode_to_air?: {
    air_date: string;
    episode_number: number;
    name: string;
    season_number: number;
  };
}
