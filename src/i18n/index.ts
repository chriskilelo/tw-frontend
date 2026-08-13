import en from './en'
import sw from './sw'

export type LanguagePreference = 'en' | 'sw'

export type ResourceMap = Record<LanguagePreference, typeof en>

const resources: ResourceMap = { en, sw }

export default resources
