import { describe, expect, it } from 'vitest'
import en from './en'
import sw from './sw'

/**
 * Every screen string in a language file, with its path. A function string (e.g. a count) is
 * called with sample arguments so its wording is checked too.
 */
function screenStrings(node: unknown, path = ''): [string, string][] {
  if (typeof node === 'string') {
    return [[path, node]]
  }
  if (typeof node === 'function') {
    // Arguments differ per string (counts, names, dates); try a few shapes and keep what renders.
    const shapes: unknown[][] = [
      [2, 'X', 'Y', 'Z'],
      ['X', 2, 'Y', 'Z'],
      ['X', 'Y', 'Z', 'W'],
      [2, 3, 4, 5],
    ]
    for (const args of shapes) {
      try {
        const sample = (node as (...values: unknown[]) => unknown)(...args)
        if (typeof sample === 'string') {
          return [[path, sample]]
        }
      } catch {
        // try the next shape
      }
    }
    return []
  }
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, value]) => screenStrings(value, path ? `${path}.${key}` : key))
  }
  return []
}

/** Words and codes meant for developers, which users should never read (ISS-013, 014, 027). */
const DEVELOPER_WORDING = /\bendpoints?\b|\bbackend\b|\b(?:N?FR|BR|UI|DES|LEG|TC)-[A-Z]*-?\d|\buuid\b/i

describe('screen strings', () => {
  it.each([
    ['English', en],
    ['Kiswahili', sw],
  ])('TC-DES-006-B: %s strings carry no developer wording or requirement codes', (_language, strings) => {
    const offenders = screenStrings(strings).filter(([, text]) => DEVELOPER_WORDING.test(text))
    expect(offenders).toEqual([])
  })
})
