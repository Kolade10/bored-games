import { build } from './build.js';

export const EVERYDAY = build('everyday', 'eve', [
  ['e', 'Waking up late', 'daily'], ['e', 'Taking a shower', 'daily'],
  ['e', 'Getting dressed', 'daily'], ['e', 'Combing your hair', 'daily'],
  ['e', 'Locking the door', 'daily'], ['m', 'Setting an alarm', 'daily'],
  ['m', 'Hitting snooze', 'daily'], ['m', 'Charging your phone', 'daily'],
  ['m', 'Looking for your keys', 'daily'], ['h', 'Rushing out of the house', 'daily'],
  ['e', 'Sweeping', 'household'], ['e', 'Mopping', 'household'],
  ['e', 'Hanging clothes', 'household'], ['e', 'Making the bed', 'household'],
  ['m', 'Changing a light bulb', 'household'], ['m', 'Taking out the bins', 'household'],
  ['m', 'Fixing a leaking tap', 'household'], ['h', 'Assembling furniture', 'household'],
  ['e', 'Typing', 'work'], ['e', 'Answering the phone', 'work'],
  ['m', 'Sitting in a meeting', 'work'], ['m', 'Falling asleep at your desk', 'work'],
  ['m', 'Printing something', 'work'], ['m', 'Job interview', 'work'],
  ['h', 'Pretending to be busy', 'work'], ['h', 'Bad video call connection', 'work'],
  ['e', 'Writing on a board', 'school'], ['e', 'Raising your hand', 'school'],
  ['m', 'Taking an exam', 'school'], ['m', 'Copying homework', 'school'],
  ['m', 'Being sent out of class', 'school'], ['h', 'Falling asleep in a lecture', 'school'],
  ['e', 'Pushing a trolley', 'shopping'], ['e', 'Paying at the till', 'shopping'],
  ['m', 'Trying on clothes', 'shopping'], ['m', 'Queueing', 'shopping'],
  ['m', 'Card being declined', 'shopping'], ['h', 'Haggling over a price', 'shopping'],
  ['e', 'Shaking hands', 'social'], ['e', 'Waving goodbye', 'social'],
  ['e', 'Taking a group photo', 'social'], ['m', 'Meeting someone new', 'social'],
  ['m', 'Whispering in a quiet room', 'social'], ['m', 'Missing a bus', 'social'],
  ['m', 'Getting a haircut', 'social'], ['m', 'Stuck in traffic', 'social'],
  ['h', 'Awkward hug', 'social'], ['h', 'Pretending to remember a name', 'social']
]);
