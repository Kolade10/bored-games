// Curated word lists for Name Place Animal Thing.
//
// These are checked before the dictionary API, because they are instant and
// because no English dictionary covers proper nouns - a player answering
// "Yetunde" or "Xiamen" should not be penalised for it.
//
// Organised by first letter so gaps are obvious: a letter with a thin list is
// a letter where players get scored unfairly. Every category covers all 26.
// Overlap between categories is fine and intentional (a bat is an animal and
// a thing; Victoria is a name and a place) - lookups are always per category.

export const COMPREHENSIVE_NAMES = [
  // A
  'aaron', 'abigail', 'adam', 'adaeze', 'ade', 'adebayo', 'adrian', 'ahmed', 'aisha', 'alan',
  'albert', 'alex', 'alexander', 'alice', 'amaka', 'amanda', 'amara', 'amina', 'amy', 'ana',
  'anders', 'andrea', 'andrew', 'angela', 'anna', 'anne', 'anthony', 'antonio', 'arthur',
  'ashley', 'austin', 'ayesha', 'ayo',
  // B
  'barbara', 'beatrice', 'ben', 'benjamin', 'bernard', 'beth', 'betty', 'bianca', 'bilal',
  'blake', 'bola', 'bolanle', 'bonnie', 'boris', 'brandon', 'brenda', 'brian', 'bruce',
  'bruno', 'bryan', 'bukola', 'byron',
  // C
  'caleb', 'camila', 'carl', 'carlos', 'carmen', 'carol', 'caroline', 'catherine', 'cecilia',
  'charles', 'charlotte', 'chen', 'cheryl', 'chidi', 'chinelo', 'chloe', 'chris', 'christian',
  'christina', 'christopher', 'claire', 'clara', 'claude', 'colin', 'connor', 'craig', 'cynthia',
  // D
  'dalia', 'damian', 'damilola', 'dami', 'dana', 'daniel', 'danielle', 'dario', 'david', 'dawn',
  'deborah', 'dennis', 'derek', 'diana', 'diane', 'diego', 'dilip', 'dmitri', 'donald', 'donna',
  'dorothy', 'douglas', 'dylan',
  // E
  'ebony', 'eddie', 'edith', 'edward', 'efe', 'ekaterina', 'elena', 'eli', 'elijah', 'elizabeth',
  'ella', 'emeka', 'emily', 'emma', 'enzo', 'eric', 'erin', 'esther', 'ethan', 'eugene', 'eva',
  'evelyn', 'ezra',
  // F
  'fabian', 'faith', 'farah', 'fatima', 'felix', 'fernando', 'fiona', 'florence', 'frances',
  'francesca', 'francis', 'frank', 'franklin', 'fred', 'freya', 'fumi', 'funke',
  // G
  'gabriel', 'gail', 'gary', 'gavin', 'gbenga', 'gemma', 'george', 'gerald', 'gina', 'giovanni',
  'gloria', 'grace', 'graham', 'greg', 'gregory', 'gunther', 'gustavo',
  // H
  'hakeem', 'hamza', 'hannah', 'hans', 'harold', 'harriet', 'harry', 'hassan', 'hazel',
  'heather', 'hector', 'helen', 'henry', 'hilda', 'holly', 'hope', 'howard', 'hugo', 'hussain',
  // I
  'ian', 'ibrahim', 'ida', 'idris', 'ifeoma', 'ignacio', 'igor', 'ilya', 'imani', 'imran',
  'ines', 'ingrid', 'irene', 'iris', 'isaac', 'isabella', 'isaiah', 'ismail', 'ivan', 'ivy',
  'iyabo',
  // J
  'jack', 'jackson', 'jacob', 'jade', 'jamal', 'james', 'jane', 'janet', 'jasmine', 'jason',
  'javier', 'jean', 'jennifer', 'jeremy', 'jerry', 'jessica', 'joan', 'joel', 'john',
  'jonathan', 'jordan', 'jose', 'joseph', 'joshua', 'joy', 'juan', 'judith', 'julia', 'julian',
  'julie', 'justin',
  // K
  'kabir', 'kai', 'kamal', 'kamala', 'karen', 'karim', 'kate', 'katherine', 'kathleen',
  'katrina', 'kayode', 'keith', 'kelly', 'kenneth', 'kevin', 'khalid', 'kim', 'kimberly',
  'kofi', 'kolade', 'konstantin', 'kwame', 'kyle',
  // L
  'lara', 'larry', 'laura', 'lauren', 'lawrence', 'layla', 'leah', 'lee', 'leila', 'leo',
  'leon', 'leonard', 'leslie', 'liam', 'lila', 'lily', 'linda', 'lisa', 'liu', 'logan',
  'lorenzo', 'louis', 'louise', 'lucas', 'lucy', 'luis', 'luke', 'lydia',
  // M
  'mabel', 'madison', 'mahmoud', 'malik', 'mandy', 'manuel', 'marcus', 'margaret', 'maria',
  'marie', 'mario', 'mark', 'martha', 'martin', 'mary', 'mason', 'mateo', 'matthew', 'maya',
  'megan', 'mehmet', 'melissa', 'mercy', 'mia', 'michael', 'michelle', 'miguel', 'mikhail',
  'mohamed', 'molly', 'monica', 'moses', 'muhammad', 'murtala',
  // N
  'nadia', 'nancy', 'naomi', 'natalia', 'nathan', 'neil', 'nelson', 'ngozi', 'nicholas',
  'nicole', 'nina', 'nkem', 'nnamdi', 'noah', 'noor', 'nora', 'norman', 'nuru',
  // O
  'obi', 'octavia', 'odette', 'olamide', 'oleg', 'olga', 'oliver', 'olivia', 'oluwaseun',
  'omar', 'omolara', 'onyeka', 'ope', 'ophelia', 'orion', 'orla', 'oscar', 'osei', 'osman',
  'otis', 'owen', 'oyinkan',
  // P
  'pablo', 'pamela', 'patricia', 'patrick', 'paul', 'paula', 'pedro', 'penelope', 'peter',
  'philip', 'phoebe', 'pierre', 'piotr', 'precious', 'priscilla', 'priya',
  // Q
  'qadir', 'qamar', 'qasim', 'qiang', 'qing', 'queenie', 'quentin', 'quiana', 'quincy',
  'quinn', 'quintin', 'quinton',
  // R
  'rachel', 'radha', 'rafael', 'rahul', 'raj', 'ramona', 'randy', 'raphael', 'rasheed',
  'raymond', 'rebecca', 'regina', 'remi', 'rene', 'ricardo', 'richard', 'rita', 'robert',
  'roberto', 'robin', 'roger', 'roman', 'ronald', 'rosa', 'rose', 'ruby', 'russell', 'ruth',
  'ryan',
  // S
  'sadia', 'salma', 'samantha', 'samuel', 'sandra', 'sara', 'sarah', 'scott', 'sean',
  'sebastian', 'sergio', 'seun', 'shane', 'sharon', 'sheila', 'shirley', 'sofia', 'solomon',
  'sonia', 'sophia', 'stanley', 'stella', 'stephanie', 'stephen', 'steven', 'sunday', 'susan',
  'suzanne', 'sylvia',
  // T
  'tamara', 'tania', 'tara', 'taylor', 'teresa', 'terry', 'thabo', 'thomas', 'timothy', 'tina',
  'tobi', 'toby', 'todd', 'tolu', 'tom', 'tomas', 'tracy', 'travis', 'trevor', 'tunde', 'tyler',
  // U
  'ubong', 'uche', 'udo', 'ugo', 'ulrich', 'ulysses', 'uma', 'umar', 'unai', 'upton', 'urban',
  'uriah', 'uriel', 'ursula', 'usha', 'usman', 'uzo', 'uzoma',
  // V
  'valentina', 'valerie', 'vanessa', 'vera', 'veronica', 'victor', 'victoria', 'vijay',
  'vikram', 'vincent', 'viola', 'violet', 'virginia', 'vivian', 'vladimir',
  // W
  'wade', 'walter', 'wanda', 'warren', 'wayne', 'wendy', 'wesley', 'wilfred', 'william',
  'willie', 'wilson', 'winston', 'wole',
  // X
  'xander', 'xavier', 'xena', 'xerxes', 'xiang', 'ximena', 'xin', 'xiomara', 'xiu', 'xochitl',
  // Y
  'yakubu', 'yara', 'yasmin', 'yemi', 'yetunde', 'yinka', 'yohannes', 'yolanda', 'yosef',
  'yuki', 'yuri', 'yusuf', 'yvette', 'yvonne',
  // Z
  'zachary', 'zahra', 'zainab', 'zane', 'zara', 'zeke', 'zelda', 'zeynep', 'zoe', 'zola',
  'zoya', 'zubair', 'zuri'
];

