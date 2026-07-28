import { useState } from 'react';

type Props = {
  onCreate: (name: string) => Promise<void>;
  onJoin: (code: string, name: string) => Promise<void>;
  onOpenAiTest: () => void;
  busy: boolean;
  error: string | null;
};

export function Landing({ onCreate, onJoin, onOpenAiTest, busy, error }: Props) {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (mode === 'create') await onCreate(name.trim());
    else await onJoin(code.trim().toUpperCase(), name.trim());
  };

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-10 animate-curtain">
      <div className="mb-10 text-center">
        <p className="mb-3 text-sm font-semibold tracking-[0.2em] text-teal-deep uppercase">
          Party mode · camera on
        </p>
        <h1 className="font-display text-5xl leading-[0.95] font-extrabold tracking-tight sm:text-6xl">
          Gesture
          <br />
          <span className="text-coral">Charades</span>
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-lg text-slate">
          Act it out. The AI does the guessing — and it has opinions.
        </p>
      </div>

      <form
        onSubmit={(e) => void submit(e)}
        className="stage-panel rounded-3xl p-6 sm:p-8"
      >
        <div className="mb-6 flex gap-2 rounded-xl bg-mist p-1">
          <button
            type="button"
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
              mode === 'create' ? 'bg-white text-ink shadow-sm' : 'text-slate'
            }`}
            onClick={() => setMode('create')}
          >
            Create Room
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
              mode === 'join' ? 'bg-white text-ink shadow-sm' : 'text-slate'
            }`}
            onClick={() => setMode('join')}
          >
            Join Room
          </button>
        </div>

        <label className="label" htmlFor="name">
          Your name
        </label>
        <input
          id="name"
          className="field mb-4"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Alex"
          maxLength={24}
          autoComplete="nickname"
          required
        />

        {mode === 'join' && (
          <>
            <label className="label" htmlFor="code">
              Room code
            </label>
            <input
              id="code"
              className="field mb-4 uppercase tracking-widest"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="AB12C"
              maxLength={5}
              required
            />
          </>
        )}

        {error && (
          <p className="mb-4 rounded-xl bg-coral/10 px-3 py-2 text-sm font-medium text-coral-deep">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Connecting…' : mode === 'create' ? 'Create room' : 'Join room'}
        </button>
      </form>

      <button
        type="button"
        onClick={onOpenAiTest}
        className="mt-6 text-center text-sm font-semibold text-teal-deep underline-offset-4 hover:underline"
      >
        Open AI camera lab
      </button>
    </div>
  );
}
