import { MovieCard } from "./types";

export const genreChips = [
  "Action",
  "Sci-Fi",
  "Drama",
  "Thriller",
  "Animation",
  "Comedy",
  "Mystery",
  "Fantasy"
];

export const trendingNow: MovieCard[] = [
  {
    id: 1001,
    title: "Solar Drift",
    year: 2025,
    genre: "Sci-Fi",
    runtime: "2h 04m",
    rating: 8.6,
    gradient: ["#3A0CA3", "#4CC9F0"]
  },
  {
    id: 1002,
    title: "Echo Unit",
    year: 2026,
    genre: "Action",
    runtime: "1h 52m",
    rating: 7.9,
    gradient: ["#9D0208", "#FFBA08"]
  },
  {
    id: 1003,
    title: "Quiet Orbit",
    year: 2024,
    genre: "Drama",
    runtime: "2h 16m",
    rating: 8.1,
    gradient: ["#1B4332", "#95D5B2"]
  },
  {
    id: 1004,
    title: "Neon Harbor",
    year: 2026,
    genre: "Thriller",
    runtime: "1h 47m",
    rating: 7.8,
    gradient: ["#03045E", "#00B4D8"]
  },
  {
    id: 1005,
    title: "Paper Moonline",
    year: 2025,
    genre: "Mystery",
    runtime: "2h 02m",
    rating: 8.3,
    gradient: ["#6A040F", "#F48C06"]
  }
];

export const continueWatching: MovieCard[] = [
  {
    id: 2001,
    title: "Skyline 71",
    year: 2025,
    genre: "Action",
    runtime: "1h 59m",
    rating: 7.6,
    progress: 72,
    gradient: ["#7209B7", "#F72585"]
  },
  {
    id: 2002,
    title: "Lantern City",
    year: 2024,
    genre: "Mystery",
    runtime: "2h 09m",
    rating: 8.0,
    progress: 39,
    gradient: ["#0A9396", "#94D2BD"]
  },
  {
    id: 2003,
    title: "Arctic Signal",
    year: 2026,
    genre: "Thriller",
    runtime: "1h 44m",
    rating: 7.7,
    progress: 54,
    gradient: ["#005F73", "#EE9B00"]
  }
];

export const topPicks: MovieCard[] = [
  {
    id: 3001,
    title: "Atlas of Fire",
    year: 2025,
    genre: "Fantasy",
    runtime: "2h 22m",
    rating: 8.4,
    gradient: ["#6D4C41", "#FF7043"]
  },
  {
    id: 3002,
    title: "Static Bloom",
    year: 2026,
    genre: "Sci-Fi",
    runtime: "1h 56m",
    rating: 8.2,
    gradient: ["#1D3557", "#A8DADC"]
  },
  {
    id: 3003,
    title: "Shoreline Trial",
    year: 2024,
    genre: "Drama",
    runtime: "2h 11m",
    rating: 7.9,
    gradient: ["#8D0801", "#FAA307"]
  },
  {
    id: 3004,
    title: "Wired Summer",
    year: 2025,
    genre: "Comedy",
    runtime: "1h 43m",
    rating: 7.4,
    gradient: ["#2A9D8F", "#E9C46A"]
  }
];
