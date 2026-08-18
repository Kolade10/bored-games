import { build } from './build.js';

export const SPORTS = build('sports', 'spo', [
  ['e', 'Football', 'football'], ['e', 'Scoring a goal', 'football'],
  ['e', 'Goalkeeper', 'football'], ['e', 'Penalty kick', 'football'],
  ['m', 'Referee', 'football'], ['m', 'Red card', 'football'],
  ['m', 'Header', 'football'], ['m', 'Celebrating a goal', 'football'],
  ['h', 'Offside', 'football'], ['h', 'Diving for a foul', 'football'],
  ['e', 'Basketball', 'basketball'], ['e', 'Slam dunk', 'basketball'],
  ['m', 'Free throw', 'basketball'], ['m', 'Dribbling', 'basketball'],
  ['e', 'Tennis', 'tennis'], ['m', 'Serving a tennis ball', 'tennis'],
  ['h', 'Line judge call', 'tennis'],
  ['e', 'Boxing', 'boxing'], ['e', 'Knockout', 'boxing'],
  ['m', 'Skipping rope', 'boxing'], ['m', 'Ringing the bell', 'boxing'],
  ['e', 'Running a race', 'athletics'], ['e', 'Long jump', 'athletics'],
  ['m', 'High jump', 'athletics'], ['m', 'Relay baton pass', 'athletics'],
  ['m', 'Winning a medal', 'athletics'], ['h', 'False start', 'athletics'],
  ['e', 'Swimming race', 'other'], ['e', 'Cycling', 'other'],
  ['e', 'Table tennis', 'other'], ['m', 'Weightlifting', 'other'],
  ['m', 'Wrestling', 'other'], ['m', 'Golf swing', 'other'],
  ['m', 'Skateboarding', 'other'], ['m', 'Doing yoga', 'other'],
  ['m', 'Lifting a trophy', 'other'], ['h', 'Cheerleading', 'other'],
  ['h', 'Marathon runner hitting the wall', 'other'], ['h', 'Sports commentator', 'other']
]);
