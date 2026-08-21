import { build } from './build.js';

export const SPORTS = build('sports', 'spo', [
  ['e', 'Football', 'kick|goal|ball|pitch', 'football'],
  ['e', 'Goalkeeper', 'goal|save|gloves|post', 'football'],
  ['e', 'Penalty', 'kick|spot|goal|foul', 'football'],
  ['m', 'Referee', 'whistle|card|rules|match', 'football'],
  ['m', 'Red card', 'send|off|foul|referee', 'football'],
  ['h', 'Offside', 'rule|line|flag|position', 'football'],
  ['h', 'Missing a penalty', 'miss|kick|goal|penalty', 'football'],
  ['e', 'Basketball', 'hoop|dribble|ball|net', 'other'],
  ['m', 'Slam dunk', 'basket|jump|hoop|ball', 'other'],
  ['e', 'Boxing', 'punch|gloves|ring|fight', 'other'],
  ['m', 'Knockout', 'punch|down|boxing|out', 'other'],
  ['e', 'Swimming', 'water|pool|stroke|race', 'other'],
  ['m', 'Tennis', 'racket|net|serve|court', 'other'],
  ['m', 'Marathon', 'run|long|distance|race', 'athletics'],
  ['m', 'Relay race', 'baton|team|run|pass', 'athletics'],
  ['h', 'False start', 'gun|early|run|start', 'athletics'],
  ['e', 'Trophy', 'win|cup|prize|lift', 'prizes'],
  ['e', 'Medal', 'gold|neck|win|hang', 'prizes'],
  ['m', 'Half time', 'break|match|middle|rest', 'general'],
  ['m', 'Substitute', 'bench|swap|player|come', 'general'],
  ['h', 'Losing on penalties', 'penalty|lose|shootout|miss', 'general'],
  ['h', 'Supporting a bad team', 'team|lose|fan|support', 'general'],
  ['m', 'Stadium', 'crowd|match|seats|big', 'general'],
  ['h', 'Commentator', 'talk|match|describe|radio', 'general']
]);
