import { conNombre } from "../lib/menu";

/** Una hilera de chips del menú: el título arriba y las opciones abajo. */
function Fila({ titulo, nota, filas, activo, alTocar }) {
  if (!filas.length) return null;
  return (
    <>
      <p className="muted" style={{ fontSize: 12, margin: "0 0 8px" }}>
        {titulo}
        {nota && <span style={{ opacity: 0.7 }}> ({nota})</span>}
      </p>
      <div className="chips" style={{ marginBottom: 14 }}>
        {filas.map((f) => (
          <button
            key={f.id}
            className={"chip" + (activo(f) ? " on" : "")}
            onClick={() => alTocar(f)}
          >
            {f.nombre}
          </button>
        ))}
      </div>
    </>
  );
}

/**
 * Los chips para armar un plato, tomados del menú de hoy.
 *
 * Es la misma mecánica del talonario: el caldo y la sopa son excluyentes, el
 * principio es uno solo, y de proteínas y huevos se pueden marcar varios.
 *
 * @param {object} props
 * @param {object} props.menu   Menú de hoy ya filtrado
 * @param {object} props.sel    { caldo, sopa, principio, proteinas, huevos }
 * @param {(cambio: object) => void} props.onCambio
 */
export default function ArmadorPlato({ menu, sel, onCambio }) {
  const caldos = conNombre(menu.caldos);
  const sopas = conNombre(menu.sopas);
  const principios = conNombre(menu.principios);
  const proteinas = conNombre(menu.proteinas);
  const huevos = conNombre(menu.huevos);

  const uno = (campo, x, excluye) =>
    onCambio({
      [campo]: sel[campo]?.id === x.id ? null : x,
      ...(excluye ? { [excluye]: null } : {}),
    });

  const varios = (campo, x) => {
    const lista = sel[campo] || [];
    onCambio({
      [campo]: lista.find((y) => y.id === x.id)
        ? lista.filter((y) => y.id !== x.id)
        : [...lista, x],
    });
  };

  return (
    <>
      <Fila
        titulo="🍲 CALDOS"
        nota="desayuno"
        filas={caldos}
        activo={(f) => sel.caldo?.id === f.id}
        alTocar={(f) => uno("caldo", f, "sopa")}
      />
      <Fila
        titulo="🥣 SOPAS"
        nota="almuerzo"
        filas={sopas}
        activo={(f) => sel.sopa?.id === f.id}
        alTocar={(f) => uno("sopa", f, "caldo")}
      />
      <Fila
        titulo="🫘 PRINCIPIOS"
        nota="va incluido"
        filas={principios}
        activo={(f) => sel.principio?.id === f.id}
        alTocar={(f) => uno("principio", f)}
      />
      <Fila
        titulo="PROTEÍNAS"
        nota="puedes elegir varias"
        filas={proteinas}
        activo={(f) => (sel.proteinas || []).some((x) => x.id === f.id)}
        alTocar={(f) => varios("proteinas", f)}
      />
      <Fila
        titulo="🍳 HUEVOS"
        filas={huevos}
        activo={(f) => (sel.huevos || []).some((x) => x.id === f.id)}
        alTocar={(f) => varios("huevos", f)}
      />
    </>
  );
}
