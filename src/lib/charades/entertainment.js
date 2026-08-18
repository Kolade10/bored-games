import { build } from './build.js';

// Acted out, not named - "Superhero" works, a specific song title does not.
export const ENTERTAINMENT = build('entertainment', 'ent', [
  ['e', 'Superhero', 'characters'], ['e', 'Ghost', 'characters'], ['e', 'Zombie', 'characters'],
  ['e', 'Pirate', 'characters'], ['e', 'Wizard', 'characters'], ['e', 'Robot', 'characters'],
  ['e', 'Vampire', 'characters'], ['m', 'Detective', 'characters'], ['m', 'Villain', 'characters'],
  ['m', 'Spy', 'characters'], ['m', 'Cowboy', 'characters'], ['h', 'Mad scientist', 'characters'],
  ['e', 'Singing on stage', 'music'], ['e', 'Playing drums', 'music'],
  ['e', 'Playing guitar', 'music'], ['e', 'DJ', 'music'], ['m', 'Choir', 'music'],
  ['m', 'Rapping', 'music'], ['m', 'Conducting an orchestra', 'music'],
  ['m', 'Dropping the microphone', 'music'], ['h', 'Lip syncing badly', 'music'],
  ['e', 'Watching a scary film', 'movies'], ['e', 'Eating popcorn at the cinema', 'movies'],
  ['m', 'Action film hero', 'movies'], ['m', 'Slow motion fight', 'movies'],
  ['m', 'Romantic film ending', 'movies'], ['m', 'Film director', 'movies'],
  ['h', 'Plot twist', 'movies'], ['h', 'Post credits scene', 'movies'],
  ['e', 'Talent show judge', 'tv'], ['e', 'News reporter', 'tv'],
  ['m', 'Reality show argument', 'tv'], ['m', 'Cooking show', 'tv'],
  ['m', 'Game show contestant', 'tv'], ['m', 'Weather forecast', 'tv'],
  ['h', 'Live broadcast going wrong', 'tv'], ['h', 'Soap opera reaction', 'tv'],
  ['e', 'Taking a bow', 'stage'], ['m', 'Stand up comedian', 'stage'],
  ['m', 'Magician', 'stage'], ['m', 'Ballet dancer', 'stage'],
  ['h', 'Stage fright', 'stage'], ['h', 'Mime artist', 'stage']
]);
