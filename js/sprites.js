/* ============================================================
 * sprites.js — pixel-art data for "Live in City"
 *
 * Every sprite is a grid of single characters. Each character
 * maps to an RGB color in the shared PALETTE below.
 *
 * Special characters:
 *   'W' = window -> rendered as a warm lit window at night
 *   'w' = white highlight
 *
 * The same file is parsed by scripts/gen_assets.py to export
 * real .png files into asset/map and asset/player.
 * ============================================================ */

const PALETTE = {
  '.': [106, 170, 78],   // grass base
  'D': [95, 156, 64],    // grass dark
  'L': [122, 184, 90],   // grass light
  'H': [142, 203, 106],  // grass highlight
  'B': [59, 111, 212],   // water
  'b': [47, 90, 176],    // water dark
  'C': [92, 138, 232],   // water light
  'W': [207, 216, 227],  // window (day)
  'w': [255, 255, 255],  // white
  'K': [27, 27, 27],     // outline
  'k': [46, 46, 46],     // dark gray
  'A': [74, 74, 74],     // asphalt
  'a': [60, 60, 60],     // asphalt dark
  'Y': [224, 195, 60],   // road line
  'T': [46, 125, 50],    // tree dark
  't': [61, 156, 64],    // tree mid
  'G': [79, 176, 79],    // tree light
  'R': [139, 58, 58],    // roof red
  'r': [168, 76, 76],    // roof red light
  'E': [201, 160, 107],  // wall beige
  'e': [176, 141, 92],   // wall beige dark
  'F': [216, 211, 201],  // wall light
  'f': [185, 179, 166],  // wall light dark
  'U': [127, 142, 163],  // wall blue-gray
  'u': [107, 122, 143],  // wall blue-gray dark
  'N': [232, 226, 208],  // wall cream
  'n': [207, 200, 180],  // wall cream dark
  'I': [156, 61, 46],    // brick red
  'i': [126, 49, 37],    // brick dark
  'J': [192, 106, 62],   // brick orange
  'P': [242, 209, 107],  // awning yellow
  'Q': [109, 159, 209],  // door blue
  'O': [91, 74, 54],     // door brown
  'V': [55, 71, 79],     // roof gray
  'v': [43, 54, 60],     // roof dark gray
  'Z': [141, 110, 99],   // trunk
  'z': [109, 83, 74],    // trunk dark
  'S': [227, 207, 138],  // sand
  's': [208, 187, 114],  // sand dark
  'X': [17, 17, 17],     // frame / void
  '9': [246, 246, 242],  // light roof
  'M': [120, 90, 70],    // hair brown
  'm': [232, 190, 150],  // skin
  'd': [60, 90, 160],    // shirt blue
  'g': [110, 150, 90],   // shirt green
  'h': [160, 70, 70],    // shirt red
  'o': [160, 130, 90],   // pants tan
};

const TILE = 16; // pixels per tile

