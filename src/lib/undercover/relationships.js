import { build } from './build.js';

export const RELATIONSHIPS = build('relationships', 'rel', [
  ['e', 'Date', 'Hangout', 'dating'], ['m', 'Crush', 'Boyfriend', 'dating'],
  ['h', 'Talking stage', 'Situationship', 'dating'], ['m', 'Flirting', 'Teasing', 'dating'],
  ['e', 'First date', 'Blind date', 'dating'], ['h', 'Ex', 'Old friend', 'dating'],
  ['m', 'Engagement', 'Wedding', 'commitment'], ['h', 'Proposal', 'Promise', 'commitment'],
  ['m', 'Marriage', 'Partnership', 'commitment'], ['e', 'Ring', 'Necklace', 'commitment'],
  ['h', 'Honeymoon', 'Holiday', 'commitment'], ['m', 'Anniversary', 'Birthday', 'commitment'],
  ['e', 'Hug', 'Handshake', 'affection'], ['h', 'Compliment', 'Flattery', 'affection'],
  ['m', 'Gift', 'Surprise', 'affection'], ['h', 'Text', 'Letter', 'affection'],
  ['m', 'Flowers', 'Chocolate', 'affection'], ['e', 'Love', 'Friendship', 'affection'],
  ['m', 'Argument', 'Debate', 'conflict'], ['h', 'Silent treatment', 'Cold shoulder', 'conflict'],
  ['m', 'Breakup', 'Fight', 'conflict'], ['h', 'Jealousy', 'Envy', 'conflict'],
  ['e', 'Apology', 'Explanation', 'conflict'], ['m', 'Trust', 'Loyalty', 'conflict'],
  ['e', 'Family', 'Friends', 'people'], ['m', 'In laws', 'Relatives', 'people'],
  ['h', 'Best friend', 'Close friend', 'people'], ['m', 'Neighbour', 'Colleague', 'people'],
  ['h', 'Roommate', 'Housemate', 'people'], ['e', 'Wedding', 'Reception', 'people']
]);
