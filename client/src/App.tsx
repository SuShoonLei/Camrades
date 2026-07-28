import { useCallback, useEffect, useRef, useState } from 'react';
import type { AiDifficulty, Room, Word } from '@shared/types';
import {
  continueAfterSummary,
  createRoom,
  createTeam,
  joinRoom,
  joinTeam,
  setDifficulty,
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

type Toast = { id: number; text: string };

export default function App() {
  const [view, setView] = useState<View>('landing');
  const [room, setRoom] = useState<Room | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(90);
  const [liveScores, setLiveScores] = useState<Record<string, number>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const prevPhase = useRef<string | null>(null);
  const toastId = useRef(0);

  const pushToast = useCallback((text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4200);
  }, []);

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
    const onBeat = (payload: {
      playerName: string;
      teamName: string;
      marginSec: number;
    }) => {
      pushToast(
        `${payload.playerName} beat the AI by ${payload.marginSec.toFixed(1)}s! +1 for ${payload.teamName}`,
      );
    };
    const onGuessPlaced = (payload: {
      playerId: string;
      wordIndex: number;
    }) => {
      // Soft sync: mark local room audience guess placeholder so UI disables
      setRoom((prev) => {
        if (!prev?.currentTurn) return prev;
        const turn = prev.currentTurn;
        if (turn.currentWordIndex !== payload.wordIndex) return prev;
        if (
          turn.audienceGuesses.some(
            (g) =>
              g.playerId === payload.playerId &&
              g.wordIndex === payload.wordIndex,
          )
        ) {
          return prev;
        }
        return {
          ...prev,
          currentTurn: {
            ...turn,
            audienceGuesses: [
              ...turn.audienceGuesses,
              {
                wordIndex: payload.wordIndex,
                playerId: payload.playerId,
                teamId: prev.players[payload.playerId]?.teamId ?? '',
                guessText: '',
                submittedAt: Date.now(),
                correct: false,
                beatTheAI: false,
              },
            ],
          },
        };
      });
    };

    socket.on('roomState', onState);
    socket.on('aiScoresUpdate', onScores);
    socket.on('timerTick', onTimer);
    socket.on('wordSolved', onSolved);
    socket.on('audienceBeat', onBeat);
    socket.on('audienceGuessPlaced', onGuessPlaced);
    return () => {
      socket.off('roomState', onState);
      socket.off('aiScoresUpdate', onScores);
      socket.off('timerTick', onTimer);
      socket.off('wordSolved', onSolved);
      socket.off('audienceBeat', onBeat);
      socket.off('audienceGuessPlaced', onGuessPlaced);
    };
  }, [pushToast]);

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
    setToasts([]);
    setView('landing');
    prevPhase.current = null;
  };

  const toastLayer = (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-curtain rounded-2xl bg-ink px-4 py-3 text-center text-sm font-semibold text-paper shadow-lg"
        >
          {t.text}
        </div>
      ))}
    </div>
  );

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

  return (
    <>
      {toastLayer}
      {room.phase === 'lobby' && (
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
          onSetDifficulty={async (d: AiDifficulty) => {
            setError(null);
            const res = await setDifficulty(room.code, d);
            if (!res.ok) setError(res.error ?? 'Failed');
          }}
          onStart={async () => {
            setError(null);
            const res = await startGame(room.code);
            if (!res.ok) setError(res.error ?? 'Cannot start');
          }}
        />
      )}
      {room.phase === 'submitting' && (
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
      )}
      {room.phase === 'in-round' && (
        <TurnView
          room={room}
          playerId={playerId}
          secondsLeft={secondsLeft}
          liveScores={liveScores}
        />
      )}
      {room.phase === 'turn-summary' && (
        <TurnSummary
          room={room}
          onContinue={() => {
            void continueAfterSummary(room.code);
          }}
        />
      )}
      {room.phase === 'game-over' && (
        <GameOver room={room} onPlayAgain={resetHome} />
      )}
    </>
  );
}
