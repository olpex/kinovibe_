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
  original_language?: string | null;
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
  production_countries: Array<{
    iso_3166_1: string;
    name: string;
  }>;
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
  crew: Array<{
    id: number;
    name: string;
    job: string;
    department: string;
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

export type TmdbTranslationEntry = {
  iso_3166_1: string;
  iso_639_1: string;
  name: string;
  english_name: string;
  data: {
    title?: string;
    name?: string;
    overview?: string;
    tagline?: string;
    biography?: string;
  };
};

export type TmdbMovieTranslationsResponse = {
  id: number;
  translations: TmdbTranslationEntry[];
};

export type TmdbPersonTranslationsResponse = {
  id: number;
  translations: TmdbTranslationEntry[];
};

export type TmdbTv = {
  id: number;
  name: string;
  first_air_date: string | null;
  vote_average: number;
  original_language?: string | null;
  genre_ids: number[];
  origin_country?: string[];
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
};

export type TmdbTvResponse = {
  page: number;
  results: TmdbTv[];
  total_pages: number;
  total_results: number;
};

export type TmdbTvDetailsResponse = {
  id: number;
  name: string;
  overview: string;
  first_air_date: string | null;
  vote_average: number;
  episode_run_time: number[];
  poster_path: string | null;
  backdrop_path: string | null;
  genres: TmdbGenre[];
  production_countries: Array<{
    iso_3166_1: string;
    name: string;
  }>;
  created_by: Array<{
    id: number;
    name: string;
  }>;
  tagline: string;
  status: string;
  original_language: string;
  number_of_seasons: number;
  number_of_episodes: number;
};

export type TmdbTvCreditsResponse = {
  cast: Array<{
    id: number;
    name: string;
    character: string;
    profile_path: string | null;
  }>;
  crew: Array<{
    id: number;
    name: string;
    job: string;
    department: string;
  }>;
};

export type TmdbTvAggregateCreditsResponse = {
  cast: Array<{
    id: number;
    name: string;
    profile_path: string | null;
    roles?: Array<{
      character?: string | null;
    }>;
  }>;
  crew: Array<{
    id: number;
    name: string;
    department: string;
    jobs?: Array<{
      job?: string | null;
    }>;
  }>;
};

export type TmdbTvVideosResponse = {
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

export type TmdbTvAlternativeTitlesResponse = {
  id: number;
  results: Array<{
    iso_3166_1: string;
    title: string;
    type: string;
  }>;
};

export type TmdbTvTranslationsResponse = {
  id: number;
  translations: TmdbTranslationEntry[];
};

export type TmdbPersonKnownForItem = {
  id: number;
  media_type: "movie" | "tv";
  title?: string;
  name?: string;
  release_date?: string | null;
  first_air_date?: string | null;
  original_language?: string | null;
  origin_country?: string[] | null;
  poster_path?: string | null;
  vote_average?: number;
};

export type TmdbPerson = {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string;
  popularity: number;
  known_for: TmdbPersonKnownForItem[];
};

export type TmdbPeopleResponse = {
  page: number;
  results: TmdbPerson[];
  total_pages: number;
  total_results: number;
};

export type TmdbPersonDetailsResponse = {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string;
  popularity: number;
  also_known_as: string[];
  homepage: string | null;
};

export type TmdbPersonDetailsWithImagesResponse = TmdbPersonDetailsResponse & {
  images?: {
    profiles: Array<{
      file_path: string | null;
    }>;
  };
};

export type TmdbPersonCombinedCreditsResponse = {
  cast: Array<{
    id: number;
    media_type: "movie" | "tv";
    title?: string;
    name?: string;
    character?: string;
    release_date?: string | null;
    first_air_date?: string | null;
    original_language?: string | null;
    origin_country?: string[] | null;
    poster_path?: string | null;
    vote_average?: number;
  }>;
};

export type TmdbAwardResult = {
  id: string;
  name: string;
  image_url?: string | null;
  year?: number | null;
  category?: string | null;
  event_date?: string | null;
};

export type TmdbAwardsResponse = {
  page?: number;
  results?: TmdbAwardResult[];
};

export type TmdbWatchProvider = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority?: number;
};

export type TmdbWatchProvidersListResponse = {
  results: TmdbWatchProvider[];
};

export type TmdbKeyword = {
  id: number;
  name: string;
};

export type TmdbKeywordSearchResponse = {
  page: number;
  results: TmdbKeyword[];
  total_pages: number;
  total_results: number;
};

export type TmdbCountryResponseItem = {
  iso_3166_1: string;
  english_name: string;
};
