import { yesNo } from './types.js';

// Entertainment
export const ENTERTAINMENT = [
  { id: 'ent-001', category: 'entertainment', type: 'multiple_choice', difficulty: 'easy',
    text: 'What would I put on tonight?', tags: ['watching'],
    options: ['A comedy', 'Something with action', 'A documentary', 'Whatever we already started'] },
  { id: 'ent-002', category: 'entertainment', type: 'this_or_that', difficulty: 'easy',
    text: 'Which would I rather watch?', tags: ['format'],
    options: ['A two-hour film', 'Three episodes of a series'] },
  { id: 'ent-003', category: 'entertainment', type: 'multiple_choice', difficulty: 'medium',
    text: 'How do I watch a series?', tags: ['habits'],
    options: ['One episode at a time', 'Binge the whole thing', 'Start loads, finish none', 'Rewatch the same one forever'] },
  ...[
    yesNo('ent-004', 'entertainment', 'easy', 'Do I watch with subtitles on?', ['habits']),
    yesNo('ent-005', 'entertainment', 'easy', 'Would I rewatch a film I have already seen?', ['habits']),
    yesNo('ent-006', 'entertainment', 'medium', 'Do I talk during films?', ['habits']),
    yesNo('ent-007', 'entertainment', 'medium', 'Would I read the book before the film?', ['books']),
    yesNo('ent-008', 'entertainment', 'hard', 'Do I look up the ending before finishing something?', ['habits'])
  ],
  { id: 'ent-009', category: 'entertainment', type: 'multiple_choice', difficulty: 'medium',
    text: 'What genre would I never choose?', tags: ['genre'],
    options: ['Horror', 'Romance', 'Documentary', 'Musical'] },
  { id: 'ent-010', category: 'entertainment', type: 'open_ended', difficulty: 'medium',
    text: 'What is my favourite film of all time?', tags: ['favourite'] },
  { id: 'ent-011', category: 'entertainment', type: 'slider', difficulty: 'medium',
    text: 'How much screen time do I get through in a day?', tags: ['habits'],
    labels: ['Barely any', 'All day'] },
  { id: 'ent-012', category: 'entertainment', type: 'multiple_choice', difficulty: 'medium',
    text: 'What is my phone doing while I watch something?', tags: ['habits'],
    options: ['In my hand the whole time', 'Face down nearby', 'Another room', 'Depends how good it is'] },
  { id: 'ent-013', category: 'entertainment', type: 'this_or_that', difficulty: 'medium',
    text: 'Where would I rather watch something?', tags: ['venue'],
    options: ['Cinema', 'Sofa at home'] },
  { id: 'ent-014', category: 'entertainment', type: 'multiple_choice', difficulty: 'hard',
    text: 'What would I watch when nobody is around to judge me?', tags: ['guilty'],
    options: ['Reality TV', 'Cartoons', 'Old episodes of something', 'Cooking videos'] },
  { id: 'ent-015', category: 'entertainment', type: 'multiple_choice', difficulty: 'easy',
    text: 'What do I do during adverts or a slow scene?', tags: ['habits'],
    options: ['Skip immediately', 'Check my phone', 'Get a snack', 'Sit through it'] },
  { id: 'ent-016', category: 'entertainment', type: 'number', difficulty: 'hard',
    text: 'How many episodes could I watch in one sitting?', tags: ['binge'],
    min: 1, max: 15, unit: 'episodes' }
];
