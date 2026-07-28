import type {
  AiDifficulty,
  GameAward,
  Room,
} from '../../shared/types.js';
import { DIFFICULTY_CONFIG } from '../../shared/types.js';

export function getDifficultyParams(d: AiDifficulty) {
  return DIFFICULTY_CONFIG[d] ?? DIFFICULTY_CONFIG.standard;
}

export function computeAwards(room: Room): GameAward[] {
  const results = room.allWordResults;
  const awards: GameAward[] = [];
  const threshold = getDifficultyParams(room.settings.aiDifficulty).threshold;

  const playerName = (id: string) => room.players[id]?.name ?? 'Someone';
  const teamName = (id: string) =>
    room.teams.find((t) => t.id === id)?.name ?? 'a team';

  const solved = results.filter(
    (r) => r.correct && r.timeToSolveSec != null,
  );
  if (solved.length > 0) {
    const best = [...solved].sort(
      (a, b) => (a.timeToSolveSec ?? 99) - (b.timeToSolveSec ?? 99),
    )[0]!;
    awards.push({
      id: 'fastest',
      title: 'Fastest Read',
      detail: `${playerName(best.actorId)} sold “${best.word.text}” in ${best.timeToSolveSec!.toFixed(1)}s`,
      playerName: playerName(best.actorId),
      teamName: teamName(best.teamId),
      wordText: best.word.text,
    });
  }

  const confusing = results.filter((r) => r.correct && r.guessFlips >= 2);
  if (confusing.length > 0) {
    const best = [...confusing].sort((a, b) => b.guessFlips - a.guessFlips)[0]!;
    awards.push({
      id: 'confusing',
      title: 'Most Confusing',
      detail: `“${best.word.text}” by ${playerName(best.actorId)} flipped Gawk ${best.guessFlips}×`,
      playerName: playerName(best.actorId),
      teamName: teamName(best.teamId),
      wordText: best.word.text,
    });
  }

  const stone = results.filter(
    (r) => !r.correct && r.peakTrueScore < threshold - 0.15,
  );
  if (stone.length > 0) {
    const best = [...stone].sort(
      (a, b) => a.peakTrueScore - b.peakTrueScore,
    )[0]!;
    awards.push({
      id: 'stone-cold',
      title: 'Stone Cold',
      detail: `“${best.word.text}” left Gawk cold (peak ${(best.peakTrueScore * 100).toFixed(0)}%)`,
      playerName: playerName(best.actorId),
      teamName: teamName(best.teamId),
      wordText: best.word.text,
    });
  }

  return awards;
}

export function addAudienceAceAward(
  room: Room,
  beatCounts: Map<string, number>,
): void {
  if (beatCounts.size === 0) return;
  let bestId = '';
  let bestCount = 0;
  for (const [id, n] of beatCounts) {
    if (n > bestCount) {
      bestCount = n;
      bestId = id;
    }
  }
  if (bestCount < 1 || !bestId) return;
  const player = room.players[bestId];
  const team = room.teams.find((t) => t.id === player?.teamId);
  room.awards.push({
    id: 'audience-ace',
    title: 'Audience Ace',
    detail: `${player?.name ?? 'Someone'} beat Gawk ${bestCount}× for ${team?.name ?? 'their team'}`,
    playerName: player?.name,
    teamName: team?.name,
  });
}

export type LiveWordStats = {
  peakTrueScore: number;
  guessFlips: number;
  lastLeading: string | null;
  wordStartedAt: number;
};

export function emptyLiveStats(now = Date.now()): LiveWordStats {
  return {
    peakTrueScore: 0,
    guessFlips: 0,
    lastLeading: null,
    wordStartedAt: now,
  };
}

export function updateLiveStats(
  stats: LiveWordStats,
  scores: Record<string, number>,
  trueText: string,
): void {
  const trueScore = scores[trueText] ?? 0;
  if (trueScore > stats.peakTrueScore) stats.peakTrueScore = trueScore;

  const entries = Object.entries(scores);
  if (entries.length === 0) return;
  const leading = [...entries].sort((a, b) => b[1]! - a[1]!)[0]![0]!;
  if (stats.lastLeading != null && stats.lastLeading !== leading) {
    stats.guessFlips += 1;
  }
  stats.lastLeading = leading;
}

export function buildWordResult(args: {
  word: { text: string; category: import('../../shared/types.js').Category };
  actorId: string;
  teamId: string;
  correct: boolean;
  stats: LiveWordStats;
  resolvedAt?: number;
}): import('../../shared/types.js').WordResult {
  const timeToSolveSec = args.correct
    ? ((args.resolvedAt ?? Date.now()) - args.stats.wordStartedAt) / 1000
    : null;
  return {
    word: args.word,
    actorId: args.actorId,
    teamId: args.teamId,
    correct: args.correct,
    timeToSolveSec,
    peakTrueScore: args.stats.peakTrueScore,
    guessFlips: args.stats.guessFlips,
  };
}
