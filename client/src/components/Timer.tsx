type Props = {
  secondsLeft: number;
  total: number;
};

export function Timer({ secondsLeft, total }: Props) {
  const urgent = secondsLeft <= 10;
  const pct = total > 0 ? (secondsLeft / total) * 100 : 0;

  return (
    <div className="w-full">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="label mb-0">Time</span>
        <span
          className={`font-display text-3xl font-extrabold tabular-nums ${
            urgent ? 'animate-urgent text-coral' : 'text-ink'
          }`}
        >
          {secondsLeft}s
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-fog">
        <div
          className={`h-full rounded-full transition-all duration-1000 linear ${
            urgent ? 'bg-coral' : 'bg-teal'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
