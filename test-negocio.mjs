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


// ---------------------------------------------------------------
// Fiados: número de WhatsApp, plantillas y saldos
// ---------------------------------------------------------------
import {
  PLANTILLAS_DEF, armarMensaje, enlaceWhatsApp, numeroWhatsApp, saldoDe,
} from './src/lib/fiados.js';

console.log('\n--- Fiados ---');
let f2 = 0;
const chk2 = (nom, real, esp) => {
  const ok = real === esp;
  if (!ok) f2++;
  console.log(`${ok ? '✓' : '✗'} ${nom}  ->  ${real}${ok ? '' : `  (esperado ${esp})`}`);
};

chk2('Celular de 10 dígitos lleva 57', numeroWhatsApp('3001234567'), '573001234567');
chk2('Ya trae indicativo, no lo duplica', numeroWhatsApp('573001234567'), '573001234567');
chk2('Con espacios y guiones', numeroWhatsApp('300 123-4567'), '573001234567');
chk2('Vacío devuelve vacío', numeroWhatsApp(''), '');

const msg = armarMensaje(PLANTILLAS_DEF.fiado, {
  cliente: 'Javier', fecha: '17 de agosto de 2026',
  detalle: '1× CALDO DE PESCADO', monto: '$12.000', saldo: '$36.000',
  negocio: 'Doña Rosa',
});
chk2('No quedan llaves sin reemplazar', /\{[a-z]+\}/.test(msg), false);
chk2('Incluye el nombre', msg.includes('Javier'), true);
chk2('Incluye el saldo', msg.includes('$36.000'), true);
chk2('Incluye el negocio', msg.includes('Doña Rosa'), true);

// Una llave que no exista se deja tal cual, no rompe
chk2('Llave desconocida no rompe', armarMensaje('Hola {nadie}', { cliente: 'X' }), 'Hola {nadie}');

chk2('Enlace de WhatsApp', enlaceWhatsApp('3001234567', 'Hola').startsWith('https://wa.me/573001234567?text='), true);
chk2('Sin celular igual arma enlace', enlaceWhatsApp('', 'Hola'), 'https://wa.me/?text=Hola');

// Saldo: dos consumos y un abono
chk2('Saldo con abonos', saldoDe([
  { tipo: 'deuda', monto: 12000 },
  { tipo: 'deuda', monto: 12000 },
  { tipo: 'abono', monto: 10000 },
]), 14000);
chk2('Saldo en cero', saldoDe([{ tipo: 'deuda', monto: 5000 }, { tipo: 'abono', monto: 5000 }]), 0);
chk2('Sin movimientos', saldoDe([]), 0);

console.log(f2 ? `\n❌ ${f2} fallo(s) en fiados` : '\n✅ Fiados: todo pasa');
process.exit(fallos + f2 ? 1 : 0);
