// =====================================================================================
// ls_extraer_reporte.js — Extracción de la definición de un reporte de Looker Studio
// Skill: homologar-looker-studio-a-looker · Solo LECTURA (no modifica el reporte).
//
// USO (en la pestaña del reporte abierto en MODO EDICIÓN, con sesión del usuario):
//   1) Pegar/evaluar TODO este archivo una vez (define window.LS).
//   2) await LS.capturarXsrf()         -> si devuelve 'esperando', cambiar de página en el editor
//                                        y volver a llamar hasta 'ok'.
//   3) await LS.cargar('<reportId>')   -> trae getReport + todas las fuentes (getBlockDatasource).
//   4) LS.paginas()                    -> [{i, pageId, nombre, componentes}]
//   5) LS.resumenPagina(i)             -> componentes de la página i con fórmulas resueltas.
//   6) LS.textos(i)                    -> textos fijos de la página i (títulos, glosario).
//   7) LS.fuentes()                    -> por fuente: tabla física + campos calculados.
//   8) LS.capturarRequests()           -> parchea XHR para guardar bodies de batchedDataV2
//      (luego navegar la página; LS.calcGrafico(componentId) da sus calculatedField).
// Con agentes cuya herramienta JS devuelve el valor de la última expresión, envolver en
// JSON.stringify(...) para obtener texto.
// =====================================================================================
(function () {
  const strip = t => JSON.parse(String(t).replace(/^\)\]\}'\s*/, ''));
  const LS = window.LS = window.LS || {};

  LS.capturarXsrf = async function () {
    if (!window.__xsrfPatched) {
      window.__xsrfPatched = true;
      const o = XMLHttpRequest.prototype.setRequestHeader;
      XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
        if (/xsrf/i.test(k)) window.__xsrf = v;
        return o.apply(this, arguments);
      };
    }
    LS.appVersion = LS.appVersion || ((performance.getEntriesByType('resource').map(e => e.name)
      .find(n => /appVersion=/.test(n)) || '').match(/appVersion=([^&]+)/) || [])[1];
    return window.__xsrf ? 'ok' : 'esperando';
  };

  LS.post = async function (metodo, cuerpo) {
    if (!window.__xsrf) throw new Error('Falta XSRF: correr LS.capturarXsrf() y navegar en el editor');
    const q = LS.appVersion ? '?appVersion=' + LS.appVersion : '';
    const r = await fetch('/u/0/' + metodo + q, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-RAP-XSRF-TOKEN': window.__xsrf },
      body: JSON.stringify(cuerpo)
    });
    if (!r.ok) throw new Error(metodo + ' HTTP ' + r.status);
    return strip(await r.text());
  };

  LS.cargar = async function (reportId) {
    LS.rep = await LS.post('getReport', { reportId });
    const ids = new Set();
    JSON.stringify(LS.rep, (k, v) => { if ((k === 'datasourceId' || k === 'datasetId') && typeof v === 'string') ids.add(v); return v; });
    LS.ds = {};
    for (const id of ids) { try { LS.ds[id] = await LS.post('getBlockDatasource', { datasourceId: id }); } catch (e) { LS.ds[id] = { error: String(e) }; } }
    return { paginas: LS.rep.reportConfig.page.length, fuentes: [...ids] };
  };

  LS.paginas = () => LS.rep.reportConfig.page.map((p, i) => ({
    i, pageId: p.pageId, nombre: (p.page && p.page.name) || p.name,
    componentes: ((p.page && p.page.componentConfig) || []).length
  }));

  // Campos de cada fuente: nombre interno -> {label, formula}
  LS._campos = function (dsId) {
    const acc = {};
    (function walk(o) {
      if (o && typeof o === 'object') {
        if (o.field && o.field.name && o.outputName)
          acc[o.field.name] = { label: o.outputName, formula: (o.frontendTextFormula || o.textFormula || '').replace(/t0\./g, '').replace(/\s+/g, ' ') };
        for (const k in o) walk(o[k]);
      }
    })(LS.ds[dsId]);
    return acc;
  };
  LS._tabla = dsId => (JSON.stringify(LS.ds[dsId] || {}).match(/"(?:tableId|table)":"([^"]+)"/) || [])[1];

  LS.fuentes = () => Object.keys(LS.ds).map(id => ({ id, tabla: LS._tabla(id), campos: LS._campos(id) }));

  LS._filtros = function () {
    const m = {};
    const e = (((LS.rep.reportConfig.report || {}).resource || {}).filter || {}).entry || [];
    e.forEach(x => m[x.key] = x.value);
    return m;
  };
  LS._descFiltro = function (k) {
    const v = LS._filtros()[k]; if (!v) return k;
    const fe = (v.filterDefinition && v.filterDefinition.filterExpression) || {};
    const sf = fe.queryTimeTransformation && fe.queryTimeTransformation.dataTransformation && fe.queryTimeTransformation.dataTransformation.sourceFieldName;
    return `${v.name}: ${fe.include === false ? 'NOT ' : ''}${sf} ${fe.filterConditionType} ${JSON.stringify((fe.stringValues || []).concat(fe.numberValues || []))}`;
  };

  LS.resumenPagina = function (i) {
    const pg = LS.rep.reportConfig.page[i].page;
    const out = (pg.componentConfig || []).filter(c => !/^(shape|line|image)/.test(c.type)).map(c => {
      const a = (c.attributeConfig && c.attributeConfig.componentAttribute) || {};
      const p = (c.propertyConfig && c.propertyConfig.componentProperty) || {};
      const ds = c.datasourceId || (p.dataset && p.dataset.datasetId);
      const campos = ds ? LS._campos(ds) : {};
      const cd = {}; (c.conceptDefs || []).forEach(x => cd[x.name] = x.queryTimeTransformation);
      const desc = n => {
        const q = cd[n]; if (!q) return n;
        const dt = q.dataTransformation || {}; const f = campos[dt.sourceFieldName];
        return `${(q.displayTransformation || {}).displayName || ''}=${f ? f.label + (f.formula && f.formula !== f.label ? ' [' + f.formula + ']' : '') : dt.sourceFieldName}${dt.aggregation ? ' agg:' + dt.aggregation : ''}`;
      };
      const mets = ((p.metrics && p.metrics.labeledConcepts) || []).flatMap(l => ((l.value && l.value.conceptNames) || []).map(desc));
      const dimsRaw = (p.dimensions && (p.dimensions.labeledConcepts || p.dimensions.conceptNames)) || [];
      const dims = JSON.parse(JSON.stringify(dimsRaw)).flatMap(d => typeof d === 'string' ? [desc(d)] : ((d.value && d.value.conceptNames) || []).map(desc));
      const titulo = (JSON.stringify(p).match(/"(?:chartTitleText|title|controlLabel)":"([^"]*)"/) || [])[1];
      return {
        id: c.componentId, tipo: c.type, titulo, top: a.top, left: a.left, ancho: a.width, alto: a.height,
        tabla: ds ? LS._tabla(ds) : null, dims, metricas: mets,
        rangoFechaCampo: p.dateRangeDimension ? desc(p.dateRangeDimension) : null,
        rangoFechaDefault: p.dateDuration || null,
        filtros: (p.filters || []).map(LS._descFiltro), heredaFiltros: p.inheritFilters,
        orden: p.sort || null, filas: p.row || null,
        kpi: p.kpiMetricProperty ? { compara: p.kpiMetricProperty.compareType, compacto: p.kpiMetricProperty.compactNumbers } : null
      };
    });
    return out.sort((x, y) => (x.top - y.top) || (x.left - y.left));
  };

  LS.textos = function (i) {
    const pg = LS.rep.reportConfig.page[i].page;
    return (pg.componentConfig || []).filter(c => c.type === 'simple-description').map(c => {
      const a = c.attributeConfig.componentAttribute; const s = JSON.stringify(c.propertyConfig);
      const m = s.match(/"(?:text|textContent|html)":"((?:[^"\\]|\\.)*)"/);
      const html = m ? JSON.parse('"' + m[1] + '"') : '';
      const d = document.createElement('div'); d.innerHTML = html;
      return { top: a.top, left: a.left, texto: d.innerText.replace(/\s+/g, ' ').trim(), html };
    });
  };

  LS.capturarRequests = function () {
    if (window.__lsCapPatched) return 'ya';
    window.__lsCapPatched = true; window.__lsCaps = [];
    const oo = XMLHttpRequest.prototype.open, os = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) { this.__u = u; return oo.apply(this, arguments); };
    XMLHttpRequest.prototype.send = function (b) {
      const x = this; const rec = { url: x.__u, body: b };
      x.addEventListener('load', () => { rec.resp = x.responseText; });
      if (/batchedData/.test(String(x.__u))) window.__lsCaps.push(rec);
      return os.apply(this, arguments);
    };
    return 'ok: navegar la página para que los gráficos pidan datos';
  };

  // Campos calculados a nivel de gráfico (no están en la fuente)
  LS.calcGrafico = function (componentId) {
    const out = [];
    (window.__lsCaps || []).forEach(r => {
      try {
        const j = JSON.parse(r.body);
        (j.dataRequest || []).forEach(dr => {
          const cid = dr.requestContext && dr.requestContext.reportContext && dr.requestContext.reportContext.componentId;
          if (cid === componentId) (dr.datasetSpec.calculatedField || []).forEach(c => out.push({
            nombre: c.name, formula: (c.dataTransformation && (c.dataTransformation.frontendTextFormula || c.dataTransformation.textFormula)) || c.formula
          }));
        });
      } catch (e) { }
    });
    return out;
  };

  // Respuesta de datos (valores que LS muestra) de un componente, si fue capturada
  LS.valores = function (componentId) {
    return (window.__lsCaps || []).filter(r => r.body && r.body.indexOf(componentId) >= 0 && r.resp)
      .map(r => { try { return strip(r.resp); } catch (e) { return r.resp && r.resp.slice(0, 2000); } });
  };
})();
'LS listo: await LS.capturarXsrf()';
