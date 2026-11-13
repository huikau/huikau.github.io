// What Ula can pull up. Ported unchanged from the old site.js (WP6 replaces this with the full species list).
export const catches = [
  { id: "mahi", e: "🐟", t: "A mahimahi! Ula said mahalo and let it go.", mood: "yay" },
  { id: "pineapple", e: "🍍", t: "A pineapple. Nobody knows how.", mood: "yay" },
  { id: "slipper", e: "🩴", t: "One slipper. Left foot. Again.", mood: "meh" },
  { id: "hee", e: "🐙", t: "A heʻe. It stole the bait and waved goodbye.", mood: "yay" },
  { id: "coconut", e: "🥥", t: "A coconut with a phone number on it.", mood: "yay" },
  { id: "puffer", e: "🐡", t: "A pufferfish that looked very offended.", mood: "meh" },
  { id: "plumeria", e: "🌺", t: "A plumeria. Ula tucked it behind her ear.", mood: "yay" },
  { id: "boot", e: "🥾", t: "An old boot. A classic.", mood: "meh" },
  { id: "shark", e: "🦈", t: "A tiny shark, more scared than she was.", mood: "yay" },
  { id: "honu", e: "🐢", t: "Just a honu saying hi. Ula waved from a respectful distance.", mood: "yay" },
  { id: "wave", e: "🌊", t: "Nothing but a nice wave. Still counts.", mood: "meh" },
  { id: "cap", e: "🧢", t: "A Fat Boy Fishing Club cap. Ula already has one.", mood: "yay" }
];

export const golden = { id: "golden", e: "🐟", t: "A golden ulua! Ula's never seen one this big.", mood: "yay", rare: true };

export const seasonal = {
  halloween: [
    { e: "💀", t: "A skeleton fish. Spooky, but polite.", mood: "meh" },
    { e: "🎃", t: "A jack-o'-lantern, still glowing. Happy Halloween!", mood: "yay" }
  ],
  winter: [{ e: "🎁", t: "A present wrapped in seaweed. Mele Kalikimaka!", mood: "yay" }],
  newyear: [{ e: "🎉", t: "A party popper. Hauʻoli Makahiki Hou!", mood: "yay" }],
  none: []
};
