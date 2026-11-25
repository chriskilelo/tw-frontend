import { describe, expect, it } from 'vitest'
import en from '../i18n/en'
import sw from '../i18n/sw'
import { translatedName } from './displayNames'

describe('translatedName', () => {
  it('TC-FR-I18N-001-B: shows role names and inquiry categories in Kiswahili (ISS-005)', () => {
    expect(translatedName('Ministry Attache', sw.roleNames)).toBe('Mwambata wa Wizara')
    expect(translatedName('Acting PS', sw.roleNames)).toBe('Kaimu Katibu Mkuu')
    expect(translatedName('Buyer Seeking Supplier', sw.inquiryCategoryNames)).toBe('Mnunuzi Anayetafuta Msambazaji')
  })

  it('keeps English names, and any name it does not know, as stored', () => {
    expect(translatedName('Ministry Attache', en.roleNames)).toBe('Ministry Attache')
    expect(translatedName('A category added later', sw.inquiryCategoryNames)).toBe('A category added later')
    expect(translatedName(null, sw.roleNames)).toBe('')
  })

  it('has a Kiswahili name for every role in the catalogue', () => {
    const roles = [
      'System Administrator', 'Ministry Administrator', 'Head of Mission', 'Deputy Head of Mission', 'MFA HQ Officer',
      'MFA Principal Secretary', 'Ministry Attache', 'Ministry HQ Officer', 'Ministry HQ Director', 'Ministry PS',
      'Ministry Publishing Authority', 'HRM&D Officer', 'Designated Deputy', 'Acting PS', 'Honorary Consul',
    ]
    expect(roles.filter((role) => !(role in sw.roleNames))).toEqual([])
  })
})
