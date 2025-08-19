// Comprehensive word lists for Name Place Thing validation
// This provides better coverage than relying solely on dictionary APIs

export const COMPREHENSIVE_NAMES = [
  // Common first names (male)
  'aaron', 'adam', 'adrian', 'alan', 'albert', 'alex', 'alexander', 'andrew', 'anthony', 'antonio',
  'arthur', 'austin', 'benjamin', 'blake', 'brandon', 'brian', 'bruce', 'bryan', 'carl', 'carlos',
  'charles', 'chris', 'christopher', 'daniel', 'david', 'dennis', 'donald', 'douglas', 'edward',
  'eric', 'ethan', 'eugene', 'frank', 'gary', 'george', 'gerald', 'gregory', 'harold', 'henry',
  'howard', 'jack', 'jacob', 'james', 'jason', 'jeffrey', 'jeremy', 'jerry', 'jesse', 'john',
  'jonathan', 'jordan', 'jose', 'joseph', 'joshua', 'juan', 'justin', 'keith', 'kenneth', 'kevin',
  'larry', 'lawrence', 'louis', 'mark', 'matthew', 'michael', 'nathan', 'nicholas', 'noah', 'patrick',
  'paul', 'peter', 'philip', 'raymond', 'richard', 'robert', 'roger', 'ronald', 'ryan', 'samuel',
  'scott', 'sean', 'stephen', 'steven', 'thomas', 'timothy', 'victor', 'walter', 'wayne', 'william',
  
  // Common first names (female)
  'abigail', 'alice', 'amanda', 'amy', 'andrea', 'angela', 'anna', 'anne', 'ashley', 'barbara',
  'betty', 'brenda', 'carol', 'carolyn', 'catherine', 'charlotte', 'cheryl', 'christina', 'christine',
  'cynthia', 'deborah', 'denise', 'diana', 'diane', 'donna', 'dorothy', 'elizabeth', 'emily', 'emma',
  'evelyn', 'frances', 'grace', 'hannah', 'helen', 'irene', 'isabella', 'jacqueline', 'jane', 'janet',
  'janice', 'jean', 'jennifer', 'jessica', 'joan', 'joyce', 'judith', 'judy', 'julia', 'julie',
  'karen', 'katherine', 'kathleen', 'kathryn', 'kelly', 'kimberly', 'laura', 'lauren', 'linda',
  'lisa', 'lori', 'louise', 'madison', 'margaret', 'maria', 'marie', 'marilyn', 'martha', 'mary',
  'megan', 'melissa', 'michelle', 'nancy', 'nicole', 'olivia', 'pamela', 'patricia', 'rachel',
  'rebecca', 'ruth', 'samantha', 'sandra', 'sara', 'sarah', 'sharon', 'stephanie', 'susan', 'teresa',
  'theresa', 'virginia', 'wendy',
  
  // International names
  'ahmed', 'ali', 'amir', 'anya', 'chen', 'dmitri', 'elena', 'fatima', 'giovanni', 'hans',
  'ibrahim', 'ivan', 'jean', 'jose', 'juan', 'luigi', 'maria', 'mohamed', 'nina', 'olga',
  'pablo', 'pierre', 'raj', 'sofia', 'tomas', 'viktor', 'xavier', 'yuki', 'zhang'
];

