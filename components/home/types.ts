export type MovieCard = {
  id: number;
  title: string;
  year: number;
  genre: string;
  runtime: string;
  rating: number;
  progress?: number;
  gradient: [string, string];
  posterUrl?: string;
  backdropUrl?: string;
  overview?: string;
};

export type HomeScreenData = {
  genreChips: string[];
  trendingNow: MovieCard[];
  continueWatching: MovieCard[];
  topPicks: MovieCard[];
  continueWatchingCaption: string;
};

export type HomeSession = {
  isConfigured: boolean;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  email?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
};
