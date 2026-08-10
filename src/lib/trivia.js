// Question source for the trivia game: https://opentdb.com

export const TRIVIA_CATEGORIES = [
  { id: '', name: 'Any category' },
  { id: '9', name: 'General Knowledge' },
  { id: '10', name: 'Books' },
  { id: '11', name: 'Film' },
  { id: '12', name: 'Music' },
  { id: '14', name: 'Television' },
  { id: '15', name: 'Video Games' },
  { id: '17', name: 'Science & Nature' },
  { id: '18', name: 'Computers' },
  { id: '19', name: 'Maths' },
  { id: '20', name: 'Mythology' },
  { id: '21', name: 'Sports' },
  { id: '22', name: 'Geography' },
  { id: '23', name: 'History' },
  { id: '24', name: 'Politics' },
  { id: '25', name: 'Art' },
  { id: '27', name: 'Animals' },
  { id: '28', name: 'Vehicles' }
];

export const TRIVIA_DIFFICULTIES = [
  { id: '', name: 'Any' },
  { id: 'easy', name: 'Easy' },
  { id: 'medium', name: 'Medium' },
  { id: 'hard', name: 'Hard' }
];

export const TIME_OPTIONS = [5, 10, 15, 30];

// OpenTDB returns HTML entities ("&quot;", "&#039;") rather than plain text.
const decodeEntities = (text) => {
  if (typeof text !== 'string') return '';
  if (typeof document === 'undefined') return text;
  const element = document.createElement('textarea');
  element.innerHTML = text;
  return element.value;
};

const shuffle = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const RESPONSE_ERRORS = {
  1: 'Not enough questions for that combination. Try another category or difficulty.',
  2: 'That request was not understood. Please try different settings.',
  3: 'Session token not found.',
  4: 'This category is exhausted. Try another one.',
  5: 'Too many requests to the question service - wait a few seconds and try again.'
};

/**
 * Fetches questions and normalises them into the shape the game stores.
 * @returns {Promise<Array<{question: string, options: string[], correct_answer: string, category: string, difficulty: string}>>}
 */
export async function fetchTriviaQuestions({ amount = 10, category = '', difficulty = '' } = {}) {
  const params = new URLSearchParams({ amount: String(amount), type: 'multiple' });
  if (category) params.set('category', category);
  if (difficulty) params.set('difficulty', difficulty);

  let response;
  try {
    response = await fetch(`https://opentdb.com/api.php?${params}`);
  } catch {
    throw new Error('Could not reach the question service. Check your connection.');
  }

  if (response.status === 429) {
    throw new Error(RESPONSE_ERRORS[5]);
  }
  if (!response.ok) {
    throw new Error('The question service is not responding. Try again shortly.');
  }

  const data = await response.json();
  if (data.response_code !== 0) {
    throw new Error(RESPONSE_ERRORS[data.response_code] || 'Could not load questions.');
  }

  return data.results.map(item => {
    const correct = decodeEntities(item.correct_answer);
    const incorrect = (item.incorrect_answers || []).map(decodeEntities);
    return {
      question: decodeEntities(item.question),
      correct_answer: correct,
      options: shuffle([correct, ...incorrect]),
      category: decodeEntities(item.category),
      difficulty: item.difficulty
    };
  });
}
