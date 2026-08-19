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

// ---------------------------------------------------------------
// Sopas: el caldo es del desayuno y la sopa del almuerzo,
// mismo papel y mismo precio, pero nunca juntas
// ---------------------------------------------------------------
console.log('\n--- Sopas ---');
let f6 = 0;
const chk6 = (nom, real, esp) => {
  const ok = real === esp;
  if (!ok) f6++;
  console.log(`${ok ? '✓' : '✗'} ${nom}  ->  ${real}${ok ? '' : `  (esperado ${esp})`}`);
};

const verduras = { id: 's1', nombre: 'Verduras', precio: 0 };
const sopaPasta = { id: 's2', nombre: 'Sopa de pasta', precio: 0 };
const ajiaco = { id: 's3', nombre: 'Ajiaco', precio: 9000 };

const s1 = armarLinea({ sopa: verduras, proteinas: [arroz, pechuga], especial: false, precios: P });
chk6('Sopa + proteinas = un almuerzo', s1.precioUnit, 10000);
chk6('  se rotula como sopa', s1.descripcion, 'SOPA DE VERDURAS + ARROZ, PECHUGA');

// No repite la palabra si el nombre ya la trae
const s2 = armarLinea({ sopa: sopaPasta, proteinas: [arroz], especial: false, precios: P });
chk6('No repite "sopa de"', s2.descripcion, 'SOPA DE PASTA + ARROZ');

// Solo sopa cuesta lo mismo que solo caldo
const s3 = armarLinea({ sopa: verduras, especial: false, precios: P });
chk6('Solo sopa = precio de solo caldo', s3.precioUnit, P.soloCaldo);
chk6('  se distingue en el desglose', s3.tipo, 'solo_sopa');
chk6('  el caldo sigue siendo solo_caldo',
  armarLinea({ caldo: pescado, especial: false, precios: P }).tipo, 'solo_caldo');

// Precio propio de la sopa manda cuando va sola
chk6('Sopa con precio propio', armarLinea({ sopa: ajiaco, especial: false, precios: P }).precioUnit, 9000);
chk6('  pero con proteina vuelve a almuerzo',
  armarLinea({ sopa: ajiaco, proteinas: [arroz], especial: false, precios: P }).precioUnit, 10000);

// Sopa + huevos también es un solo plato
const s4 = armarLinea({ sopa: verduras, huevos: [revueltos], especial: false, precios: P });
chk6('Sopa + huevos, un solo cobro', s4.precioUnit, 10000);
chk6('  con los huevos rotulados', s4.descripcion, 'SOPA DE VERDURAS + HUEVOS: REVUELTOS');

// Si por alguna razón llegan los dos, manda el caldo y no se duplica
const s5 = armarLinea({ caldo: pescado, sopa: verduras, proteinas: [arroz], especial: false, precios: P });
chk6('Caldo y sopa juntos: manda el caldo', s5.descripcion, 'CALDO DE PESCADO + ARROZ');

console.log(f6 ? `\n❌ ${f6} fallo(s) en sopas` : '\n✅ Sopas: todo pasa');

// ---------------------------------------------------------------
// Principios: van incluidos en el plato, no suman aparte
// ---------------------------------------------------------------
console.log('\n--- Principios ---');
let f7 = 0;
const chk7 = (nom, real, esp) => {
  const ok = real === esp;
  if (!ok) f7++;
  console.log(`${ok ? '✓' : '✗'} ${nom}  ->  ${real}${ok ? '' : `  (esperado ${esp})`}`);
};

const frijoles = { id: 'p1', nombre: 'Frijoles', precio: 0 };
const macarrones = { id: 'p2', nombre: 'Principio de macarrones', precio: 0 };
const lentejas = { id: 'p3', nombre: 'Lentejas', precio: 6000 };

// El plato completo del almuerzo
const g1 = armarLinea({ sopa: verduras, principio: frijoles, proteinas: [pechuga], especial: false, precios: P });
chk7('Sopa + principio + proteina = un almuerzo', g1.precioUnit, 10000);
chk7('  descripcion completa', g1.descripcion, 'SOPA DE VERDURAS + PECHUGA + PRINCIPIO: FRIJOLES');
chk7('  el principio viene rotulado aparte', g1.principio, 'PRINCIPIO: FRIJOLES');

