import { build } from './build.js';

export const FOOD = build('food', 'foo', [
  ['e', 'Pizza', 'foods'], ['e', 'Banana', 'foods'], ['e', 'Egg', 'foods'],
  ['e', 'Bread', 'foods'], ['e', 'Rice', 'foods'], ['e', 'Grilled chicken', 'foods'],
  ['e', 'Corn', 'foods'], ['e', 'Watermelon', 'foods'], ['m', 'Spaghetti', 'foods'],
  ['m', 'Sandwich', 'foods'], ['m', 'Burger', 'foods'], ['m', 'Salad', 'foods'],
  ['m', 'Soup', 'foods'], ['h', 'Sushi', 'foods'], ['h', 'Barbecue', 'foods'],
  ['e', 'Ice cream', 'desserts'], ['e', 'Cake', 'desserts'], ['e', 'Chocolate', 'desserts'],
  ['m', 'Doughnut', 'desserts'], ['m', 'Birthday cake', 'desserts'],
  ['h', 'Melting ice cream', 'desserts'],
  ['e', 'Drinking water', 'drinks'], ['e', 'Tea', 'drinks'], ['e', 'Coffee', 'drinks'],
  ['m', 'Fizzy drink', 'drinks'], ['m', 'Smoothie', 'drinks'],
  ['h', 'Hot drink burning your tongue', 'drinks'],
  ['e', 'Frying', 'cooking'], ['e', 'Stirring a pot', 'cooking'],
  ['e', 'Washing plates', 'cooking'], ['m', 'Chopping onions', 'cooking'],
  ['m', 'Grating', 'cooking'], ['m', 'Kneading dough', 'cooking'],
  ['m', 'Tasting for salt', 'cooking'], ['m', 'Burning the food', 'cooking'],
  ['h', 'Peeling with a blunt knife', 'cooking'], ['h', 'Following a recipe badly', 'cooking'],
  ['e', 'Waiter taking an order', 'restaurant'], ['m', 'Asking for the bill', 'restaurant'],
  ['m', 'Ordering takeaway', 'restaurant'], ['m', 'Food too spicy to eat', 'restaurant'],
  ['h', 'Sending food back', 'restaurant'], ['h', 'Splitting the bill', 'restaurant']
]);
