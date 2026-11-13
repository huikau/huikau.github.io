// Vetted vocabulary (plan section 4.5). Ported unchanged from the old site.js.
export const words = [
  ["huikau", "Mixed up, jumbled, confused. In the best way."],
  ["aloha", "Love and compassion. Also hello, and goodbye."],
  ["mahalo", "Thank you."],
  ["nalu", "A wave; the surf."],
  ["kai", "The sea, or seawater."],
  ["moana", "The open ocean."],
  ["lawaiʻa", "A fisherman. Also, to go fishing."],
  ["hoʻomaha", "To rest or take a break. A vacation."],
  ["mālie", "Calm and quiet, like the sea on a still evening."],
  ["pau", "Finished, all done."],
  ["ʻono", "Delicious."],
  ["makani", "Wind."],
  ["ʻohana", "Family, including the ones you choose."],
  ["kōkua", "Help, given freely."],
  ["pāʻina", "A meal shared with friends; a small party."],
  ["a hui hou", "Until we meet again."]
];

/** The word for the day containing epoch-ms `ms` (days counted from the Unix epoch, as before). */
export const wordOfDay = (ms) => words[Math.floor(ms / 86400000) % words.length];
