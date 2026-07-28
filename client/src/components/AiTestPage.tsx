import { useEffect, useRef, useState } from 'react';
import { loadAiModel, startGuessing } from '../ai/aiGuesser';

const DEMO_WORDS = ['person waving', 'thumbs up', 'peace sign', 'pointing'];

export function AiTestPage({ onBack }: { onBack: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(DEMO_WORDS.map((w) => [w, 0])),
  );
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [camError, setCamError] = useState<string | null>(null);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let stream: MediaStream | undefined;
    let cancelled = false;

    (async () => {
      try {
        await loadAiModel((p) => {
          if (p.status === 'progress_total' && p.progress != null) {
            setProgress(Math.round(p.progress));
          }
        });
        if (cancelled) return;
        setLoading(false);

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          stop = startGuessing(videoRef.current, DEMO_WORDS, setScores);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.toLowerCase().includes('permission') || msg.includes('NotAllowed')) {
          setCamError('Camera permission denied. Enable it in browser settings.');
        } else if (!cancelled) {
          setError(msg);
        }
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      stop?.();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-8 animate-curtain">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="label mb-0">Lab</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            AI Guess Test
          </h1>
        </div>
        <button type="button" className="btn-secondary" onClick={onBack}>
          Back
        </button>
      </div>

      <p className="max-w-xl text-slate">
        Hold a gesture in frame. Bars update ~every 800ms with smoothed CLIP
        scores for hardcoded candidates.
      </p>

      {loading && (
        <div className="stage-panel rounded-2xl p-6">
          <p className="font-semibold">Loading AI model…</p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-fog">
            <div
              className="h-full rounded-full bg-teal transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-slate">{progress}%</p>
        </div>
      )}

      {camError && (
        <div className="rounded-2xl border-2 border-coral/40 bg-coral/10 p-4 text-coral-deep">
          {camError}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border-2 border-coral/40 bg-coral/10 p-4">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="overflow-hidden rounded-2xl bg-ink shadow-lg">
          <video
            ref={videoRef}
            className="aspect-[4/3] w-full object-cover"
            playsInline
            muted
            autoPlay
          />
        </div>
        <div className="stage-panel flex flex-col gap-3 rounded-2xl p-5">
          {sorted.map(([label, score]) => (
            <div key={label}>
              <div className="mb-1 flex justify-between text-sm font-semibold">
                <span>{label}</span>
                <span className="tabular-nums text-slate">
                  {(score * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-fog/80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal to-amber transition-all duration-300"
                  style={{ width: `${Math.min(100, score * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
