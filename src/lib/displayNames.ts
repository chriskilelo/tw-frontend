/**
 * A name stored in English in the database (a role, an inquiry category) in the reader's
 * language, from the language file's map. A name the map doesn't know, such as a category a
 * department adds later, is shown as stored (ISS-005).
 */
export function translatedName(value: string | null | undefined, names: Record<string, string>): string {
  if (!value) {
    return ''
  }
  return names[value] ?? value
}
