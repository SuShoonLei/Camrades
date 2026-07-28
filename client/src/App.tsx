import { useCallback, useEffect, useRef, useState } from 'react';
import type { Room, Word } from '@shared/types';
import {
  continueAfterSummary,
  createRoom,
  createTeam,
  joinRoom,
  joinTeam,
  setTeamReady,
  socket,
  startGame,
  updateDraftWords,
} from './socket';
import { sfx } from './sounds';
import { Landing } from './components/Landing';
import { Lobby } from './components/Lobby';
import { WordSubmission } from './components/WordSubmission';
import { TurnView } from './components/TurnView';
import { TurnSummary } from './components/TurnSummary';
import { GameOver } from './components/GameOver';
import { AiTestPage } from './components/AiTestPage';

type View = 'landing' | 'ai-test' | 'game';

export default function App() {
  const [view, setView] = useState<View>('landing');
  const [room, setRoom] = useState<Room | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(90);
  const [liveScores, setLiveScores] = useState<Record<string, number>>({});
  const prevPhase = useRef<string | null>(null);

  useEffect(() => {
    const onState = (r: Room) => {
      setRoom(r);
      setView('game');
      if (r.currentTurn?.startedAt && r.currentTurn.status === 'active') {
        const elapsed = (Date.now() - r.currentTurn.startedAt) / 1000;
        setSecondsLeft(
          Math.max(0, Math.ceil(r.currentTurn.durationSec - elapsed)),
        );
      }
      if (r.phase !== 'in-round') {
        setLiveScores({});
      }
    };
    const onScores = (payload: {
      scores: Record<string, number>;
      wordIndex: number;
    }) => {
      setLiveScores(payload.scores);
    };
    const onTimer = (payload: { secondsLeft: number }) => {
      setSecondsLeft(payload.secondsLeft);
    };
    const onSolved = () => {
      sfx.correct();
    };

    socket.on('roomState', onState);
    socket.on('aiScoresUpdate', onScores);
    socket.on('timerTick', onTimer);
    socket.on('wordSolved', onSolved);
    return () => {
      socket.off('roomState', onState);
      socket.off('aiScoresUpdate', onScores);
      socket.off('timerTick', onTimer);
      socket.off('wordSolved', onSolved);
    };
  }, []);

  useEffect(() => {
    if (!room) return;
    const prev = prevPhase.current;
    if (prev !== room.phase) {
      if (room.phase === 'in-round') sfx.turnStart();
      if (room.phase === 'turn-summary') sfx.turnEnd();
      if (room.phase === 'game-over') sfx.gameOver();
      prevPhase.current = room.phase;
    }
  }, [room?.phase]);

  const handleCreate = useCallback(async (name: string) => {
    setBusy(true);
    setError(null);
    const res = await createRoom(name);
    setBusy(false);
    if (!res.ok || !res.room || !res.playerId) {
      setError(res.error ?? 'Could not create room');
      return;
    }
    setPlayerId(res.playerId);
    setRoom(res.room);
    setView('game');
  }, []);

  const handleJoin = useCallback(async (code: string, name: string) => {
    setBusy(true);
    setError(null);
    const res = await joinRoom(code, name);
    setBusy(false);
    if (!res.ok || !res.room || !res.playerId) {
      setError(res.error ?? 'Could not join room');
      return;
    }
    setPlayerId(res.playerId);
    setRoom(res.room);
    setView('game');
  }, []);

  const resetHome = () => {
    setRoom(null);
    setPlayerId(null);
    setError(null);
    setLiveScores({});
    setView('landing');
    prevPhase.current = null;
  };

  if (view === 'ai-test') {
    return <AiTestPage onBack={() => setView('landing')} />;
  }

  if (view === 'landing' || !room || !playerId) {
    return (
      <Landing
        onCreate={handleCreate}
        onJoin={handleJoin}
        onOpenAiTest={() => setView('ai-test')}
        busy={busy}
        error={error}
      />
    );
  }

  if (room.phase === 'lobby') {
    return (
      <Lobby
        room={room}
        playerId={playerId}
        error={error}
        onCreateTeam={async (name) => {
          setError(null);
          const res = await createTeam(room.code, name);
          if (!res.ok) setError(res.error ?? 'Failed');
        }}
        onJoinTeam={async (teamId) => {
          setError(null);
          const res = await joinTeam(room.code, teamId);
          if (!res.ok) setError(res.error ?? 'Failed');
        }}
        onStart={async () => {
          setError(null);
          const res = await startGame(room.code);
          if (!res.ok) setError(res.error ?? 'Cannot start');
        }}
      />
    );
  }

  if (room.phase === 'submitting') {
    return (
      <WordSubmission
        room={room}
        playerId={playerId}
        onUpdateWords={async (words: Word[]) => {
          const res = await updateDraftWords(room.code, words);
          return res.ok ? null : (res.error ?? 'Update failed');
        }}
        onSetReady={async (ready) => {
          const res = await setTeamReady(room.code, ready);
          return res.ok ? null : (res.error ?? 'Ready failed');
        }}
      />
    );
  }

  if (room.phase === 'in-round') {
    return (
      <TurnView
        room={room}
        playerId={playerId}
        secondsLeft={secondsLeft}
        liveScores={liveScores}
      />
    );
  }

  if (room.phase === 'turn-summary') {
    return (
      <TurnSummary
        room={room}
        onContinue={() => {
          void continueAfterSummary(room.code);
        }}
      />
    );
  }

  if (room.phase === 'game-over') {
    return <GameOver room={room} onPlayAgain={resetHome} />;
  }

  return null;
}