// El principio no encarece el plato
const g2 = armarLinea({ sopa: verduras, proteinas: [pechuga], especial: false, precios: P });
chk7('Sin principio cuesta lo mismo', g2.precioUnit, g1.precioUnit);

// Todo junto: sopa, principio, proteina y huevos, un solo cobro
const g3 = armarLinea({ sopa: verduras, principio: frijoles, proteinas: [arroz], huevos: [revueltos], especial: false, precios: P });
chk7('Plato completo con huevos', g3.precioUnit, 10000);
chk7('  cada parte rotulada', g3.descripcion,
  'SOPA DE VERDURAS + ARROZ + PRINCIPIO: FRIJOLES + HUEVOS: REVUELTOS');

// Seco con principio, sin sopa
const g4 = armarLinea({ principio: frijoles, proteinas: [pechuga], especial: false, precios: P });
chk7('Seco con principio', g4.precioUnit, 8000);
chk7('  descripcion', g4.descripcion, 'SECO: PECHUGA + PRINCIPIO: FRIJOLES');

// No repite la palabra si el nombre ya la trae
chk7('No repite "principio de"',
  armarLinea({ principio: macarrones, proteinas: [arroz], especial: false, precios: P }).descripcion,
  'SECO: ARROZ + PRINCIPIO: MACARRONES');

// Solo el principio, con y sin precio propio
chk7('Solo principio se cobra como seco',
  armarLinea({ principio: frijoles, especial: false, precios: P }).precioUnit, 8000);
chk7('Solo principio con precio propio',
  armarLinea({ principio: lentejas, especial: false, precios: P }).precioUnit, 6000);
chk7('  pero acompanado vuelve a almuerzo',
  armarLinea({ sopa: verduras, principio: lentejas, especial: false, precios: P }).precioUnit, 10000);

// Nada seleccionado sigue devolviendo null
chk7('Sin nada devuelve null', armarLinea({ especial: false, precios: P }), null);

console.log(f7 ? `\n❌ ${f7} fallo(s) en principios` : '\n✅ Principios: todo pasa');


// ---------------------------------------------------------------
// Menú de hoy: filtra el catálogo, y nunca deja al mesero sin nada
// ---------------------------------------------------------------
import { diarioVacio, menuDelDia, menuVacio } from './src/lib/menu.js';

console.log('\n--- Menu de hoy ---');
let f8 = 0;
const chk8 = (nom, real, esp) => {
  const ok = real === esp;
  if (!ok) f8++;
  console.log(`${ok ? '✓' : '✗'} ${nom}  ->  ${real}${ok ? '' : `  (esperado ${esp})`}`);
};

const catalogo = {
  caldos: [{ id: 'c1', nombre: 'Pescado' }, { id: 'c2', nombre: 'Hueso' }],
  sopas: [{ id: 's1', nombre: 'Verduras' }, { id: 's2', nombre: 'Pasta' }],
  principios: [{ id: 'p1', nombre: 'Frijoles' }],
  proteinas: [{ id: 't1', nombre: 'Arroz' }, { id: 't2', nombre: 'Carne' }, { id: 't3', nombre: 'Pechuga' }],
  huevos: [{ id: 'h1', nombre: 'Revueltos' }],
  adicionales: [{ id: 'a1', nombre: 'Jugo' }],
  especiales: [],
  meriendas: [{ id: 'm1', nombre: 'Empanada', precio: 3000 }, { id: 'm2', nombre: 'Buñuelo', precio: 2000 }],
};

// Un día normal: se marcó parte del catálogo
const marcado = { caldos: [], sopas: ['s1'], principios: ['p1'], proteinas: ['t2', 't3'], huevos: [], adicionales: ['a1'], especiales: [] };
const r1 = menuDelDia(catalogo, marcado);
chk8('Filtra las sopas', r1.menu.sopas.map(x => x.nombre).join(','), 'Verduras');
chk8('Filtra las proteinas', r1.menu.proteinas.map(x => x.nombre).join(','), 'Carne,Pechuga');
chk8('Lo no marcado queda fuera', r1.menu.caldos.length, 0);
chk8('Los huevos tampoco', r1.menu.huevos.length, 0);
chk8('No avisa, porque si hay seleccion', r1.sinSeleccion, false);

