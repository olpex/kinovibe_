import { DataSourceStatus } from "@/lib/data-source";

export type MovieCard = {
  id: number;
  title: string;
  year: number;
  genre: string;
  countries: string[];
  runtime: string;
  rating: number;
  progress?: number;
  gradient: [string, string];
  posterUrl?: string;
  backdropUrl?: string;
  overview?: string;
};

export type GenreChip = {
  id: number;
  name: string;
};

export type HomeScreenData = {
  genreChips: GenreChip[];
  trendingNow: MovieCard[];
  continueWatching: MovieCard[];
  topPicks: MovieCard[];
  continueWatchingCaption: string;
  featuredUpdatedAt: string;
  dataSourceStatus: DataSourceStatus;
};

export type HomeSession = {
  isConfigured: boolean;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  isPro: boolean;
  email?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
};
