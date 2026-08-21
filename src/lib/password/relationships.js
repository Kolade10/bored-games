import { build } from './build.js';

export const RELATIONSHIPS = build('relationships', 'rel', [
  ['e', 'First date', 'date|first|nervous|meet', 'dating'],
  ['e', 'Holding hands', 'hand|hold|couple|touch', 'dating'],
  ['e', 'Giving flowers', 'flower|give|rose|gift', 'dating'],
  ['m', 'Blind date', 'date|stranger|blind|meet', 'dating'],
  ['m', 'Being stood up', 'wait|date|nobody|come', 'dating'],
  ['h', 'The talking stage', 'talk|stage|dating|before', 'dating'],
  ['e', 'Wedding', 'marry|ring|bride|church', 'commitment'],
  ['e', 'Engagement ring', 'ring|propose|finger|marry', 'commitment'],
  ['m', 'Proposal', 'knee|ring|marry|ask', 'commitment'],
  ['m', 'Honeymoon', 'trip|after|wedding|couple', 'commitment'],
  ['h', 'Meeting the in-laws', 'family|parents|meet|partner', 'commitment'],
  ['e', 'Hug', 'arms|hold|squeeze|warm', 'affection'],
  ['m', 'Anniversary', 'year|celebrate|date|remember', 'affection'],
  ['m', 'Surprise gift', 'gift|surprise|give|wrap', 'affection'],
  ['h', 'A long goodbye', 'leave|goodbye|long|wave', 'affection'],
  ['m', 'Argument', 'fight|shout|disagree|angry', 'conflict'],
  ['m', 'Apologising', 'sorry|apologise|forgive|wrong', 'conflict'],
  ['h', 'The silent treatment', 'quiet|ignore|angry|silence', 'conflict'],
  ['h', 'Saying you are fine', 'fine|okay|not|angry', 'conflict'],
  ['h', 'Bringing up the past', 'past|old|remember|argument', 'conflict'],
  ['e', 'Best friend', 'friend|best|close|mate', 'friendship'],
  ['m', 'Group chat', 'chat|group|message|friends', 'friendship'],
  ['m', 'Cancelling plans', 'cancel|plan|stay|excuse', 'friendship'],
  ['h', 'The friend who is always late', 'late|friend|wait|always', 'friendship'],
  ['h', 'Third wheeling', 'couple|three|alone|extra', 'friendship']
]);
