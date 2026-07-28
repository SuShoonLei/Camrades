import express from 'express';
import { createServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import cors from 'cors';
import { Filter } from 'bad-words';
import { v4 as uuid } from 'uuid';
import type { AiDifficulty, Category, Room, Word } from '../../shared/types.js';
import { CATEGORIES } from '../../shared/types.js';
import {
  allTeamsValid,
  audienceBeatCounts,
  continueAfterSummary,
  createRoom,
  endTurn,
  advanceToNextWord,
  getRoom,
  liveWordStats,
  recordCurrentWordResult,
  removePlayerFromRoom,
  roomIsFull,
  finalizeSubmissions,
} from './rooms.js';
import {
  emptyLiveStats,
  getDifficultyParams,
  updateLiveStats,
} from './awards.js';

const profanity = new Filter();

const CLIENT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

const app = express();
app.use(cors({ origin: CLIENT_ORIGINS }));
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGINS, methods: ['GET', 'POST'] },
});

type SocketData = { playerId?: string; roomCode?: string };

function emitRoom(room: Room): void {
  io.to(room.code).emit('roomState', room);
}

function wordCountOk(text: string): boolean {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  return parts.length >= 1 && parts.length <= 4;
}

io.on('connection', (socket: Socket) => {
  console.log('socket connected:', socket.id);
  const data = socket.data as SocketData;

  socket.on(
    'createRoom',
    (
      payload: { hostName: string },
      ack?: (res: { ok: boolean; error?: string; room?: Room; playerId?: string }) => void,
    ) => {
      const name = payload?.hostName?.trim();
      if (!name) {
        ack?.({ ok: false, error: 'Name is required' });
        return;
      }
      const { room, player } = createRoom(name);
      data.playerId = player.id;
      data.roomCode = room.code;
      void socket.join(room.code);
      ack?.({ ok: true, room, playerId: player.id });
      emitRoom(room);
    },
  );

  socket.on(
    'joinRoom',
    (
      payload: { code: string; playerName: string },
      ack?: (res: { ok: boolean; error?: string; room?: Room; playerId?: string }) => void,
    ) => {
      const code = payload?.code?.trim().toUpperCase();
      const name = payload?.playerName?.trim();
      if (!code || !name) {
        ack?.({ ok: false, error: 'Room code and name are required' });
        return;
      }
      const room = getRoom(code);
      if (!room) {
        ack?.({ ok: false, error: 'Room not found' });
        return;
      }
      if (room.phase !== 'lobby') {
        ack?.({ ok: false, error: 'Game already started' });
        return;
      }
      if (roomIsFull(room)) {
        ack?.({ ok: false, error: 'Room is full' });
        return;
      }

      // Auto-place on a team with space, or create a new team
      let team = room.teams.find((t) => t.playerIds.length < 3);
      if (!team) {
        const teamId = uuid();
        team = {
          id: teamId,
          name: `${name}'s Team`,
          playerIds: [],
          score: 0,
          audienceBonus: 0,
          ready: false,
        };
        room.teams.push(team);
        room.draftWords[teamId] = [];
      }

      const playerId = uuid();
      room.players[playerId] = { id: playerId, name, teamId: team.id };
      team.playerIds.push(playerId);

      data.playerId = playerId;
      data.roomCode = room.code;
      void socket.join(room.code);
      ack?.({ ok: true, room, playerId });
      emitRoom(room);
    },
  );

  socket.on(
    'createTeam',
    (
      payload: { roomCode: string; teamName: string },
      ack?: (res: { ok: boolean; error?: string }) => void,
    ) => {
      const room = getRoom(payload?.roomCode);
      const playerId = data.playerId;
      if (!room || !playerId || !room.players[playerId]) {
        ack?.({ ok: false, error: 'Not in a room' });
        return;
      }
      if (room.phase !== 'lobby') {
        ack?.({ ok: false, error: 'Game already started' });
        return;
      }

      const player = room.players[playerId]!;
      const oldTeam = room.teams.find((t) => t.id === player.teamId);
      if (oldTeam) {
        oldTeam.playerIds = oldTeam.playerIds.filter((id) => id !== playerId);
        if (oldTeam.playerIds.length === 0) {
          room.teams = room.teams.filter((t) => t.id !== oldTeam.id);
          delete room.draftWords[oldTeam.id];
        }
      }

      const teamName = payload.teamName?.trim() || `${player.name}'s Team`;
      const teamId = uuid();
      room.teams.push({
        id: teamId,
        name: teamName,
        playerIds: [playerId],
        score: 0,
        audienceBonus: 0,
        ready: false,
      });
      room.draftWords[teamId] = [];
      player.teamId = teamId;

      ack?.({ ok: true });
      emitRoom(room);
    },
  );

  socket.on(
    'joinTeam',
    (
      payload: { roomCode: string; teamId: string },
      ack?: (res: { ok: boolean; error?: string }) => void,
    ) => {
      const room = getRoom(payload?.roomCode);
      const playerId = data.playerId;
      if (!room || !playerId || !room.players[playerId]) {
        ack?.({ ok: false, error: 'Not in a room' });
        return;
      }
      if (room.phase !== 'lobby') {
        ack?.({ ok: false, error: 'Game already started' });
        return;
      }

      const team = room.teams.find((t) => t.id === payload.teamId);
      if (!team) {
        ack?.({ ok: false, error: 'Team not found' });
        return;
      }
      if (team.playerIds.length >= 3) {
        ack?.({ ok: false, error: 'Team is full (max 3)' });
        return;
      }

      const player = room.players[playerId]!;
      if (player.teamId === team.id) {
        ack?.({ ok: true });
        return;
      }

      const oldTeam = room.teams.find((t) => t.id === player.teamId);
      if (oldTeam) {
        oldTeam.playerIds = oldTeam.playerIds.filter((id) => id !== playerId);
        if (oldTeam.playerIds.length === 0) {
          room.teams = room.teams.filter((t) => t.id !== oldTeam.id);
          delete room.draftWords[oldTeam.id];
        }
      }

      team.playerIds.push(playerId);
      player.teamId = team.id;
      ack?.({ ok: true });
      emitRoom(room);
    },
  );

  socket.on(
    'setDifficulty',
    (
      payload: { roomCode: string; aiDifficulty: AiDifficulty },
      ack?: (res: { ok: boolean; error?: string }) => void,
    ) => {
      const room = getRoom(payload?.roomCode);
      const playerId = data.playerId;
      if (!room || !playerId) {
        ack?.({ ok: false, error: 'Not in a room' });
        return;
      }
      if (room.hostId !== playerId) {
        ack?.({ ok: false, error: 'Only the host can set difficulty' });
        return;
      }
      if (room.phase !== 'lobby') {
        ack?.({ ok: false, error: 'Can only change difficulty in lobby' });
        return;
      }
      const d = payload.aiDifficulty;
      if (d !== 'rookie' && d !== 'standard' && d !== 'veteran') {
        ack?.({ ok: false, error: 'Invalid difficulty' });
        return;
      }
      room.settings.aiDifficulty = d;
      ack?.({ ok: true });
      emitRoom(room);
    },
  );

  socket.on(
    'startGame',
    (
      payload: { roomCode: string },
      ack?: (res: { ok: boolean; error?: string }) => void,
    ) => {
      const room = getRoom(payload?.roomCode);
      const playerId = data.playerId;
      if (!room || !playerId) {
        ack?.({ ok: false, error: 'Not in a room' });
        return;
      }
      if (room.hostId !== playerId) {
        ack?.({ ok: false, error: 'Only the host can start' });
        return;
      }
      if (!allTeamsValid(room)) {
        ack?.({
          ok: false,
          error: 'Every team needs 2–3 players before starting',
        });
        return;
      }

      room.phase = 'submitting';
      for (const t of room.teams) {
        t.ready = false;
        if (!room.draftWords[t.id]) room.draftWords[t.id] = [];
      }
      ack?.({ ok: true });
      emitRoom(room);
    },
  );

  // ——— Phase 2: word submission ———

  socket.on(
    'updateDraftWords',
    (
      payload: { roomCode: string; words: Word[] },
      ack?: (res: { ok: boolean; error?: string }) => void,
    ) => {
      const room = getRoom(payload?.roomCode);
      const playerId = data.playerId;
      if (!room || !playerId || !room.players[playerId]) {
        ack?.({ ok: false, error: 'Not in a room' });
        return;
      }
      if (room.phase !== 'submitting') {
        ack?.({ ok: false, error: 'Not in submission phase' });
        return;
      }

      const player = room.players[playerId]!;
      const team = room.teams.find((t) => t.id === player.teamId);
      if (!team) {
        ack?.({ ok: false, error: 'No team' });
        return;
      }
      if (team.ready) {
        ack?.({ ok: false, error: 'Team is already ready' });
        return;
      }

      const words = payload.words ?? [];
      if (words.length > room.settings.wordsPerTeam) {
        ack?.({ ok: false, error: `Max ${room.settings.wordsPerTeam} words` });
        return;
      }

      for (const w of words) {
        if (!w.text?.trim() || !wordCountOk(w.text)) {
          ack?.({
            ok: false,
            error: 'Each entry must be 1–4 words (no empty strings)',
          });
          return;
        }
        if (!CATEGORIES.includes(w.category as Category)) {
          ack?.({ ok: false, error: 'Invalid category' });
          return;
        }
        if (profanity.isProfane(w.text)) {
          ack?.({
            ok: false,
            error: `"${w.text}" contains language we can't use — try another word`,
          });
          return;
        }
      }

      room.draftWords[team.id] = words.map((w) => ({
        text: w.text.trim(),
        category: w.category,
      }));
      ack?.({ ok: true });
      emitRoom(room);
    },
  );

  socket.on(
    'setTeamReady',
    (
      payload: { roomCode: string; ready: boolean },
      ack?: (res: { ok: boolean; error?: string }) => void,
    ) => {
      const room = getRoom(payload?.roomCode);
      const playerId = data.playerId;
      if (!room || !playerId || !room.players[playerId]) {
        ack?.({ ok: false, error: 'Not in a room' });
        return;
      }
      if (room.phase !== 'submitting') {
        ack?.({ ok: false, error: 'Not in submission phase' });
        return;
      }

      const player = room.players[playerId]!;
      const team = room.teams.find((t) => t.id === player.teamId);
      if (!team) {
        ack?.({ ok: false, error: 'No team' });
        return;
      }

      const draft = room.draftWords[team.id] ?? [];
      if (payload.ready) {
        if (draft.length !== room.settings.wordsPerTeam) {
          ack?.({
            ok: false,
            error: `Need exactly ${room.settings.wordsPerTeam} words before ready`,
          });
          return;
        }
        for (const w of draft) {
          if (!wordCountOk(w.text) || profanity.isProfane(w.text)) {
            ack?.({ ok: false, error: 'Fix invalid words before ready' });
            return;
          }
        }
      }

      team.ready = Boolean(payload.ready);
      ack?.({ ok: true });

      if (room.teams.every((t) => t.ready)) {
        finalizeSubmissions(room);
        startTurnTimer(room.code);
      }
      emitRoom(room);
    },
  );

  // ——— Phase 4 / 6 / 7: turn, AI scores, audience ———

  socket.on(
    'aiScores',
    (payload: { roomCode: string; scores: Record<string, number> }) => {
      const room = getRoom(payload?.roomCode);
      const playerId = data.playerId;
      if (!room || !playerId || !room.currentTurn) return;
      if (room.phase !== 'in-round' || room.currentTurn.status !== 'active')
        return;
      if (room.currentTurn.revealing) return;

      const turn = room.currentTurn;
      const actorId =
        turn.actorRotation[
          turn.currentWordIndex % turn.actorRotation.length
        ];
      if (playerId !== actorId) return;

      turn.aiScores = payload.scores ?? {};
      io.to(room.code).emit('aiScoresUpdate', {
        scores: turn.aiScores,
        wordIndex: turn.currentWordIndex,
      });

      const trueWord = turn.assignedWords[turn.currentWordIndex];
      if (!trueWord) return;

      let stats = liveWordStats.get(room.code);
      if (!stats) {
        stats = emptyLiveStats(turn.wordStartedAt ?? Date.now());
        liveWordStats.set(room.code, stats);
      }
      updateLiveStats(stats, turn.aiScores, trueWord.text);

      const { threshold, holdTicks } = getDifficultyParams(
        room.settings.aiDifficulty,
      );

      const entries = Object.entries(turn.aiScores);
      if (entries.length === 0) return;
      const sorted = [...entries].sort((a, b) => b[1]! - a[1]!);
      const [topLabel, topScore] = sorted[0]!;
      const isMatch = topLabel === trueWord.text && topScore >= threshold;
      const hk = holdKey(room.code, turn.currentWordIndex);

      if (isMatch) {
        const next = (holdCounts.get(hk) ?? 0) + 1;
        holdCounts.set(hk, next);
        if (next >= holdTicks) {
          holdCounts.delete(hk);
          const resolvedAt = Date.now();
          turn.correctCount += 1;
          turn.solvedWords.push(trueWord);
          turn.revealing = true;

          recordCurrentWordResult(room, true, resolvedAt);

          // Mark audience guesses that beat the AI
          const beatToasts: Array<{
            playerName: string;
            teamName: string;
            marginSec: number;
          }> = [];
          for (const g of turn.audienceGuesses) {
            if (g.wordIndex !== turn.currentWordIndex) continue;
            if (g.correct && g.submittedAt < resolvedAt) {
              g.beatTheAI = true;
              const guessTeam = room.teams.find((t) => t.id === g.teamId);
              if (guessTeam) guessTeam.audienceBonus += 1;
              const beats = audienceBeatCounts.get(room.code) ?? new Map();
              beats.set(g.playerId, (beats.get(g.playerId) ?? 0) + 1);
              audienceBeatCounts.set(room.code, beats);
              beatToasts.push({
                playerName: room.players[g.playerId]?.name ?? 'Someone',
                teamName: guessTeam?.name ?? 'a team',
                marginSec: (resolvedAt - g.submittedAt) / 1000,
              });
            }
          }

          emitRoom(room);
          io.to(room.code).emit('wordSolved', {
            word: trueWord,
            correctCount: turn.correctCount,
          });
          for (const t of beatToasts) {
            io.to(room.code).emit('audienceBeat', t);
          }

          setTimeout(() => {
            const r = getRoom(room.code);
            if (!r?.currentTurn || r.currentTurn.status !== 'active') return;
            advanceToNextWord(r);
            emitRoom(r);
            if (r.phase === 'turn-summary') {
              clearTurnTimer(room.code);
            }
          }, 1500);
        }
      } else {
        holdCounts.set(hk, 0);
      }
    },
  );

  socket.on(
    'audienceGuess',
    (
      payload: { roomCode: string; wordIndex: number; guessText: string },
      ack?: (res: { ok: boolean; error?: string }) => void,
    ) => {
      const room = getRoom(payload?.roomCode);
      const playerId = data.playerId;
      if (!room || !playerId || !room.players[playerId]) {
        ack?.({ ok: false, error: 'Not in a room' });
        return;
      }
      const turn = room.currentTurn;
      if (
        !turn ||
        room.phase !== 'in-round' ||
        turn.status !== 'active' ||
        turn.revealing
      ) {
        ack?.({ ok: false, error: 'No live word to guess' });
        return;
      }
      if (payload.wordIndex !== turn.currentWordIndex) {
        ack?.({ ok: false, error: 'Stale word index' });
        return;
      }

      const player = room.players[playerId]!;
      if (player.teamId === turn.teamId) {
        ack?.({ ok: false, error: 'Performing team cannot audience-guess' });
        return;
      }

      const already = turn.audienceGuesses.some(
        (g) => g.playerId === playerId && g.wordIndex === payload.wordIndex,
      );
      if (already) {
        ack?.({ ok: false, error: 'Already guessed this word' });
        return;
      }

      const guessText = (payload.guessText ?? '').trim();
      if (!guessText) {
        ack?.({ ok: false, error: 'Empty guess' });
        return;
      }

      const trueWord = turn.assignedWords[turn.currentWordIndex];
      if (!trueWord) {
        ack?.({ ok: false, error: 'No word' });
        return;
      }

      const correct =
        guessText.toLowerCase() === trueWord.text.trim().toLowerCase();

      turn.audienceGuesses.push({
        wordIndex: turn.currentWordIndex,
        playerId,
        teamId: player.teamId,
        guessText,
        submittedAt: Date.now(),
        correct,
        beatTheAI: false,
      });

      ack?.({ ok: true });
      // Don't broadcast full room (would leak correctness); emit ack-only.
      // Soft update without revealing guess correctness to others:
      io.to(room.code).emit('audienceGuessPlaced', {
        playerId,
        wordIndex: turn.currentWordIndex,
      });
    },
  );

  socket.on(
    'continueAfterSummary',
    (
      payload: { roomCode: string },
      ack?: (res: { ok: boolean; error?: string }) => void,
    ) => {
      const room = getRoom(payload?.roomCode);
      const playerId = data.playerId;
      if (!room || !playerId) {
        ack?.({ ok: false, error: 'Not in a room' });
        return;
      }
      if (room.phase !== 'turn-summary') {
        ack?.({ ok: false, error: 'Not in summary' });
        return;
      }
      continueAfterSummary(room);
      startTurnTimer(room.code);
      ack?.({ ok: true });
      emitRoom(room);
    },
  );

  socket.on('disconnect', () => {
    console.log('socket disconnected:', socket.id);
    const playerId = data.playerId;
    const code = data.roomCode;
    if (!playerId || !code) return;
    const room = getRoom(code);
    if (!room) return;

    const { emptied } = removePlayerFromRoom(room, playerId);
    if (!emptied) {
      emitRoom(room);
      if (room.phase === 'turn-summary' || room.phase === 'game-over') {
        // leave timer alone
      } else if (room.phase !== 'in-round') {
        clearTurnTimer(code);
      }
    } else {
      clearTurnTimer(code);
    }
  });

  // Re-sync helper
  socket.on('requestRoomState', (payload: { roomCode: string }) => {
    const room = getRoom(payload?.roomCode);
    if (room) socket.emit('roomState', room);
  });
});

