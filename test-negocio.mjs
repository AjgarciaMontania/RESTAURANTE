import { armarLinea, totalLineas, PRECIOS_DEF, money } from './src/lib/negocio.js';

const P = { ...PRECIOS_DEF, almuerzoNormal: 10000, almuerzoEspecial: 13000, soloCaldo: 5000, soloSeco: 8000 };
const pescado = { id: 'a', nombre: 'Pescado', precio: 0 };
const hueso   = { id: 'b', nombre: 'Hueso',   precio: 6000 };
const arroz   = { id: 'c', nombre: 'Arroz',   precio: 0 };
const pechuga = { id: 'd', nombre: 'Pechuga', precio: 0 };

let fallos = 0;
const chk = (nom, real, esp) => {
  const ok = real === esp;
  if (!ok) fallos++;
  console.log(`${ok ? '✓' : '✗'} ${nom}  ->  ${real}${ok ? '' : `  (esperado ${esp})`}`);
};

// Caso del ejemplo de Alvaro
const l1 = armarLinea({ caldo: pescado, proteinas: [], especial: false, precios: P });
chk('Solo caldo de pescado', l1.precioUnit, 5000);

const l2 = armarLinea({ caldo: null, proteinas: [arroz, pechuga], especial: false, precios: P });
chk('Solo seco (arroz, pechuga)', l2.precioUnit, 8000);
chk('  descripcion', l2.descripcion, 'SECO: ARROZ, PECHUGA');

const l3 = armarLinea({ caldo: pescado, proteinas: [arroz, pechuga], especial: false, precios: P });
chk('Combinado = UN almuerzo normal', l3.precioUnit, 10000);
chk('  no suma caldo+seco (13000)', l3.precioUnit !== 13000, true);
chk('  descripcion', l3.descripcion, 'CALDO DE PESCADO + ARROZ, PECHUGA');

const l4 = armarLinea({ caldo: pescado, proteinas: [pechuga], especial: true, precios: P });
chk('Combinado especial', l4.precioUnit, 13000);

// Precio propio de la fila pisa al base
const l5 = armarLinea({ caldo: hueso, proteinas: [], especial: false, precios: P });
chk('Solo caldo con precio propio ($6000)', l5.precioUnit, 6000);
chk('  queda bloqueado', l5.fijo, true);

// Nada seleccionado
chk('Sin selección devuelve null', armarLinea({ caldo: null, proteinas: [], especial: false, precios: P }), null);

// Precio editable cuando no es fijo
const l6 = armarLinea({ caldo: pescado, proteinas: [arroz], especial: false, precios: { ...P, almuerzoNormalFijo: false } });
chk('Almuerzo no fijo => editable', l6.fijo, false);

// Total del talonario del ejemplo: 1 caldo de pescado + 1 arroz/pechuga = 20.000
const total = totalLineas([
  { cant: 1, precioUnit: 10000 },
  { cant: 1, precioUnit: 10000 },
]);
chk('Total ejemplo talonario', money(total), '$20.000');

// Adicional se cobra aparte encima del almuerzo
chk('Almuerzo + adicional', money(totalLineas([{ cant: 1, precioUnit: 10000 }, { cant: 2, precioUnit: 3000 }])), '$16.000');

console.log(fallos ? `\n❌ ${fallos} fallo(s)` : '\n✅ Todas las reglas de cobro pasan');
process.exit(fallos ? 1 : 0);