// Nadie marcó nada: se muestra todo, con aviso
const r2 = menuDelDia(catalogo, { caldos: [], sopas: [], principios: [], proteinas: [], huevos: [], adicionales: [], especiales: [] });
chk8('Sin marcar muestra el catalogo', r2.menu.proteinas.length, 3);
chk8('  y avisa', r2.sinSeleccion, true);

// Documento del día inexistente
const r3 = menuDelDia(catalogo, undefined);
chk8('Sin documento del dia muestra todo', r3.menu.caldos.length, 2);
chk8('  y avisa', r3.sinSeleccion, true);

// Un id que ya no existe en el catálogo simplemente se ignora
const r4 = menuDelDia(catalogo, { ...marcado, proteinas: ['t2', 'borrado'] });
chk8('Ignora lo que ya no esta en el catalogo', r4.menu.proteinas.map(x => x.nombre).join(','), 'Carne');

chk8('menuVacio detecta vacio', menuVacio({ caldos: [], sopas: [] }), true);
chk8('menuVacio detecta con datos', menuVacio({ caldos: ['x'] }), false);

// --- Meriendas: fijas, van todos los días sin marcarlas ---
chk8('Meriendas pasan completas aunque no se marquen', r1.menu.meriendas.map(x => x.nombre).join(','), 'Empanada,Buñuelo');
chk8('  tambien sin seleccion del dia', r2.menu.meriendas.length, 2);
chk8('  y sin documento del dia', r3.menu.meriendas.length, 2);

// Marcar meriendas no cambia nada: van todas de todas formas
const r5 = menuDelDia(catalogo, { ...marcado, meriendas: ['m1'] });
chk8('Marcar una merienda no excluye la otra', r5.menu.meriendas.length, 2);

// Solo meriendas marcadas no cuenta como "menu de hoy armado"
const r6 = menuDelDia(catalogo, { meriendas: ['m1', 'm2'] });
chk8('Solo meriendas sigue siendo sin seleccion', r6.sinSeleccion, true);
chk8('  y por eso muestra todo el catalogo', r6.menu.proteinas.length, 3);

chk8('diarioVacio ignora las meriendas', diarioVacio({ meriendas: ['m1'] }), true);
chk8('diarioVacio detecta lo marcado', diarioVacio({ sopas: ['s1'] }), false);

// El catálogo puede ser solo meriendas y aun así hay algo que vender
chk8('menuVacio si cuenta las meriendas', menuVacio({ meriendas: [{ id: 'm1' }] }), false);

console.log(f8 ? `\n❌ ${f8} fallo(s) en menu de hoy` : '\n✅ Menu de hoy: todo pasa');

// ---------------------------------------------------------------
// Receta del renglon: lo que permite repetir o corregir un plato
// ---------------------------------------------------------------
import { receta, soloDatos } from './src/lib/negocio.js';

console.log('\n--- Repetir y corregir ---');
let f9 = 0;
const chk9 = (nom, real, esp) => {
  const ok = real === esp;
  if (!ok) f9++;
  console.log(`${ok ? '✓' : '✗'} ${nom}  ->  ${real}${ok ? '' : `  (esperado ${esp})`}`);
};

const rHueso = { id: 'c2', nombre: 'Hueso' };
const rSudada = { id: 't9', nombre: 'Carne sudada', precio: 9000 };
const rFrita = { id: 't8', nombre: 'Carne frita' };
const rFrijoles = { id: 'p1', nombre: 'Frijoles' };
const rAlverja = { id: 'p2', nombre: 'Alverja' };

const rRec = receta({ caldo: rHueso, principio: rFrijoles, proteinas: [rSudada], huevos: [], especial: false });

