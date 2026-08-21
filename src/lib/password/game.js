// Team formation and scoring. Deliberately kept clear of the word files: the
// browser must never load the bank, or every player could read all 276 words
// straight out of the JavaScript bundle. Words come from the server, one at a
// time, and only to the clue giver.

import { POINT_STEPS } from './build.js';

const shuffle = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/**
 * Splits players into teams of near-equal size.
 *
 * Dealt round-robin from a shuffled list rather than sliced into blocks: with
 * 9 players across 4 teams, slicing leaves 3/3/3/0, while dealing gives
 * 3/2/2/2. Nobody should end up on a team of one when it can be avoided.
 */
export function balancedTeams(playerIds, teamCount) {
  const teams = Array.from({ length: teamCount }, () => []);
  shuffle(playerIds).forEach((id, index) => {
    teams[index % teamCount].push(id);
  });
  return teams;
}

/**
 * Whose turn it is to give clues.
 *
 * Everyone on a team should get roughly the same number of turns, so this
 * picks from whoever has done it least, and avoids handing it straight back to
 * the person who just did it.
 */
export function pickClueGiver(memberIds, previousGiverIds = []) {
  if (memberIds.length === 0) return null;
  if (memberIds.length === 1) return memberIds[0];

  const counts = Object.fromEntries(memberIds.map(id => [id, 0]));
  previousGiverIds.forEach(id => {
    if (counts[id] !== undefined) counts[id] += 1;
  });

  const fewest = Math.min(...memberIds.map(id => counts[id]));
  const eligible = memberIds.filter(id => counts[id] === fewest);
  const last = previousGiverIds[previousGiverIds.length - 1];
  const preferred = eligible.length > 1 ? eligible.filter(id => id !== last) : eligible;
  return shuffle(preferred)[0];
}

/** What the current word is worth, given how many clues have gone by. */
export function pointsForStep(step, mode = 'risk') {
  if (mode === 'classic') return 1;
  return POINT_STEPS[Math.min(step, POINT_STEPS.length - 1)];
}

/** Turn order, drawn once at the start and kept for the whole game. */
export const shuffleTeamOrder = (teamIds) => shuffle(teamIds);
