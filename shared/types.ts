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
  ready: boolean;
};

export type Word = { text: string; category: Category };

export type WordSubmission = {
  teamId: string;
  words: Word[]; // length = settings.wordsPerTeam
};

/** performingTeamId -> sourceTeamId whose list they act out. No key equals its value (except 1-team practice). */
export type Assignment = Record<string, string>;

export type Turn = {
  teamId: string;
  assignedWords: Word[];
  currentWordIndex: number;
  actorRotation: string[];
  candidatePool: Word[];
  aiScores: Record<string, number>;
  startedAt: number | null;
  durationSec: number;
  correctCount: number;
  status: 'waiting' | 'active' | 'ended';
  /** true while showing the brief correct reveal */
  revealing: boolean;
  /** words already revealed as correct this turn */
  solvedWords: Word[];
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
};

export type Room = {
  code: string;
  hostId: string;
  teams: Team[];
  /** flat player lookup by id */
  players: Record<string, Player>;
  turnOrder: string[];
  currentTurn: Turn | null;
  assignment: Assignment | null;
  submissions: WordSubmission[];
  /** in-progress draft lists during submitting phase */
  draftWords: Record<string, Word[]>;
  phase: RoomPhase;
  settings: RoomSettings;
  /** team ids that have completed a turn this round */
  completedTurnTeamIds: string[];
  /** candidate texts used in pools this game (to avoid decoy repeats) */
  usedCandidateTexts: string[];
  lastTurnResult: {
    teamId: string;
    teamName: string;
    correctCount: number;
    assignedWords: Word[];
    solvedWords: Word[];
  } | null;
};

export type PublicRoom = Room;
