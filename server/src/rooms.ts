import { randomBytes } from 'node:crypto';
import { v4 as uuid } from 'uuid';
import type {
  Assignment,
  Player,
  Room,
  Team,
  Word,
  WordSubmission,
} from '../../shared/types.js';
import { buildCandidatePool } from './decoys.js';
import {
  addAudienceAceAward,
  buildWordResult,
  computeAwards,
  emptyLiveStats,
  type LiveWordStats,
} from './awards.js';

const rooms = new Map<string, Room>();

/** Per-room live stats for the current word */
export const liveWordStats = new Map<string, LiveWordStats>();
/** playerId -> beat-the-AI count this game */
export const audienceBeatCounts = new Map<string, Map<string, number>>();

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(): string {
  let code = '';
  const bytes = randomBytes(5);
  for (let i = 0; i < 5; i++) {
    code += CODE_CHARS[bytes[i]! % CODE_CHARS.length];
  }
  return code;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function deleteRoom(code: string): void {
  const c = code.toUpperCase();
  rooms.delete(c);
  liveWordStats.delete(c);
  audienceBeatCounts.delete(c);
}

export function createRoom(hostName: string): { room: Room; player: Player } {
  let code = generateRoomCode();
  while (rooms.has(code)) code = generateRoomCode();

  const hostId = uuid();
  const teamId = uuid();
  const team: Team = {
    id: teamId,
    name: `${hostName}'s Team`,
    playerIds: [hostId],
    score: 0,
    audienceBonus: 0,
    ready: false,
  };
  const player: Player = { id: hostId, name: hostName.trim(), teamId };

  const room: Room = {
    code,
    hostId,
    teams: [team],
    players: { [hostId]: player },
    turnOrder: [],
    currentTurn: null,
    assignment: null,
    submissions: [],
    draftWords: { [teamId]: [] },
    phase: 'lobby',
    settings: {
      turnDurationSec: 90,
      wordsPerTeam: 5,
      roundsPerTeam: 1,
      aiDifficulty: 'standard',
    },
    completedTurnTeamIds: [],
    usedCandidateTexts: [],
    allWordResults: [],
    awards: [],
    lastTurnResult: null,
  };

  rooms.set(code, room);
  audienceBeatCounts.set(code, new Map());
  return { room, player };
}

export function findPlayerRoom(playerId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.players[playerId]) return room;
  }
  return undefined;
}

export function allTeamsValid(room: Room): boolean {
  if (room.teams.length < 1) return false;
  return room.teams.every(
    (t) => t.playerIds.length >= 2 && t.playerIds.length <= 3,
  );
}

