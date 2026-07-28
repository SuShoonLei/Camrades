import { useEffect, useRef, useState } from 'react';
import { AI_NAME } from '@shared/types';
import {
  pickCommentary,
  speakLine,
  type CommentaryResult,
} from '../ai/commentary';

type Props = {
  scores: Record<string, number>;
  hideLabels?: boolean;
  trueWord?: string;
  revealing?: boolean;
  threshold?: number;
  voiceEnabled?: boolean;
  onToggleVoice?: (on: boolean) => void;
};

export function AiThinkingBars({
  scores,
  hideLabels,
  trueWord,
  revealing,
  threshold = 0.55,
  voiceEnabled = false,
  onToggleVoice,
}: Props) {
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top = entries[0];
  const moodFace =
    revealing || (top && top[1] > threshold)
      ? 'excited'
      : top && top[1] > 0.35
        ? 'curious'
        : 'thinking';

  const [line, setLine] = useState(`${AI_NAME} is warming up…`);
  const prevLeading = useRef<string | null>(null);
  const lastRefresh = useRef(0);
  const lastMood = useRef<string>('');

  useEffect(() => {
    const now = Date.now();
    const result: CommentaryResult = pickCommentary({
      scores,
      threshold,
      revealing,
      trueWord,
      prevLeading: prevLeading.current,
    });

    const leadingChanged =
      result.leading != null &&
      prevLeading.current != null &&
      result.leading !== prevLeading.current;
    const moodChanged = result.mood !== lastMood.current;
    const due = now - lastRefresh.current > 2200;

    if (revealing || leadingChanged || moodChanged || due) {
      setLine(result.line);
      lastRefresh.current = now;
      lastMood.current = result.mood;
      if (voiceEnabled) speakLine(`${AI_NAME}. ${result.line}`);
    }
    if (result.leading) prevLeading.current = result.leading;
  }, [scores, threshold, revealing, trueWord, voiceEnabled]);

  return (
    <div className="stage-panel rounded-2xl p-4 sm:p-5">
      <div className="mb-3 flex items-start gap-3">
        <AiFace mood={moodFace} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-display text-lg font-bold leading-tight">
              {AI_NAME}
            </p>
            {onToggleVoice && (
              <button
                type="button"
                className="text-xs font-semibold text-teal-deep underline-offset-2 hover:underline"
                onClick={() => onToggleVoice(!voiceEnabled)}
              >
                {voiceEnabled ? 'Voice on' : 'Voice off'}
              </button>
            )}
          </div>
          <div
            key={line}
            className="relative mt-2 rounded-2xl rounded-tl-sm bg-ink px-3 py-2 text-sm font-medium text-paper animate-curtain"
          >
            {line}
          </div>
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
  const eyes = mood === 'excited' ? '◕' : mood === 'curious' ? '◉' : '•';
  const mouth = mood === 'excited' ? 'D' : mood === 'curious' ? 'o' : '‿';

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