export const COMPREHENSIVE_PLACES = [
  // A
  'aba', 'abeokuta', 'abidjan', 'abuja', 'accra', 'addis ababa', 'adelaide', 'afghanistan',
  'akure', 'alaska', 'albania', 'albany', 'alberta', 'algeria', 'algiers', 'amazon',
  'amsterdam', 'anchorage', 'andorra', 'angola', 'ankara', 'antarctica', 'antigua',
  'argentina', 'arizona', 'arkansas', 'armenia', 'asia', 'athens', 'atlanta', 'auckland',
  'australia', 'austria', 'azerbaijan',
  // B
  'baghdad', 'bahamas', 'bahrain', 'baku', 'bali', 'baltimore', 'bamako', 'bangkok',
  'bangladesh', 'barbados', 'barcelona', 'bauchi', 'bayelsa', 'beijing', 'beirut', 'belarus',
  'belfast', 'belgium', 'belgrade', 'belize', 'benin', 'benue', 'bergen', 'berlin', 'bermuda',
  'bern', 'bhutan', 'birmingham', 'bogota', 'bolivia', 'bordeaux', 'borneo', 'borno', 'bosnia',
  'boston', 'botswana', 'brasilia', 'bratislava', 'brazil', 'brisbane', 'bristol', 'brussels',
  'bucharest', 'budapest', 'buenos aires', 'bulgaria', 'burundi',
  // C
  'cairo', 'calabar', 'calgary', 'california', 'cambodia', 'cameroon', 'canada', 'canberra',
  'cancun', 'cape town', 'caracas', 'cardiff', 'caribbean', 'casablanca', 'chad', 'chennai',
  'chicago', 'chile', 'china', 'cologne', 'colombia', 'colorado', 'congo', 'copenhagen',
  'cordoba', 'costa rica', 'croatia', 'cuba', 'cyprus', 'czechia',
  // D
  'dakar', 'dallas', 'damascus', 'damaturu', 'delaware', 'delhi', 'delta', 'denmark', 'denver',
  'detroit', 'dhaka', 'djibouti', 'doha', 'dominica', 'dortmund', 'dresden', 'dubai', 'dublin',
  'durban', 'dusseldorf',
  // E
  'ecuador', 'edinburgh', 'edmonton', 'edo', 'egypt', 'ekiti', 'england', 'enugu', 'epe',
  'eritrea', 'estonia', 'ethiopia', 'europe', 'everest',
  // F
  'fiji', 'finland', 'florence', 'florida', 'france', 'frankfurt', 'freetown', 'fresno',
  'fukuoka', 'funafuti',
  // G
  'gabon', 'galway', 'gambia', 'geneva', 'georgia', 'germany', 'ghana', 'gibraltar', 'glasgow',
  'goa', 'gombe', 'gothenburg', 'greece', 'greenland', 'grenada', 'guatemala', 'guinea',
  'gusau', 'guyana',
  // H
  'hague', 'haiti', 'halifax', 'hamburg', 'hanoi', 'harare', 'havana', 'hawaii', 'helsinki',
  'himalayas', 'hiroshima', 'honduras', 'hong kong', 'honolulu', 'houston', 'hungary',
  'hyderabad',
  // I
  'ibadan', 'iceland', 'idaho', 'ikeja', 'illinois', 'ilorin', 'imo', 'india', 'indiana',
  'indonesia', 'iowa', 'iran', 'iraq', 'ireland', 'islamabad', 'israel', 'istanbul', 'italy',
  'ivory coast',
  // J
  'jakarta', 'jamaica', 'japan', 'java', 'jeddah', 'jerusalem', 'jigawa', 'johannesburg',
  'jordan', 'jos', 'juba',
  // K
  'kabul', 'kaduna', 'kampala', 'kano', 'kansas', 'karachi', 'kathmandu', 'katsina',
  'kazakhstan', 'kebbi', 'kentucky', 'kenya', 'khartoum', 'kiev', 'kigali', 'kingston',
  'kinshasa', 'kiribati', 'kogi', 'kolkata', 'korea', 'kosovo', 'kuala lumpur', 'kuwait',
  'kwara', 'kyoto', 'kyrgyzstan',
  // L
  'lagos', 'lahore', 'laos', 'latvia', 'lebanon', 'leeds', 'leipzig', 'lesotho', 'liberia',
  'libya', 'liechtenstein', 'lima', 'lisbon', 'lithuania', 'liverpool', 'ljubljana', 'lokoja',
  'london', 'los angeles', 'louisiana', 'luanda', 'lusaka', 'luxembourg', 'lyon',
  // M
  'macau', 'madagascar', 'madrid', 'maiduguri', 'maine', 'makurdi', 'malawi', 'malaysia',
  'maldives', 'mali', 'malta', 'managua', 'manchester', 'manila', 'manitoba', 'maputo',
  'marseille', 'maryland', 'mauritius', 'mecca', 'medellin', 'melbourne', 'memphis', 'mexico',
  'miami', 'michigan', 'milan', 'minna', 'minnesota', 'minsk', 'mississippi', 'missouri',
  'mogadishu', 'moldova', 'monaco', 'mongolia', 'montana', 'montenegro', 'montevideo',
  'montreal', 'morocco', 'moscow', 'mozambique', 'mumbai', 'munich', 'myanmar',
  // N
  'nagoya', 'nairobi', 'namibia', 'naples', 'nasarawa', 'nashville', 'nassau', 'nauru',
  'nebraska', 'nepal', 'netherlands', 'nevada', 'newcastle', 'nicaragua', 'nice', 'niger',
  'nigeria', 'nnewi', 'norway', 'nottingham', 'nouakchott', 'nsukka',
  // O
  'oakland', 'oaxaca', 'oceania', 'odessa', 'ogun', 'ohio', 'okinawa', 'oklahoma', 'oman',
  'ondo', 'onitsha', 'ontario', 'oregon', 'osaka', 'oslo', 'osun', 'ottawa', 'owerri',
  'oxford', 'oyo',
  // P
  'pakistan', 'palermo', 'palestine', 'panama', 'paraguay', 'paris', 'patagonia', 'perth',
  'peru', 'philadelphia', 'philippines', 'phnom penh', 'phoenix', 'plateau', 'poland',
  'port harcourt', 'portugal', 'prague', 'pretoria', 'puerto rico', 'pune', 'pyongyang',
  // Q
  'qatar', 'qingdao', 'qom', 'quebec', 'queensland', 'queenstown', 'quetta', 'quezon', 'quito',
  // R
  'rabat', 'raleigh', 'rawalpindi', 'recife', 'reykjavik', 'rhode island', 'richmond', 'riga',
  'rio de janeiro', 'rivers', 'riyadh', 'romania', 'rome', 'rotterdam', 'russia', 'rwanda',
  // S
  'sacramento', 'sahara', 'samoa', 'san diego', 'san francisco', 'santiago', 'sao paulo',
  'sarajevo', 'saskatchewan', 'saudi arabia', 'scotland', 'seattle', 'senegal', 'seoul',
  'serbia', 'seville', 'seychelles', 'shanghai', 'sheffield', 'siberia', 'sicily', 'singapore',
  'skopje', 'slovakia', 'slovenia', 'sofia', 'sokoto', 'somalia', 'spain', 'sparta',
  'sri lanka', 'stockholm', 'strasbourg', 'sudan', 'suriname', 'sweden', 'switzerland',
  'sydney', 'syria',
  // T
  'taipei', 'taiwan', 'tajikistan', 'tallinn', 'tampa', 'tanzania', 'taraba', 'tashkent',
  'tbilisi', 'tehran', 'tel aviv', 'tennessee', 'texas', 'thailand', 'tijuana', 'tirana',
  'togo', 'tokyo', 'toronto', 'toulouse', 'tripoli', 'tunis', 'tunisia', 'turin', 'turkey',
  'turkmenistan',
  // U
  'uganda', 'ughelli', 'ukraine', 'ulaanbaatar', 'umuahia', 'uruguay', 'utah', 'uyo',
  'uzbekistan',
  // V
  'vaduz', 'valencia', 'vancouver', 'vanuatu', 'vatican', 'venezuela', 'venice', 'veracruz',
  'vermont', 'verona', 'victoria', 'vienna', 'vietnam', 'vilnius', 'virginia', 'vladivostok',
  // W
  'wales', 'warri', 'warsaw', 'washington', 'wellington', 'wichita', 'windhoek', 'winnipeg',
  'wisconsin', 'wuhan', 'wukari', 'wyoming',
  // X
  'xalapa', 'xanthi', 'xiamen', 'xian', 'xinjiang', 'xochimilco', 'xuzhou',
  // Y
  'yamoussoukro', 'yangon', 'yaounde', 'yekaterinburg', 'yemen', 'yenagoa', 'yerevan', 'yobe',
  'yokohama', 'yola', 'york', 'yorkshire', 'yosemite', 'yukon',
  // Z
  'zagreb', 'zambia', 'zamfara', 'zanzibar', 'zaragoza', 'zaria', 'zhengzhou', 'zimbabwe',
  'zurich'
];