const turnTimers = new Map<string, ReturnType<typeof setInterval>>();
const holdCounts = new Map<string, number>();

function holdKey(code: string, wordIndex: number): string {
  return `${code}:${wordIndex}`;
}

function clearTurnTimer(code: string): void {
  const t = turnTimers.get(code);
  if (t) clearInterval(t);
  turnTimers.delete(code);
}

function startTurnTimer(code: string): void {
  clearTurnTimer(code);
  const room = getRoom(code);
  if (!room?.currentTurn || room.currentTurn.status !== 'active') return;

  const turn = room.currentTurn;
  turn.startedAt = turn.startedAt ?? Date.now();

  const tick = setInterval(() => {
    const r = getRoom(code);
    if (!r?.currentTurn || r.currentTurn.status !== 'active') {
      clearInterval(tick);
      turnTimers.delete(code);
      return;
    }
    const elapsed = Date.now() - (r.currentTurn.startedAt ?? Date.now());
    const left = Math.max(
      0,
      Math.ceil(r.currentTurn.durationSec - elapsed / 1000),
    );
    io.to(code).emit('timerTick', { secondsLeft: left });
    if (left <= 0) {
      clearInterval(tick);
      turnTimers.delete(code);
      endTurn(r);
      emitRoom(r);
    }
  }, 1000);

  turnTimers.set(code, tick);
}

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`Gesture Charades server listening on http://localhost:${PORT}`);
});
