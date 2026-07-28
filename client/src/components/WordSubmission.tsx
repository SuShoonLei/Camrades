import { useEffect, useState } from 'react';
import { CATEGORIES, type Category, type Room, type Word } from '@shared/types';

type Props = {
  room: Room;
  playerId: string;
  onUpdateWords: (words: Word[]) => Promise<string | null>;
  onSetReady: (ready: boolean) => Promise<string | null>;
};

export function WordSubmission({
  room,
  playerId,
  onUpdateWords,
  onSetReady,
}: Props) {
  const me = room.players[playerId];
  const team = room.teams.find((t) => t.id === me?.teamId);
  const draft = team ? (room.draftWords[team.id] ?? []) : [];
  const [local, setLocal] = useState<Word[]>(draft);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [category, setCategory] = useState<Category>('Actions');

  useEffect(() => {
    setLocal(draft);
  }, [draft]);

  if (!team) return null;

  const sync = async (next: Word[]) => {
    setLocal(next);
    const err = await onUpdateWords(next);
    setError(err);
  };

  const addWord = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (local.length >= room.settings.wordsPerTeam) {
      setError(`Max ${room.settings.wordsPerTeam} words`);
      return;
    }
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length < 1 || parts.length > 4) {
      setError('Keep it to 1–4 words');
      return;
    }
    await sync([...local, { text: trimmed, category }]);
    setText('');
  };

  const removeAt = async (i: number) => {
    await sync(local.filter((_, idx) => idx !== i));
  };

  const toggleReady = async () => {
    const err = await onSetReady(!team.ready);
    setError(err);
  };

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 py-8 animate-curtain">
      <header className="mb-6">
        <p className="label mb-1">Write your list</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          {team.name}
        </h1>
        <p className="mt-2 text-slate">
          Short phrases only (1–4 words). Another team will act these out for
          the AI. Anyone on your team can edit.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        {room.teams.map((t) => (
          <span
            key={t.id}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              t.ready
                ? 'bg-teal/20 text-teal-deep'
                : 'bg-mist text-slate'
            }`}
          >
            {t.name}: {t.ready ? 'Ready' : 'Writing…'}
          </span>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-coral/10 px-3 py-2 text-sm font-medium text-coral-deep">
          {error}
        </p>
      )}

      <div className="stage-panel mb-4 space-y-2 rounded-2xl p-4">
        {local.length === 0 && (
          <p className="py-6 text-center text-slate">No words yet — add some.</p>
        )}
        {local.map((w, i) => (
          <div
            key={`${w.text}-${i}`}
            className="flex items-center gap-3 rounded-xl bg-mist/70 px-3 py-2.5"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold text-slate">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{w.text}</p>
              <p className="text-xs text-slate">{w.category}</p>
            </div>
            {!team.ready && (
              <button
                type="button"
                className="text-sm font-semibold text-coral"
                onClick={() => void removeAt(i)}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      {!team.ready && local.length < room.settings.wordsPerTeam && (
        <div className="stage-panel mb-4 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="label" htmlFor="word">
              Phrase
            </label>
            <input
              id="word"
              className="field"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="riding a bike"
              maxLength={40}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void addWord();
                }
              }}
            />
          </div>
          <div className="sm:w-48">
            <label className="label" htmlFor="cat">
              Category
            </label>
            <select
              id="cat"
              className="field"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="btn-teal" onClick={() => void addWord()}>
            Add
          </button>
        </div>
      )}

      <button
        type="button"
        className={team.ready ? 'btn-secondary w-full' : 'btn-primary w-full'}
        disabled={!team.ready && local.length !== room.settings.wordsPerTeam}
        onClick={() => void toggleReady()}
      >
        {team.ready
          ? 'Not ready yet'
          : `Ready (${local.length}/${room.settings.wordsPerTeam})`}
      </button>
    </div>
  );
}
