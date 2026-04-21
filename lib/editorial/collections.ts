import { toIntlLocale, type Locale } from "@/lib/i18n/shared";
import type { MovieDiscoverFilters } from "@/lib/tmdb/movie-filters";

export type EditorialCollection = {
  slug: string;
  titleKey: string;
  subtitleKey: string;
  rationaleKey: string;
  filters: MovieDiscoverFilters;
};

const BASE_FILTERS: Pick<MovieDiscoverFilters, "includeAdult" | "includeVideo"> = {
  includeAdult: false,
  includeVideo: false
};

export const EDITORIAL_COLLECTIONS = [
  {
    slug: "watch-tonight",
    titleKey: "collections.watchTonight.title",
    subtitleKey: "collections.watchTonight.subtitle",
    rationaleKey: "collections.watchTonight.rationale",
    filters: {
      ...BASE_FILTERS,
      sortBy: "popularity.desc",
      genreIds: [],
      ratingFrom: 6.4,
      ratingTo: undefined,
      voteCountFrom: 150,
      runtimeFrom: undefined,
      runtimeTo: 135
    }
  },
  {
    slug: "short-movies-under-95",
    titleKey: "collections.shortMovies.title",
    subtitleKey: "collections.shortMovies.subtitle",
    rationaleKey: "collections.shortMovies.rationale",
    filters: {
      ...BASE_FILTERS,
      sortBy: "popularity.desc",
      genreIds: [],
      ratingFrom: 6,
      ratingTo: undefined,
      voteCountFrom: 80,
      runtimeFrom: undefined,
      runtimeTo: 95
    }
  },
  {
    slug: "family-night",
    titleKey: "collections.familyNight.title",
    subtitleKey: "collections.familyNight.subtitle",
    rationaleKey: "collections.familyNight.rationale",
    filters: {
      ...BASE_FILTERS,
      sortBy: "popularity.desc",
      genreIds: [10751],
      ratingFrom: 6,
      ratingTo: undefined,
      voteCountFrom: 80,
      runtimeFrom: undefined,
      runtimeTo: 140
    }
  },
  {
    slug: "smart-thrillers",
    titleKey: "collections.smartThrillers.title",
    subtitleKey: "collections.smartThrillers.subtitle",
    rationaleKey: "collections.smartThrillers.rationale",
    filters: {
      ...BASE_FILTERS,
      sortBy: "vote_average.desc",
      genreIds: [53],
      ratingFrom: 6.8,
      ratingTo: undefined,
      voteCountFrom: 500,
      runtimeFrom: undefined,
      runtimeTo: 160
    }
  },
  {
    slug: "science-fiction-starters",
    titleKey: "collections.scifi.title",
    subtitleKey: "collections.scifi.subtitle",
    rationaleKey: "collections.scifi.rationale",
    filters: {
      ...BASE_FILTERS,
      sortBy: "popularity.desc",
      genreIds: [878],
      ratingFrom: 6.3,
      ratingTo: undefined,
      voteCountFrom: 120,
      runtimeFrom: undefined,
      runtimeTo: 155
    }
  },
  {
    slug: "hidden-animation",
    titleKey: "collections.animation.title",
    subtitleKey: "collections.animation.subtitle",
    rationaleKey: "collections.animation.rationale",
    filters: {
      ...BASE_FILTERS,
      sortBy: "vote_average.desc",
      genreIds: [16],
      ratingFrom: 6.7,
      ratingTo: undefined,
      voteCountFrom: 120,
      runtimeFrom: undefined,
      runtimeTo: 125
    }
  }
] satisfies EditorialCollection[];

export function getEditorialCollection(slug: string): EditorialCollection | undefined {
  return EDITORIAL_COLLECTIONS.find((collection) => collection.slug === slug);
}

export function getCollectionCanonicalPath(collection: EditorialCollection): `/collections/${string}` {
  return `/collections/${collection.slug}`;
}

export function getCollectionsUpdatedLabel(locale: Locale): string {
  const formatter = new Intl.DateTimeFormat(toIntlLocale(locale), {
    month: "long",
    year: "numeric"
  });
  return formatter.format(new Date());
}