// Firestore rechaza undefined: todos los campos tienen que existir
const rSinUndef = (o) => JSON.stringify(o) === JSON.stringify(JSON.parse(JSON.stringify(o)));
chk9('La receta no lleva undefined', rSinUndef(rRec), true);
chk9('Guarda el caldo', rRec.caldo.nombre, 'Hueso');
chk9('  con precio numerico', rRec.caldo.precio, 0);
chk9('Guarda el principio', rRec.principio.nombre, 'Frijoles');
chk9('Guarda la proteina', rRec.proteinas[0].nombre, 'Carne sudada');
chk9('  con su precio', rRec.proteinas[0].precio, 9000);
chk9('Sopa vacia queda en null', rRec.sopa, null);
chk9('Huevos vacios queda en lista', rRec.huevos.length, 0);
chk9('soloDatos de nada es null', soloDatos(null), null);

// Repetir la receta y cambiarle dos cosas da el segundo plato de la pareja
const rPlato1 = armarLinea({ ...rRec, precios: PRECIOS_DEF });
const rPlato2 = armarLinea({ ...rRec, principio: rAlverja, proteinas: [rFrita], precios: PRECIOS_DEF });
chk9('Plato 1 de la pareja', rPlato1.descripcion, 'CALDO DE HUESO + CARNE SUDADA + PRINCIPIO: FRIJOLES');
chk9('Plato 2 de la pareja', rPlato2.descripcion, 'CALDO DE HUESO + CARNE FRITA + PRINCIPIO: ALVERJA');
chk9('Cada uno es un almuerzo', rPlato1.precioUnit, 10000);
chk9('  el otro tambien', rPlato2.precioUnit, 10000);
chk9('Los dos juntos son 2 almuerzos', totalLineas([
  { cant: 1, precioUnit: rPlato1.precioUnit },
  { cant: 1, precioUnit: rPlato2.precioUnit },
]), 20000);

// Dos platos identicos si caben en un solo renglon con cantidad 2
chk9('Dos identicos en un renglon', totalLineas([{ cant: 2, precioUnit: rPlato1.precioUnit }]), 20000);

console.log(f9 ? `\n❌ ${f9} fallo(s) en repetir y corregir` : '\n✅ Repetir y corregir: todo pasa');

// ---------------------------------------------------------------
// Carta del dia: como se lee cada plato en la pantalla del comedor
// ---------------------------------------------------------------
import { hayPlato, limpiarPlato, precioPlato, resumenPlato, PLATO_VACIO } from './src/lib/carta.js';

console.log('\n--- Carta ---');
let f10 = 0;
const chk10 = (nom, real, esp) => {
  const ok = real === esp;
  if (!ok) f10++;
  console.log(`${ok ? '✓' : '✗'} ${nom}  ->  ${real}${ok ? '' : `  (esperado ${esp})`}`);
};

const cPescado = { id: 'c1', nombre: 'Pescado', precio: 0 };
const cFrijoles = { id: 'p1', nombre: 'Principio de frijoles', precio: 0 };
const cSudada = { id: 't1', nombre: 'Carne sudada', precio: 0 };
const cSopa = { id: 's1', nombre: 'Sopa de verduras', precio: 0 };
const cHuevo = { id: 'h1', nombre: 'Huevos revueltos', precio: 0 };

// El ejemplo de Alvaro: caldo de pescado + frijoles + carne sudada
const completo = { caldo: cPescado, principio: cFrijoles, proteinas: [cSudada], huevos: [] };
const r = resumenPlato(completo);
chk10('El titulo es la proteina', r.titulo, 'Carne sudada');
chk10('Dos renglones de detalle', r.detalles.length, 2);
chk10('  el caldo', r.detalles[0].txt, 'Caldo de pescado');
chk10('  el principio sin repetir la palabra', r.detalles[1].txt, 'Frijoles');
chk10('Es un almuerzo normal', precioPlato(completo, PRECIOS_DEF), 10000);
chk10('  y especial cuesta mas', precioPlato({ ...completo, especial: true }, PRECIOS_DEF), 13000);

// Sopa: el rotulo cambia y no repite "sopa de sopa"
const conSopa = resumenPlato({ sopa: cSopa, proteinas: [cSudada] });
chk10('La sopa se rotula como sopa', conSopa.detalles[0].txt, 'Sopa de verduras');

// Sin proteina manda el principio
const soloPrin = resumenPlato({ caldo: cPescado, principio: cFrijoles, proteinas: [] });
chk10('Sin proteina titula el principio', soloPrin.titulo, 'Frijoles');
chk10('  y el caldo queda de detalle', soloPrin.detalles[0].txt, 'Caldo de pescado');

