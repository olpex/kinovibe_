export type TmdbGenreListResponse = {
  genres: Array<{ id: number; name: string }>;
};

export type TmdbGenre = {
  id: number;
  name: string;
};

export type TmdbMovie = {
  id: number;
  title: string;
  release_date: string | null;
  vote_average: number;
  genre_ids: number[];
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
};

export type TmdbMoviesResponse = {
  page: number;
  results: TmdbMovie[];
  total_pages: number;
  total_results: number;
};

export type TmdbMovieDetailsResponse = {
  id: number;
  title: string;
  overview: string;
  release_date: string | null;
  vote_average: number;
  runtime: number | null;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: TmdbGenre[];
  tagline: string;
  status: string;
  original_language: string;
};

export type TmdbMovieCreditsResponse = {
  cast: Array<{
    id: number;
    name: string;
    character: string;
    profile_path: string | null;
  }>;
};

export type TmdbMovieVideosResponse = {
  results: Array<{
    id: string;
    key: string;
    site: string;
    name: string;
    type: string;
    official: boolean;
    published_at: string;
  }>;
};

export type TmdbMovieWatchProvidersResponse = {
  id: number;
  results: Record<
    string,
    {
      link?: string;
      flatrate?: Array<{
        provider_id: number;
        provider_name: string;
      }>;
      rent?: Array<{
        provider_id: number;
        provider_name: string;
      }>;
      buy?: Array<{
        provider_id: number;
        provider_name: string;
      }>;
    }
  >;
};

export type TmdbMovieAlternativeTitlesResponse = {
  id: number;
  titles: Array<{
    iso_3166_1: string;
    title: string;
    type: string;
  }>;
};
