import type { CatalogVehicle, Rarity, VehicleCategory } from '@/domain/types';

/**
 * Curated VYNR vehicle catalog (v1).
 *
 * Each entry is a model *generation*, not a trim or a model year. Production
 * years are approximate, publicly known ranges and are always displayed as
 * estimates. No technical specifications (power, weight, price, etc.) are
 * stored. Rarity is assigned by the curation rules in docs/DATA_PROVENANCE.md,
 * never by the recognition model.
 *
 * Ids are permanent: never rename or reuse an id, because encounters reference it.
 */

interface Opts {
  electric?: boolean;
  aliases?: string[];
}

function v(
  id: string,
  manufacturerId: string,
  model: string,
  generation: string,
  yearStart: number,
  yearEnd: number | null,
  category: VehicleCategory,
  rarity: Rarity,
  opts: Opts = {},
): CatalogVehicle {
  return {
    id,
    manufacturerId,
    model,
    generation,
    yearStart,
    yearEnd,
    category,
    rarity,
    electric: opts.electric ?? false,
    aliases: opts.aliases ?? [],
  };
}

export const CATALOG_VERSION = 1;

export const VEHICLES: CatalogVehicle[] = [
  // ───────────────────────────── Japan ─────────────────────────────
  v('toyota-corolla-e210', 'toyota', 'Corolla', 'E210', 2018, null, 'sedan', 'common'),
  v('toyota-camry-xv70', 'toyota', 'Camry', 'XV70', 2017, 2024, 'sedan', 'common'),
  v('toyota-rav4-xa50', 'toyota', 'RAV4', 'XA50', 2018, 2025, 'suv', 'common'),
  v('toyota-prius-xw60', 'toyota', 'Prius', 'XW60', 2022, null, 'hatchback', 'common'),
  v('toyota-tacoma-n300', 'toyota', 'Tacoma', '3rd gen (N300)', 2015, 2023, 'pickup', 'common'),
  v('toyota-gr86-zn8', 'toyota', 'GR86', 'ZN8', 2021, null, 'sports', 'uncommon', {
    aliases: ['86', 'gr 86'],
  }),
  v('toyota-gr-supra-j29', 'toyota', 'GR Supra', 'J29 (A90/A91)', 2019, null, 'sports', 'rare', {
    aliases: ['supra', 'gr supra', 'a90'],
  }),
  v('toyota-supra-a80', 'toyota', 'Supra', 'A80', 1993, 2002, 'sports', 'rare', {
    aliases: ['mk4 supra', 'supra mk4'],
  }),
  v('toyota-gr-yaris', 'toyota', 'GR Yaris', 'GXPA16', 2020, null, 'hatchback', 'rare', {
    aliases: ['gr yaris'],
  }),
  v('toyota-land-cruiser-j300', 'toyota', 'Land Cruiser', 'J300', 2021, null, 'offroad', 'uncommon', {
    aliases: ['land cruiser 300', 'lc300'],
  }),
  v('lexus-is-xe30', 'lexus', 'IS', 'XE30', 2013, null, 'sedan', 'uncommon', {
    aliases: ['is350', 'is300', 'is 350', 'is 300'],
  }),
  v('lexus-lfa', 'lexus', 'LFA', 'LFA10', 2010, 2012, 'supercar', 'legendary'),
  v('honda-civic-11', 'honda', 'Civic', '11th gen', 2021, null, 'sedan', 'common'),
  v('honda-civic-type-r-fl5', 'honda', 'Civic Type R', 'FL5', 2022, null, 'hatchback', 'rare', {
    aliases: ['type r', 'civic type-r'],
  }),
  v('honda-accord-10', 'honda', 'Accord', '10th gen', 2017, 2022, 'sedan', 'common'),
  v('honda-cr-v-6', 'honda', 'CR-V', '6th gen', 2022, null, 'suv', 'common', { aliases: ['crv'] }),
  v('honda-nsx-na', 'honda', 'NSX', 'NA1/NA2', 1990, 2005, 'supercar', 'exotic', {
    aliases: ['acura nsx'],
  }),
  v('honda-nsx-nc1', 'honda', 'NSX', 'NC1', 2016, 2022, 'supercar', 'exotic', {
    aliases: ['acura nsx'],
  }),
  v('honda-s2000', 'honda', 'S2000', 'AP1/AP2', 1999, 2009, 'convertible', 'rare'),
  v('nissan-altima-l34', 'nissan', 'Altima', 'L34', 2018, null, 'sedan', 'common'),
  v('nissan-rogue-t33', 'nissan', 'Rogue', 'T33', 2020, null, 'suv', 'common', {
    aliases: ['x-trail'],
  }),
  v('nissan-z-rz34', 'nissan', 'Z', 'RZ34', 2022, null, 'sports', 'uncommon', {
    aliases: ['400z', 'nissan z'],
  }),
  v('nissan-gt-r-r35', 'nissan', 'GT-R', 'R35', 2007, 2025, 'supercar', 'exotic', {
    aliases: ['gtr', 'gt r'],
  }),
  v('nissan-skyline-gt-r-r34', 'nissan', 'Skyline GT-R', 'R34', 1999, 2002, 'sports', 'legendary', {
    aliases: ['skyline', 'r34', 'skyline gtr'],
  }),
  v('mazda-mx-5-nd', 'mazda', 'MX-5', 'ND', 2015, null, 'convertible', 'uncommon', {
    aliases: ['miata', 'mx5', 'mx-5 miata'],
  }),
  v('mazda-rx-7-fd', 'mazda', 'RX-7', 'FD', 1992, 2002, 'sports', 'rare', { aliases: ['rx7'] }),
  v('mazda-cx-5-kf', 'mazda', 'CX-5', 'KF', 2017, null, 'suv', 'common', { aliases: ['cx5'] }),
  v('mazda-3-bp', 'mazda', 'Mazda3', 'BP', 2019, null, 'hatchback', 'common', {
    aliases: ['3', 'mazda 3'],
  }),
  v('subaru-wrx-vb', 'subaru', 'WRX', 'VB', 2021, null, 'sedan', 'uncommon'),
  v('subaru-outback-bt', 'subaru', 'Outback', 'BT', 2019, 2025, 'wagon', 'common'),
  v('subaru-brz-zd8', 'subaru', 'BRZ', 'ZD8', 2021, null, 'sports', 'uncommon'),
  v('mitsubishi-lancer-evo-x', 'mitsubishi', 'Lancer Evolution', 'X', 2007, 2016, 'sedan', 'rare', {
    aliases: ['evo', 'evo x', 'lancer evo'],
  }),

  // ──────────────────────────── Germany ────────────────────────────
  v('volkswagen-golf-mk8', 'volkswagen', 'Golf', 'Mk8', 2019, null, 'hatchback', 'common'),
  v('volkswagen-golf-gti-mk8', 'volkswagen', 'Golf GTI', 'Mk8', 2020, null, 'hatchback', 'uncommon', {
    aliases: ['gti'],
  }),
  v('volkswagen-beetle-type-1', 'volkswagen', 'Beetle', 'Type 1', 1938, 2003, 'coupe', 'uncommon', {
    aliases: ['bug', 'kafer', 'käfer', 'type 1'],
  }),
  v('volkswagen-id4', 'volkswagen', 'ID.4', '1st gen', 2020, null, 'suv', 'common', {
    electric: true,
    aliases: ['id4', 'id 4'],
  }),
  v('volkswagen-jetta-a7', 'volkswagen', 'Jetta', 'A7', 2018, null, 'sedan', 'common'),
  v('bmw-3-series-g20', 'bmw', '3 Series', 'G20', 2018, null, 'sedan', 'common', {
    aliases: ['330i', '320i', '3-series', 'm340i'],
  }),
  v('bmw-m3-g80', 'bmw', 'M3', 'G80', 2020, null, 'sedan', 'rare'),
  v('bmw-m3-e30', 'bmw', 'M3', 'E30', 1986, 1991, 'coupe', 'exotic'),
  v('bmw-m5-f90', 'bmw', 'M5', 'F90', 2017, 2024, 'sedan', 'rare'),
  v('bmw-x5-g05', 'bmw', 'X5', 'G05', 2018, null, 'suv', 'common'),
  v('bmw-i8', 'bmw', 'i8', 'I12/I15', 2014, 2020, 'sports', 'exotic'),
  v('mercedes-c-class-w206', 'mercedes-benz', 'C-Class', 'W206', 2021, null, 'sedan', 'common', {
    aliases: ['c class', 'c300', 'c-klasse'],
  }),
  v('mercedes-g-class-w463-2', 'mercedes-benz', 'G-Class', 'W463 (2nd gen)', 2018, null, 'offroad', 'rare', {
    aliases: ['g wagon', 'g-wagon', 'g63', 'g class', 'g550'],
  }),
  v('mercedes-sprinter-vs30', 'mercedes-benz', 'Sprinter', 'VS30', 2018, null, 'van', 'common'),
  v('mercedes-amg-gt-c190', 'mercedes-benz', 'AMG GT', 'C190', 2014, 2021, 'sports', 'exotic', {
    aliases: ['amg gt', 'gt'],
  }),
  v('mercedes-300-sl-w198', 'mercedes-benz', '300 SL', 'W198', 1954, 1963, 'coupe', 'legendary', {
    aliases: ['gullwing', '300sl'],
  }),
  v('mercedes-amg-one', 'mercedes-benz', 'AMG ONE', 'C298', 2022, null, 'hypercar', 'legendary', {
    aliases: ['amg one', 'project one'],
  }),
  v('audi-a4-b9', 'audi', 'A4', 'B9', 2015, 2024, 'sedan', 'common'),
  v('audi-q5-fy', 'audi', 'Q5', 'FY', 2017, 2024, 'suv', 'common'),
  v('audi-tt-8s', 'audi', 'TT', '8S', 2014, 2023, 'coupe', 'uncommon'),
  v('audi-rs6-avant-c8', 'audi', 'RS 6 Avant', 'C8', 2019, null, 'wagon', 'rare', {
    aliases: ['rs6', 'rs 6', 'rs6 avant'],
  }),
  v('audi-r8-4s', 'audi', 'R8', 'Type 4S', 2015, 2024, 'supercar', 'exotic'),
  v('porsche-911-992', 'porsche', '911', '992', 2019, null, 'sports', 'rare', {
    aliases: ['carrera', '911 carrera'],
  }),
  v('porsche-911-gt3-992', 'porsche', '911 GT3', '992', 2021, null, 'sports', 'exotic', {
    aliases: ['gt3'],
  }),
  v('porsche-taycan-j1', 'porsche', 'Taycan', 'J1', 2019, null, 'sedan', 'rare', { electric: true }),
  v('porsche-cayenne-e3', 'porsche', 'Cayenne', 'E3', 2017, null, 'suv', 'uncommon'),
  v('porsche-macan-95b', 'porsche', 'Macan', '95B', 2014, null, 'suv', 'uncommon'),
  v('porsche-carrera-gt', 'porsche', 'Carrera GT', '980', 2003, 2006, 'supercar', 'legendary'),
  v('porsche-918-spyder', 'porsche', '918 Spyder', '918', 2013, 2015, 'hypercar', 'legendary', {
    aliases: ['918'],
  }),

  // ───────────────────────── United States ─────────────────────────
  v('ford-f-150-14', 'ford', 'F-150', '14th gen', 2020, null, 'pickup', 'common', {
    aliases: ['f150', 'f 150'],
  }),
  v('ford-maverick', 'ford', 'Maverick', '1st gen (P758)', 2021, null, 'pickup', 'common'),
  v('ford-explorer-u625', 'ford', 'Explorer', 'U625', 2019, null, 'suv', 'common'),
  v('ford-mustang-s550', 'ford', 'Mustang', 'S550', 2014, 2023, 'coupe', 'uncommon'),
  v('ford-mustang-s650', 'ford', 'Mustang', 'S650', 2023, null, 'coupe', 'uncommon'),
  v('ford-bronco-u725', 'ford', 'Bronco', '6th gen (U725)', 2021, null, 'offroad', 'uncommon'),
  v('ford-gt-2', 'ford', 'GT', '2nd gen', 2016, 2022, 'supercar', 'legendary', {
    aliases: ['ford gt'],
  }),
  v('chevrolet-silverado-4', 'chevrolet', 'Silverado', '4th gen', 2018, null, 'pickup', 'common', {
    aliases: ['silverado 1500'],
  }),
  v('chevrolet-equinox-3', 'chevrolet', 'Equinox', '3rd gen', 2017, 2024, 'suv', 'common'),
  v('chevrolet-camaro-6', 'chevrolet', 'Camaro', '6th gen', 2015, 2023, 'coupe', 'uncommon'),
  v('chevrolet-corvette-c8', 'chevrolet', 'Corvette', 'C8', 2019, null, 'sports', 'rare', {
    aliases: ['vette', 'stingray', 'corvette stingray'],
  }),
  v('chevrolet-corvette-c2', 'chevrolet', 'Corvette', 'C2', 1962, 1967, 'sports', 'rare', {
    aliases: ['sting ray', 'stingray'],
  }),
  v('dodge-charger-ld', 'dodge', 'Charger', 'LD', 2010, 2023, 'sedan', 'common'),
  v('dodge-challenger-lc', 'dodge', 'Challenger', 'LC', 2008, 2023, 'coupe', 'uncommon'),
  v('dodge-viper-vx', 'dodge', 'Viper', '5th gen (VX)', 2012, 2017, 'supercar', 'exotic', {
    aliases: ['srt viper'],
  }),
  v('jeep-wrangler-jl', 'jeep', 'Wrangler', 'JL', 2017, null, 'offroad', 'common'),
  v('jeep-grand-cherokee-wl', 'jeep', 'Grand Cherokee', 'WL', 2021, null, 'suv', 'common'),
  v('tesla-model-3', 'tesla', 'Model 3', '1st gen', 2017, null, 'sedan', 'common', {
    electric: true,
    aliases: ['model3'],
  }),
  v('tesla-model-y', 'tesla', 'Model Y', '1st gen', 2020, null, 'suv', 'common', {
    electric: true,
    aliases: ['modely'],
  }),
  v('tesla-model-s', 'tesla', 'Model S', '1st gen', 2012, null, 'sedan', 'uncommon', {
    electric: true,
    aliases: ['models'],
  }),
  v('tesla-cybertruck', 'tesla', 'Cybertruck', '1st gen', 2023, null, 'pickup', 'uncommon', {
    electric: true,
  }),
  v('cadillac-escalade-5', 'cadillac', 'Escalade', '5th gen', 2020, null, 'suv', 'uncommon'),
  v('rivian-r1t', 'rivian', 'R1T', '1st gen', 2021, null, 'pickup', 'uncommon', { electric: true }),

  // ──────────────────────── United Kingdom ─────────────────────────
  v('mini-hatch-f56', 'mini', 'Cooper Hatch', 'F56', 2013, 2023, 'hatchback', 'common', {
    aliases: ['cooper', 'mini cooper', 'hatch', 'cooper s'],
  }),
  v('land-rover-defender-l663', 'land-rover', 'Defender', 'L663', 2019, null, 'offroad', 'uncommon', {
    aliases: ['defender 110', 'defender 90'],
  }),
  v('land-rover-defender-classic', 'land-rover', 'Defender', '90/110 (classic)', 1983, 2016, 'offroad', 'uncommon', {
    aliases: ['defender 110', 'defender 90', 'land rover 90', 'land rover 110'],
  }),
  v('land-rover-range-rover-l460', 'land-rover', 'Range Rover', 'L460', 2021, null, 'suv', 'uncommon'),
  v('land-rover-range-rover-sport-l461', 'land-rover', 'Range Rover Sport', 'L461', 2022, null, 'suv', 'uncommon'),
  v('jaguar-f-type-x152', 'jaguar', 'F-Type', 'X152', 2013, 2024, 'sports', 'rare', {
    aliases: ['ftype', 'f type'],
  }),
  v('jaguar-e-type', 'jaguar', 'E-Type', 'Series 1–3', 1961, 1975, 'sports', 'exotic', {
    aliases: ['etype', 'e type', 'xke'],
  }),
  v('aston-martin-db11', 'aston-martin', 'DB11', '1st gen', 2016, 2023, 'sports', 'exotic'),
  v('aston-martin-vantage-2018', 'aston-martin', 'Vantage', '2nd gen (2018)', 2017, null, 'sports', 'exotic'),
  v('aston-martin-valkyrie', 'aston-martin', 'Valkyrie', '1st gen', 2021, null, 'hypercar', 'legendary'),
  v('mclaren-720s', 'mclaren', '720S', '1st gen', 2017, 2023, 'supercar', 'exotic'),
  v('mclaren-artura', 'mclaren', 'Artura', '1st gen', 2021, null, 'supercar', 'exotic'),
  v('mclaren-f1', 'mclaren', 'F1', '1st gen', 1992, 1998, 'hypercar', 'legendary'),
  v('rolls-royce-phantom-8', 'rolls-royce', 'Phantom', 'VIII', 2017, null, 'sedan', 'exotic'),
  v('rolls-royce-cullinan', 'rolls-royce', 'Cullinan', '1st gen', 2018, null, 'suv', 'exotic'),
  v('bentley-continental-gt-3', 'bentley', 'Continental GT', '3rd gen', 2017, 2024, 'coupe', 'rare'),
  v('lotus-emira', 'lotus', 'Emira', '1st gen', 2021, null, 'sports', 'rare'),

  // ───────────────────────────── Italy ─────────────────────────────
  v('fiat-500-312', 'fiat', '500', '312', 2007, 2024, 'hatchback', 'common', {
    aliases: ['cinquecento', '500c'],
  }),
  v('fiat-panda-319', 'fiat', 'Panda', '319', 2011, null, 'hatchback', 'common'),
  v('alfa-romeo-giulia-952', 'alfa-romeo', 'Giulia', '952', 2015, null, 'sedan', 'uncommon'),
  v('alfa-romeo-stelvio-949', 'alfa-romeo', 'Stelvio', '949', 2016, null, 'suv', 'uncommon'),
  v('maserati-ghibli-m157', 'maserati', 'Ghibli', 'M157', 2013, 2024, 'sedan', 'rare'),
  v('maserati-mc20', 'maserati', 'MC20', '1st gen', 2020, null, 'supercar', 'exotic'),
  v('ferrari-488', 'ferrari', '488', 'F142M', 2015, 2019, 'supercar', 'exotic', {
    aliases: ['488 gtb', '488 spider'],
  }),
  v('ferrari-f8', 'ferrari', 'F8 Tributo', 'F142MFL', 2019, 2023, 'supercar', 'exotic', {
    aliases: ['f8', 'f8 spider'],
  }),
  v('ferrari-roma', 'ferrari', 'Roma', '1st gen', 2019, null, 'coupe', 'exotic'),
  v('ferrari-296', 'ferrari', '296 GTB', '1st gen', 2021, null, 'supercar', 'exotic', {
    aliases: ['296', '296 gts'],
  }),
  v('ferrari-f40', 'ferrari', 'F40', '1st gen', 1987, 1992, 'supercar', 'legendary'),
  v('ferrari-enzo', 'ferrari', 'Enzo', '1st gen', 2002, 2004, 'hypercar', 'legendary', {
    aliases: ['enzo ferrari'],
  }),
  v('ferrari-laferrari', 'ferrari', 'LaFerrari', 'F150', 2013, 2016, 'hypercar', 'legendary'),
  v('lamborghini-huracan', 'lamborghini', 'Huracán', 'LB724', 2014, 2024, 'supercar', 'exotic', {
    aliases: ['huracan'],
  }),
  v('lamborghini-aventador', 'lamborghini', 'Aventador', 'LB834', 2011, 2022, 'supercar', 'exotic'),
  v('lamborghini-urus', 'lamborghini', 'Urus', '1st gen', 2018, null, 'suv', 'exotic'),
  v('lamborghini-countach-classic', 'lamborghini', 'Countach', 'LP400–25th Anniversary', 1974, 1990, 'supercar', 'legendary'),
  v('pagani-zonda', 'pagani', 'Zonda', '1st gen', 1999, 2019, 'hypercar', 'legendary'),
  v('pagani-huayra', 'pagani', 'Huayra', '1st gen', 2012, null, 'hypercar', 'legendary'),

  // ────────────────────────── South Korea ──────────────────────────
  v('hyundai-elantra-cn7', 'hyundai', 'Elantra', 'CN7', 2020, null, 'sedan', 'common', {
    aliases: ['avante'],
  }),
  v('hyundai-elantra-n', 'hyundai', 'Elantra N', 'CN7', 2021, null, 'sedan', 'uncommon', {
    aliases: ['avante n'],
  }),
  v('hyundai-tucson-nx4', 'hyundai', 'Tucson', 'NX4', 2020, null, 'suv', 'common'),
  v('hyundai-santa-fe-mx5', 'hyundai', 'Santa Fe', 'MX5', 2023, null, 'suv', 'common'),
  v('hyundai-ioniq-5', 'hyundai', 'IONIQ 5', 'NE', 2021, null, 'suv', 'common', {
    electric: true,
    aliases: ['ioniq5', 'ioniq 5'],
  }),
  v('hyundai-ioniq-5-n', 'hyundai', 'IONIQ 5 N', 'NE', 2023, null, 'suv', 'rare', {
    electric: true,
    aliases: ['ioniq 5n', 'ioniq5 n'],
  }),
  v('kia-telluride', 'kia', 'Telluride', '1st gen', 2019, null, 'suv', 'common'),
  v('kia-sportage-nq5', 'kia', 'Sportage', 'NQ5', 2021, null, 'suv', 'common'),
  v('kia-sorento-mq4', 'kia', 'Sorento', 'MQ4', 2020, null, 'suv', 'common'),
  v('kia-ev6', 'kia', 'EV6', 'CV', 2021, null, 'suv', 'uncommon', { electric: true }),
  v('kia-stinger', 'kia', 'Stinger', 'CK', 2017, 2023, 'sedan', 'uncommon'),
  v('genesis-g70', 'genesis', 'G70', 'IK', 2017, null, 'sedan', 'uncommon'),
  v('genesis-gv80', 'genesis', 'GV80', 'JX1', 2020, null, 'suv', 'uncommon'),
];
