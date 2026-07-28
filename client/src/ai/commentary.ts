import { AI_NAME } from '@shared/types';

export { AI_NAME };

type Mood =
  | 'searching'
  | 'closing'
  | 'soClose'
  | 'secondGuess'
  | 'gotIt';

const LINES: Record<Mood, string[]> = {
  searching: [
    'hmm, let me think…',
    'still warming up the eyeballs…',
    'nothing’s jumping out yet.',
    'processing… aggressively average so far.',
    'I see shapes. Vague, judgmental shapes.',
  ],
  closing: [
    'ooh, something’s forming…',
    'getting warmer. keep going.',
    'pattern emerging. don’t stop.',
    'I might actually be onto something.',
    'confidence climbing. slowly. dramatically.',
  ],
  soClose: [
    'so close I can taste it.',
    'almost locked. one more beat…',
    'don’t you dare stop now.',
    'right on the edge of a commitment.',
    'this is the moment. sell it.',
  ],
  secondGuess: [
    'wait — pivoting to “{label}”…',
    'plot twist: looking like “{label}”.',
    'scratch that. “{label}” just took the lead.',
    'second-guessing hard. “{label}”?',
    'new frontrunner: “{label}”. bold choice.',
  ],
  gotIt: [
    'got it — “{label}”!',
    'locked. that’s “{label}”.',
    'called it: “{label}”.',
    'and the answer is “{label}”.',
    'boom. “{label}”. you’re welcome.',
  ],
};

function pick(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)]!;
}

function fill(template: string, label?: string): string {
  return template.replace(/\{label\}/g, label ?? '???');
}

export type CommentaryInput = {
  scores: Record<string, number>;
  threshold: number;
  revealing?: boolean;
  trueWord?: string;
  prevLeading?: string | null;
};

export type CommentaryResult = {
  line: string;
  mood: Mood;
  leading: string | null;
};

/**
 * Pick a Gawk line from the current score pattern.
 * Callers should throttle (e.g. only refresh when mood/leading changes,
 * or at most every ~2s) so it doesn't spam.
 */
export function pickCommentary(input: CommentaryInput): CommentaryResult {
  const { scores, threshold, revealing, trueWord, prevLeading } = input;
  const entries = Object.entries(scores);
  if (revealing && trueWord) {
    return {
      mood: 'gotIt',
      leading: trueWord,
      line: fill(pick(LINES.gotIt), trueWord),
    };
  }
  if (entries.length === 0) {
    return {
      mood: 'searching',
      leading: null,
      line: pick(LINES.searching),
    };
  }

  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const [leading, top] = sorted[0]!;
  const second = sorted[1]?.[1] ?? 0;
  const spread = top - second;

  if (prevLeading && prevLeading !== leading && top > 0.2) {
    return {
      mood: 'secondGuess',
      leading,
      line: fill(pick(LINES.secondGuess), leading),
    };
  }

  if (top >= threshold - 0.05 && top < threshold) {
    return {
      mood: 'soClose',
      leading,
      line: pick(LINES.soClose),
    };
  }

  if (top >= 0.28 && (spread > 0.04 || top >= threshold * 0.7)) {
    return {
      mood: 'closing',
      leading,
      line: pick(LINES.closing),
    };
  }

  return {
    mood: 'searching',
    leading,
    line: pick(LINES.searching),
  };
}

export function speakLine(text: string): void {
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.pitch = 1.1;
    window.speechSynthesis.speak(u);
  } catch {
    // ignore
  }
}
