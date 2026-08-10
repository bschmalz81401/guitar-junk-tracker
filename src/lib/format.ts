/** English indefinite article for a word ("a" / "an"). */
export function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}
