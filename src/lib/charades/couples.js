import { build } from './build.js';

// Playful and general audience - things a couple would recognise instantly.
export const COUPLES = build('couples', 'cou', [
  ['e', 'Going on a date', 'dating'], ['e', 'Getting ready for a date', 'dating'],
  ['e', 'Holding hands', 'dating'], ['e', 'Giving flowers', 'dating'],
  ['m', 'First date nerves', 'dating'], ['m', 'Splitting a dessert', 'dating'],
  ['m', 'Taking a selfie together', 'dating'], ['h', 'Waiting for someone who is late', 'dating'],
  ['e', 'Your partner being hungry', 'moods'], ['m', 'Your partner getting jealous', 'moods'],
  ['m', 'Your partner ignoring you', 'moods'],
  ['m', 'Partner not replying', 'moods'],
  ['m', 'Pretending not to be annoyed', 'moods'],
  ['h', 'Saying you are fine', 'moods'],
  ['h', 'Giving the silent treatment', 'moods'],
  ['e', 'Deciding what to watch', 'together'], ['e', 'Sharing food', 'together'],
  ['m', 'Arguing over food', 'together'], ['m', 'Choosing where to eat', 'together'],
  ['m', 'Meeting your partner’s parents', 'together'],
  ['m', 'Too many photos of your partner', 'together'],
  ['m', 'Falling asleep together', 'together'],
  ['h', 'Trying to plan a surprise', 'together'],
  ['h', 'Pretending to like a gift', 'together'],
  ['h', 'Fighting over the blanket', 'together'],
  ['e', 'Video calling', 'distance'], ['m', 'Waiting at the airport', 'distance'],
  ['m', 'Long goodbye', 'distance'], ['h', 'Missing someone', 'distance']
]);
