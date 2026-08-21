import { build } from './build.js';

export const FUNNY = build('funny', 'fun', [
  ['e', 'Sneezing', 'nose|achoo|cold|blow', 'situations'],
  ['e', 'Snoring', 'sleep|noise|nose|loud', 'situations'],
  ['e', 'Yawning', 'tired|mouth|sleep|open', 'situations'],
  ['m', 'Hiccups', 'sound|breath|stop|water', 'situations'],
  ['m', 'Tripping in public', 'fall|trip|people|embarrass', 'situations'],
  ['h', 'Laughing at the wrong time', 'laugh|wrong|serious|time', 'situations'],
  ['e', 'Losing your keys', 'key|lost|find|search', 'everyday'],
  ['e', 'Oversleeping', 'sleep|late|alarm|morning', 'everyday'],
  ['m', 'Hitting snooze', 'alarm|sleep|button|morning', 'everyday'],
  ['m', 'Running out of data', 'internet|data|finish|phone', 'everyday'],
  ['m', 'Low battery', 'phone|charge|battery|die', 'everyday'],
  ['h', 'Pretending to be busy', 'busy|pretend|work|look', 'everyday'],
  ['h', 'Forgetting a name', 'name|forget|remember|person', 'awkward'],
  ['h', 'Waving at the wrong person', 'wave|wrong|person|hand', 'awkward'],
  ['h', 'Replying to the wrong chat', 'message|wrong|send|chat', 'awkward'],
  ['h', 'Being left on read', 'message|read|reply|ignore', 'awkward'],
  ['m', 'Talking to yourself', 'talk|alone|self|voice', 'behaviour'],
  ['m', 'Arguing with a machine', 'machine|shout|broken|argue', 'behaviour'],
  ['h', 'Overreacting to a small injury', 'pain|small|cry|hurt', 'behaviour'],
  ['h', 'Pretending you understood', 'understand|pretend|nod|confused', 'behaviour'],
  ['e', 'Dancing badly', 'dance|bad|move|music', 'behaviour'],
  ['m', 'Chasing a mosquito', 'mosquito|hit|night|buzz', 'behaviour'],
  ['h', 'Untangling earphones', 'earphone|knot|wire|tangle', 'struggles'],
  ['h', 'Opening a stubborn jar', 'jar|open|tight|lid', 'struggles'],
  ['m', 'Carrying too much at once', 'carry|many|hands|drop', 'struggles']
]);
