import type { Room } from '@shared/types';

type Props = {
  room: Room;
  onPlayAgain: () => void;
};

export function GameOver({ room, onPlayAgain }: Props) {
  const ranked = [...room.teams].sort((a, b) => b.score - a.score);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-10 animate-curtain">
      <div className="mb-8 text-center">
        <p className="label mb-2">Final curtain</p>
        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          Game over
        </h1>
        <p className="mt-2 text-slate">The AI has rendered its verdict.</p>
      </div>

      <ol className="stage-panel space-y-3 rounded-3xl p-5 sm:p-6">
        {ranked.map((team, i) => (
          <li
            key={team.id}
            className={`flex items-center gap-4 rounded-2xl px-4 py-3 ${
              i === 0 ? 'bg-amber/25' : 'bg-mist/60'
            }`}
          >
            <span className="font-display text-2xl font-extrabold text-slate tabular-nums">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-lg font-bold">{team.name}</p>
              <p className="text-xs text-slate">
                {team.playerIds.map((id) => room.players[id]?.name).filter(Boolean).join(', ')}
              </p>
            </div>
            <span className="font-display text-2xl font-extrabold text-coral tabular-nums">
              {team.score}
            </span>
          </li>
        ))}
      </ol>

      <button type="button" className="btn-primary mt-8 w-full" onClick={onPlayAgain}>
        Back to home
      </button>
    </div>
  );
}
