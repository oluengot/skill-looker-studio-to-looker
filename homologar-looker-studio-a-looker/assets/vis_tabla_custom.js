// PLANTILLA REUTILIZABLE (skill homologar-looker-studio-a-looker). Copiar a <carpeta>/visualizaciones/<vis_id>.js,
// cambiar `id` y `label` en looker.plugins.visualizations.add y registrar en manifest.lkml.
// Origen: Club Urgencia (club_urgencia_tabla). Colores por defecto = brand del area (#224073 / #b7d8df).

// Visualización personalizada Looker: "Club Urgencia - Tabla / KPI"
// Proyecto BI · 01_DM/INF_CLUB_URGENCIA/visualizaciones/club_urgencia_tabla.js
//
// Una sola vis con el lenguaje visual del área (dashboard 145 BALANCE_DIRECTORIO,
// Venta_Sinergia_CM, interclinica_centro_medico_*): encabezado azul corporativo #224073,
// fila de total #b7d8df, primera columna fija, tarjeta blanca con sombra suave.
//
// Modos (opción "Modo"):
//   - auto  : KPI si la query trae 1 medida y ninguna dimensión; si no, tabla.
//   - tabla : tabla normal o dinámica (pivot). Usa los totales de Looker (Totales / Totales de fila).
//   - kpi   : tarjeta con el primer valor (como el scorecard de Looker Studio). Estilo "Looker
//             Studio": valor arriba, título en cursiva abajo y marco redondeado opcional.
//   - tarjetas: fila de scorecards, uno por valor de la dimensión (CLC, NCC, ...).
//   - matriz  : recuadros por grupo con KPI en columnas (Miembros / No Miembros del Club).
//
// Tabla:
//   - Clic en un encabezado ordena por esa columna (incluida "Total" en tablas dinámicas).
//     El orden inicial se fija con "Orden inicial" (ej. "total desc", "2 desc", "Inscritos asc").
//   - "Transponer" pone las medidas como filas y los valores de la dimensión como columnas
//     (tabla Resumen: Inscritos / Meta / Estatus por clínica).
//   - "Ocultar columnas nulas" esconde la columna "∅ / null" de una tabla dinámica.
//   - "Renombrar columnas": "Etiqueta original=Etiqueta nueva; ..." (se compara con label_short).
//   - Botón "Copiar" deja la tabla en el portapapeles en formato Excel (tabulado).
//   - Drill down (2+ dimensiones con Subtotales en la 1ª): mismo esquema que Balance_Directorio,
//     columna "Estructura" en árbol con +/−, barra Expandir todo / Contraer detalle /
//     Copiar para Excel / Zoom texto, y fila Total azul.
// Los valores se muestran con el formato de LookML (campo `rendered`), así cuadran con Looker.

