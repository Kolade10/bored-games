import { build } from './build.js';

export const FUNNY = build('funny', 'fun', [
  ['e', 'Sneezing loudly', 'situations'], ['e', 'Slipping on a banana peel', 'situations'],
  ['e', 'Tripping over nothing', 'situations'], ['e', 'Yawning', 'situations'],
  ['e', 'Hiccups', 'situations'], ['m', 'Trying not to laugh', 'situations'],
  ['m', 'Waving at the wrong person', 'situations'], ['m', 'Walking into a glass door', 'awkward'],
  ['m', 'Spilling a drink on yourself', 'awkward'], ['m', 'Phone ringing in a quiet room',
  'awkward'], ['m', 'Bad smell in a small room', 'awkward'],
  ['h', 'Laughing at the wrong moment', 'awkward'], ['h', 'Forgetting why you came in',
  'awkward'], ['h', 'Pretending to understand', 'awkward'],
  ['h', 'Being caught staring', 'awkward'], ['h', 'Trying to avoid someone', 'awkward'],
  ['e', 'Dancing badly', 'behaviour'], ['e', 'Snoring', 'behaviour'],
  ['m', 'Talking to yourself', 'behaviour'], ['m', 'Arguing with a machine', 'behaviour'],
  ['m', 'Overreacting to a small injury', 'behaviour'],
  ['m', 'Eating something too hot', 'behaviour'], ['m', 'Chasing a fly', 'behaviour'],
  ['h', 'Pretending you were not asleep', 'behaviour'],
  ['h', 'Acting normal after a mistake', 'behaviour'],
  ['h', 'Reading a message and not replying', 'behaviour'],
  ['m', 'Selfie gone wrong', 'photos'], ['m', 'Posing for too long', 'photos'],
  ['h', 'Being photobombed', 'photos'],
  ['m', 'Struggling with a shopping bag', 'struggles'],
  ['m', 'Umbrella in the wind', 'struggles'],
  ['m', 'Carrying too much at once', 'struggles'],
  ['h', 'Opening a jar that will not open', 'struggles'],
  ['h', 'Untangling earphones', 'struggles'],
  ['h', 'Forgetting something important', 'struggles']
]);
