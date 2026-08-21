import { build } from './build.js';

export const ENTERTAINMENT = build('entertainment', 'ent', [
  ['e', 'Superhero', 'cape|power|save|comic', 'characters'],
  ['e', 'Ghost', 'scary|white|haunt|dead', 'characters'],
  ['e', 'Pirate', 'ship|treasure|sea|eye', 'characters'],
  ['m', 'Wizard', 'magic|wand|spell|hat', 'characters'],
  ['m', 'Detective', 'clue|solve|crime|case', 'characters'],
  ['h', 'Villain', 'bad|evil|hero|enemy', 'characters'],
  ['e', 'Cinema', 'film|screen|popcorn|watch', 'movies'],
  ['e', 'Popcorn', 'cinema|corn|snack|pop', 'movies'],
  ['m', 'Horror film', 'scary|fear|blood|scream', 'movies'],
  ['m', 'Trailer', 'preview|film|short|clip', 'movies'],
  ['h', 'Plot twist', 'story|surprise|end|turn', 'movies'],
  ['h', 'Spoiling the ending', 'spoil|end|tell|film', 'movies'],
  ['e', 'News presenter', 'news|read|tv|report', 'tv'],
  ['m', 'Reality show', 'real|house|drama|tv', 'tv'],
  ['m', 'Cooking show', 'cook|chef|tv|food', 'tv'],
  ['h', 'Binge watching', 'watch|episode|series|all', 'tv'],
  ['e', 'Guitar', 'string|play|music|strum', 'music'],
  ['e', 'Drums', 'beat|stick|hit|music', 'music'],
  ['m', 'Karaoke', 'sing|mic|screen|song', 'music'],
  ['m', 'Concert', 'live|stage|crowd|music', 'music'],
  ['h', 'Forgetting the lyrics', 'words|song|forget|sing', 'music'],
  ['h', 'A song stuck in your head', 'song|head|repeat|stuck', 'music'],
  ['e', 'Selfie', 'photo|phone|face|camera', 'modern'],
  ['m', 'Going viral', 'internet|share|famous|views', 'modern'],
  ['h', 'Reading the comments', 'comment|post|read|internet', 'modern']
]);
