import { build } from './build.js';

export const GENERAL = build('general', 'gen', [
  // Animals
  ['e', 'Lion', 'animals'], ['e', 'Elephant', 'animals'], ['e', 'Monkey', 'animals'],
  ['e', 'Snake', 'animals'], ['e', 'Chicken', 'animals'], ['e', 'Dog', 'animals'],
  ['e', 'Cat', 'animals'], ['e', 'Fish', 'animals'], ['e', 'Bird', 'animals'],
  ['e', 'Goat', 'animals'], ['e', 'Cow', 'animals'], ['m', 'Giraffe', 'animals'],
  ['m', 'Crocodile', 'animals'], ['m', 'Frog', 'animals'], ['m', 'Butterfly', 'animals'],
  ['m', 'Spider', 'animals'], ['m', 'Penguin', 'animals'], ['m', 'Kangaroo', 'animals'],
  ['m', 'Owl', 'animals'], ['h', 'Chameleon', 'animals'], ['h', 'Octopus', 'animals'],
  // Objects and household
  ['e', 'Umbrella', 'objects'], ['e', 'Phone', 'objects'], ['e', 'Broom', 'objects'],
  ['e', 'Bucket', 'objects'], ['e', 'Chair', 'objects'], ['e', 'Ladder', 'objects'],
  ['e', 'Toothbrush', 'objects'], ['e', 'Mirror', 'objects'], ['e', 'Scissors', 'objects'],
  ['e', 'Pillow', 'objects'], ['e', 'Camera', 'objects'], ['e', 'Guitar', 'objects'],
  ['m', 'Hammer', 'objects'], ['m', 'Kettle', 'objects'], ['m', 'Iron', 'objects'],
  ['m', 'Fan', 'objects'], ['m', 'Torch', 'objects'], ['m', 'Wheelbarrow', 'objects'],
  ['m', 'Sewing machine', 'objects'], ['h', 'Padlock', 'objects'], ['h', 'Stapler', 'objects'],
  // People and jobs
  ['e', 'Doctor', 'jobs'], ['e', 'Teacher', 'jobs'], ['e', 'Police officer', 'jobs'],
  ['e', 'Chef', 'jobs'], ['e', 'Driver', 'jobs'], ['e', 'Footballer', 'jobs'],
  ['e', 'Barber', 'jobs'], ['e', 'Nurse', 'jobs'], ['m', 'Tailor', 'jobs'],
  ['m', 'Mechanic', 'jobs'], ['m', 'Photographer', 'jobs'], ['m', 'Farmer', 'jobs'],
  ['m', 'Pilot', 'jobs'], ['m', 'Waiter', 'jobs'], ['m', 'Security guard', 'jobs'],
  ['h', 'Accountant', 'jobs'], ['h', 'Lawyer', 'jobs'], ['h', 'News presenter', 'jobs'],
  // Transportation
  ['e', 'Car', 'transport'], ['e', 'Bicycle', 'transport'], ['e', 'Aeroplane', 'transport'],
  ['e', 'Boat', 'transport'], ['e', 'Motorcycle', 'transport'], ['m', 'Helicopter', 'transport'],
  ['m', 'Train', 'transport'], ['m', 'Bus', 'transport'], ['m', 'Ambulance', 'transport'],
  ['h', 'Submarine', 'transport'], ['h', 'Hot air balloon', 'transport'],
  // Places
  ['e', 'Hospital', 'places'], ['e', 'Market', 'places'], ['e', 'Church', 'places'],
  ['e', 'School', 'places'], ['e', 'Beach', 'places'], ['m', 'Airport', 'places'],
  ['m', 'Bank', 'places'], ['m', 'Petrol station', 'places'], ['m', 'Barbershop', 'places'],
  ['m', 'Zoo', 'places'], ['h', 'Courtroom', 'places'], ['h', 'Library', 'places'],
  // Actions
  ['e', 'Swimming', 'actions'], ['e', 'Dancing', 'actions'], ['e', 'Sleeping', 'actions'],
  ['e', 'Running', 'actions'], ['e', 'Eating', 'actions'], ['e', 'Crying', 'actions'],
  ['e', 'Laughing', 'actions'], ['e', 'Clapping', 'actions'], ['m', 'Brushing your teeth',
  'actions'], ['m', 'Washing clothes', 'actions'], ['m', 'Tying your shoes', 'actions'],
  ['m', 'Taking a selfie', 'actions'], ['m', 'Reading a book', 'actions'],
  ['m', 'Driving in traffic', 'actions'], ['m', 'Climbing a ladder', 'actions'],
  ['h', 'Threading a needle', 'actions'], ['h', 'Parallel parking', 'actions'],
  ['h', 'Whispering a secret', 'actions']
]);