export function roomIsFull(room: Room): boolean {
  const total = Object.keys(room.players).length;
  return total >= 18;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function computeAssignment(teamIds: string[]): Assignment {
  if (teamIds.length === 0) return {};
  if (teamIds.length === 1) {
    return { [teamIds[0]!]: teamIds[0]! };
  }

  for (let attempt = 0; attempt < 200; attempt++) {
    const shuffled = shuffle(teamIds);
    const assignment: Assignment = {};
    let ok = true;
    for (let i = 0; i < teamIds.length; i++) {
      if (teamIds[i] === shuffled[i]) {
        ok = false;
        break;
      }
      assignment[teamIds[i]!] = shuffled[i]!;
    }
    if (ok) return assignment;
  }

  const assignment: Assignment = {};
  for (let i = 0; i < teamIds.length; i++) {
    assignment[teamIds[i]!] = teamIds[(i + 1) % teamIds.length]!;
  }
  return assignment;
}

export function allSubmittedWords(room: Room): Word[] {
  return room.submissions.flatMap((s) => s.words);
}

function currentActorId(turn: NonNullable<Room['currentTurn']>): string {
  if (turn.actorRotation.length === 0) return '';
  return (
    turn.actorRotation[turn.currentWordIndex % turn.actorRotation.length] ?? ''
  );
}

export function resetWordStats(roomCode: string): void {
  liveWordStats.set(roomCode.toUpperCase(), emptyLiveStats());
}

export function recordCurrentWordResult(
  room: Room,
  correct: boolean,
  resolvedAt = Date.now(),
): void {
  const turn = room.currentTurn;
  if (!turn) return;
  const word = turn.assignedWords[turn.currentWordIndex];
  if (!word) return;
  // Already recorded for this index
  if (turn.wordHistory.length > turn.currentWordIndex) return;

  const stats =
    liveWordStats.get(room.code) ??
    emptyLiveStats(turn.wordStartedAt ?? Date.now());
  const result = buildWordResult({
    word,
    actorId: currentActorId(turn),
    teamId: turn.teamId,
    correct,
    stats,
    resolvedAt,
  });
  turn.wordHistory.push(result);
  room.allWordResults.push(result);
}

export function startTurnForTeam(room: Room, teamId: string): void {
  const team = room.teams.find((t) => t.id === teamId);
  if (!team || !room.assignment) return;

  const sourceId = room.assignment[teamId]!;
  const submission = room.submissions.find((s) => s.teamId === sourceId);
  const assignedWords = submission?.words ?? [];

  const used = new Set(room.usedCandidateTexts.map((t) => t.toLowerCase()));

  const first = assignedWords[0];
  const candidatePool = first
    ? buildCandidatePool(first, allSubmittedWords(room), used)
    : [];
  for (const w of candidatePool) used.add(w.text.trim().toLowerCase());
  room.usedCandidateTexts = [...used];

  const now = Date.now();
  room.currentTurn = {
    teamId,
    assignedWords,
    currentWordIndex: 0,
    actorRotation: [...team.playerIds],
    candidatePool,
    aiScores: Object.fromEntries(candidatePool.map((w) => [w.text, 0])),
    startedAt: now,
    wordStartedAt: now,
    durationSec: room.settings.turnDurationSec,
    correctCount: 0,
    status: 'active',
    revealing: false,
    solvedWords: [],
    wordHistory: [],
    audienceGuesses: [],
  };
  room.phase = 'in-round';
  room.lastTurnResult = null;
  resetWordStats(room.code);
}

export function advanceToNextWord(room: Room): void {
  const turn = room.currentTurn;
  if (!turn) return;

  turn.currentWordIndex += 1;
  turn.revealing = false;

  if (turn.currentWordIndex >= turn.assignedWords.length) {
    endTurn(room);
    return;
  }

  const current = turn.assignedWords[turn.currentWordIndex]!;
  const used = new Set(room.usedCandidateTexts.map((t) => t.toLowerCase()));
  turn.candidatePool = buildCandidatePool(
    current,
    allSubmittedWords(room),
    used,
  );
  for (const w of turn.candidatePool) {
    used.add(w.text.trim().toLowerCase());
  }
  room.usedCandidateTexts = [...used];
  turn.aiScores = Object.fromEntries(
    turn.candidatePool.map((w) => [w.text, 0]),
  );
  turn.wordStartedAt = Date.now();
  resetWordStats(room.code);
}

export function endTurn(room: Room): void {
  const turn = room.currentTurn;
  if (!turn || turn.status === 'ended') return;

  // Record timed-out current word if still live and not yet recorded
  if (
    turn.currentWordIndex < turn.assignedWords.length &&
    turn.wordHistory.length === turn.currentWordIndex
  ) {
    recordCurrentWordResult(room, false);
  }

  // Any remaining unstarted words
  while (turn.wordHistory.length < turn.assignedWords.length) {
    const idx = turn.wordHistory.length;
    const word = turn.assignedWords[idx]!;
    const actorId =
      turn.actorRotation[idx % Math.max(1, turn.actorRotation.length)] ?? '';
    const result = buildWordResult({
      word,
      actorId,
      teamId: turn.teamId,
      correct: false,
      stats: emptyLiveStats(),
    });
    turn.wordHistory.push(result);
    room.allWordResults.push(result);
  }

  turn.status = 'ended';
  turn.revealing = false;

  const team = room.teams.find((t) => t.id === turn.teamId);
  if (team) {
    team.score += turn.correctCount;
  }

  room.lastTurnResult = {
    teamId: turn.teamId,
    teamName: team?.name ?? 'Team',
    correctCount: turn.correctCount,
    assignedWords: turn.assignedWords,
    solvedWords: turn.solvedWords,
  };

  if (!room.completedTurnTeamIds.includes(turn.teamId)) {
    room.completedTurnTeamIds.push(turn.teamId);
  }

  room.phase = 'turn-summary';
}

export function continueAfterSummary(room: Room): void {
  const remaining = room.turnOrder.filter(
    (id) => !room.completedTurnTeamIds.includes(id),
  );

  if (remaining.length === 0) {
    room.phase = 'game-over';
    room.currentTurn = null;
    room.awards = computeAwards(room);
    const beats = audienceBeatCounts.get(room.code) ?? new Map();
    addAudienceAceAward(room, beats);
    return;
  }

  startTurnForTeam(room, remaining[0]!);
}

export function removePlayerFromRoom(
  room: Room,
  playerId: string,
): { emptied: boolean; actorChanged: boolean } {
  const player = room.players[playerId];
  if (!player) return { emptied: false, actorChanged: false };

  let actorChanged = false;
  const team = room.teams.find((t) => t.id === player.teamId);
  if (team) {
    team.playerIds = team.playerIds.filter((id) => id !== playerId);
    if (team.playerIds.length === 0) {
      room.teams = room.teams.filter((t) => t.id !== team.id);
      delete room.draftWords[team.id];
      room.submissions = room.submissions.filter((s) => s.teamId !== team.id);
    }
  }

  delete room.players[playerId];

  if (room.hostId === playerId) {
    const next = Object.keys(room.players)[0];
    if (next) room.hostId = next;
  }

  if (
    room.phase === 'in-round' &&
    room.currentTurn?.status === 'active' &&
    room.currentTurn.teamId === player?.teamId
  ) {
    const turn = room.currentTurn;
    turn.actorRotation = turn.actorRotation.filter((id) => room.players[id]);
    if (turn.actorRotation.length === 0) {
      endTurn(room);
      actorChanged = true;
    } else {
      actorChanged = true;
    }
  }

  const emptied = Object.keys(room.players).length === 0;
  if (emptied) deleteRoom(room.code);

  return { emptied, actorChanged };
}

export function finalizeSubmissions(room: Room): void {
  room.submissions = room.teams.map((t) => ({
    teamId: t.id,
    words: [...(room.draftWords[t.id] ?? [])],
  }));

  const teamIds = room.teams.map((t) => t.id);
  room.assignment = computeAssignment(teamIds);
  room.turnOrder = shuffle(teamIds);
  room.completedTurnTeamIds = [];
  room.usedCandidateTexts = [];
  room.allWordResults = [];
  room.awards = [];
  audienceBeatCounts.set(room.code, new Map());
  room.teams.forEach((t) => {
    t.ready = false;
    t.score = 0;
    t.audienceBonus = 0;
  });

  if (room.turnOrder[0]) {
    startTurnForTeam(room, room.turnOrder[0]);
  }
}

export type { WordSubmission };
