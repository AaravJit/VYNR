import type { Manufacturer } from '@/domain/types';

/**
 * Curated manufacturer list. Names and countries of origin are factual
 * information (headquarters country of the brand). See docs/DATA_PROVENANCE.md.
 */
export const MANUFACTURERS: Manufacturer[] = [
  // Japan
  { id: 'toyota', name: 'Toyota', country: 'JP', aliases: [] },
  { id: 'lexus', name: 'Lexus', country: 'JP', aliases: [] },
  { id: 'honda', name: 'Honda', country: 'JP', aliases: ['acura'] },
  { id: 'nissan', name: 'Nissan', country: 'JP', aliases: ['datsun'] },
  { id: 'mazda', name: 'Mazda', country: 'JP', aliases: [] },
  { id: 'subaru', name: 'Subaru', country: 'JP', aliases: [] },
  { id: 'mitsubishi', name: 'Mitsubishi', country: 'JP', aliases: ['mitsubishi motors'] },
  // Germany
  { id: 'volkswagen', name: 'Volkswagen', country: 'DE', aliases: ['vw'] },
  { id: 'bmw', name: 'BMW', country: 'DE', aliases: ['bmw m', 'bayerische motoren werke'] },
  {
    id: 'mercedes-benz',
    name: 'Mercedes-Benz',
    country: 'DE',
    aliases: ['mercedes', 'mercedes benz', 'mercedes-amg', 'amg', 'benz'],
  },
  { id: 'audi', name: 'Audi', country: 'DE', aliases: ['audi sport'] },
  { id: 'porsche', name: 'Porsche', country: 'DE', aliases: [] },
  // United States
  { id: 'ford', name: 'Ford', country: 'US', aliases: [] },
  { id: 'chevrolet', name: 'Chevrolet', country: 'US', aliases: ['chevy'] },
  { id: 'dodge', name: 'Dodge', country: 'US', aliases: ['srt'] },
  { id: 'jeep', name: 'Jeep', country: 'US', aliases: [] },
  { id: 'tesla', name: 'Tesla', country: 'US', aliases: [] },
  { id: 'cadillac', name: 'Cadillac', country: 'US', aliases: [] },
  { id: 'rivian', name: 'Rivian', country: 'US', aliases: [] },
  // United Kingdom
  { id: 'mini', name: 'MINI', country: 'GB', aliases: ['mini cooper'] },
  { id: 'land-rover', name: 'Land Rover', country: 'GB', aliases: ['landrover', 'range rover'] },
  { id: 'jaguar', name: 'Jaguar', country: 'GB', aliases: [] },
  { id: 'aston-martin', name: 'Aston Martin', country: 'GB', aliases: ['aston'] },
  { id: 'mclaren', name: 'McLaren', country: 'GB', aliases: ['mclaren automotive'] },
  { id: 'rolls-royce', name: 'Rolls-Royce', country: 'GB', aliases: ['rolls royce'] },
  { id: 'bentley', name: 'Bentley', country: 'GB', aliases: [] },
  { id: 'lotus', name: 'Lotus', country: 'GB', aliases: [] },
  // Italy
  { id: 'fiat', name: 'Fiat', country: 'IT', aliases: ['abarth'] },
  { id: 'alfa-romeo', name: 'Alfa Romeo', country: 'IT', aliases: ['alfa'] },
  { id: 'maserati', name: 'Maserati', country: 'IT', aliases: [] },
  { id: 'ferrari', name: 'Ferrari', country: 'IT', aliases: [] },
  { id: 'lamborghini', name: 'Lamborghini', country: 'IT', aliases: ['lambo'] },
  { id: 'pagani', name: 'Pagani', country: 'IT', aliases: [] },
  // South Korea
  { id: 'hyundai', name: 'Hyundai', country: 'KR', aliases: ['hyundai n'] },
  { id: 'kia', name: 'Kia', country: 'KR', aliases: [] },
  { id: 'genesis', name: 'Genesis', country: 'KR', aliases: [] },
];
