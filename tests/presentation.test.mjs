// Real PRESENTACIÓN strings from PROFECO QQP 2025-2026 and their expected parse.
// Run: node --test tests/presentation.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePresentation } from '../tools/lib/presentation.mjs';

// [presentation as published, expected]  (pack only when a multipack was detected)
const CASES = [
  // weight
  ['1 Kg. Granel', { value: 1000, unit: 'g' }],
  ['1 Kg. Granel. de Pavo. Virginia', { value: 1000, unit: 'g' }],
  ['Paquete 400 Gr.', { value: 400, unit: 'g' }],
  ['Lata 425 Gr. en Tomate', { value: 425, unit: 'g' }],
  ['Barra 90 Gr. Sin Sal', { value: 90, unit: 'g' }],
  ['Bolsa Plástico 900 Gr. Estándar', { value: 900, unit: 'g' }],
  ['Bolsa 5 Kg. Polvo', { value: 5000, unit: 'g' }],
  ['Lata. 1.08 Kg.', { value: 1080, unit: 'g' }],
  ['Paquete 1 Kg. Ó 1.1 Kg.', { value: 1000, unit: 'g' }],
  ['Bolsa Plástico 2 Kg. Estándar o Morena', { value: 2000, unit: 'g' }],
  ['Sobre 7 Gr. Naranja', { value: 7, unit: 'g' }],
  ['Paquete 144 Gr. 8 Rebanadas', { value: 144, unit: 'g' }],
  ['Pieza 43.8 Gr. con Leche Confitados', { value: 43.8, unit: 'g' }],
  ['Caja 1 Pieza 11 Gr.', { value: 11, unit: 'g' }],
  ['Blister 1 Pieza 8 Gr. C.b. 415083', { value: 8, unit: 'g' }],
  ['Bote 305 Gr./400 Ml. Base de Agua', { value: 305, unit: 'g' }],
  ['Caja con Tubo con 20 Gr. 1 Gr./100 Gr.', { value: 20, unit: 'g' }],
  ['Kg. Natural', { value: 1000, unit: 'g' }],
  ['Paquete Contenido Variable. Kg. Seco', { value: 1000, unit: 'g' }],
  ['Paquete 80 Piezass. Antifugas. Talla 4', { value: 80, unit: 'pza' }],
  // volume
  ['Botella 850 Ml. Vegetal', { value: 850, unit: 'ml' }],
  ['Botella 600 Ml.', { value: 600, unit: 'ml' }],
  ['Caja 1 Lt. Entera', { value: 1000, unit: 'ml' }],
  ['Botella 2 Lt. No Retornable', { value: 2000, unit: 'ml' }],
  ['Botella 1.5 Lt.', { value: 1500, unit: 'ml' }],
  ['Botella 946 Ml. Soya', { value: 946, unit: 'ml' }],
  ['Lata 355 Ml.', { value: 355, unit: 'ml' }],
  ['Botella 500 Ml. Etílico Desnaturalizado. 70°', { value: 500, unit: 'ml' }],
  ['Frasco Gotero 24 Ml. 1.000 G., Solución Gotas', { value: 24, unit: 'ml' }],
  ['Envase o Caja 1 Lt. Entera', { value: 1000, unit: 'ml' }],
  // multipacks
  ['Canasta con 6 Botellas de 355 Ml. No Retornable', { value: 2130, unit: 'ml', pack: 6 }],
  ['Paquete con 12 Latas de 355 Ml.', { value: 4260, unit: 'ml', pack: 12 }],
  ['Paquete con 12 Latas de 355 Ml. C/u', { value: 4260, unit: 'ml', pack: 12 }],
  ['Canastilla C/6 Botellas de 296 Ml.', { value: 1776, unit: 'ml', pack: 6 }],
  ['Caja 12 Cubos de 10.5 Gr. C/u. Caldo', { value: 126, unit: 'g', pack: 12 }],
  ['Caja con 30 Sobres de 5 Gr. C/u. Polvo Efervescente. Sabor Naranja', { value: 150, unit: 'g', pack: 30 }],
  ['Caja 200 Gr. (50 Sobres de 4 Gr. C/u). Mascabado', { value: 200, unit: 'g', pack: 50 }],
  ['Caja con 5 Ampolletas de 2 Ml. Solución Inyectable', { value: 10, unit: 'ml', pack: 5 }],
  ['Caja con 20 Sobres de 10 Ml. Gel', { value: 200, unit: 'ml', pack: 20 }],
  ['Paquete 400 Gr. (2 Pack)', { value: 400, unit: 'g', pack: 2 }],
  ['Bolsa 15 Piezas. 382.5 Gr.', { value: 382.5, unit: 'g', pack: 15 }],
  ['Bolsa 20+2 Piezas. 561 Gr.', { value: 561, unit: 'g', pack: 22 }],
  ['Paquete 10 Cajas. 50 Piezas C/u', { value: 500, unit: 'pza', pack: 10 }],
  ['2 Cajas con 14 Cápsulas de 20 Mg. C/u', { value: 28, unit: 'pza', pack: 2 }],
  // pieces: medicines count tablets, strengths are ignored
  ['Caja con 30 Tabletas de 50 Mg.', { value: 30, unit: 'pza' }],
  ['Caja con 4 Tabletas de 37.5 Mg./500 Mg.', { value: 4, unit: 'pza' }],
  ['Caja con 20 Comprimidos de 125/5 Mg.', { value: 20, unit: 'pza' }],
  ['Frasco con 28 Tabletas de 10 Mg.', { value: 28, unit: 'pza' }],
  ['Caja con 40 Tabletas de 1 Gr.', { value: 40, unit: 'pza' }],
  ['Caja con 12 Tabletas. Efervescente', { value: 12, unit: 'pza' }],
  ['Caja con 10 Tabletas', { value: 10, unit: 'pza' }],
  ['Caja con 30 Cápsulas', { value: 30, unit: 'pza' }],
  ['Caja con Frasco 120 Disparos. Suspensión 27.5 Μg./50 Μl.', { value: 120, unit: 'pza' }],
  ['Caja con Dispositivo Inhalador con 60 Dosis. 50 Μg./250 Μg.', { value: 60, unit: 'pza' }],
  // pieces: eggs, paper, school, razors, batteries
  ['Paquete C/18 Blanco', { value: 18, unit: 'pza' }],
  ['Paquete C/12 Rojo', { value: 12, unit: 'pza' }],
  ['Paquete 4 Rollos. 200 Hojas Dobles', { value: 4, unit: 'pza' }],
  ['Paquete 4 Rollos. Xxl Hojas Dobles', { value: 4, unit: 'pza' }],
  ['Paquete 420 Hojas', { value: 420, unit: 'pza' }],
  ['100 Hojas. Cuadro Grande. C/espiral', { value: 100, unit: 'pza' }],
  ['Bolsa con 10 Piezas. Mediano', { value: 10, unit: 'pza' }],
  ['Caja con 10 Piezas (10x10 Cm.). Absorbente Estéril', { value: 10, unit: 'pza' }],
  ['Paquete 1 Pieza (30 Cm. X 5 M.). Premium', { value: 1, unit: 'pza' }],
  ['Caja 12 Ceras. Estándar. C.b. 201034', { value: 12, unit: 'pza' }],
  ['Paquete con 2. Venus. Sensitive', { value: 2, unit: 'pza' }],
  ['Paquete con 6. Aa', { value: 6, unit: 'pza' }],
  ['Estuche con 2. Mach 3. Sensitive', { value: 2, unit: 'pza' }],
  ['Caja 1 Pieza. 30 W. Luz de Día. 30w/865. 8,000 Horas', { value: 1, unit: 'pza' }],
  // single pieces and bunches
  ['Pieza', { value: 1, unit: 'pza' }],
  ['Pieza. Romana', { value: 1, unit: 'pza' }],
  ['Manojo', { value: 1, unit: 'pza' }],
  ['Manojo. Cambray', { value: 1, unit: 'pza' }],
  ['Concha. Pieza de 68 a 90 Gr. (12 Cm. de Diámetro Aprox.)', { value: 1, unit: 'pza' }],
  ['Pieza (charola o Bolsa, No Incluye Complementos)', { value: 1, unit: 'pza' }],
  // nothing to parse
  ['Caja', null],
  ['Bolsa. Cambray', null],
  ['Fire Tv Stick', null],
  ['', null],
];

// Forms the app's own input may use (not in the PROFECO data but required by the brief)
const EXTRA = [
  ['PAQUETE 4 PZAS. 200 GR. C/U', { value: 800, unit: 'g', pack: 4 }],
  ['6 PACK 355 ML', { value: 2130, unit: 'ml', pack: 6 }],
  ['Leche 1,5 L', { value: 1500, unit: 'ml' }],
  ['Maruchan 12 x 64 g', { value: 768, unit: 'g', pack: 12 }],
  ['Huevo 18 piezas', { value: 18, unit: 'pza' }],
  ['Papel higiénico 12 rollos', { value: 12, unit: 'pza' }],
  ['Refresco 2.5 lt', { value: 2500, unit: 'ml' }],
];

for (const [text, expected] of [...CASES, ...EXTRA]) {
  test(`parsePresentation(${JSON.stringify(text)})`, () => {
    assert.deepEqual(parsePresentation(text), expected);
  });
}

test('null and undefined are null', () => {
  assert.equal(parsePresentation(null), null);
  assert.equal(parsePresentation(undefined), null);
});

test('at least 40 real strings are covered', () => {
  assert.ok(CASES.length >= 40);
});