looker.plugins.visualizations.add({
  id: "club_urgencia_tabla",
  label: "Club Urgencia - Tabla / KPI",
  options: {
    modo: {
      type: "string",
      label: "Modo",
      display: "select",
      values: [{ "Automático": "auto" }, { "Tabla": "tabla" }, { "KPI (tarjeta)": "kpi" },
        { "KPI en fila (uno por valor de la dimensión)": "tarjetas" }, { "Matriz de KPI (grupos × columnas)": "matriz" }],
      default: "auto",
      section: "General",
      order: 1
    },
    titulo: {
      type: "string",
      label: "Título",
      default: "",
      placeholder: "Ej: Captación Club Post Atención",
      section: "General",
      order: 2
    },
    subtitulo: {
      type: "string",
      label: "Subtítulo / nota",
      default: "",
      placeholder: "Ej: Últimos 14 días",
      section: "General",
      order: 3
    },
    color_principal: {
      type: "string",
      label: "Color corporativo",
      display: "color",
      default: "#224073",
      section: "General",
      order: 4
    },
    transponer: {
      type: "boolean",
      label: "Transponer (medidas como filas)",
      default: false,
      section: "Tabla",
      order: 1
    },
    mostrar_total: {
      type: "boolean",
      label: "Mostrar fila de Total (si la query trae totales)",
      default: true,
      section: "Tabla",
      order: 2
    },
    orden_inicial: {
      type: "string",
      label: "Orden inicial",
      default: "",
      placeholder: "total desc · 2 desc · Inscritos asc (vacío = orden de Looker)",
      section: "Tabla",
      order: 3
    },
    ocultar_pivot_nulo: {
      type: "boolean",
      label: "Ocultar columnas nulas de la tabla dinámica",
      default: true,
      section: "Tabla",
      order: 4
    },
    renombrar: {
      type: "string",
      label: "Renombrar columnas",
      default: "",
      placeholder: "Inscritos=Inscritos Club; Meta Junio 2027=Meta",
      section: "Tabla",
      order: 5
    },
    tamano_fuente: {
      type: "number",
      label: "Tamaño de letra (px)",
      default: 13,
      section: "Tabla",
      order: 6
    },
    mostrar_copiar: {
      type: "boolean",
      label: "Botón Copiar para Excel",
      default: true,
      section: "Tabla",
      order: 7
    },
    jerarquia: {
      type: "boolean",
      label: "Drill down: 1ª dimensión agrupa a la 2ª (requiere Subtotales en la 1ª)",
      default: true,
      section: "Jerarquía",
      order: 1
    },
    jerarquia_expandida: {
      type: "boolean",
      label: "Abrir expandido (mostrar el 2º nivel)",
      default: true,
      section: "Jerarquía",
      order: 2
    },
    kpi_tamano_valor: {
      type: "number",
      label: "Tamaño del valor (px)",
      default: 44,
      section: "KPI",
      order: 1
    },
    kpi_estilo: {
      type: "string",
      label: "Estilo",
      display: "select",
      values: [{ "Área (título arriba)": "area" }, { "Looker Studio (título abajo en cursiva)": "studio" }],
      default: "area",
      section: "KPI",
      order: 2
    },
    kpi_borde: {
      type: "boolean",
      label: "Marco redondeado",
      default: false,
      section: "KPI",
      order: 3
    },
    tarjetas_orden: {
      type: "string",
      label: "KPI en fila: tarjetas fijas (en orden)",
      default: "",
      placeholder: "CLC, NCC, CT, CLL, CSJ, IPV, IVM (las que no traen datos dicen \"No hay datos\")",
      section: "KPI",
      order: 4
    },
    matriz_columnas: {
      type: "string",
      label: "Matriz: títulos de columna (separados por |)",
      default: "",
      placeholder: "Miembros del Club Urgencia | No Miembros del Club Urgencia",
      section: "KPI",
      order: 5
    },
    matriz_filas: {
      type: "string",
      label: "Matriz: filas (Grupo | Etiqueta | medida col 1 | medida col 2 ; ...)",
      default: "",
      placeholder: "Fidelización | Recompra URG | recompra_club | recompra_otros ; ...",
      section: "KPI",
      order: 6
    }
  },

  create: function (element) {
    element.innerHTML = `<style>
* { box-sizing: border-box; }
.cu-shell {
  --cu-blue: #224073;
  --cu-blue-2: #2b4d86;
  --cu-total: #b7d8df;
  --cu-line: #edf3f6;
  --cu-text: #2f3f4d;
  --cu-text-strong: #20303d;
  --cu-font: 13px;
  width: 100%;
  height: 100%;
  padding: 6px;
  font-family: 'Google Sans', Arial, Helvetica, sans-serif;
  color: var(--cu-text);
  display: flex;
  flex-direction: column;
}
.cu-card {
  flex: 1 1 auto;
  min-height: 0;
  background: #ffffff;
  border: 1px solid #dde8ee;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(34, 64, 115, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.cu-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px 8px 14px;
  border-left: 4px solid var(--cu-blue);
  margin: 10px 0 6px 0;
}
.cu-title { flex: 1; font-size: 15px; font-weight: 700; color: var(--cu-blue); letter-spacing: .3px; text-transform: uppercase; }
.cu-sub { font-size: 12px; color: #6b7686; font-weight: 400; text-transform: none; margin-left: 6px; }
.cu-btn {
  cursor: pointer; background: #ffffff; color: var(--cu-blue); border: 1px solid #b8c0cc;
  padding: 3px 12px; border-radius: 999px; font-weight: 700; font-size: 11px; font-family: inherit;
}
.cu-btn:hover { background: #eef1f5; }
.cu-btn.ok { background: var(--cu-blue); color: #fff; border-color: var(--cu-blue); }
.cu-scroll { flex: 1 1 auto; min-height: 0; overflow: auto; }
table.cu-t { border-collapse: separate; border-spacing: 0; width: 100%; font-size: var(--cu-font); }
.cu-t th, .cu-t td {
  padding: 7px 12px; border-bottom: 1px solid var(--cu-line); border-right: 1px solid var(--cu-line);
  white-space: nowrap; vertical-align: middle;
}
.cu-t thead th {
  position: sticky; top: 0; z-index: 3;
  background: var(--cu-blue); color: #fff; font-weight: 700; text-align: center;
  border-right: 1px solid rgba(255,255,255,0.14); cursor: pointer; user-select: none;
  white-space: normal; min-width: 70px; line-height: 1.25;
}
.cu-t thead tr.cu-h2 th { top: var(--cu-h1, 31px); background: var(--cu-blue-2); font-weight: 600; }
.cu-t thead th.cu-nosort { cursor: default; }
.cu-t thead th .cu-arrow { font-size: 9px; margin-left: 4px; opacity: .85; }
.cu-t thead th:first-child { left: 0; z-index: 4; text-align: left; }
.cu-t td { text-align: center; font-variant-numeric: tabular-nums; }
.cu-t td.cu-dim { text-align: left; color: var(--cu-text-strong); font-weight: 600; }
.cu-t tbody td:first-child, .cu-t tfoot td:first-child {
  position: sticky; left: 0; z-index: 2; box-shadow: 2px 0 5px rgba(0,0,0,0.04);
}
.cu-t tbody tr:nth-child(odd) td { background: #ffffff; }
.cu-t tbody tr:nth-child(even) td { background: #fbfdfe; }
.cu-t tbody tr:hover td { background: #eef3fb; }
.cu-t td.cu-coltot { font-weight: 700; color: var(--cu-blue); }
.cu-t td.cu-null { color: #b0b8c4; }
/* Drill down: mismo esquema que la vis Balance_Directorio (dashboard 145). */
.cu-card.cu-card-dd { border: 1px solid #5c5c5c; border-radius: 0; box-shadow: none; }
.cu-dd { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; font-family: Arial, Helvetica, sans-serif; color: #111827; }
.cu-dd-bar {
  display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 8px 10px;
  border-bottom: 1px solid #c9c9c9; background: #f1f3f5;
}
.cu-dd-btn {
  border: 1px solid #b8c0cc; background: linear-gradient(#fbfbfb, #e7ebf0); color: #334155;
  padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit;
}
.cu-dd-btn.active { background: var(--cu-blue); color: #ffffff; border-color: #1b335c; }
.cu-dd-excel {
  background-color: #5ba115; color: #ffffff; border: 1px solid #447a10; padding: 6px 14px; border-radius: 6px;
  font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
  font-family: inherit; transition: background-color .2s;
}
.cu-dd-excel:hover { background-color: #4b8810; }
.cu-dd-zoom { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--cu-blue); margin-left: 4px; }
.cu-dd-zbtn {
  border: 1px solid #b8c0cc; background: #ffffff; color: var(--cu-blue); border-radius: 12px; width: 24px; height: 22px;
  display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; cursor: pointer; line-height: 1;
}
.cu-dd-zbtn:hover { background: #e2e8f0; }
.cu-dd-zval { min-width: 36px; text-align: center; font-weight: 600; }
.cu-dd-pill {
  margin-left: auto; background: #dfe7f1; color: #334155; border: 1px solid #c7d2e0;
  padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 700;
}
.cu-dd-scroll { flex: 1 1 auto; min-height: 0; overflow: auto; }
table.cu-dd-t { width: max-content; min-width: 100%; border-collapse: collapse; font-size: calc(12px * var(--z, 1)); }
.cu-dd-t thead th {
  position: sticky; top: 0; z-index: 20; background: var(--cu-blue); color: #ffffff; font-weight: 700;
  padding: 6px 8px; border: 1px solid #5c5c5c; white-space: nowrap; text-align: center; cursor: pointer; user-select: none;
}
.cu-dd-t thead tr.cu-dd-h2 th { top: var(--cu-h1, 29px); }
.cu-dd-t thead th.cu-nosort { cursor: default; font-size: calc(13px * var(--z, 1)); }
.cu-dd-t thead th .cu-arrow { font-size: 9px; margin-left: 4px; opacity: .85; }
.cu-dd-t tbody td { padding: 3px 6px; border: 1px solid #c9c9c9; vertical-align: middle; background: #ffffff; }
.cu-dd-t td.cu-dd-num { text-align: right; font-variant-numeric: tabular-nums; min-width: 110px; font-size: calc(14px * var(--z, 1)); }
.cu-dd-t td.cu-null { color: #9aa3ae; }
.cu-dd-t .cu-dd-est { position: sticky; left: 0; z-index: 8; min-width: 260px; white-space: nowrap; text-align: left; box-shadow: 1px 0 0 0 #5c5c5c; }
.cu-dd-t thead th.cu-dd-est { z-index: 25; }
.cu-dd-t tr.cu-dd-l1 td { background: #efefef; font-weight: 700; }
.cu-dd-t tr.cu-dd-l2 td { background: #f8f8f8; font-weight: 400; }
.cu-dd-t tr.cu-dd-tot td { position: sticky; bottom: 0; z-index: 9; background: var(--cu-blue); color: #ffffff; font-weight: 700; border-color: #5c5c5c; }
.cu-dd-t tr.cu-dd-tot td.cu-dd-est { z-index: 10; }
.cu-dd-tree { display: flex; align-items: center; gap: 8px; min-width: 0; }
.cu-dd-i0 { padding-left: 6px; }
.cu-dd-i1 { padding-left: 30px; }
.cu-dd-tog {
  width: 16px; min-width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer; user-select: none; color: #374151; font-size: 10px; font-weight: 700;
  border: 1px solid #aeb7c3; border-radius: 3px; background: #f3f4f6;
}
.cu-dd-tog.vacio { visibility: hidden; cursor: default; }
.cu-t tfoot td {
  position: sticky; bottom: 0; z-index: 1;
  background: var(--cu-total); font-weight: 700; color: #1e2a33; border-top: 2px solid #9cc6cf;
}
.cu-t tfoot td:first-child { z-index: 3; }
.cu-kpi {
  flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 10px 14px;
}
.cu-kpi-label { font-size: 13px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: .4px; }
.cu-kpi-value { font-weight: 700; color: var(--cu-blue); line-height: 1.1; margin-top: 6px; font-variant-numeric: tabular-nums; }
.cu-kpi-sub { font-size: 12px; color: #6b7686; margin-top: 4px; }
/* KPI con el formato de los scorecards de Looker Studio (página KPI de Éxito). */
.cu-card.cu-card-plain { border: 0; border-radius: 0; box-shadow: none; background: transparent; }
.cu-ls { font-family: Roboto, Arial, Helvetica, sans-serif; color: #1b4586; }
.cu-ls-kpi {
  flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 8px 24px;
}
.cu-ls-kpi.borde { border: 2px solid #1b4586; border-radius: 15px; margin: 2px; }
.cu-ls-valor { line-height: 1.15; font-variant-numeric: tabular-nums; white-space: nowrap; }
.cu-ls-tit { font-size: 14px; font-weight: 700; font-style: italic; margin-top: 6px; }
.cu-ls-fila { flex: 1 1 auto; display: flex; align-items: center; }
.cu-ls-tj { flex: 1 1 0; min-width: 0; text-align: center; padding: 4px 6px; }
.cu-ls-tj-lbl { font-size: 12px; color: #5f6f86; }
.cu-ls-tj-val { line-height: 1.15; white-space: nowrap; font-variant-numeric: tabular-nums; }
.cu-ls-vacio { font-size: .7em; }
.cu-ls-mx { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 2px 8px; }
.cu-ls-mx-cab, .cu-ls-mx-grupo { display: grid; align-items: center; }
.cu-ls-mx-cab div { text-align: center; font-size: 14px; font-weight: 700; font-style: italic; padding: 0 4px 6px; }
.cu-ls-mx-grupo { border: 2px solid #1b4586; border-radius: 15px; margin: 0 0 22px 0; padding: 10px 0; row-gap: 14px; }
.cu-ls-mx-gtit {
  grid-column: 1; text-align: right; padding-right: 10px; line-height: 1.15;
  font-family: Montserrat, Arial, Helvetica, sans-serif; font-weight: 700; font-size: 22px; color: #26b4c0;
}
.cu-ls-mx-lbl { text-align: center; font-size: 13px; font-weight: 700; font-style: italic; padding: 0 6px; }
.cu-ls-mx-val { text-align: center; line-height: 1.1; font-variant-numeric: tabular-nums; white-space: nowrap; }
.cu-empty {
  padding: 16px; margin: 8px; border: 1px solid #d8e2ea; background: #f8fbfd; color: #27384a;
  border-radius: 10px; font-size: 13px;
}
</style>
<div class="cu-shell"><div class="cu-card"></div></div>`;
    this._sort = null;
    this._sortKey = null;
  },

  updateAsync: function (data, element, config, queryResponse, details, done) {
    var viz = this;
    var NULO = "–";
    var SIN_DATOS = "No hay datos";
    viz.clearErrors();
    var shell = element.querySelector(".cu-shell");
    var card = element.querySelector(".cu-card");
    if (!shell || !card) {
      viz.create(element);
      shell = element.querySelector(".cu-shell");
      card = element.querySelector(".cu-card");
    }

    try {
      var color = config.color_principal || "#224073";
      shell.style.setProperty("--cu-blue", color);
      shell.style.setProperty("--cu-blue-2", ajustarColor(color, 18));
      shell.style.setProperty("--cu-font", (Number(config.tamano_fuente) || 13) + "px");

      var fields = queryResponse.fields || {};
      var dims = (fields.dimension_like || fields.dimensions || []).filter(function (f) { return !f.hidden; });
      var meas = (fields.measure_like || fields.measures || []).concat(fields.table_calculations || [])
        .filter(function (f, i, arr) { return !f.hidden && arr.findIndex(function (g) { return g.name === f.name; }) === i; });
      var pivots = queryResponse.pivots || [];
      var hayPivot = (fields.pivots || []).length > 0 && pivots.length > 0;

      var modo = config.modo || "auto";
      if (modo === "auto" && dims.length === 0 && meas.length === 1 && !hayPivot) modo = "kpi";
      var estiloStudio = modo === "tarjetas" || modo === "matriz" || (modo === "kpi" && config.kpi_estilo === "studio");
      card.classList.toggle("cu-card-plain", estiloStudio);
      card.classList.remove("cu-card-dd");

      if (meas.length === 0 && dims.length === 0) {
        viz.addError({ title: "Faltan campos", message: "Agrega al menos una medida a la consulta." });
        done();
        return;
      }
      // Los formatos Looker Studio muestran "No hay datos" en cada tarjeta, como los scorecards originales.
      if (estiloStudio) {
        var filasKpi = data || [];
        if (modo === "tarjetas") renderTarjetas(card, config, dims, meas, filasKpi);
        else if (modo === "matriz") renderMatriz(card, config, meas, filasKpi[0]);
        else renderKpi(card, config, meas[0] || dims[0], filasKpi[0]);
        done();
        return;
      }
      if (!data || data.length === 0) {
        card.innerHTML = encabezado(config, false) + '<div class="cu-empty">Sin datos para los filtros seleccionados.</div>';
        done();
        return;
      }
      if (modo === "kpi") {
        renderKpi(card, config, meas[0] || dims[0], data[0]);
        done();
        return;
      }

      var renombres = parseRenombres(config.renombrar);
      var etiqueta = function (f) {
        var l = f.label_short || f.label || f.name;
        return renombres[l] || renombres[f.label] || renombres[f.name] || l;
      };

      // ---------------------------------------------------------------
      // Modelo de columnas: cada columna sabe leer su celda de una fila.
      // ---------------------------------------------------------------
      var columnas = [];
      dims.forEach(function (d) {
        columnas.push({ key: d.name, label: etiqueta(d), dim: true, field: d, get: function (row) { return row[d.name]; } });
      });

      var grupos = null; // encabezado de 2 niveles para pivot con varias medidas
      var totalesQuery = queryResponse.totals_data || null;
      if (hayPivot) {
        var pivVisibles = pivots.filter(function (p) {
          if (p.is_total) return false;
          if (config.ocultar_pivot_nulo === false) return true;
          var vals = Object.keys(p.data || {}).map(function (k) { return p.data[k]; });
          return !(vals.length && vals.every(function (v) { return v === null || v === undefined || v === ""; }));
        });
        var tieneRowTotal = data.some(function (r) {
          return meas.some(function (m) { return r[m.name] && r[m.name]["$$$_row_total_$$$"]; });
        });
        grupos = [];
        pivVisibles.forEach(function (p) {
          var nombre = pivotLabel(p);
          grupos.push({ label: nombre, span: meas.length });
          meas.forEach(function (m) {
            columnas.push({
              key: m.name + "|" + p.key,
              label: meas.length > 1 ? etiqueta(m) : nombre,
              field: m,
              get: function (row) { return row[m.name] ? row[m.name][p.key] : null; },
              tot: function () { return totalesQuery && totalesQuery[m.name] ? totalesQuery[m.name][p.key] : null; }
            });
          });
        });
        if (tieneRowTotal) {
          grupos.push({ label: "Total", span: meas.length });
          meas.forEach(function (m) {
            columnas.push({
              key: m.name + "|total",
              label: meas.length > 1 ? etiqueta(m) : "Total",
              field: m,
              coltot: true,
              get: function (row) { return row[m.name] ? row[m.name]["$$$_row_total_$$$"] : null; },
              tot: function () { return totalesQuery && totalesQuery[m.name] ? totalesQuery[m.name]["$$$_row_total_$$$"] : null; }
            });
          });
        }
        if (meas.length === 1) grupos = null;
      } else {
        meas.forEach(function (m) {
          columnas.push({
            key: m.name, label: etiqueta(m), field: m,
            get: function (row) { return row[m.name]; },
            tot: function () { return totalesQuery ? totalesQuery[m.name] : null; }
          });
        });
      }

      var filas = data.slice();

      // Orden: el elegido con clic manda; si no, "Orden inicial" de la configuración.
      var firma = columnas.map(function (c) { return c.key; }).join(",");
      if (viz._sortKey !== firma) { viz._sort = null; viz._sortKey = firma; }
      var orden = viz._sort || parseOrden(config.orden_inicial, columnas);
      if (orden) {
        var col = columnas[orden.idx];
        if (col) {
          filas.sort(function (a, b) {
            var va = valorOrden(col.get(a)), vb = valorOrden(col.get(b));
            if (va === vb) return 0;
            if (va === null) return 1;
            if (vb === null) return -1;
            var r = (typeof va === "number" && typeof vb === "number") ? va - vb : String(va).localeCompare(String(vb), "es");
            return orden.desc ? -r : r;
          });
        }
      }

      var mostrarTotal = config.mostrar_total !== false && totalesQuery &&
        columnas.some(function (c) { return c.tot && c.tot(); });

      // Drill down (como la tabla dinámica con expandir/contraer de Looker Studio): la 1ª dimensión
      // agrupa a la 2ª. El nivel contraído usa los subtotales de Looker (conteos distintos reales).
      var subtotales = subtotalesPorGrupo(queryResponse, dims);
      var jerarquica = config.jerarquia !== false && !hayPivot && !config.transponer && dims.length >= 2 && subtotales;
      if (jerarquica && viz._abiertos === undefined) viz._abiertos = {};
      if (jerarquica && viz._expandidoBase === undefined) viz._expandidoBase = config.jerarquia_expandida !== false;

      var tabla = config.transponer
        ? tablaTranspuesta(columnas, filas, dims, mostrarTotal)
        : jerarquica
          ? tablaJerarquia(columnas, data.slice(), subtotales, mostrarTotal, viz._sort || parseOrden(config.orden_inicial, columnas))
          : tablaNormal(columnas, grupos, filas, dims, mostrarTotal, orden);

      card.classList.toggle("cu-card-dd", !!jerarquica);
      card.innerHTML = jerarquica
        ? '<div class="cu-dd">' + barraJerarquia(config, dims) + '<div class="cu-dd-scroll">' + tabla.html + "</div></div>"
        : encabezado(config, config.mostrar_copiar !== false) + '<div class="cu-scroll">' + tabla.html + "</div>";

      // Alto real de la 1ª fila de encabezado para que la 2ª quede pegada (sticky).
      var h1 = card.querySelector("thead tr");
      if (h1 && (grupos || jerarquica)) shell.style.setProperty("--cu-h1", h1.getBoundingClientRect().height + "px");

      if (!config.transponer) {
        Array.prototype.forEach.call(card.querySelectorAll("th[data-col]"), function (th) {
          th.addEventListener("click", function () {
            var idx = Number(th.getAttribute("data-col"));
            var actual = viz._sort || orden;
            var desc = !(actual && actual.idx === idx && actual.desc);
            if (columnas[idx].dim && !(actual && actual.idx === idx)) desc = false;
            viz._sort = { idx: idx, desc: desc };
            viz.updateAsync(data, element, config, queryResponse, details, function () {});
          });
        });
      }

      if (jerarquica) {
        var redibujar = function () { viz.updateAsync(data, element, config, queryResponse, details, function () {}); };
        Array.prototype.forEach.call(card.querySelectorAll("[data-grp]"), function (b) {
          b.addEventListener("click", function (ev) {
            ev.stopPropagation();
            var g = decodeURIComponent(b.getAttribute("data-grp"));
            viz._abiertos[g] = !estaAbierto(g);
            redibujar();
          });
        });
        Array.prototype.forEach.call(card.querySelectorAll("[data-dd]"), function (b) {
          b.addEventListener("click", function (ev) {
            ev.preventDefault();
            var accion = b.getAttribute("data-dd");
            if (accion === "expandir" || accion === "contraer") {
              viz._expandidoBase = accion === "expandir";
              viz._abiertos = {};
            } else if (accion === "zin") {
              viz._zoom = Math.min(200, (viz._zoom || 100) + 10);
            } else if (accion === "zout") {
              viz._zoom = Math.max(60, (viz._zoom || 100) - 10);
            } else if (accion === "copiar") {
              var original = b.innerHTML;
              copiar(tabla.tsv, function (ok) {
                b.innerHTML = ok ? "📋 ¡Copiado!" : "No se pudo copiar";
                b.style.backgroundColor = ok ? "#2e7d32" : "#b42318";
                setTimeout(function () { b.innerHTML = original; b.style.backgroundColor = ""; }, 2000);
              });
              return;
            }
            redibujar();
          });
        });
      }

      var btn = card.querySelector(".cu-btn");
      if (btn) {
        btn.addEventListener("click", function () {
          copiar(tabla.tsv, function (ok) {
            btn.textContent = ok ? "Copiado ✓" : "No se pudo copiar";
            btn.classList.toggle("ok", ok);
            setTimeout(function () { btn.textContent = "Copiar"; btn.classList.remove("ok"); }, 1800);
          });
        });
      }
    } catch (err) {
      console.error("club_urgencia_tabla:", err);
      viz.addError({ title: "Error en la visualización", message: String(err && err.message || err) });
    }
    done();

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------
    function esc(s) {
      return String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    // Texto de una celda tal como lo formatea Looker. Las filas traen `rendered`; los totales
    // traen `html`. Si no viene ninguno, se aplica el value_format del campo (es-CL).
    function texto(cell, campo) {
      if (!cell) return "";
      if (cell.rendered !== undefined && cell.rendered !== null && cell.rendered !== "") return String(cell.rendered);
      if (cell.value === null || cell.value === undefined) return NULO;
      if (cell.html !== undefined && cell.html !== null && cell.html !== "") {
        var div = document.createElement("div");
        div.innerHTML = cell.html;
        return div.textContent;
      }
      return formatear(cell.value, campo);
    }

    function formatear(v, campo) {
      var n = Number(v);
      var fmt = campo && campo.value_format;
      if (isNaN(n) || !fmt) return String(v);
      var pct = fmt.indexOf("%") >= 0;
      var dec = (fmt.split(".")[1] || "").replace(/[^0#]/g, "").length;
      return (pct ? n * 100 : n).toLocaleString("es-CL", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + (pct ? "%" : "");
    }

    function celda(t, clase) {
      var nulo = t === NULO;
      return '<td class="' + (clase || "") + (nulo ? " cu-null" : "") + '">' + esc(t) + "</td>";
    }

    function valorOrden(cell) {
      if (!cell || cell.value === null || cell.value === undefined) return null;
      var n = Number(cell.value);
      return isNaN(n) ? String(cell.value) : n;
    }

    function pivotLabel(p) {
      var vals = Object.keys(p.data || {}).map(function (k) { return p.data[k]; });
      var etiquetas = (p.labels && Object.keys(p.labels).map(function (k) { return p.labels[k]; })) || [];
      var txt = (etiquetas.length ? etiquetas : vals).filter(function (v) { return v !== null && v !== undefined; }).join(" · ");
      return txt || "∅";
    }

    function encabezado(cfg, conBoton) {
      if (!cfg.titulo && !conBoton) return "";
      return '<div class="cu-head"><div class="cu-title">' + esc(cfg.titulo || "") +
        (cfg.subtitulo ? '<span class="cu-sub">' + esc(cfg.subtitulo) + "</span>" : "") + "</div>" +
        (conBoton ? '<button class="cu-btn" type="button">Copiar</button>' : "") + "</div>";
    }

    function tablaNormal(cols, grps, rows, dimensiones, conTotal, ord) {
      var tsv = [];
      var h = '<table class="cu-t"><thead>';
      if (grps) {
        h += "<tr>";
        if (dimensiones.length) h += '<th class="cu-nosort" colspan="' + dimensiones.length + '"></th>';
        grps.forEach(function (g) { h += '<th class="cu-nosort" colspan="' + g.span + '">' + esc(g.label) + "</th>"; });
        h += '</tr><tr class="cu-h2">';
      } else {
        h += "<tr>";
      }
      var encab = [];
      cols.forEach(function (c, i) {
        var flecha = ord && ord.idx === i ? '<span class="cu-arrow">' + (ord.desc ? "▼" : "▲") + "</span>" : "";
        h += '<th data-col="' + i + '" title="Ordenar">' + esc(c.label) + flecha + "</th>";
        encab.push(c.label);
      });
      h += "</tr></thead><tbody>";
      tsv.push(encab.join("\t"));
      rows.forEach(function (r) {
        var linea = [];
        h += "<tr>";
        cols.forEach(function (c) {
          var t = texto(c.get(r), c.field);
          linea.push(t === NULO ? "" : t);
          h += celda(t, (c.dim ? "cu-dim" : "") + (c.coltot ? " cu-coltot" : ""));
        });
        h += "</tr>";
        tsv.push(linea.join("\t"));
      });
      h += "</tbody>";
      if (conTotal) {
        var lineaTot = [];
        h += "<tfoot><tr>";
        cols.forEach(function (c, i) {
          var t = c.dim ? (i === 0 ? "Total" : "") : texto(c.tot ? c.tot() : null, c.field);
          lineaTot.push(t === NULO ? "" : t);
          h += celda(t, c.dim ? "cu-dim" : "");
        });
        h += "</tr></tfoot>";
        tsv.push(lineaTot.join("\t"));
      }
      h += "</table>";
      return { html: h, tsv: tsv.join("\n") };
    }

    function comparar(va, vb, desc) {
      if (va === vb) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      var r = (typeof va === "number" && typeof vb === "number") ? va - vb : String(va).localeCompare(String(vb), "es");
      return desc ? -r : r;
    }

    // Filas de subtotal de Looker agrupadas solo por la 1ª dimensión, indexadas por su valor.
    function subtotalesPorGrupo(qr, dimensiones) {
      var sd = qr && qr.subtotals_data;
      if (!sd || dimensiones.length < 2) return null;
      var clave = dimensiones[0].name;
      var mapa = {};
      var hay = false;
      Object.keys(sd).forEach(function (k) {
        (sd[k] || []).forEach(function (r) {
          var g = r["$$$__grouping__$$$"];
          if (g && g.length === 1 && g[0] === clave) {
            mapa[String(r[clave] ? r[clave].value : null)] = r;
            hay = true;
          }
        });
      });
      return hay ? mapa : null;
    }

    function estaAbierto(g) {
      return viz._abiertos && viz._abiertos[g] !== undefined ? viz._abiertos[g] : viz._expandidoBase;
    }

    // Barra de herramientas del drill down (igual a Balance_Directorio).
    function barraJerarquia(cfg, dimensiones) {
      var zoom = viz._zoom || 100;
      var pill = cfg.titulo || dimensiones.slice(0, 2).map(function (d) { return d.label_short || d.label; }).join(" / ");
      if (cfg.subtitulo) pill += " · " + cfg.subtitulo;
      return '<div class="cu-dd-bar">' +
        '<button class="cu-dd-btn" type="button" data-dd="expandir">Expandir todo</button>' +
        '<button class="cu-dd-btn" type="button" data-dd="contraer">Contraer detalle</button>' +
        (cfg.mostrar_copiar !== false ? '<button class="cu-dd-excel" type="button" data-dd="copiar">📋 Copiar para Excel</button>' : "") +
        '<div class="cu-dd-zoom"><span>Zoom texto:</span>' +
        '<button class="cu-dd-zbtn" type="button" data-dd="zout">−</button>' +
        '<span class="cu-dd-zval">' + zoom + "%</span>" +
        '<button class="cu-dd-zbtn" type="button" data-dd="zin">+</button></div>' +
        '<span class="cu-dd-pill">' + esc(pill) + "</span></div>";
    }

    // Árbol de 2 niveles en una sola columna "Estructura": la 1ª dimensión (fila gris, con +/−)
    // muestra los subtotales de Looker; al expandir aparecen las filas de la 2ª dimensión.
    function tablaJerarquia(cols, rows, subt, conTotal, ord) {
      var c0 = cols[0];
      var dimHijas = cols.filter(function (c, i) { return c.dim && i > 0; });
      var valores = cols.map(function (c, i) { return { c: c, i: i }; }).filter(function (x) { return !x.c.dim; });
      var grupos = [];
      var pos = {};
      rows.forEach(function (r) {
        var k = String(r[c0.key] ? r[c0.key].value : null);
        if (!(k in pos)) { pos[k] = grupos.length; grupos.push({ k: k, cell: r[c0.key], filas: [] }); }
        grupos[pos[k]].filas.push(r);
      });
      if (ord && cols[ord.idx]) {
        var col = cols[ord.idx];
        var porFila = function (a, b) { return comparar(valorOrden(col.get(a)), valorOrden(col.get(b)), ord.desc); };
        if (ord.idx === 0) {
          grupos.sort(function (a, b) { return comparar(valorOrden(a.cell), valorOrden(b.cell), ord.desc); });
        } else if (col.dim) {
          grupos.forEach(function (g) { g.filas.sort(porFila); });
        } else {
          grupos.sort(function (a, b) { return comparar(valorOrden(col.get(subt[a.k] || {})), valorOrden(col.get(subt[b.k] || {})), ord.desc); });
          grupos.forEach(function (g) { g.filas.sort(porFila); });
        }
      }

      var flecha = function (i) { return ord && ord.idx === i ? '<span class="cu-arrow">' + (ord.desc ? "▼" : "▲") + "</span>" : ""; };
      var etiquetaEst = [c0.label].concat(dimHijas.map(function (c) { return c.label; })).join(" / ");
      var conGrupo = !!config.titulo;
      var tsv = [[etiquetaEst].concat(valores.map(function (x) { return x.c.label; })).join("\t")];
      var h = '<table class="cu-dd-t" style="--z:' + ((viz._zoom || 100) / 100) + '"><thead>';
      if (conGrupo) {
        h += '<tr><th class="cu-dd-est" data-col="0" rowspan="2" title="Ordenar">' + esc(etiquetaEst) + flecha(0) + "</th>" +
          '<th class="cu-nosort" colspan="' + valores.length + '">' + esc(config.titulo) + '</th></tr><tr class="cu-dd-h2">';
      } else {
        h += '<tr><th class="cu-dd-est" data-col="0" title="Ordenar">' + esc(etiquetaEst) + flecha(0) + "</th>";
      }
      valores.forEach(function (x) { h += '<th data-col="' + x.i + '" title="Ordenar">' + esc(x.c.label) + flecha(x.i) + "</th>"; });
      h += "</tr></thead><tbody>";

      // leer(x) devuelve la celda de la columna de valores x para esa fila.
      var fila = function (clase, sangria, toggle, nombre, leer) {
        var linea = [nombre];
        var s = '<tr class="' + clase + '"><td class="cu-dd-est"><div class="cu-dd-tree ' + sangria + '">' + toggle +
          "<span>" + esc(nombre) + "</span></div></td>";
        valores.forEach(function (x) {
          var t = texto(leer(x), x.c.field);
          linea.push(t === NULO ? "" : t);
          s += '<td class="cu-dd-num' + (t === NULO ? " cu-null" : "") + '">' + esc(t) + "</td>";
        });
        tsv.push(linea.join("\t"));
        return s + "</tr>";
      };

      grupos.forEach(function (g) {
        var abierto = estaAbierto(g.k);
        var tog = '<span class="cu-dd-tog" data-grp="' + encodeURIComponent(g.k) + '" title="' +
          (abierto ? "Contraer" : "Expandir") + '">' + (abierto ? "−" : "+") + "</span>";
        h += fila("cu-dd-l1", "cu-dd-i0", tog, texto(g.cell, c0.field),
          function (x) { return x.c.get(subt[g.k] || {}); });
        if (!abierto) return;
        g.filas.forEach(function (r) {
          var nombre = dimHijas.map(function (c) { return texto(c.get(r), c.field); }).join(" · ");
          h += fila("cu-dd-l2", "cu-dd-i1", '<span class="cu-dd-tog vacio">+</span>', nombre,
            function (x) { return x.c.get(r); });
        });
      });
      if (conTotal) {
        h += fila("cu-dd-tot", "cu-dd-i0", '<span class="cu-dd-tog vacio">+</span>', "Total",
          function (x) { return x.c.tot ? x.c.tot() : null; });
      }
      h += "</tbody></table>";
      return { html: h, tsv: tsv.join("\n") };
    }

    function tablaTranspuesta(cols, rows, dimensiones, conTotal) {
      // Columnas = valores de la(s) dimensión(es); filas = medidas.
      var dimCols = cols.filter(function (c) { return c.dim; });
      var valCols = cols.filter(function (c) { return !c.dim; });
      var nombreFila = function (r) {
        return dimCols.map(function (c) { return texto(c.get(r), c.field); }).join(" · ");
      };
      var tsv = [];
      var h = '<table class="cu-t"><thead><tr><th class="cu-nosort">' +
        esc(dimCols.map(function (c) { return c.label; }).join(" · ")) + "</th>";
      var encab = [dimCols.map(function (c) { return c.label; }).join(" · ")];
      rows.forEach(function (r) { var n = nombreFila(r); encab.push(n); h += '<th class="cu-nosort">' + esc(n) + "</th>"; });
      if (conTotal) { encab.push("Total"); h += '<th class="cu-nosort">Total</th>'; }
      h += "</tr></thead><tbody>";
      tsv.push(encab.join("\t"));
      valCols.forEach(function (c) {
        var linea = [c.label];
        h += '<tr><td class="cu-dim">' + esc(c.label) + "</td>";
        rows.forEach(function (r) { var t = texto(c.get(r), c.field); linea.push(t === NULO ? "" : t); h += celda(t); });
        if (conTotal) { var tt = texto(c.tot ? c.tot() : null, c.field); linea.push(tt === NULO ? "" : tt); h += celda(tt, "cu-coltot"); }
        h += "</tr>";
        tsv.push(linea.join("\t"));
      });
      h += "</tbody></table>";
      return { html: h, tsv: tsv.join("\n") };
    }

    function hayValor(cell) {
      return !!cell && cell.value !== null && cell.value !== undefined;
    }

    // HTML del valor de un scorecard: el texto formateado o "No hay datos" (más chico, como Looker Studio).
    function valorKpi(cell, campo) {
      return hayValor(cell) ? esc(texto(cell, campo)) : '<span class="cu-ls-vacio">' + SIN_DATOS + "</span>";
    }

    function renderKpi(nodo, cfg, campo, fila) {
      var cell = fila ? fila[campo.name] : null;
      if (cell && typeof cell === "object" && !("value" in cell)) {
        var k = Object.keys(cell)[0];
        cell = cell[k];
      }
      var titulo = cfg.titulo || campo.label_short || campo.label;
      if (cfg.kpi_estilo === "studio") {
        nodo.innerHTML = '<div class="cu-ls cu-ls-kpi' + (cfg.kpi_borde ? " borde" : "") + '">' +
          '<div class="cu-ls-valor" style="font-size:' + (Number(cfg.kpi_tamano_valor) || 36) + 'px">' +
          valorKpi(cell, campo) + "</div>" +
          '<div class="cu-ls-tit">' + esc(titulo) + "</div></div>";
        return;
      }
      nodo.innerHTML = '<div class="cu-kpi"><div class="cu-kpi-label">' + esc(titulo) + "</div>" +
        '<div class="cu-kpi-value" style="font-size:' + (Number(cfg.kpi_tamano_valor) || 44) + 'px">' +
        esc(texto(cell, campo)) + "</div>" +
        (cfg.subtitulo ? '<div class="cu-kpi-sub">' + esc(cfg.subtitulo) + "</div>" : "") + "</div>";
    }

    // Fila de scorecards (CLC, NCC, ...): una tarjeta por valor de la 1ª dimensión con la 1ª medida,
    // o una por medida si la query no trae dimensión. "Tarjetas fijas" fija el orden y muestra
    // "No hay datos" en las que no vienen, como Looker Studio.
    function renderTarjetas(nodo, cfg, dimensiones, medidas, filas) {
      var m = medidas[0];
      var d = dimensiones[0];
      var items = [];
      if (d) {
        filas.forEach(function (r) { items.push({ l: texto(r[d.name], d), v: m ? r[m.name] : null, f: m }); });
      } else if (filas[0]) {
        medidas.forEach(function (x) { items.push({ l: x.label_short || x.label, v: filas[0][x.name], f: x }); });
      }
      var fijas = String(cfg.tarjetas_orden || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
      if (fijas.length) {
        items = fijas.map(function (l) {
          for (var i = 0; i < items.length; i++) { if (items[i].l === l) return items[i]; }
          return { l: l, v: null, f: m };
        });
      }
      var tam = Number(cfg.kpi_tamano_valor) || 30;
      nodo.innerHTML = '<div class="cu-ls cu-ls-fila">' + items.map(function (it) {
        return '<div class="cu-ls-tj"><div class="cu-ls-tj-lbl">' + esc(it.l) + "</div>" +
          '<div class="cu-ls-tj-val" style="font-size:' + tam + 'px">' +
          valorKpi(it.v, it.f) + "</div></div>";
      }).join("") + "</div>";
    }

    // Matriz de KPI (sección "Otros KPI's de Éxito"): cada grupo es un recuadro redondeado con su
    // título a la izquierda y una fila por etiqueta; las columnas son las medidas indicadas.
    function renderMatriz(nodo, cfg, medidas, fila) {
      var buscar = function (ref) {
        ref = ref.toLowerCase();
        for (var i = 0; i < medidas.length; i++) {
          var x = medidas[i];
          var n = x.name.toLowerCase();
          if (n === ref || n.split(".").pop() === ref || String(x.label_short || "").toLowerCase() === ref) return x;
        }
        return null;
      };
      var cols = String(cfg.matriz_columnas || "").split("|").map(function (s) { return s.trim(); }).filter(Boolean);
      var grupos = [];
      var pos = {};
      String(cfg.matriz_filas || "").split(";").forEach(function (linea) {
        var p = linea.split("|").map(function (s) { return s.trim(); });
        if (p.length < 3 || !p[0]) return;
        if (!(p[0] in pos)) { pos[p[0]] = grupos.length; grupos.push({ t: p[0], filas: [] }); }
        grupos[pos[p[0]]].filas.push({ l: p[1], refs: p.slice(2) });
      });
      if (!grupos.length) {
        nodo.innerHTML = '<div class="cu-empty">Configura "Matriz: filas" (Grupo | Etiqueta | medida col 1 | medida col 2 ; ...).</div>';
        return;
      }
      var ncol = cols.length;
      grupos.forEach(function (g) { g.filas.forEach(function (f) { ncol = Math.max(ncol, f.refs.length); }); });
      var plantilla = "grid-template-columns: 26% 30%" + new Array(ncol + 1).join(" " + (44 / ncol) + "%") + ";";
      var colores = ["#db372d", "#1b4586"];
      var tam = Number(cfg.kpi_tamano_valor) || 36;
      var h = '<div class="cu-ls cu-ls-mx"><div class="cu-ls-mx-cab" style="' + plantilla + '"><div></div><div></div>';
      for (var c = 0; c < ncol; c++) {
        h += '<div style="color:' + colores[c % colores.length] + '">' + esc(cols[c] || "") + "</div>";
      }
      h += "</div>";
      grupos.forEach(function (g) {
        h += '<div class="cu-ls-mx-grupo" style="' + plantilla + '">' +
          '<div class="cu-ls-mx-gtit" style="grid-row: 1 / span ' + g.filas.length + '">' + esc(g.t) + "</div>";
        g.filas.forEach(function (f, i) {
          h += '<div class="cu-ls-mx-lbl" style="grid-column:2;grid-row:' + (i + 1) + '">' + esc(f.l) + "</div>";
          for (var j = 0; j < ncol; j++) {
            var campo = f.refs[j] ? buscar(f.refs[j]) : null;
            var cell = campo && fila ? fila[campo.name] : null;
            var t = campo ? valorKpi(cell, campo) : "";
            h += '<div class="cu-ls-mx-val" style="grid-column:' + (j + 3) + ";grid-row:" + (i + 1) +
              ";font-size:" + tam + 'px">' + t + "</div>";
          }
        });
        h += "</div>";
      });
      nodo.innerHTML = h + "</div>";
    }

    function parseRenombres(s) {
      var out = {};
      String(s || "").split(";").forEach(function (par) {
        var i = par.indexOf("=");
        if (i > 0) out[par.slice(0, i).trim()] = par.slice(i + 1).trim();
      });
      return out;
    }

    function parseOrden(s, cols) {
      s = String(s || "").trim();
      if (!s) return null;
      var m = s.match(/^(.*?)(?:\s+(asc|desc))?$/i);
      var objetivo = m[1].trim().toLowerCase();
      var desc = (m[2] || "desc").toLowerCase() === "desc";
      var idx = -1;
      if (/^\d+$/.test(objetivo)) idx = Number(objetivo) - 1;
      else if (objetivo === "total") {
        for (var i = cols.length - 1; i >= 0; i--) { if (cols[i].coltot) { idx = i; break; } }
        if (idx < 0) idx = cols.length - 1;
      } else {
        idx = cols.findIndex(function (c) { return String(c.label).toLowerCase() === objetivo || c.key.toLowerCase() === objetivo; });
      }
      return idx >= 0 && idx < cols.length ? { idx: idx, desc: desc } : null;
    }

    function ajustarColor(hex, pct) {
      var m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
      if (!m) return hex;
      var n = parseInt(m[1], 16);
      var f = function (c) { return Math.min(255, Math.round(c + (255 - c) * pct / 100)); };
      var r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
      return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    function copiar(txt, cb) {
      var fallback = function () {
        try {
          var ta = document.createElement("textarea");
          ta.value = txt;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          var ok = document.execCommand("copy");
          document.body.removeChild(ta);
          cb(ok);
        } catch (e) { cb(false); }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(function () { cb(true); }, fallback);
      } else {
        fallback();
      }
    }
  }
});
