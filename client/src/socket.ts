import { io, type Socket } from 'socket.io-client';
import type { Room, Word } from '@shared/types';

const URL =
  import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

export const socket: Socket = io(URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('connected');
});

socket.on('disconnect', () => {
  console.log('disconnected');
});

type Ack<T> = (res: T) => void;

export function createRoom(
  hostName: string,
): Promise<{ ok: boolean; error?: string; room?: Room; playerId?: string }> {
  return new Promise((resolve) => {
    socket.emit('createRoom', { hostName }, resolve as Ack<unknown>);
  });
}

export function joinRoom(
  code: string,
  playerName: string,
): Promise<{ ok: boolean; error?: string; room?: Room; playerId?: string }> {
  return new Promise((resolve) => {
    socket.emit('joinRoom', { code, playerName }, resolve as Ack<unknown>);
  });
}

export function createTeam(roomCode: string, teamName: string) {
  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    socket.emit('createTeam', { roomCode, teamName }, resolve);
  });
}

export function joinTeam(roomCode: string, teamId: string) {
  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    socket.emit('joinTeam', { roomCode, teamId }, resolve);
  });
}

export function startGame(roomCode: string) {
  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    socket.emit('startGame', { roomCode }, resolve);
  });
}

export function updateDraftWords(roomCode: string, words: Word[]) {
  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    socket.emit('updateDraftWords', { roomCode, words }, resolve);
  });
}

export function setTeamReady(roomCode: string, ready: boolean) {
  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    socket.emit('setTeamReady', { roomCode, ready }, resolve);
  });
}

export function sendAiScores(
  roomCode: string,
  scores: Record<string, number>,
) {
  socket.emit('aiScores', { roomCode, scores });
}

export function continueAfterSummary(roomCode: string) {
  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    socket.emit('continueAfterSummary', { roomCode }, resolve);
  });
}

export function setDifficulty(
  roomCode: string,
  aiDifficulty: 'rookie' | 'standard' | 'veteran',
) {
  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    socket.emit('setDifficulty', { roomCode, aiDifficulty }, resolve);
  });
}

export function submitAudienceGuess(
  roomCode: string,
  wordIndex: number,
  guessText: string,
) {
  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    socket.emit(
      'audienceGuess',
      { roomCode, wordIndex, guessText },
      resolve,
    );
  });
}
