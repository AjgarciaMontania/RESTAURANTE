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


// ---------------------------------------------------------------
// Estados de cobro: qué entra a la caja y qué queda debiendo
// ---------------------------------------------------------------
import { entroACaja, estadoPago, quedoDebiendo } from './src/lib/negocio.js';

console.log('\n--- Cobros ---');
let f3 = 0;
const chk3 = (nom, real, esp) => {
  const ok = real === esp;
  if (!ok) f3++;
  console.log(`${ok ? '✓' : '✗'} ${nom}  ->  ${real}${ok ? '' : `  (esperado ${esp})`}`);
};

const recienTomado = { total: 12000, pago: 'porCobrar' };
chk3('Recién tomado no entra a caja', entroACaja(recienTomado), 0);
chk3('Recién tomado no es deuda', quedoDebiendo(recienTomado), 0);

const pagado = { total: 12000, pago: 'pagado', abonado: 12000 };
chk3('Pagado entra completo', entroACaja(pagado), 12000);
chk3('Pagado no debe nada', quedoDebiendo(pagado), 0);

const fiado = { total: 12000, pago: 'fiado', abonado: 0 };
chk3('Fiado no entra a caja', entroACaja(fiado), 0);
chk3('Fiado debe todo', quedoDebiendo(fiado), 12000);

const parcial = { total: 12000, pago: 'parcial', abonado: 8000 };
chk3('Parcial entra lo abonado', entroACaja(parcial), 8000);
chk3('Parcial debe la diferencia', quedoDebiendo(parcial), 4000);

// Pedidos viejos, de antes de que existiera el cobro aparte
chk3('Pedido viejo se da por pagado', estadoPago({ total: 9000 }), 'pagado');
chk3('Pedido viejo entra a caja', entroACaja({ total: 9000 }), 9000);
chk3('Pedido viejo marcado fiado', estadoPago({ total: 9000, fiado: true }), 'fiado');
chk3('Pedido viejo fiado es deuda', quedoDebiendo({ total: 9000, fiado: true }), 9000);

// La caja del día debe cuadrar: caja + fiado + sin cobrar = vendido
const dia = [recienTomado, pagado, fiado, parcial];
const enCaja = dia.reduce((s, p) => s + entroACaja(p), 0);
const debido = dia.reduce((s, p) => s + quedoDebiendo(p), 0);
const sinCobrar = dia.filter((p) => estadoPago(p) === 'porCobrar').reduce((s, p) => s + p.total, 0);
const vendido = dia.reduce((s, p) => s + p.total, 0);
chk3('Caja + fiado + sin cobrar = vendido', enCaja + debido + sinCobrar, vendido);

console.log(f3 ? `\n❌ ${f3} fallo(s) en cobros` : '\n✅ Cobros: todo cuadra');


// ---------------------------------------------------------------
// Avisos: nada se manda solo, se acumula y se envía junto
// ---------------------------------------------------------------
import { netoPendiente, plantillaPara, sinAvisar } from './src/lib/fiados.js';

console.log('\n--- Avisos ---');
let f4 = 0;
const chk4 = (nom, real, esp) => {
  const ok = real === esp;
  if (!ok) f4++;
  console.log(`${ok ? '✓' : '✗'} ${nom}  ->  ${real}${ok ? '' : `  (esperado ${esp})`}`);
};

const cuenta = [
  { tipo: 'deuda', monto: 12000, avisado: true },
  { tipo: 'deuda', monto: 12000, avisado: false },
  { tipo: 'abono', monto: 5000, avisado: false },
  { tipo: 'deuda', monto: 10000 },            // sin la marca = sin avisar
];

chk4('Cuenta 3 pendientes', sinAvisar(cuenta).length, 3);
chk4('Neto pendiente (12000 - 5000 + 10000)', netoPendiente(cuenta), 17000);
chk4('Nada pendiente', sinAvisar([{ tipo: 'deuda', monto: 1, avisado: true }]).length, 0);

