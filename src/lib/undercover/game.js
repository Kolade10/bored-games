// Scoring and role assignment. Kept clear of the pair files on purpose: a
// component that imports the bank ships all 298 pairs to every browser, and
// anyone could then read off both words. The server picks the pair and the
// undercover; this file only holds what the client is allowed to know.

export const shuffle = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/**
 * Who is undercover each round.
 *
 * Spread as evenly as the numbers allow rather than drawn fresh each time:
 * over five rounds nobody should be undercover three times while someone else
 * never is. Players who have been it least are drawn from first, and the order
 * inside that group is random so it never becomes predictable.
 */
export function assignUndercovers(playerIds, rounds) {
  const counts = Object.fromEntries(playerIds.map(id => [id, 0]));
  const picks = [];

  for (let round = 0; round < rounds; round++) {
    const fewest = Math.min(...playerIds.map(id => counts[id]));
    const eligible = playerIds.filter(id => counts[id] === fewest);
    // Avoid the same player twice running when there is any other choice.
    const last = picks[picks.length - 1];
    const preferred = eligible.length > 1 ? eligible.filter(id => id !== last) : eligible;
    const chosen = shuffle(preferred)[0];
    counts[chosen] += 1;
    picks.push(chosen);
  }
  return picks;
}

export const SCORING = {
  civilianWin: 10,
  undercoverSurvives: 20,
  undercoverGuessBonus: 15,
  correctAccusation: 5
};
