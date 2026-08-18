import { build } from './build.js';

// Abstract and situational - the ones that need real acting.
export const TRICKY = build('tricky', 'tri', [
  ['h', 'Being late', 'concepts'], ['h', 'Being caught lying', 'concepts'],
  ['h', 'Regret', 'concepts'], ['h', 'Jealousy', 'concepts'],
  ['h', 'Patience', 'concepts'], ['h', 'Confusion', 'concepts'],
  ['h', 'Relief', 'concepts'], ['h', 'Suspicion', 'concepts'],
  ['h', 'Disappointment', 'concepts'], ['h', 'Guilt', 'concepts'],
  ['m', 'Deja vu', 'concepts'], ['m', 'Boredom', 'concepts'],
  ['m', 'Panic', 'concepts'], ['m', 'Excitement', 'concepts'],
  ['h', 'Trying to remember something', 'situations'],
  ['h', 'Pretending to be interested', 'situations'],
  ['h', 'Waiting for bad news', 'situations'],
  ['h', 'Realising you are wrong', 'situations'],
  ['h', 'Changing your mind halfway', 'situations'],
  ['h', 'Hiding a surprise', 'situations'],
  ['h', 'Losing an argument', 'situations'],
  ['h', 'Being told off', 'situations'],
  ['m', 'Making a difficult decision', 'situations'],
  ['m', 'Getting lost', 'situations'],
  ['m', 'Running out of time', 'situations'],
  ['m', 'Being watched', 'situations'],
  ['h', 'Time passing slowly', 'abstract'], ['h', 'Growing up', 'abstract'],
  ['h', 'Silence', 'abstract'], ['h', 'A secret', 'abstract'],
  ['h', 'Good luck', 'abstract'], ['h', 'Teamwork', 'abstract']
]);