// Solo caldo: titula el caldo y no se repite abajo
const soloCal = resumenPlato({ caldo: cPescado, proteinas: [] });
chk10('Solo caldo titula el caldo', soloCal.titulo, 'Caldo de pescado');
chk10('  sin repetirlo en el detalle', soloCal.detalles.length, 0);
chk10('  y se cobra como caldo solo', precioPlato({ caldo: cPescado, proteinas: [] }, PRECIOS_DEF), 5000);

// Huevos: se muestran sin decir "huevos huevos"
const conHuevo = resumenPlato({ caldo: cPescado, proteinas: [cSudada], huevos: [cHuevo] });
chk10('Los huevos no se repiten', conHuevo.detalles.some(d => d.txt === 'Huevos revueltos'), true);

// Plato vacio
chk10('Plato vacio no se puede publicar', hayPlato(PLATO_VACIO), false);
chk10('Con una proteina ya se puede', hayPlato({ ...PLATO_VACIO, proteinas: [cSudada] }), true);
chk10('Plato vacio no tiene titulo raro', resumenPlato(PLATO_VACIO).titulo, 'Plato del día');

// Lo que se guarda no puede llevar undefined ni mas de 2 fotos
const guardable = limpiarPlato({ ...completo, nota: '  con jugo  ', fotos: ['a', '', 'b', 'c'] });
chk10('Recorta a dos fotos', guardable.fotos.join(','), 'a,b');
chk10('Quita espacios de la nota', guardable.nota, 'con jugo');
chk10('Sin undefined para Firestore',
  JSON.stringify(guardable) === JSON.stringify(JSON.parse(JSON.stringify(guardable))), true);
chk10('La sopa vacia queda en null', guardable.sopa, null);


// --- Platos de la seccion Especiales, y los dos bloques del TV ---
import { esEspecial, separarPlatos } from './src/lib/carta.js';

const bandeja = { id: 'e1', nombre: 'Bandeja paisa', precio: 18000 };
const casa = { ...PLATO_VACIO, deLaCasa: bandeja };

chk10('El plato de la casa se anuncia con su nombre', resumenPlato(casa).titulo, 'Bandeja paisa');
chk10('  sin renglones de detalle', resumenPlato(casa).detalles.length, 0);
chk10('  y con su propio precio', precioPlato(casa, PRECIOS_DEF), 18000);
chk10('  si no tiene precio, cobra como especial',
  precioPlato({ ...PLATO_VACIO, deLaCasa: { id: 'e2', nombre: 'Sancocho' } }, PRECIOS_DEF), 13000);
chk10('El plato de la casa ya se puede publicar', hayPlato(casa), true);
chk10('  y se guarda para Firestore', limpiarPlato(casa).deLaCasa.nombre, 'Bandeja paisa');

chk10('Es especial por ser de la casa', esEspecial(casa), true);
chk10('Es especial por el interruptor', esEspecial({ ...completo, especial: true }), true);
chk10('El corriente no es especial', esEspecial(completo), false);

const partido = separarPlatos([completo, casa, { ...completo, especial: true }]);
chk10('Un corriente en el bloque del dia', partido.corriente.length, 1);
chk10('Dos en el bloque de especiales', partido.especial.length, 2);
chk10('Sin platos no rompe', separarPlatos().corriente.length, 0);

console.log(f10 ? `\n❌ ${f10} fallo(s) en carta` : '\n✅ Carta: todo pasa');

// ---------------------------------------------------------------
// Desechables del "para llevar" y desglose por producto
// ---------------------------------------------------------------
import { empaquesPedido, lineaDesechables, resumenProductos } from './src/lib/negocio.js';

console.log('\n--- Para llevar y desglose ---');
let f11 = 0;
const chk11 = (nom, real, esp) => {
  const ok = real === esp;
  if (!ok) f11++;
  console.log(`${ok ? '✓' : '✗'} ${nom}  ->  ${real}${ok ? '' : `  (esperado ${esp})`}`);
};

const PD = { ...PRECIOS_DEF, desechable: 1000 };
const li = (tipo, cant = 1, precioUnit = 10000, descripcion = 'X') => ({ tipo, cant, precioUnit, descripcion });

