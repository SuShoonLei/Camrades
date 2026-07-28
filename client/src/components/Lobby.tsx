import { useState } from 'react';
import type { Room } from '@shared/types';

type Props = {
  room: Room;
  playerId: string;
  onCreateTeam: (name: string) => Promise<void>;
  onJoinTeam: (teamId: string) => Promise<void>;
  onStart: () => Promise<void>;
  error: string | null;
};

export function Lobby({
  room,
  playerId,
  onCreateTeam,
  onJoinTeam,
  onStart,
  error,
}: Props) {
  const [teamName, setTeamName] = useState('');
  const isHost = room.hostId === playerId;
  const everyTeamValid = room.teams.every(
    (t) => t.playerIds.length >= 2 && t.playerIds.length <= 3,
  );
  const me = room.players[playerId];

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-8 animate-curtain">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label mb-1">Lobby</p>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">
            Room{' '}
            <span className="tracking-[0.15em] text-coral">{room.code}</span>
          </h1>
          <p className="mt-1 text-slate">
            Share the code. Build teams of 2–3. Host starts when ready.
          </p>
        </div>
        {isHost && (
          <button
            type="button"
            className="btn-primary"
            disabled={!everyTeamValid}
            onClick={() => void onStart()}
          >
            Start Game
          </button>
        )}
      </header>

      {error && (
        <p className="mb-4 rounded-xl bg-coral/10 px-3 py-2 text-sm font-medium text-coral-deep">
          {error}
        </p>
      )}

      {!everyTeamValid && isHost && (
        <p className="mb-4 text-sm font-medium text-amber">
          Every team needs 2–3 players before you can start.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {room.teams.map((team) => {
          const full = team.playerIds.length >= 3;
          const onThis = me?.teamId === team.id;
          return (
            <div key={team.id} className="stage-panel rounded-2xl p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-display text-xl font-bold">{team.name}</h2>
                <span className="text-sm font-semibold text-slate">
                  {team.playerIds.length}/3
                </span>
              </div>
              <ul className="mb-4 space-y-2">
                {team.playerIds.map((id) => {
                  const p = room.players[id];
                  return (
                    <li
                      key={id}
                      className="flex items-center gap-2 rounded-lg bg-mist/80 px-3 py-2 text-sm font-medium"
                    >
                      <span className="inline-block h-2 w-2 rounded-full bg-teal" />
                      {p?.name ?? '…'}
                      {id === room.hostId && (
                        <span className="ml-auto text-xs font-semibold tracking-wide text-coral uppercase">
                          Host
                        </span>
                      )}
                      {id === playerId && (
                        <span className="ml-auto text-xs font-semibold text-teal-deep">
                          You
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {!onThis && (
                <button
                  type="button"
                  className="btn-secondary w-full py-2 text-sm"
                  disabled={full}
                  onClick={() => void onJoinTeam(team.id)}
                >
                  {full ? 'Full' : 'Join team'}
                </button>
              )}
              {onThis && (
                <p className="text-center text-sm font-semibold text-teal-deep">
                  You’re on this team
                </p>
              )}
            </div>
          );
        })}
      </div>

      <form
        className="stage-panel mt-6 flex flex-col gap-3 rounded-2xl p-5 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void onCreateTeam(teamName.trim() || 'New Team');
          setTeamName('');
        }}
      >
        <div className="flex-1">
          <label className="label" htmlFor="teamName">
            Create a new team
          </label>
          <input
            id="teamName"
            className="field"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Team name"
            maxLength={28}
          />
        </div>
        <button type="submit" className="btn-teal shrink-0">
          Create team
        </button>
      </form>
    </div>
  );
}
