type Props = {
  scores: Record<string, number>;
  /** Hide the true word label from non-actors */
  hideLabels?: boolean;
  trueWord?: string;
  revealing?: boolean;
};

export function AiThinkingBars({
  scores,
  hideLabels,
  trueWord,
  revealing,
}: Props) {
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top = entries[0];
  const mood =
    revealing || (top && top[1] > 0.55)
      ? 'excited'
      : top && top[1] > 0.35
        ? 'curious'
        : 'thinking';

  return (
    <div className="stage-panel rounded-2xl p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <AiFace mood={mood} />
        <div>
          <p className="font-display text-lg font-bold leading-tight">
            {revealing ? 'Nailed it!' : 'AI is watching…'}
          </p>
          <p className="text-sm text-slate">
            {revealing
              ? 'Confidence locked in'
              : 'Smoothed scores from the camera feed'}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {entries.map(([label, score], i) => {
          const isTrue = trueWord === label;
          const showLabel = !hideLabels || revealing;
          return (
            <div key={label}>
              <div className="mb-1 flex justify-between gap-2 text-sm font-semibold">
                <span className="truncate">
                  {showLabel ? label : `Guess ${i + 1}`}
                  {revealing && isTrue && (
                    <span className="ml-2 text-teal-deep">✓</span>
                  )}
                </span>
                <span className="tabular-nums text-slate">
                  {(score * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-5 overflow-hidden rounded-lg bg-fog/70">
                <div
                  className={`h-full rounded-lg transition-all duration-500 ease-out ${
                    revealing && isTrue
                      ? 'bg-teal'
                      : i === 0
                        ? 'bg-gradient-to-r from-coral to-amber'
                        : 'bg-gradient-to-r from-teal/70 to-teal'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(2, score * 100))}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AiFace({ mood }: { mood: 'thinking' | 'curious' | 'excited' }) {
  const eyes =
    mood === 'excited' ? '◕' : mood === 'curious' ? '◉' : '•';
  const mouth =
    mood === 'excited' ? 'D' : mood === 'curious' ? 'o' : '‿';

  return (
    <div
      className="animate-face flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-ink text-amber"
      aria-hidden
    >
      <span className="font-display text-xl font-bold leading-none tracking-tight">
        {eyes}
        {mouth}
        {eyes}
      </span>
    </div>
  );
}