// La regla de Alvaro: completo 2 empaques, individual 1
chk11('Almuerzo completo son 2 empaques', empaquesPedido([li('almuerzo_normal')]), 2);
chk11('Almuerzo especial tambien', empaquesPedido([li('almuerzo_especial')]), 2);
chk11('Solo caldo es 1', empaquesPedido([li('solo_caldo')]), 1);
chk11('Solo sopa es 1', empaquesPedido([li('solo_sopa')]), 1);
chk11('Solo seco es 1', empaquesPedido([li('solo_seco')]), 1);
chk11('El especial es 1', empaquesPedido([li('especial')]), 1);
chk11('Adicional no empaca', empaquesPedido([li('adicional')]), 0);
chk11('Merienda no empaca', empaquesPedido([li('merienda')]), 0);
chk11('Dos almuerzos son 4', empaquesPedido([li('almuerzo_normal', 2)]), 4);

// El renglon que se agrega al pedido
const d1 = lineaDesechables([li('almuerzo_normal')], true, PD);
chk11('Almuerzo para llevar cobra 2000', d1.cant * d1.precioUnit, 2000);
const d2 = lineaDesechables([li('solo_seco')], true, PD);
chk11('Seco para llevar cobra 1000', d2.cant * d2.precioUnit, 1000);
const d3 = lineaDesechables([li('almuerzo_normal'), li('solo_caldo'), li('merienda', 3, 3000)], true, PD);
chk11('Mezcla: 2 + 1 + 0 = 3000', d3.cant * d3.precioUnit, 3000);

chk11('En la mesa no cobra', lineaDesechables([li('almuerzo_normal')], false, PD), null);
chk11('Solo meriendas no cobra', lineaDesechables([li('merienda', 3, 3000)], true, PD), null);
chk11('Apagado en Ajustes no cobra',
  lineaDesechables([li('almuerzo_normal')], true, { ...PD, cobrarDesechable: false }), null);

// El rTotal del pedido: almuerzo + 2 desechables
const conEmpaque = [li('almuerzo_normal'), d1];
chk11('Almuerzo para llevar total', totalLineas(conEmpaque), 12000);

// --- Desglose por producto ---
const ventasDia = [
  { items: [li('merienda', 5, 3000, 'MERIENDA: EMPANADA'), li('merienda', 2, 2000, 'MERIENDA: BUÑUELO')] },
  { items: [li('merienda', 1, 3000, 'MERIENDA: EMPANADA'), li('almuerzo_normal', 3, 10000, 'CALDO + CARNE')] },
  { items: [li('almuerzo_normal', 1, 10000, 'SOPA + PECHUGA')] },
];
const rCats = resumenProductos(ventasDia);
const mer = rCats.find((c) => c.tipo === 'merienda');
const alm = rCats.find((c) => c.tipo === 'almuerzo_normal');

chk11('Meriendas suman bien', mer.total, 22000);
chk11('  y se abren por producto', mer.filas.length, 2);
chk11('  la empanada junta los dos pedidos', mer.filas.find((f) => f.desc.includes('EMPANADA')).cant, 6);
chk11('  ordenadas de mayor a menor', mer.filas[0].desc.includes('EMPANADA'), true);
chk11('Los almuerzos se abren por combinacion', alm.filas.length, 2);
chk11('  pero si suman', alm.cant, 4);
chk11('Las categorias van de mayor a menor', rCats[0].tipo, 'almuerzo_normal');
chk11('  la combinacion mas vendida va de primera', alm.filas[0].cant, 3);

// Los desechables no se abren: todos los renglones se llaman igual
const conEmpaques = resumenProductos([{ items: [li('desechable', 4, 1000, 'DESECHABLES')] }]);
chk11('Los desechables no se abren', conEmpaques[0].filas.length, 0);
chk11('  pero suman', conEmpaques[0].total, 4000);

console.log(f11 ? `\n❌ ${f11} fallo(s) en para llevar` : '\n✅ Para llevar y desglose: todo pasa');
process.exit(fallos + f2 + f3 + f4 + f5 + f6 + f7 + f8 + f9 + f10 + f11 ? 1 : 0);
