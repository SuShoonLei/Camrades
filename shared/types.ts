export type Category =
  | 'Movies'
  | 'Animals'
  | 'Actions'
  | 'Everyday Objects'
  | 'Occupations';

export const CATEGORIES: Category[] = [
  'Movies',
  'Animals',
  'Actions',
  'Everyday Objects',
  'Occupations',
];

export type AiDifficulty = 'rookie' | 'standard' | 'veteran';

export const AI_NAME = 'Gawk';

export type Player = {
  id: string;
  name: string;
  teamId: string;
};

export type Team = {
  id: string;
  name: string;
  playerIds: string[]; // 2 or 3
  score: number;
  /** Bonus points from beating the AI as audience (separate track) */
  audienceBonus: number;
  ready: boolean;
};

export type Word = { text: string; category: Category };

export type WordSubmission = {
  teamId: string;
  words: Word[]; // length = settings.wordsPerTeam
};

/** performingTeamId -> sourceTeamId whose list they act out. No key equals its value (except 1-team practice). */
export type Assignment = Record<string, string>;

export type WordResult = {
  word: Word;
  actorId: string;
  teamId: string;
  correct: boolean;
  timeToSolveSec: number | null;
  peakTrueScore: number;
  guessFlips: number;
};

export type AudienceGuess = {
  wordIndex: number;
  playerId: string;
  teamId: string;
  guessText: string;
  submittedAt: number;
  correct: boolean;
  beatTheAI: boolean;
};

export type Turn = {
  teamId: string;
  assignedWords: Word[];
  currentWordIndex: number;
  actorRotation: string[];
  candidatePool: Word[];
  aiScores: Record<string, number>;
  startedAt: number | null;
  /** when the current word became live (for timeToSolveSec) */
  wordStartedAt: number | null;
  durationSec: number;
  correctCount: number;
  status: 'waiting' | 'active' | 'ended';
  revealing: boolean;
  solvedWords: Word[];
  wordHistory: WordResult[];
  audienceGuesses: AudienceGuess[];
};

export type RoomPhase =
  | 'lobby'
  | 'submitting'
  | 'in-round'
  | 'turn-summary'
  | 'game-over';

export type RoomSettings = {
  turnDurationSec: number;
  wordsPerTeam: number;
  roundsPerTeam: number;
  aiDifficulty: AiDifficulty;
};

export type GameAward = {
  id: 'fastest' | 'confusing' | 'stone-cold' | 'audience-ace';
  title: string;
  detail: string;
  playerName?: string;
  teamName?: string;
  wordText?: string;
};

export type Room = {
  code: string;
  hostId: string;
  teams: Team[];
  players: Record<string, Player>;
  turnOrder: string[];
  currentTurn: Turn | null;
  assignment: Assignment | null;
  submissions: WordSubmission[];
  draftWords: Record<string, Word[]>;
  phase: RoomPhase;
  settings: RoomSettings;
  completedTurnTeamIds: string[];
  usedCandidateTexts: string[];
  /** Aggregated WordResults across all turns this game */
  allWordResults: WordResult[];
  awards: GameAward[];
  lastTurnResult: {
    teamId: string;
    teamName: string;
    correctCount: number;
    assignedWords: Word[];
    solvedWords: Word[];
  } | null;
};

export type PublicRoom = Room;

export const DIFFICULTY_CONFIG: Record<
  AiDifficulty,
  { threshold: number; holdTicks: number; label: string; blurb: string }
> = {
  rookie: {
    threshold: 0.45,
    holdTicks: 1,
    label: 'Rookie',
    blurb: 'Forgiving — Gawk commits faster',
  },
  standard: {
    threshold: 0.55,
    holdTicks: 2,
    label: 'Standard',
    blurb: 'Balanced default',
  },
  veteran: {
    threshold: 0.65,
    holdTicks: 3,
    label: 'Veteran',
    blurb: 'Needs sustained clarity',
  },
};
