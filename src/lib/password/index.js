// The whole word bank, for the seed generator and the tests only.
//
// Application code must not import this file - it drags all 276 words into
// whatever bundle it lands in. Components import './build.js' for the settings
// and './game.js' for the logic; the words themselves come from the server.

import { GENERAL } from './general.js';
import { FOOD } from './food.js';
import { ENTERTAINMENT } from './entertainment.js';
import { SPORTS } from './sports.js';
import { FUNNY } from './funny.js';
import { RELATIONSHIPS } from './relationships.js';
import { NIGERIAN } from './nigerian.js';

export * from './build.js';
export * from './game.js';

export const WORDS = [
  ...GENERAL, ...FOOD, ...ENTERTAINMENT, ...SPORTS, ...FUNNY,
  ...RELATIONSHIPS, ...NIGERIAN
];
