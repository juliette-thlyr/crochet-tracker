import type { Database } from './database.types';

export type ColourFamily = Database['public']['Enums']['colour_family'];

/** The twelve colour families. The hex values are swatches only, used nowhere else. */
export const COLOUR_FAMILIES: { value: ColourFamily; label: string; hex: string }[] = [
  { value: 'red', label: 'Red', hex: '#D64545' },
  { value: 'pink', label: 'Pink', hex: '#F28DB2' },
  { value: 'orange', label: 'Orange', hex: '#F39237' },
  { value: 'yellow', label: 'Yellow', hex: '#F6D743' },
  { value: 'green', label: 'Green', hex: '#4CAF50' },
  { value: 'blue', label: 'Blue', hex: '#4A90E2' },
  { value: 'purple', label: 'Purple', hex: '#8E5CC4' },
  { value: 'brown', label: 'Brown', hex: '#8B5A3C' },
  { value: 'grey', label: 'Grey', hex: '#9E9E9E' },
  { value: 'black', label: 'Black', hex: '#222222' },
  { value: 'white', label: 'White', hex: '#FFFFFF' },
  { value: 'multicolour', label: 'Multicolour', hex: 'conic-gradient(#D64545, #F6D743, #4CAF50, #4A90E2, #8E5CC4, #D64545)' },
];

export function colourLabel(f: ColourFamily | null): string {
  return COLOUR_FAMILIES.find((c) => c.value === f)?.label ?? '';
}

/** CSS `background` for a family's swatch. */
export function colourHex(f: ColourFamily): string {
  return COLOUR_FAMILIES.find((c) => c.value === f)!.hex;
}