export const COMPREHENSIVE_PLACES = [
  // World capitals
  'beijing', 'berlin', 'bern', 'bogota', 'brasilia', 'brussels', 'budapest', 'cairo', 'canberra',
  'copenhagen', 'delhi', 'dublin', 'helsinki', 'islamabad', 'jakarta', 'kabul', 'lima', 'lisbon',
  'london', 'madrid', 'moscow', 'oslo', 'ottawa', 'paris', 'prague', 'reykjavik', 'rome', 'seoul',
  'stockholm', 'tokyo', 'vienna', 'warsaw',
  
  // Major cities
  'amsterdam', 'atlanta', 'auckland', 'austin', 'baltimore', 'bangkok', 'barcelona', 'birmingham',
  'boston', 'calgary', 'chicago', 'cologne', 'dallas', 'denver', 'detroit', 'dubai', 'florence',
  'frankfurt', 'geneva', 'glasgow', 'hamburg', 'houston', 'istanbul', 'las vegas', 'los angeles',
  'manchester', 'melbourne', 'miami', 'milan', 'montreal', 'munich', 'naples', 'new york',
  'orlando', 'philadelphia', 'phoenix', 'portland', 'san francisco', 'seattle', 'sydney', 'toronto',
  'turin', 'vancouver', 'venice', 'zurich',
  
  // Countries
  'afghanistan', 'albania', 'algeria', 'argentina', 'armenia', 'australia', 'austria', 'azerbaijan',
  'bahrain', 'bangladesh', 'belarus', 'belgium', 'bolivia', 'brazil', 'bulgaria', 'cambodia',
  'canada', 'chile', 'china', 'colombia', 'croatia', 'cuba', 'cyprus', 'denmark', 'ecuador',
  'egypt', 'estonia', 'ethiopia', 'finland', 'france', 'georgia', 'germany', 'ghana', 'greece',
  'hungary', 'iceland', 'india', 'indonesia', 'iran', 'iraq', 'ireland', 'israel', 'italy',
  'japan', 'jordan', 'kazakhstan', 'kenya', 'kuwait', 'latvia', 'lebanon', 'libya', 'lithuania',
  'luxembourg', 'madagascar', 'malaysia', 'mexico', 'morocco', 'nepal', 'netherlands', 'nigeria',
  'norway', 'pakistan', 'peru', 'philippines', 'poland', 'portugal', 'qatar', 'romania', 'russia',
  'singapore', 'slovakia', 'slovenia', 'somalia', 'spain', 'sweden', 'switzerland', 'thailand',
  'tunisia', 'turkey', 'ukraine', 'uruguay', 'venezuela', 'vietnam', 'yemen',
  
  // US States
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut', 'delaware',
  'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa', 'kansas', 'kentucky',
  'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi',
  'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey', 'new mexico',
  'new york', 'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania',
  'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas', 'utah', 'vermont',
  'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming',
  
  // Geographic features
  'alps', 'amazon', 'andes', 'arctic', 'atlantic', 'everest', 'himalayas', 'mediterranean',
  'mississippi', 'nile', 'pacific', 'sahara', 'tibet'
];

export const COMPREHENSIVE_ANIMALS = [
  // Mammals
  'aardvark', 'alpaca', 'antelope', 'ape', 'armadillo', 'badger', 'bat', 'bear', 'beaver', 'bison',
  'buffalo', 'camel', 'cat', 'cheetah', 'chimpanzee', 'cow', 'deer', 'dog', 'dolphin', 'donkey',
  'elephant', 'elk', 'ferret', 'fox', 'giraffe', 'goat', 'gorilla', 'hamster', 'hedgehog', 'hippo',
  'horse', 'hyena', 'jaguar', 'kangaroo', 'koala', 'lamb', 'leopard', 'lion', 'llama', 'lynx',
  'mole', 'monkey', 'moose', 'mouse', 'otter', 'panda', 'pig', 'porcupine', 'rabbit', 'raccoon',
  'rat', 'rhinoceros', 'seal', 'sheep', 'skunk', 'sloth', 'squirrel', 'tiger', 'walrus', 'whale',
  'wolf', 'zebra',
  
  // Birds
  'albatross', 'canary', 'cardinal', 'chicken', 'crane', 'crow', 'duck', 'eagle', 'falcon', 'finch',
  'flamingo', 'goose', 'hawk', 'heron', 'hummingbird', 'kingfisher', 'magpie', 'ostrich', 'owl',
  'parrot', 'peacock', 'pelican', 'penguin', 'pigeon', 'robin', 'sparrow', 'stork', 'swan', 'turkey',
  'vulture', 'woodpecker',
  
  // Fish & Marine
  'anchovy', 'barracuda', 'bass', 'cod', 'crab', 'eel', 'flounder', 'goldfish', 'grouper', 'halibut',
  'herring', 'jellyfish', 'lobster', 'mackerel', 'octopus', 'salmon', 'sardine', 'shark', 'shrimp',
  'squid', 'starfish', 'swordfish', 'trout', 'tuna',
  
  // Reptiles & Amphibians
  'alligator', 'chameleon', 'cobra', 'crocodile', 'frog', 'gecko', 'iguana', 'lizard', 'python',
  'salamander', 'snake', 'toad', 'tortoise', 'turtle', 'viper',
  
  // Insects & Others
  'ant', 'bee', 'beetle', 'butterfly', 'caterpillar', 'cockroach', 'cricket', 'dragonfly', 'firefly',
  'flea', 'fly', 'grasshopper', 'ladybug', 'mosquito', 'moth', 'scorpion', 'spider', 'wasp'
];

