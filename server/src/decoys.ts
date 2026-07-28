import type { Category, Word } from '../../shared/types.js';

/** Built-in fallback bank used when submitted words aren't enough for decoys. */
export const FALLBACK_BANK: Word[] = [
  // Movies
  { text: 'Titanic', category: 'Movies' },
  { text: 'Star Wars', category: 'Movies' },
  { text: 'The Matrix', category: 'Movies' },
  { text: 'Jurassic Park', category: 'Movies' },
  { text: 'Frozen', category: 'Movies' },
  { text: 'Spider Man', category: 'Movies' },
  { text: 'Finding Nemo', category: 'Movies' },
  { text: 'Harry Potter', category: 'Movies' },
  // Animals
  { text: 'elephant', category: 'Animals' },
  { text: 'penguin', category: 'Animals' },
  { text: 'giraffe', category: 'Animals' },
  { text: 'kangaroo', category: 'Animals' },
  { text: 'octopus', category: 'Animals' },
  { text: 'flamingo', category: 'Animals' },
  { text: 'sloth', category: 'Animals' },
  { text: 'dolphin', category: 'Animals' },
  // Actions
  { text: 'riding a bike', category: 'Actions' },
  { text: 'brushing teeth', category: 'Actions' },
  { text: 'cooking pasta', category: 'Actions' },
  { text: 'flying a kite', category: 'Actions' },
  { text: 'playing guitar', category: 'Actions' },
  { text: 'swimming laps', category: 'Actions' },
  { text: 'tying shoes', category: 'Actions' },
  { text: 'juggling balls', category: 'Actions' },
  // Everyday Objects
  { text: 'umbrella', category: 'Everyday Objects' },
  { text: 'toaster', category: 'Everyday Objects' },
  { text: 'scissors', category: 'Everyday Objects' },
  { text: 'backpack', category: 'Everyday Objects' },
  { text: 'alarm clock', category: 'Everyday Objects' },
  { text: 'watering can', category: 'Everyday Objects' },
  { text: 'flashlight', category: 'Everyday Objects' },
  { text: 'headphones', category: 'Everyday Objects' },
  // Occupations
  { text: 'firefighter', category: 'Occupations' },
  { text: 'chef', category: 'Occupations' },
  { text: 'astronaut', category: 'Occupations' },
  { text: 'magician', category: 'Occupations' },
  { text: 'dentist', category: 'Occupations' },
  { text: 'pilot', category: 'Occupations' },
  { text: 'librarian', category: 'Occupations' },
  { text: 'detective', category: 'Occupations' },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build a candidate pool: current word + 2–3 same-category decoys.
 * Prefer unused submitted words; fall back to the built-in bank.
 */
export function buildCandidatePool(
  current: Word,
  allSubmitted: Word[],
  usedTexts: Set<string>,
  decoyCount = 2 + Math.floor(Math.random() * 2), // 2 or 3
): Word[] {
  const normalize = (t: string) => t.trim().toLowerCase();
  const currentNorm = normalize(current.text);

  const pickFrom = (pool: Word[]): Word[] =>
    shuffle(
      pool.filter(
        (w) =>
          w.category === current.category &&
          normalize(w.text) !== currentNorm &&
          !usedTexts.has(normalize(w.text)),
      ),
    );

  let decoys = pickFrom(allSubmitted).slice(0, decoyCount);

  if (decoys.length < decoyCount) {
    const needed = decoyCount - decoys.length;
    const already = new Set(decoys.map((d) => normalize(d.text)));
    const extras = pickFrom(FALLBACK_BANK)
      .filter((w) => !already.has(normalize(w.text)))
      .slice(0, needed);
    decoys = [...decoys, ...extras];
  }

  // Last resort: allow reuse from fallback if still short
  if (decoys.length < 2) {
    const more = shuffle(
      FALLBACK_BANK.filter(
        (w) =>
          w.category === (current.category as Category) &&
          normalize(w.text) !== currentNorm,
      ),
    ).slice(0, 2 - decoys.length);
    decoys = [...decoys, ...more];
  }

  return shuffle([current, ...decoys]);
}