export const COMPREHENSIVE_ANIMALS = [
  // A
  'aardvark', 'adder', 'albatross', 'alligator', 'alpaca', 'anaconda', 'anchovy', 'angelfish',
  'ant', 'anteater', 'antelope', 'ape', 'aphid', 'armadillo', 'avocet', 'axolotl',
  // B
  'baboon', 'badger', 'bandicoot', 'barracuda', 'bat', 'bear', 'beaver', 'bee', 'beetle',
  'bison', 'blackbird', 'boa', 'boar', 'bobcat', 'budgerigar', 'buffalo', 'bull', 'bullfrog',
  'bumblebee', 'butterfly', 'buzzard',
  // C
  'camel', 'canary', 'capybara', 'cardinal', 'caribou', 'carp', 'cat', 'caterpillar', 'catfish',
  'centipede', 'chameleon', 'cheetah', 'chicken', 'chimpanzee', 'chinchilla', 'chipmunk',
  'cicada', 'clam', 'cobra', 'cockatoo', 'cockroach', 'cod', 'condor', 'cougar', 'cow',
  'coyote', 'crab', 'crane', 'cricket', 'crocodile', 'crow', 'cuckoo',
  // D
  'dachshund', 'deer', 'dingo', 'dinosaur', 'dodo', 'dog', 'dolphin', 'donkey', 'dormouse',
  'dove', 'dragonfly', 'dromedary', 'duck', 'dugong',
  // E
  'eagle', 'earthworm', 'echidna', 'eel', 'egret', 'eland', 'elephant', 'elk', 'emu', 'ermine',
  // F
  'falcon', 'fawn', 'ferret', 'finch', 'firefly', 'fish', 'flamingo', 'flea', 'flounder',
  'fly', 'fox', 'frog',
  // G
  'gannet', 'gazelle', 'gecko', 'gerbil', 'gibbon', 'giraffe', 'gnat', 'gnu', 'goat',
  'goldfish', 'goose', 'gopher', 'gorilla', 'grasshopper', 'grouse', 'guinea pig', 'gull',
  'guppy',
  // H
  'haddock', 'halibut', 'hamster', 'hare', 'harrier', 'hawk', 'hedgehog', 'heron', 'herring',
  'hippopotamus', 'hornet', 'horse', 'hound', 'hummingbird', 'hyena', 'hyrax',
  // I
  'ibex', 'ibis', 'iguana', 'impala', 'inchworm', 'indri', 'insect', 'isopod',
  // J
  'jackal', 'jackrabbit', 'jaguar', 'javelina', 'jay', 'jellyfish', 'jerboa', 'junco',
  // K
  'kangaroo', 'katydid', 'kingfisher', 'kite', 'kiwi', 'koala', 'kookaburra', 'krill', 'kudu',
  // L
  'ladybug', 'lamb', 'lamprey', 'lark', 'lemming', 'lemur', 'leopard', 'limpet', 'lion',
  'lizard', 'llama', 'lobster', 'locust', 'loris', 'lynx', 'lyrebird',
  // M
  'macaque', 'macaw', 'mackerel', 'magpie', 'mallard', 'mamba', 'manatee', 'mandrill', 'mantis',
  'marmot', 'marten', 'meerkat', 'mink', 'minnow', 'mole', 'mongoose', 'monkey', 'moose',
  'mosquito', 'moth', 'mouse', 'mule', 'mussel',
  // N
  'narwhal', 'nene', 'newt', 'nightingale', 'numbat', 'nuthatch', 'nutria', 'nyala',
  // O
  'ocelot', 'octopus', 'okapi', 'opossum', 'orangutan', 'orca', 'oriole', 'oryx', 'osprey',
  'ostrich', 'otter', 'owl', 'ox', 'oyster',
  // P
  'panda', 'pangolin', 'panther', 'parrot', 'partridge', 'peacock', 'pelican', 'penguin',
  'perch', 'pheasant', 'pig', 'pigeon', 'pika', 'pike', 'piranha', 'platypus', 'pony',
  'porcupine', 'porpoise', 'possum', 'prawn', 'ptarmigan', 'puffin', 'puma', 'python',
  // Q
  'quail', 'quetzal', 'quokka', 'quoll',
  // R
  'rabbit', 'raccoon', 'ram', 'rat', 'rattlesnake', 'raven', 'ray', 'reindeer', 'rhinoceros',
  'roadrunner', 'robin', 'rooster',
  // S
  'salamander', 'salmon', 'sardine', 'scallop', 'scorpion', 'seahorse', 'seal', 'shark',
  'sheep', 'shrew', 'shrimp', 'skunk', 'sloth', 'slug', 'snail', 'snake', 'sparrow', 'spider',
  'squid', 'squirrel', 'starfish', 'stingray', 'stork', 'swan', 'swordfish',
  // T
  'tadpole', 'tapir', 'tarantula', 'termite', 'tern', 'terrier', 'tiger', 'toad', 'tortoise',
  'toucan', 'trout', 'tuna', 'turkey', 'turtle',
  // U
  'uakari', 'umbrellabird', 'urchin', 'urial',
  // V
  'vaquita', 'vervet', 'vicuna', 'viper', 'viperfish', 'vole', 'vulture',
  // W
  'wallaby', 'walrus', 'warthog', 'wasp', 'weasel', 'whale', 'whippet', 'wildebeest', 'wolf',
  'wolverine', 'wombat', 'woodpecker', 'worm', 'wren',
  // X
  'xenopus', 'xenops', 'xerus',
  // Y
  'yabby', 'yak', 'yellowfin', 'yellowhammer', 'yellowjacket',
  // Z
  'zander', 'zebra', 'zebu', 'zorilla'
];