export const COMPREHENSIVE_THINGS = [
  // Household items
  'alarm', 'basket', 'blanket', 'bottle', 'bowl', 'box', 'brush', 'bucket', 'candle', 'chair',
  'clock', 'couch', 'cup', 'curtain', 'desk', 'dish', 'door', 'fan', 'fork', 'glass', 'hammer',
  'jar', 'key', 'knife', 'ladder', 'lamp', 'mirror', 'mug', 'needle', 'pan', 'paper', 'pen',
  'pencil', 'pillow', 'plate', 'pot', 'radio', 'rope', 'ruler', 'scissors', 'shelf', 'soap',
  'spoon', 'table', 'thread', 'towel', 'umbrella', 'vase', 'wallet', 'watch', 'window',
  
  // Technology
  'antenna', 'battery', 'cable', 'camera', 'computer', 'device', 'engine', 'gadget', 'keyboard',
  'laptop', 'machine', 'monitor', 'motor', 'phone', 'printer', 'robot', 'screen', 'sensor',
  'speaker', 'switch', 'tablet', 'television', 'transmitter',
  
  // Clothing
  'belt', 'boot', 'coat', 'dress', 'glove', 'hat', 'jacket', 'jeans', 'pants', 'scarf', 'shirt',
  'shoe', 'skirt', 'sock', 'suit', 'sweater', 'tie',
  
  // Food items
  'apple', 'banana', 'bread', 'butter', 'cake', 'candy', 'carrot', 'cheese', 'chocolate', 'cookie',
  'cream', 'egg', 'fish', 'fruit', 'honey', 'ice', 'jam', 'meat', 'milk', 'nut', 'orange', 'pasta',
  'pizza', 'potato', 'rice', 'salad', 'sandwich', 'soup', 'sugar', 'tea', 'tomato', 'vegetable',
  'water', 'wine',
  
  // Tools & Equipment
  'axe', 'drill', 'file', 'gear', 'instrument', 'lever', 'nail', 'pliers', 'saw', 'screw',
  'screwdriver', 'tool', 'wrench',
  
  // Abstract concepts
  'adventure', 'art', 'beauty', 'chance', 'chaos', 'choice', 'concept', 'courage', 'danger',
  'dream', 'emotion', 'energy', 'faith', 'freedom', 'future', 'happiness', 'hope', 'idea',
  'imagination', 'justice', 'knowledge', 'language', 'legend', 'liberty', 'logic', 'love',
  'magic', 'memory', 'mystery', 'nature', 'opportunity', 'passion', 'peace', 'philosophy',
  'power', 'progress', 'purpose', 'quality', 'reality', 'reason', 'responsibility', 'science',
  'secret', 'spirit', 'strength', 'success', 'thought', 'time', 'tradition', 'truth', 'unity',
  'value', 'victory', 'virtue', 'wisdom', 'wonder'
];

// Helper function to check if word exists in any comprehensive list
export function findInComprehensiveLists(word, category) {
  const cleanWord = word.trim().toLowerCase();
  
  switch (category) {
    case 'name':
      return COMPREHENSIVE_NAMES.includes(cleanWord);
    case 'place':
      return COMPREHENSIVE_PLACES.includes(cleanWord);
    case 'animal':
      return COMPREHENSIVE_ANIMALS.includes(cleanWord);
    case 'thing':
      return COMPREHENSIVE_THINGS.includes(cleanWord);
    default:
      return false;
  }
}
