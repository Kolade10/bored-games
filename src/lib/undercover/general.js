import { build } from './build.js';

export const GENERAL = build('general', 'gen', [
  // Animals
  ['e', 'Dog', 'Cat', 'animals'], ['e', 'Lion', 'Tiger', 'animals'],
  ['e', 'Fish', 'Bird', 'animals'], ['m', 'Goat', 'Sheep', 'animals'],
  ['m', 'Crocodile', 'Alligator', 'animals'], ['m', 'Rabbit', 'Hamster', 'animals'],
  ['m', 'Horse', 'Donkey', 'animals'], ['h', 'Frog', 'Toad', 'animals'],
  ['h', 'Turtle', 'Tortoise', 'animals'], ['h', 'Moth', 'Butterfly', 'animals'],
  ['m', 'Snake', 'Lizard', 'animals'], ['e', 'Elephant', 'Giraffe', 'animals'],
  // Food and drink
  ['e', 'Pizza', 'Burger', 'food'], ['m', 'Coffee', 'Tea', 'food'],
  ['m', 'Bread', 'Cake', 'food'], ['h', 'Juice', 'Smoothie', 'food'],
  ['m', 'Rice', 'Pasta', 'food'], ['h', 'Soup', 'Stew', 'food'],
  ['e', 'Chocolate', 'Ice cream', 'food'], ['m', 'Sandwich', 'Wrap', 'food'],
  ['h', 'Biscuit', 'Cookie', 'food'], ['m', 'Milk', 'Yoghurt', 'food'],
  ['e', 'Apple', 'Orange', 'food'], ['h', 'Chips', 'Crisps', 'food'],
  // Places
  ['e', 'Beach', 'Pool', 'places'], ['m', 'Hotel', 'Hostel', 'places'],
  ['m', 'School', 'University', 'places'], ['h', 'Market', 'Mall', 'places'],
  ['m', 'Hospital', 'Clinic', 'places'], ['e', 'Church', 'Mosque', 'places'],
  ['m', 'Airport', 'Train station', 'places'], ['h', 'Restaurant', 'Cafe', 'places'],
  ['m', 'Cinema', 'Theatre', 'places'], ['e', 'Mountain', 'Desert', 'places'],
  ['h', 'Garden', 'Park', 'places'], ['m', 'Library', 'Bookshop', 'places'],
  // Objects
  ['e', 'Phone', 'Laptop', 'objects'], ['m', 'Chair', 'Stool', 'objects'],
  ['h', 'Cup', 'Mug', 'objects'], ['m', 'Bag', 'Suitcase', 'objects'],
  ['e', 'Umbrella', 'Raincoat', 'objects'], ['m', 'Clock', 'Watch', 'objects'],
  ['h', 'Sofa', 'Armchair', 'objects'], ['m', 'Pen', 'Pencil', 'objects'],
  ['m', 'Mirror', 'Window', 'objects'], ['h', 'Blanket', 'Duvet', 'objects'],
  ['e', 'Camera', 'Binoculars', 'objects'], ['m', 'Fan', 'Air conditioner', 'objects'],
  ['h', 'Broom', 'Mop', 'objects'], ['m', 'Candle', 'Torch', 'objects'],
  // Jobs
  ['m', 'Doctor', 'Nurse', 'jobs'], ['m', 'Teacher', 'Lecturer', 'jobs'],
  ['e', 'Chef', 'Waiter', 'jobs'], ['h', 'Lawyer', 'Judge', 'jobs'],
  ['m', 'Pilot', 'Driver', 'jobs'], ['m', 'Barber', 'Hairdresser', 'jobs'],
  ['e', 'Farmer', 'Fisherman', 'jobs'], ['h', 'Tailor', 'Designer', 'jobs'],
  ['m', 'Police officer', 'Security guard', 'jobs'], ['m', 'Singer', 'Dancer', 'jobs'],
  // Activities and transport
  ['e', 'Swimming', 'Running', 'activities'], ['m', 'Dancing', 'Singing', 'activities'],
  ['h', 'Walking', 'Jogging', 'activities'], ['m', 'Reading', 'Writing', 'activities'],
  ['m', 'Cooking', 'Baking', 'activities'], ['h', 'Napping', 'Sleeping', 'activities'],
  ['e', 'Car', 'Bicycle', 'transport'], ['m', 'Bus', 'Taxi', 'transport'],
  ['h', 'Ship', 'Boat', 'transport'], ['m', 'Train', 'Tram', 'transport'],
  ['e', 'Aeroplane', 'Helicopter', 'transport'], ['h', 'Lorry', 'Van', 'transport'],
  // Weather and nature
  ['e', 'Rain', 'Snow', 'nature'], ['m', 'River', 'Lake', 'nature'],
  ['h', 'Fog', 'Mist', 'nature'], ['m', 'Sun', 'Moon', 'nature'],
  ['h', 'Hill', 'Mountain', 'nature'], ['m', 'Forest', 'Jungle', 'nature']
]);
