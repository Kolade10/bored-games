import { build } from './build.js';

export const SPORTS = build('sports', 'spo', [
  ['e', 'Football', 'Basketball', 'sports'], ['m', 'Tennis', 'Badminton', 'sports'],
  ['h', 'Boxing', 'Wrestling', 'sports'], ['m', 'Swimming', 'Diving', 'sports'],
  ['e', 'Cricket', 'Baseball', 'sports'], ['m', 'Volleyball', 'Handball', 'sports'],
  ['h', 'Marathon', 'Sprint', 'sports'], ['m', 'Cycling', 'Skating', 'sports'],
  ['h', 'Table tennis', 'Squash', 'sports'], ['m', 'Golf', 'Snooker', 'sports'],
  ['e', 'Goalkeeper', 'Striker', 'football'], ['m', 'Referee', 'Linesman', 'football'],
  ['h', 'Penalty', 'Free kick', 'football'], ['m', 'Corner', 'Throw in', 'football'],
  ['h', 'Yellow card', 'Red card', 'football'], ['m', 'Half time', 'Full time', 'football'],
  ['e', 'Stadium', 'Pitch', 'venue'], ['m', 'Dressing room', 'Dugout', 'venue'],
  ['h', 'Gym', 'Training ground', 'venue'], ['m', 'Track', 'Court', 'venue'],
  ['e', 'Coach', 'Captain', 'people'], ['m', 'Fan', 'Supporter', 'people'],
  ['h', 'Substitute', 'Reserve', 'people'], ['m', 'Champion', 'Runner up', 'people'],
  ['e', 'Medal', 'Trophy', 'prizes'], ['h', 'League', 'Tournament', 'prizes'],
  ['m', 'World Cup', 'Olympics', 'prizes'], ['h', 'Draw', 'Tie', 'prizes'],
  ['m', 'Whistle', 'Buzzer', 'kit'], ['e', 'Boots', 'Trainers', 'kit'],
  ['h', 'Jersey', 'Kit', 'kit'], ['m', 'Helmet', 'Gloves', 'kit']
]);
