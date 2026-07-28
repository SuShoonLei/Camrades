import type { Room } from '@shared/types';

type Props = {
  room: Room;
  onContinue: () => void;
};

export function TurnSummary({ room, onContinue }: Props) {
  const result = room.lastTurnResult;
  if (!result) return null;

  const missed = result.assignedWords.filter(
    (w) => !result.solvedWords.some((s) => s.text === w.text),
  );
  const sweep = missed.length === 0;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-10 animate-curtain">
      <div className="stage-panel rounded-3xl p-6 sm:p-8">
        <p className="label mb-1">Turn over</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          {result.teamName}
        </h1>
        <p className="mt-3 font-display text-5xl font-extrabold text-coral">
          {result.correctCount}
          <span className="text-2xl text-ink">
            {' '}
            / {result.assignedWords.length}
          </span>
        </p>
        <p className="mt-2 text-slate">
          {sweep
            ? 'Clean sweep — the AI never stood a chance.'
            : 'Solid run. Here’s what slipped through.'}
        </p>

        {missed.length > 0 && (
          <div className="mt-6">
            <p className="label">Unguessed</p>
            <ul className="mt-2 space-y-2">
              {missed.map((w) => (
                <li
                  key={w.text}
                  className="rounded-xl bg-mist/80 px-3 py-2 text-sm font-semibold"
                >
                  {w.text}{' '}
                  <span className="font-normal text-slate">· {w.category}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button type="button" className="btn-primary mt-8 w-full" onClick={onContinue}>
          {room.completedTurnTeamIds.length >= room.turnOrder.length
            ? 'See final scores'
            : 'Next team'}
        </button>
      </div>
    </div>
  );
}
