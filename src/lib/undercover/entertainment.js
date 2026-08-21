import { build } from './build.js';

export const ENTERTAINMENT = build('entertainment', 'ent', [
  ['e', 'Movie', 'TV show', 'formats'], ['m', 'Series', 'Documentary', 'formats'],
  ['h', 'Podcast', 'Radio show', 'formats'], ['m', 'Cartoon', 'Anime', 'formats'],
  ['m', 'Concert', 'Festival', 'formats'], ['h', 'Trailer', 'Advert'],
  ['e', 'Comedy', 'Horror', 'genres'], ['m', 'Romance', 'Drama', 'genres'],
  ['h', 'Thriller', 'Mystery', 'genres'], ['m', 'Action', 'Adventure', 'genres'],
  ['e', 'Guitar', 'Drums', 'music'], ['m', 'Piano', 'Keyboard', 'music'],
  ['h', 'Singer', 'Rapper', 'music'], ['m', 'Album', 'Playlist', 'music'],
  ['m', 'Choir', 'Band', 'music'], ['h', 'Remix', 'Cover', 'music'],
  ['e', 'Superhero', 'Villain', 'characters'], ['m', 'Wizard', 'Witch', 'characters'],
  ['m', 'Ghost', 'Zombie', 'characters'], ['h', 'Detective', 'Spy', 'characters'],
  ['e', 'Pirate', 'Cowboy', 'characters'], ['m', 'Robot', 'Alien', 'characters'],
  ['m', 'Actor', 'Director', 'people'], ['h', 'Comedian', 'Presenter', 'people'],
  ['m', 'Influencer', 'Blogger', 'people'], ['h', 'Fan', 'Follower', 'people'],
  ['e', 'Cinema', 'Netflix', 'watching'], ['m', 'Popcorn', 'Snacks', 'watching'],
  ['h', 'Subtitles', 'Dubbing', 'watching'], ['m', 'Sequel', 'Remake', 'watching'],
  ['e', 'Video game', 'Board game', 'games'], ['m', 'Puzzle', 'Riddle', 'games'],
  ['h', 'Chess', 'Draughts', 'games'], ['m', 'Karaoke', 'Talent show', 'games'],
  ['m', 'Award', 'Trophy', 'events'], ['h', 'Premiere', 'Launch', 'events'],
  ['e', 'Stage', 'Screen', 'events'], ['m', 'Audience', 'Crowd', 'events']
]);
