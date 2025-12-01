import { Language } from '../types/store';
import { en } from './locales/en';
import { zh } from './locales/zh';

export const translations: Record<Language, Record<string, string>> = {
  en,
  zh
};
