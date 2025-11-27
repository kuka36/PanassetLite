import { Language } from '../types';
import { en } from './locales/en';
import { zh } from './locales/zh';

export const translations: Record<Language, Record<string, string>> = {
  en,
  zh
};