chk4('Solo consumos usa plantilla de fiado',
  plantillaPara([{ tipo: 'deuda' }, { tipo: 'deuda' }]), 'fiado');
chk4('Solo abonos usa plantilla de abono',
  plantillaPara([{ tipo: 'abono' }]), 'abono');
chk4('Mezclados usan estado de cuenta',
  plantillaPara([{ tipo: 'deuda' }, { tipo: 'abono' }]), 'estado');

console.log(f4 ? `\n❌ ${f4} fallo(s) en avisos` : '\n✅ Avisos: todo pasa');


// ---------------------------------------------------------------
// El huevo cuenta como una proteína más
// ---------------------------------------------------------------
console.log('\n--- Huevos ---');
let f5 = 0;
const chk5 = (nom, real, esp) => {
  const ok = real === esp;
  if (!ok) f5++;
  console.log(`${ok ? '✓' : '✗'} ${nom}  ->  ${real}${ok ? '' : `  (esperado ${esp})`}`);
};

const revueltos = { id: 'h1', nombre: 'Huevos revueltos', precio: 0 };
const pechuga2 = { id: 'd', nombre: 'Pechuga', precio: 0 };
const rancheros = { id: 'h2', nombre: 'Huevos rancheros', precio: 7000 };

// Caldo + huevos = un solo almuerzo, igual que con la pechuga
const h1 = armarLinea({ caldo: pescado, huevos: [revueltos], especial: false, precios: P });
chk5('Caldo + huevos = un almuerzo', h1.precioUnit, 10000);
chk5('  se rotulan aparte', h1.descripcion, 'CALDO DE PESCADO + HUEVOS: REVUELTOS');
chk5('  no repite la palabra huevos', /HUEVOS:\s*HUEVOS/.test(h1.descripcion), false);

// Mezclando proteína y huevo sigue siendo un solo almuerzo
const h2 = armarLinea({ caldo: pescado, proteinas: [arroz, pechuga], huevos: [rancheros], especial: false, precios: P });
chk5('Caldo + proteinas + huevos, un solo cobro', h2.precioUnit, 10000);
chk5('  cada parte en su lugar', h2.descripcion,
  'CALDO DE PESCADO + ARROZ, PECHUGA + HUEVOS: RANCHEROS');

// Solo huevos = seco
const h3 = armarLinea({ caldo: null, huevos: [revueltos], especial: false, precios: P });
chk5('Solo huevos se cobra como seco', h3.precioUnit, 8000);
chk5('  descripcion sin proteina', h3.descripcion, 'HUEVOS: REVUELTOS');

// Seco y huevos juntos, sin caldo
const h3b = armarLinea({ caldo: null, proteinas: [arroz], huevos: [revueltos], especial: false, precios: P });
chk5('Seco + huevos', h3b.descripcion, 'SECO: ARROZ + HUEVOS: REVUELTOS');

// Un huevo con precio propio manda cuando va solo
const h4 = armarLinea({ caldo: null, huevos: [rancheros], especial: false, precios: P });
chk5('Huevo con precio propio, solo', h4.precioUnit, 7000);

// Pero acompañado del caldo sigue siendo el precio del almuerzo
const h5 = armarLinea({ caldo: pescado, huevos: [rancheros], especial: false, precios: P });
chk5('Huevo con precio propio + caldo = almuerzo', h5.precioUnit, 10000);

// Especial también aplica
const h6 = armarLinea({ caldo: pescado, huevos: [revueltos], especial: true, precios: P });
chk5('Caldo + huevos marcado especial', h6.precioUnit, 13000);

// El rótulo se conserva para que la cocina lo muestre aparte
chk5('La linea trae los huevos por separado', h2.huevos, 'HUEVOS: RANCHEROS');
chk5('Sin huevos queda vacio',
  armarLinea({ caldo: pescado, proteinas: [arroz], especial: false, precios: P }).huevos, '');

console.log(f5 ? `\n❌ ${f5} fallo(s) en huevos` : '\n✅ Huevos: todo pasa');
process.exit(fallos + f2 + f3 + f4 + f5 ? 1 : 0);