export const COMPREHENSIVE_THINGS = [
  // A
  'abacus', 'adapter', 'airplane', 'alarm', 'album', 'anchor', 'antenna', 'anvil', 'apple',
  'apron', 'aquarium', 'armchair', 'arrow', 'ashtray', 'axe',
  // B
  'backpack', 'bag', 'balloon', 'bandage', 'barrel', 'basket', 'bathtub', 'battery', 'beaker',
  'bed', 'bell', 'belt', 'bench', 'bicycle', 'binoculars', 'blanket', 'blender', 'blouse',
  'board', 'boat', 'bolt', 'book', 'boot', 'bottle', 'bowl', 'box', 'bracelet', 'brick',
  'briefcase', 'broom', 'brush', 'bucket', 'bulb', 'button',
  // C
  'cabinet', 'cable', 'calculator', 'calendar', 'camera', 'can', 'candle', 'canoe', 'cap',
  'car', 'carpet', 'cart', 'cauldron', 'chain', 'chair', 'chalk', 'charger', 'chest',
  'chimney', 'chisel', 'clamp', 'clip', 'clock', 'closet', 'cloth', 'coat', 'coin', 'comb',
  'compass', 'computer', 'cone', 'container', 'cord', 'cork', 'couch', 'crayon', 'crown',
  'cup', 'curtain', 'cushion',
  // D
  'dagger', 'dartboard', 'dashboard', 'desk', 'detergent', 'diary', 'dice', 'dictionary',
  'dish', 'doll', 'door', 'doorbell', 'drain', 'drawer', 'dress', 'drill', 'drum', 'dryer',
  'dustpan', 'duvet',
  // E
  'earphone', 'earring', 'easel', 'elevator', 'engine', 'envelope', 'eraser', 'escalator',
  'extinguisher', 'eyeglasses',
  // F
  'fabric', 'fan', 'faucet', 'fence', 'file', 'filter', 'flag', 'flashlight', 'flask', 'flute',
  'folder', 'fork', 'fountain', 'frame', 'freezer', 'fridge', 'funnel', 'furnace', 'furniture',
  // G
  'gadget', 'garage', 'gate', 'gauge', 'gear', 'generator', 'glass', 'glasses', 'globe',
  'glove', 'glue', 'goggles', 'gown', 'gramophone', 'grater', 'grill', 'guitar',
  // H
  'hammer', 'hammock', 'handbag', 'handle', 'hanger', 'harmonica', 'harness', 'hat',
  'headphone', 'heater', 'helmet', 'hinge', 'hoe', 'hook', 'hose', 'hourglass',
  // I
  'ice', 'icebox', 'igloo', 'incense', 'ink', 'inkwell', 'instrument', 'iron', 'ironing board',
  'insulation',
  // J
  'jacket', 'jar', 'javelin', 'jeans', 'jersey', 'jewel', 'jigsaw', 'journal', 'joystick',
  'jug', 'juicer', 'jumper',
  // K
  'kayak', 'kettle', 'key', 'keyboard', 'keychain', 'kiln', 'kimono', 'kite', 'knapsack',
  'knife', 'knob', 'knot',
  // L
  'label', 'ladder', 'ladle', 'lamp', 'lantern', 'laptop', 'laser', 'lawnmower', 'leash',
  'lens', 'letter', 'lever', 'lid', 'lighter', 'lock', 'locker', 'locket', 'log', 'luggage',
  'lute',
  // M
  'machine', 'magazine', 'magnet', 'mailbox', 'mallet', 'map', 'marble', 'marker', 'mask',
  'mat', 'mattress', 'medal', 'megaphone', 'microphone', 'microscope', 'microwave', 'mirror',
  'mixer', 'monitor', 'mop', 'motor', 'mug', 'mural',
  // N
  'nail', 'napkin', 'necklace', 'needle', 'net', 'newspaper', 'nightstand', 'notebook',
  'nozzle', 'nut', 'nutcracker',
  // O
  'oar', 'oboe', 'ointment', 'omelette', 'onion', 'opal', 'orange', 'orb', 'organ', 'ornament',
  'ottoman', 'outlet', 'oven', 'overcoat',
  // P
  'package', 'padlock', 'paint', 'paintbrush', 'pan', 'panel', 'pants', 'paper', 'parachute',
  'parcel', 'passport', 'pen', 'pencil', 'pendant', 'perfume', 'phone', 'photo', 'piano',
  'pillow', 'pin', 'pipe', 'pitcher', 'plate', 'pliers', 'plug', 'pole', 'poster', 'pot',
  'printer', 'projector', 'pump', 'purse', 'puzzle', 'pyramid',
  // Q
  'quadrant', 'quarter', 'quartz', 'quiche', 'quill', 'quilt', 'quiver',
  // R
  'rack', 'radiator', 'radio', 'rag', 'rake', 'ramp', 'razor', 'receipt', 'recorder',
  'refrigerator', 'remote', 'ribbon', 'ring', 'robe', 'rocket', 'rod', 'rope', 'router',
  'ruler', 'rug',
  // S
  'sack', 'saddle', 'safe', 'sail', 'sandal', 'sandpaper', 'satchel', 'saucer', 'saw', 'scale',
  'scanner', 'scarf', 'scissors', 'scooter', 'screen', 'screw', 'screwdriver', 'sculpture',
  'seat', 'shampoo', 'shed', 'sheet', 'shelf', 'shield', 'shirt', 'shoe', 'shovel', 'shower',
  'sieve', 'sign', 'sink', 'skateboard', 'ski', 'skirt', 'slippers', 'socket', 'sock', 'sofa',
  'spade', 'speaker', 'sponge', 'spoon', 'spring', 'stamp', 'stapler', 'statue', 'stethoscope',
  'stool', 'stove', 'straw', 'string', 'suitcase', 'sunglasses', 'sweater', 'switch', 'syringe',
  // T
  'table', 'tablet', 'tank', 'tape', 'teapot', 'telephone', 'telescope', 'television', 'tent',
  'thermometer', 'thermos', 'thimble', 'thread', 'ticket', 'tie', 'tile', 'timer', 'tin',
  'tire', 'toaster', 'toilet', 'tongs', 'toolbox', 'toothbrush', 'torch', 'towel', 'tower',
  'toy', 'tractor', 'trailer', 'train', 'tray', 'tripod', 'trolley', 'trophy', 'trousers',
  'truck', 'trumpet', 'tube', 'tunnel', 'turbine', 'tweezers', 'typewriter',
  // U
  'ukulele', 'umbrella', 'underwear', 'uniform', 'unicycle', 'upholstery', 'urn', 'usb',
  'utensil',
  // V
  'vacuum', 'valve', 'van', 'vase', 'veil', 'vending machine', 'vent', 'vessel', 'vest',
  'video', 'violin', 'visor',
  // W
  'wagon', 'walkie-talkie', 'wall', 'wallet', 'wardrobe', 'washer', 'watch', 'watering can',
  'weight', 'wheel', 'wheelbarrow', 'whisk', 'whistle', 'wig', 'window', 'wire', 'wok',
  'wrench', 'wristband',
  // X
  'x-ray', 'xenon', 'xylophone',
  // Y
  'yacht', 'yam', 'yardstick', 'yarn', 'yearbook', 'yeast', 'yogurt', 'yoke', 'yolk', 'yoyo',
  'yurt',
  // Z
  'zeppelin', 'zinc', 'zip', 'zipper', 'zither', 'zucchini'
];