const SPRITES = {

  /* ---------- terrain ---------- */

  grass: {
    size: 16,
    map: [
      '................',
      '................',
      '..D......D......',
      '.....D.....L....',
      '........D...D...',
      '....L...........',
      '.......D........',
      '..D......L......',
      '................',
      '........D.......',
      '..L.............',
      '...........D....',
      '....D......D....',
      '.......L........',
      '................',
      '................',
    ],
  },

  grassAlt: {
    size: 16,
    map: [
      '................',
      '....D...........',
      '.......L........',
      '..D.......D.....',
      '.............D..',
      '......L.........',
      '................',
      '....D.....D.....',
      '................',
      '.......L....L...',
      '..D.............',
      '...........D....',
      '.....D......D...',
      '........L.......',
      '................',
      '................',
    ],
  },

  water1: {
    size: 16,
    map: [
      'BBBBBBBBBBBBBBBB',
      'BBBBBBBBBBBBBBBB',
      'BBBBBBBBBBBBBBBB',
      'BBBBBBBBBCCBBBBB',
      'BBBBBBBCCCCBBBBB',
      'BBBBBBCCCCBBBBBB',
      'BBBBBBBBBBBBBBBB',
      'BBBBBBBBBBBBBBBB',
      'bBBBBBBBBBBBBBBb',
      'bbbbbbbbbbbbbbbb',
      'bbbbbbbbbbbbbbbb',
      'bbbbbbbbbbbbbbbb',
      'bbbbbbbbbbbbbbbb',
      'bbbbbbbbbbbbbbbb',
      'bbbbbbbbbbbbbbbb',
      'bbbbbbbbbbbbbbbb',
    ],
  },

  water2: {
    size: 16,
    map: [
      'BBBBBBBBBBBBBBBB',
      'BBBBBBBBBBBBBBBB',
      'BBBBBBBBBBBBBBBB',
      'BBBBBBBBBBBBBBBB',
      'BBBBBBBCCBBBBBBB',
      'BBBBBBCCCCBBBBBB',
      'BBBBCCCCCCBBBBBB',
      'BBBBBBBBBBBBBBBB',
      'BBBBBBBBBBBBBBBB',
      'bBBBBBBBBBBBBBBb',
      'bbbbbbbbbbbbbbbb',
      'bbbbbbbbbbbbbbbb',
      'bbbbbbbbbbbbbbbb',
      'bbbbbbbbbbbbbbbb',
      'bbbbbbbbbbbbbbbb',
      'bbbbbbbbbbbbbbbb',
    ],
  },

  sand: {
    size: 16,
    map: [
      'SSSSSSSSSSSSSSSS',
      'SSSSSSSSSSSSSSSS',
      'SSSSSSSSSSSSSSSS',
      'SsSSSSSSsSSSSSSs',
      'SSSSSSsSSSSSSSSS',
      'SSsSSSSSSSSSsSSS',
      'SSSSSSSSSSSSSSSS',
      'SSSSSSSSsSSSSSSS',
      'sSSSSSSSSSSSSSSs',
      'SSSSSSSSSSSSSSSS',
      'SSsSSSSSSSsSSSSS',
      'SSSSSSSSSSSSSSSS',
      'SSSSSSsSSSSSSSSS',
      'SSSSSSSSSSSSSSSS',
      'sSSSSSSSSSSSSSSs',
      'SSSSSSSSSSSSSSSS',
    ],
  },

  tree: {
    size: 16,
    map: [
      '.......GG.......',
      '......GGGG......',
      '.....GTtTTG.....',
      '....GTttttTG....',
      '....GTtttttG....',
      '...GTttttttTG...',
      '...GTtttttttG...',
      '..GTttttttttTG..',
      '..GTtttttttttG..',
      '..GTttttttttTG..',
      '...GTTttttTTG...',
      '....GTTTTTTG....',
      '.......ZZ.......',
      '......ZZZ.......',
      '.....ZZZZ.......',
      '................',
    ],
  },

  park: {
    size: 16,
    map: [
      '................',
      '.....TTT........',
      '....TtttT.......',
      '....TtttT.......',
      '.....TTT........',
      '.......L........',
      '..DD......DD....',
      '.......L........',
      '................',
      '...L......L.....',
      '................',
      '......LL........',
      '..L.......L.....',
      '................',
      '......L.........',
      '................',
    ],
  },

  /* ---------- buildings: residential ---------- */

  res1: {
    size: 16,
    map: [
      '................',
      '....RRRRRRRR....',
      '...RrrrrrrrrR...',
      '...RrrrrrrrrR...',
      '...RrrrrrrrrR...',
      '...RRRRRRRRRR...',
      '...EEEEEEEEEE...',
      '...EEWWEEWWEE...',
      '...EEWWEEWWEE...',
      '...EEWWEEWWEE...',
      '...EEEEEEEEEE...',
      '...EEEEOOOEEE...',
      '...EEEEOOOEEE...',
      '...KKKKKKKKKK...',
      '................',
      '................',
    ],
  },

  res2: {
    size: 16,
    map: [
      '................',
      '....VVVVVVVV....',
      '...VvvvvvvvvV...',
      '...VvWWWWWWvV...',
      '...VvWWWWWWvV...',
      '...VVVVVVVVVV...',
      '...NNNNNNNNNN...',
      '...NNWWNNWWNN...',
      '...NNWWNNWWNN...',
      '...NNWWNNWWNN...',
      '...NNWWNNWWNN...',
      '...NNNNNNNNNN...',
      '...NNNNOONNNN...',
      '...NNNNOONNNN...',
      '...KKKKKKKKKK...',
      '................',
    ],
  },

  res3: { // apartment block, 2x2 tiles
    size: 32,
    map: [
      '................................',
      '.....RRRRRRRRRRRRRRRRRR........',
      '....RrrrrrrrrrrrrrrrrrrR.......',
      '....RrrrrrrrrrrrrrrrrrrR.......',
      '....RrrrrrrrrrrrrrrrrrrR.......',
      '....RRRRRRRRRRRRRRRRRRRR.......',
      '....FFFFFFFFFFFFFFFFFFFF.......',
      '....FFWWFFWWFFWWFFWWFFWW.......',
      '....FFWWFFWWFFWWFFWWFFWW.......',
      '....FFWWFFWWFFWWFFWWFFWW.......',
      '....FFFFFFFFFFFFFFFFFFFF.......',
      '....FFWWFFWWFFWWFFWWFFWW.......',
      '....FFWWFFWWFFWWFFWWFFWW.......',
      '....FFWWFFWWFFWWFFWWFFWW.......',
      '....FFFFFFFFFFFFFFFFFFFF.......',
      '....FFWWFFWWFFWWFFWWFFWW.......',
      '....FFWWFFWWFFWWFFWWFFWW.......',
      '....FFWWFFWWFFWWFFWWFFWW.......',
      '....FFFFFFFFFFFFFFFFFFFF.......',
      '....FFFFFFFFFFOOFFFFFFFF.......',
      '....FFFFFFFFFFOOFFFFFFFF.......',
      '....FFFFFFFFFFFFFFFFFFFF.......',
      '....KKKKKKKKKKKKKKKKKKKK.......',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
  },

  /* ---------- buildings: commercial ---------- */

  com1: {
    size: 16,
    map: [
      '................',
      '....PPPPPPPP....',
      '...PPPPPPPPPP...',
      '...EEEEEEEEEE...',
      '...EEWWWWWWEE...',
      '...EEWWWWWWEE...',
      '...EEWWWWWWEE...',
      '...EEEEEEEEEE...',
      '...EEEEEEEEEE...',
      '...UUUUUUUUUU...',
      '...UUWWWWWWUU...',
      '...UUWWWWWWUU...',
      '...UUUUQQUUUU...',
      '...KKKKKKKKKK...',
      '................',
      '................',
    ],
  },

  com2: {
    size: 16,
    map: [
      '................',
      '....VVVVVVVV....',
      '...VvWWWWWWvV...',
      '...VvWWWWWWvV...',
      '...VVVVVVVVVV...',
      '...UUUUUUUUUU...',
      '...UUWWUUWWUU...',
      '...UUWWUUWWUU...',
      '...UUUUUUUUUU...',
      '...UUWWUUWWUU...',
      '...UUWWUUWWUU...',
      '...UUUUUUUUUU...',
      '...UUUUQQUUUU...',
      '...KKKKKKKKKK...',
      '................',
      '................',
    ],
  },

  com3: { // office tower, 2x2 tiles
    size: 32,
    map: [
      '................................',
      '..........UUUUUUUUUUUU..........',
      '.........UUWWUUWWUUWWUU.........',
      '.........UUWWUUWWUUWWUU.........',
      '.........UUWWUUWWUUWWUU.........',
      '.........UUWWUUWWUUWWUU.........',
      '.........UUWWUUWWUUWWUU.........',
      '.........UUWWUUWWUUWWUU.........',
      '.........UUUUUUUUUUUU...........',
      '........UUWWUUWWUUWWUU..........',
      '........UUWWUUWWUUWWUU..........',
      '........UUWWUUWWUUWWUU..........',
      '........UUWWUUWWUUWWUU..........',
      '........UUWWUUWWUUWWUU..........',
      '........UUWWUUWWUUWWUU..........',
      '........UUUUUUUUUUUU............',
      '.......UUWWUUWWUUWWUU...........',
      '.......UUWWUUWWUUWWUU...........',
      '.......UUWWUUWWUUWWUU...........',
      '.......UUWWUUWWUUWWUU...........',
      '.......UUWWUUWWUUWWUU...........',
      '.......UUUUUUUUUUUUUUU..........',
      '.......UUUUUUUUUUUUUUU..........',
      '.......UUUUUQQUUUUUUU...........',
      '.......UUUUUQQUUUUUUU...........',
      '.......KKKKKKKKKKKKKKK..........',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
  },

  /* ---------- buildings: industrial ---------- */

  ind1: {
    size: 16,
    map: [
      '................',
      '....VVVVVVVV....',
      '...VvvvvvvvvV...',
      '...IIIIIIIIII...',
      '...IiIiIiIiIi...',
      '...IIIIIIIIII...',
      '...IiIiIiIiIi...',
      '...IIIIIIIIII...',
      '...IIIIIIIIII...',
      '...IIiIIIIiII...',
      '...IIIIIIIIII...',
      '...IIIIIwIIII...',
      '...IIIIIIIIII...',
      '...KKKKKKKKKK...',
      '................',
      '................',
    ],
  },

  ind2: {
    size: 16,
    map: [
      '.......VVV.....',
      '......VvvvV....',
      '.....VvvvvvV...',
      '.....VvvvvvV...',
      '....JJJJJJJJ...',
      '....JiiJiiJ....',
      '....JiiJiiJ....',
      '....JJJJJJJJ...',
      '....JiiJiiJ....',
      '....JiiJiiJ....',
      '....JJJJJJJJ...',
      '....JiiJiiJ....',
      '....JJJJJJJJ...',
      '....KKKKKKKK...',
      '................',
      '................',
    ],
  },

  ind3: { // factory complex, 2x2 tiles
    size: 32,
    map: [
      '..............VVV..............',
      '.............VvvvV.............',
      '.............VvvvvV............',
      '............VVvvvvVV............',
      '............VvVVVVvV............',
      '...........VVvVVVVvVV...........',
      '...........VvvVwwVvvV...........',
      '...........VVVVVVVVVV...........',
      '...........JJJJJJJJJJ...........',
      '...........JiiJiiJiiJ...........',
      '...........JiiJiiJiiJ...........',
      '...........JJJJJJJJJJ...........',
      '...........JiiJiiJiiJ...........',
      '...........JiiJiiJiiJ...........',
      '...........JJJJJJJJJJ...........',
      '...........JiiJiiJiiJ...........',
      '...........JiiJiiJiiJ...........',
      '...........JJJJJJJJJJ...........',
      '...........JiiJiiJiiJ...........',
      '...........JiiJiiJiiJ...........',
      '...........JJJJJJJJJJ...........',
      '...........JiiJiiJiiJ...........',
      '...........JiiJiiJiiJ...........',
      '...........JJJJJJJJJJ...........',
      '...........JIIIIIIIIJ...........',
      '...........JIIIIIIIIJ...........',
      '...........KKKKKKKKKK...........',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
  },

  /* ---------- player ----------
   * 4 directions x 2 walk frames. Faces are drawn from the
   * front (down), back (up) and sides (left/right).
   */

  playerDown1: {
    size: 16,
    map: [
      '......MMMM......',
      '......mmmm......',
      '......mmmm......',
      '......mMMMm.....',
      '.....mWmmWm.....',
      '.....mWmmWm.....',
      '.....mmmmmm.....',
      '......mmmm......',
      '.....dddddd.....',
      '....dddddddd....',
      '....dddddddd....',
      '....dddddddd....',
      '.....oOOOOo.....',
      '....oOoOOoOo....',
      '....o..OO..o....',
      '................',
    ],
  },

  playerDown2: {
    size: 16,
    map: [
      '......MMMM......',
      '......mmmm......',
      '......mmmm......',
      '......mMMMm.....',
      '.....mWmmWm.....',
      '.....mWmmWm.....',
      '.....mmmmmm.....',
      '......mmmm......',
      '.....dddddd.....',
      '....dddddddd....',
      '....dddddddd....',
      '....dddddddd....',
      '.....oOOOOo.....',
      '....oOoOOoOo....',
      '....o.OO..o.....',
      '................',
    ],
  },

  playerUp1: {
    size: 16,
    map: [
      '......MMMM......',
      '......mmmm......',
      '......mmmm......',
      '......mMMMm.....',
      '.....mWmmWm.....',
      '.....mWmmWm.....',
      '.....mmmmmm.....',
      '......mmmm......',
      '.....dddddd.....',
      '....dddddddd....',
      '....dddddddd....',
      '....dddddddd....',
      '.....oOOOOo.....',
      '....oOoOOoOo....',
      '....o..OO..o....',
      '................',
    ],
  },

  playerUp2: {
    size: 16,
    map: [
      '......MMMM......',
      '......mmmm......',
      '......mmmm......',
      '......mMMMm.....',
      '.....mWmmWm.....',
      '.....mWmmWm.....',
      '.....mmmmmm.....',
      '......mmmm......',
      '.....dddddd.....',
      '....dddddddd....',
      '....dddddddd....',
      '....dddddddd....',
      '.....oOOOOo.....',
      '....oOoOOoOo....',
      '....o.OO..o.....',
      '................',
    ],
  },

  playerLeft1: {
    size: 16,
    map: [
      '......MMMM......',
      '.....mmmm.......',
      '.....mmmm.......',
      '.....mMMMm......',
      '.....mmWm.......',
      '.....mmWm.......',
      '.....mmmm.......',
      '......mmmm......',
      '.....dddddd.....',
      '....dddddddd....',
      '....dddddddd....',
      '....dddddddd....',
      '.....oOOOOo.....',
      '....oOoOOoOo....',
      '....o..OO..o....',
      '................',
    ],
  },

  playerLeft2: {
    size: 16,
    map: [
      '......MMMM......',
      '.....mmmm.......',
      '.....mmmm.......',
      '.....mMMMm......',
      '.....mmWm.......',
      '.....mmWm.......',
      '.....mmmm.......',
      '......mmmm......',
      '.....dddddd.....',
      '....dddddddd....',
      '....dddddddd....',
      '....dddddddd....',
      '.....oOOOOo.....',
      '....oOoOOoOo....',
      '....o.OO..o.....',
      '................',
    ],
  },

  playerRight1: {
    size: 16,
    map: [
      '......MMMM......',
      '.......mmmm.....',
      '.......mmmm.....',
      '......mMMMm.....',
      '.......mWmm.....',
      '.......mWmm.....',
      '.......mmmm.....',
      '......mmmm......',
      '.....dddddd.....',
      '....dddddddd....',
      '....dddddddd....',
      '....dddddddd....',
      '.....oOOOOo.....',
      '....oOoOOoOo....',
      '....o..OO..o....',
      '................',
    ],
  },

  playerRight2: {
    size: 16,
    map: [
      '......MMMM......',
      '.......mmmm.....',
      '.......mmmm.....',
      '......mMMMm.....',
      '.......mWmm.....',
      '.......mWmm.....',
      '.......mmmm.....',
      '......mmmm......',
      '.....dddddd.....',
      '....dddddddd....',
      '....dddddddd....',
      '....dddddddd....',
      '.....oOOOOo.....',
      '....oOoOOoOo....',
      '....o.OO..o.....',
      '................',
    ],
  },
};
