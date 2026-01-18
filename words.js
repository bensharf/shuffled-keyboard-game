// Word list for the typing game - common 4-8 letter English words
const WORDS = [
  // 4-letter words
  "able", "back", "ball", "band", "bank", "base", "bear", "beat", "been", "bell",
  "best", "bird", "blow", "blue", "boat", "body", "book", "born", "both", "call",
  "came", "camp", "card", "care", "case", "cell", "city", "club", "cold", "come",
  "cool", "copy", "cost", "dark", "data", "date", "days", "deal", "deep", "desk",
  "does", "done", "door", "down", "draw", "drop", "drug", "each", "east", "easy",
  "edge", "else", "even", "ever", "face", "fact", "fall", "farm", "fast", "fear",
  "feel", "file", "fill", "film", "find", "fine", "fire", "firm", "fish", "five",
  "flat", "flow", "food", "foot", "form", "four", "free", "from", "full", "fund",
  "game", "gave", "girl", "give", "glad", "goal", "goes", "gold", "gone", "good",
  "grow", "hair", "half", "hall", "hand", "hang", "hard", "have", "head", "hear",

  // 5-letter words
  "about", "above", "added", "after", "again", "agree", "ahead", "allow", "alone", "along",
  "among", "angry", "apple", "apply", "areas", "argue", "arise", "armed", "aside", "avoid",
  "award", "basic", "beach", "began", "begin", "being", "below", "birth", "black", "blame",
  "blank", "block", "blood", "board", "brain", "brand", "bread", "break", "bring", "broad",
  "broke", "brown", "build", "built", "buyer", "carry", "catch", "cause", "chain", "chair",
  "cheap", "check", "chief", "child", "china", "chose", "claim", "class", "clean", "clear",
  "climb", "clock", "close", "cloud", "coach", "coast", "color", "comes", "count", "court",
  "cover", "cream", "crime", "cross", "crowd", "cycle", "daily", "dance", "death", "depth",
  "doing", "doubt", "dozen", "draft", "drama", "dream", "dress", "drink", "drive", "drove",
  "early", "earth", "empty", "enemy", "enjoy", "enter", "equal", "error", "event", "every",

  // 6-letter words
  "accept", "access", "across", "action", "active", "actual", "advice", "affect", "afford", "afraid",
  "agency", "agreed", "allows", "almost", "always", "amount", "animal", "answer", "anyone", "appear",
  "arrive", "artist", "asking", "attack", "author", "battle", "beauty", "become", "before", "behind",
  "belief", "beside", "better", "beyond", "bigger", "border", "boston", "bottle", "bottom", "bought",
  "branch", "breath", "bridge", "bright", "broken", "budget", "burden", "button", "bought", "camera",
  "campus", "cancer", "cannot", "carbon", "career", "carry", "caught", "center", "chance", "change",
  "charge", "choice", "choose", "church", "circle", "client", "closed", "closer", "coffee", "column",
  "combat", "coming", "common", "copper", "corner", "costly", "county", "couple", "course", "covers",
  "create", "credit", "crisis", "custom", "damage", "danger", "dealer", "debate", "decade", "decide",
  "deeply", "defend", "define", "degree", "demand", "dental", "depend", "design", "desire", "detail",

  // 7-letter words
  "ability", "absence", "account", "achieve", "acquire", "address", "advance", "adverse", "advised", "against",
  "airport", "already", "ancient", "another", "anxiety", "anybody", "applied", "arrange", "arrival", "article",
  "attempt", "attract", "auction", "average", "awesome", "balance", "banking", "barrier", "battery", "bearing",
  "beating", "because", "bedroom", "believe", "benefit", "besides", "between", "billion", "blanket", "brother",
  "brought", "builder", "burning", "cabinet", "calling", "capable", "capital", "captain", "capture", "careful",
  "carrier", "central", "century", "certain", "chamber", "channel", "chapter", "charged", "charity", "charter",
  "chicken", "classic", "climate", "clothes", "cluster", "coastal", "collect", "college", "combine", "comfort",
  "command", "comment", "company", "compare", "complex", "concept", "concern", "confirm", "connect", "consent",
  "contact", "contain", "content", "contest", "context", "control", "convert", "correct", "council", "counter",
  "country", "coupled", "courage", "covered", "crucial", "culture", "current", "cutting", "dancing", "dealing",

  // 8-letter words
  "absolute", "abstract", "academic", "accepted", "accident", "accounts", "accurate", "achieved", "acquired", "activity",
  "actually", "addition", "adequate", "adjusted", "advanced", "advocate", "affected", "aircraft", "alliance", "although",
  "aluminum", "analysis", "announce", "anything", "anywhere", "apparent", "approach", "approval", "argument", "artistic",
  "assembly", "assuming", "athletic", "attached", "attempts", "audience", "automate", "bachelor", "balanced", "baseball",
  "bathroom", "becoming", "behavior", "believed", "benefits", "birthday", "bleeding", "blessing", "blocking", "boundary",
  "breaking", "bringing", "brothers", "building", "business", "calendar", "campaign", "capacity", "captured", "category",
  "cautious", "centered", "centring", "ceremony", "chairman", "champion", "changing", "chapters", "charging", "chemical",
  "children", "choosing", "circular", "citizens", "civilian", "claiming", "clearing", "climbing", "clinical", "clothing",
  "coaching", "collapse", "combined", "commands", "commerce", "commonly", "communal", "compared", "competes", "complete",
  "composed", "compound", "computer", "conclude", "concrete", "conflict", "confused", "congress", "connects", "conquest"
];

// Get a random word using a seeded random number generator
function getWordFromSeed(seed, index) {
  const rng = seededRandom(seed + index);
  return WORDS[Math.floor(rng() * WORDS.length)].toUpperCase();
}

// Simple seeded random number generator (mulberry32)
function seededRandom(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
