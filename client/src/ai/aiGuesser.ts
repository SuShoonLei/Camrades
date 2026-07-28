/**
 * Client-side CLIP zero-shot guesser.
 *
 * Approach: high-level `pipeline('zero-shot-image-classification')` per frame.
 * With only 3–4 candidates every ~800ms this stays interactive on modern
 * laptops/phones. If latency becomes a problem we can switch to caching text
 * embeddings once per word and cosine-comparing image embeddings each tick —
 * not needed yet for this candidate-pool size.
 */
import {
  pipeline,
  type ProgressInfo,
  type ZeroShotImageClassificationPipeline,
} from '@huggingface/transformers';

const MODEL_ID = 'Xenova/clip-vit-base-patch32';
const ALPHA = 0.3;
const INTERVAL_MS = 800;
const FRAME_SIZE = 224;

let classifierPromise: Promise<ZeroShotImageClassificationPipeline> | null =
  null;

export type LoadProgress = {
  status: string;
  progress?: number;
  file?: string;
};

export async function loadAiModel(
  onProgress?: (p: LoadProgress) => void,
): Promise<ZeroShotImageClassificationPipeline> {
  if (!classifierPromise) {
    classifierPromise = pipeline(
      'zero-shot-image-classification',
      MODEL_ID,
      {
        progress_callback: (info: ProgressInfo) => {
          if (!onProgress) return;
          if (info.status === 'progress_total') {
            onProgress({
              status: 'progress_total',
              progress: (info as { progress?: number }).progress,
            });
          } else if (info.status === 'progress') {
            onProgress({
              status: 'progress',
              progress: (info as { progress?: number }).progress,
              file: (info as { file?: string }).file,
            });
          } else {
            onProgress({ status: info.status });
          }
        },
      },
    ) as Promise<ZeroShotImageClassificationPipeline>;
  }
  return classifierPromise;
}

function captureFrame(videoEl: HTMLVideoElement): string | null {
  if (!videoEl.videoWidth || !videoEl.videoHeight) return null;
  const canvas = document.createElement('canvas');
  canvas.width = FRAME_SIZE;
  canvas.height = FRAME_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Center-crop to square then scale to 224
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  const side = Math.min(vw, vh);
  const sx = (vw - side) / 2;
  const sy = (vh - side) / 2;
  ctx.drawImage(videoEl, sx, sy, side, side, 0, 0, FRAME_SIZE, FRAME_SIZE);
  return canvas.toDataURL('image/jpeg', 0.85);
}

export function startGuessing(
  videoEl: HTMLVideoElement,
  candidateWords: string[],
  onScores: (scores: Record<string, number>) => void,
): () => void {
  let stopped = false;
  let busy = false;
  const ema: Record<string, number> = Object.fromEntries(
    candidateWords.map((w) => [w, 0]),
  );
  let timer: ReturnType<typeof setInterval> | null = null;

  const tick = async () => {
    if (stopped || busy) return;
    busy = true;
    try {
      const classifier = await loadAiModel();
      if (stopped) return;
      const dataUrl = captureFrame(videoEl);
      if (!dataUrl) {
        busy = false;
        return;
      }

      const results = (await classifier(dataUrl, candidateWords)) as Array<{
        label: string;
        score: number;
      }>;

      if (stopped) return;

      for (const r of results) {
        const prev = ema[r.label] ?? 0;
        ema[r.label] = ALPHA * r.score + (1 - ALPHA) * prev;
      }
      // Ensure all candidates present
      for (const w of candidateWords) {
        if (ema[w] === undefined) ema[w] = 0;
      }
      onScores({ ...ema });
    } catch (err) {
      console.error('AI guess tick failed', err);
    } finally {
      busy = false;
    }
  };

  void loadAiModel().then(() => {
    if (stopped) return;
    void tick();
    timer = setInterval(() => {
      void tick();
    }, INTERVAL_MS);
  });

  return () => {
    stopped = true;
    if (timer) clearInterval(timer);
  };
}
