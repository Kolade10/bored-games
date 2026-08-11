// Questions are written in the first person, from the answerer's side:
// "What's my ideal weekend?"
//
// That is right for the person answering, but the guesser was seeing the same
// wording and reading it as a question about themselves. They need it turned
// around: "What's Kolade's ideal weekend?"
//
// The first person reference becomes the answerer's name; later ones in the
// same sentence become they/their, so "Would I say I am competitive?" reads
// "Would Kolade say they are competitive?" rather than repeating the name.

// Auxiliary + I, where third person singular changes the auxiliary.
const AUX = {
  am: ['is', 'are'],
  do: ['does', 'do'],
  does: ['does', 'do'],
  have: ['has', 'have'],
  has: ['has', 'have'],
  was: ['was', 'were'],
  is: ['is', 'are']
};

// Auxiliaries that do not inflect.
const FLAT_AUX = new Set(['would', 'could', 'should', 'will', 'can', 'did', 'must', 'might']);

const PATTERN = new RegExp(
  [
    "\\b(am|do|does|have|has|was|is|would|could|should|will|can|did|must|might)\\s+I\\b",
    "\\bI\\s+(am|have|had|could|would|will|can|do|did)\\b",
    "\\bI'd\\b",
    "\\bI'm\\b",
    "\\bI've\\b",
    "\\bmyself\\b",
    "\\bmy\\b",
    "\\bme\\b",
    "\\bI\\b"
  ].join('|'),
  'gi'
);

const capitalise = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Rewrites a first-person question so it asks about someone else.
 * @param {string} text
 * @param {string} name the answerer's name
 * @returns {string}
 */
export function askAbout(text, name) {
  if (!text) return '';
  if (!name) name = 'they';

  let seen = 0; // 0 -> use the name, after that -> they/their/them

  const out = text.replace(PATTERN, (match, auxBefore, verbAfter, offset) => {
    const first = seen === 0;
    seen++;
    const subject = first ? name : 'they';
    const lower = match.toLowerCase();

    // "am I", "do I", "would I", ...
    if (auxBefore) {
      const aux = auxBefore.toLowerCase();
      const replacement = AUX[aux]
        ? `${AUX[aux][first ? 0 : 1]} ${subject}`
        : `${FLAT_AUX.has(aux) ? aux : auxBefore} ${subject}`;
      return offset === 0 ? capitalise(replacement) : replacement;
    }

    // "I am", "I have", "I could", ...
    if (verbAfter) {
      const verb = verbAfter.toLowerCase();
      const conjugated = AUX[verb] ? AUX[verb][first ? 0 : 1] : verb;
      const replacement = `${subject} ${conjugated}`;
      return offset === 0 ? capitalise(replacement) : replacement;
    }

    if (lower === "i'd") return `${subject} would`;
    if (lower === "i'm") return first ? `${name} is` : 'they are';
    if (lower === "i've") return first ? `${name} has` : 'they have';
    if (lower === 'myself') return 'themselves';
    if (lower === 'my') return first ? `${name}'s` : 'their';
    if (lower === 'me') return first ? name : 'them';

    // bare "I"
    return offset === 0 ? capitalise(subject) : subject;
  });

  return out;
}

/**
 * The wording each side should see.
 * @param {object} question
 * @param {'answerer'|'guesser'} role
 * @param {string} answererName
 */
export function questionFor(question, role, answererName) {
  if (!question?.text) return '';
  return role === 'guesser' ? askAbout(question.text, answererName) : question.text;
}
