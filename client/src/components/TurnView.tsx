import { useEffect, useRef, useState } from 'react';
import type { Room } from '@shared/types';
import { loadAiModel, startGuessing } from '../ai/aiGuesser';
import { sendAiScores } from '../socket';
import { AiThinkingBars } from './AiThinkingBars';
import { Timer } from './Timer';

type Props = {
  room: Room;
  playerId: string;
  secondsLeft: number;
  liveScores: Record<string, number>;
};

export function TurnView({ room, playerId, secondsLeft, liveScores }: Props) {
  const turn = room.currentTurn;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [camError, setCamError] = useState<string | null>(null);
  const lastSend = useRef(0);

  const actorId =
    turn && turn.actorRotation.length > 0
      ? turn.actorRotation[
          turn.currentWordIndex % turn.actorRotation.length
        ]
      : undefined;
  const isActor = playerId === actorId;
  const currentWord = turn?.assignedWords[turn.currentWordIndex];
  const team = turn
    ? room.teams.find((t) => t.id === turn.teamId)
    : undefined;

  useEffect(() => {
    if (
      !turn ||
      !isActor ||
      turn.status !== 'active' ||
      turn.revealing ||
      !currentWord
    ) {
      return;
    }

    let stop: (() => void) | undefined;
    let stream: MediaStream | undefined;
    let cancelled = false;

    (async () => {
      setModelLoading(true);
      setCamError(null);
      try {
        await loadAiModel((p) => {
          if (p.status === 'progress_total' && p.progress != null) {
            setProgress(Math.round(p.progress));
          }
        });
        if (cancelled) return;
        setModelLoading(false);

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const candidates = turn.candidatePool.map((w) => w.text);
        stop = startGuessing(video, candidates, (s) => {
          const now = Date.now();
          if (now - lastSend.current >= 500) {
            lastSend.current = now;
            sendAiScores(room.code, s);
          }
        });
      } catch (e) {
        setModelLoading(false);
        const msg = e instanceof Error ? e.message : String(e);
        if (
          msg.toLowerCase().includes('permission') ||
          msg.includes('NotAllowed') ||
          msg.includes('NotFound')
        ) {
          setCamError(
            'Camera access needed to act. Allow permission, or hand the phone to a teammate.',
          );
        } else {
          setCamError(msg);
        }
      }
    })();

    return () => {
      cancelled = true;
      stop?.();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [
    isActor,
    turn?.currentWordIndex,
    turn?.revealing,
    turn?.status,
    currentWord?.text,
    room.code,
    turn,
  ]);

  if (!turn) return null;

  const actor = actorId ? room.players[actorId] : undefined;
  const isOnTeam = team?.playerIds.includes(playerId) ?? false;
  const scores =
    Object.keys(liveScores).length > 0 ? liveScores : turn.aiScores;

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-6 animate-curtain">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label mb-0">{team?.name ?? 'Team'}</p>
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">
            Word {turn.currentWordIndex + 1} / {turn.assignedWords.length}
          </h1>
          <p className="text-sm font-semibold text-teal-deep">
            Score so far: {turn.correctCount}
          </p>
        </div>
        <div className="w-40 sm:w-48">
          <Timer secondsLeft={secondsLeft} total={turn.durationSec} />
        </div>
      </div>

      {turn.revealing && currentWord && (
        <div className="mb-4 rounded-2xl bg-teal px-4 py-4 text-center text-white">
          <p className="font-display text-2xl font-extrabold">Correct!</p>
          <p className="mt-1 text-lg font-semibold opacity-95">
            {currentWord.text}
          </p>
        </div>
      )}

      <div className="mb-4 rounded-2xl bg-ink px-4 py-3 text-center text-paper">
        {isActor ? (
          <p className="font-semibold">
            You’re up — act out the word. No talking!
          </p>
        ) : isOnTeam ? (
          <p className="font-semibold">
            It’s {actor?.name ?? 'a teammate'}’s turn to act
          </p>
        ) : (
          <p className="font-semibold">
            Watching {team?.name} · actor: {actor?.name ?? '…'}
          </p>
        )}
      </div>

      {isActor && currentWord && !turn.revealing && (
        <div className="mb-4 rounded-2xl border-2 border-dashed border-coral/50 bg-coral/10 px-4 py-5 text-center">
          <p className="label mb-1 text-coral-deep">Your word</p>
          <p className="font-display text-3xl font-extrabold tracking-tight text-coral-deep sm:text-4xl">
            {currentWord.text}
          </p>
          <p className="mt-1 text-sm text-slate">{currentWord.category}</p>
        </div>
      )}

      {modelLoading && isActor && (
        <div className="stage-panel mb-4 rounded-2xl p-4">
          <p className="font-semibold">Loading AI model…</p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-fog">
            <div
              className="h-full rounded-full bg-teal transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {camError && (
        <div className="mb-4 rounded-2xl border-2 border-coral/40 bg-coral/10 p-4 text-sm font-medium text-coral-deep">
          {camError}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {isActor && (
          <div className="overflow-hidden rounded-2xl bg-ink">
            <video
              ref={videoRef}
              className="aspect-[4/3] w-full -scale-x-100 object-cover"
              playsInline
              muted
              autoPlay
            />
          </div>
        )}
        <div className={isActor ? '' : 'md:col-span-2'}>
          <AiThinkingBars
            scores={scores}
            hideLabels={!isActor && !turn.revealing}
            trueWord={currentWord?.text}
            revealing={turn.revealing}
          />
        </div>
      </div>
    </div>
  );
}