const LISTS = {
  name: COMPREHENSIVE_NAMES,
  place: COMPREHENSIVE_PLACES,
  animal: COMPREHENSIVE_ANIMALS,
  thing: COMPREHENSIVE_THINGS
};

/** Lowercase, strip accents, collapse whitespace. "José" -> "jose". */
const normalize = (word) =>
  word
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

/** Also ignore spaces, hyphens and apostrophes, so "x ray" finds "x-ray". */
const compact = (word) => normalize(word).replace(/[\s'-]/g, '');

/**
 * Plural forms players actually type. Only applied to animals and things -
 * plenty of names and places legitimately end in s (Athens, Charles).
 */
const singularForms = (word) => {
  const forms = [];
  if (word.endsWith('ies') && word.length > 4) forms.push(`${word.slice(0, -3)}y`);
  if (word.endsWith('es') && word.length > 3) forms.push(word.slice(0, -2));
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) forms.push(word.slice(0, -1));
  return forms;
};

// Sets built once at module load - lookups are hot during scoring.
const INDEX = Object.fromEntries(
  Object.entries(LISTS).map(([category, words]) => [
    category,
    {
      exact: new Set(words.map(normalize)),
      loose: new Set(words.map(compact))
    }
  ])
);

const PLURALISABLE = new Set(['animal', 'thing']);

/**
 * Is this word in the curated list for the category?
 * @param {string} word
 * @param {'name'|'place'|'animal'|'thing'} category
 * @returns {boolean}
 */
export function findInComprehensiveLists(word, category) {
  const index = INDEX[category];
  if (!index || !word || typeof word !== 'string') return false;

  const exact = normalize(word);
  if (!exact) return false;
  if (index.exact.has(exact) || index.loose.has(compact(word))) return true;

  if (PLURALISABLE.has(category)) {
    return singularForms(exact).some(
      form => index.exact.has(form) || index.loose.has(compact(form))
    );
  }

  return false;
}

/** Word counts per category - used by the coverage test. */
export const listSizes = () =>
  Object.fromEntries(Object.entries(LISTS).map(([k, v]) => [k, v.length]));
