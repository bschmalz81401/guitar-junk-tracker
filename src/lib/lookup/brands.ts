export const MULTI_WORD_BRANDS = [
  "Electro-Harmonix",
  "Mesa/Boogie",
  "Mesa Boogie",
  "Two-Rock",
  "Friedman",
  "Suhr",
  "Music Man",
  "Ernie Ball Music Man",
  "ESP LTD",
  "Squier",
  "Fender",
  "Gibson",
  "Epiphone",
  "Ibanez",
  "PRS",
  "Paul Reed Smith",
  "Jackson",
  "Charvel",
  "Gretsch",
  "Rickenbacker",
  "Taylor",
  "Martin",
  "Collings",
  "Marshall",
  "Orange",
  "Vox",
  "Bogner",
  "Diezel",
  "ENGL",
  "Hughes & Kettner",
  "Blackstar",
  "Fender",
  "Boss",
  "Strymon",
  "Eventide",
  "Universal Audio",
  "Walrus Audio",
  "JHS",
  "Keeley",
  "EarthQuaker Devices",
  "Catalinbread",
  "Wampler",
  "Origin Effects",
  "Celestion",
  "Eminence",
  "Mesa",
  "Soldano",
  "Revv",
  "Victory",
  "Morgan",
  "Matchless",
  "Dr. Z",
  "Tone King",
  "Ampeg",
  "Hartke",
  "Aguilar",
  "Darkglass",
  "TC Electronic",
  "Line 6",
  "Neural DSP",
  "Positive Grid",
  "Yamaha",
  "Roland",
  "Casio",
  "Korg",
  "Schecter",
  "Caparison",
  "Mayones",
  "Strandberg",
  "Kiesel",
  "Warmoth",
  "Bare Knuckle",
  "Seymour Duncan",
  "DiMarzio",
  "Fishman",
  "EMG",
  "Lollar",
  "TV Jones",
].sort((a, b) => b.length - a.length);

export function inferBrandModel(name: string, existingBrand?: string): { brand?: string; model?: string } {
  if (existingBrand) {
    const re = new RegExp(`^${existingBrand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i");
    const rest = name.replace(re, "").trim();
    return rest ? { brand: existingBrand, model: rest } : { brand: existingBrand };
  }

  for (const brand of MULTI_WORD_BRANDS) {
    if (name.toLowerCase().startsWith(brand.toLowerCase() + " ") || name.toLowerCase() === brand.toLowerCase()) {
      const rest = name.slice(brand.length).trim().replace(/^[-–—:]\s*/, "");
      return rest ? { brand, model: rest } : { brand };
    }
  }

  // Fallback: first token as brand if it looks like a proper name
  const parts = name.split(/\s+/);
  if (parts.length >= 2 && /^[A-Z][A-Za-z0-9&./-]+$/.test(parts[0])) {
    return { brand: parts[0], model: parts.slice(1).join(" ") };
  }
  return {};
}
