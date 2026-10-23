// =====================================================================================
// looker_api_helpers.js — Helpers de la API INTERNA de Looker (workspace dev del usuario)
// Skill: homologar-looker-studio-a-looker
//
// USO: en una pestaña de Looker con sesión iniciada (y modo desarrollo activo para escribir
// archivos), evaluar este archivo una vez → queda window.LK.
//
//   LK.P = 'BI'                                        // proyecto LookML
//   await LK.leer('01_DM/X/vista.view.lkml')           // {contents, digest}
//   await LK.crear('01_DM/X/dashboard/pagina', 'dashboard')  // crea .dashboard.lookml vacío
//   await LK.escribir('01_DM/X/vista.view.lkml', texto) // GET digest + PUT + verificación SHA-256
//   await LK.validar()                                  // errores de severidad 'error' del proyecto
//   await LK.modificados()                              // archivos con cambios git en el workspace
//   await LK.ramas()                                    // git_branches (remote_ref de master = prod)
//   await LK.sql('SELECT 1', 'bigquery_conexion')       // SQL crudo por la conexión de Looker
//   await LK.query({model, view, fields, filters, sorts, total, limit})  // crea + corre (dev)
//   await LK.exportarUdd(269)                           // LookML de un dashboard de usuario
//   await LK.patchElemento(id, cuerpo)                  // PATCH dashboard_element (UDD)
// =====================================================================================
(function () {
  const LK = window.LK = window.LK || {};
  LK.P = LK.P || 'BI';
  const csrf = () => document.querySelector('meta[name="csrf-token"]').content;
  const H = () => ({ 'X-CSRF-Token': csrf(), 'Content-Type': 'application/json', 'Accept': 'application/json' });
  const J = async r => { const t = await r.text(); try { return JSON.parse(t.replace(/^\)\]\}'\s*/, '')); } catch (e) { return t; } };
  const enc = p => encodeURIComponent(p);           // ruta COMPLETA codificada (/ -> %2F)
  const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');

  LK.leer = async ruta => J(await fetch(`/api/internal/projects/${LK.P}/files/${enc(ruta)}`, { headers: H(), credentials: 'include' }));

  // tipo: view | model | dashboard | javascript | documentation | custom | style_config
  LK.crear = async (rutaSinExtension, tipo) => {
    const r = await fetch(`/api/internal/projects/${LK.P}/files`, { method: 'POST', headers: H(), credentials: 'include', body: JSON.stringify({ path: rutaSinExtension, type: tipo }) });
    return { status: r.status, body: await J(r) };
  };

  LK.escribir = async (ruta, contenido) => {
    contenido = contenido.replace(/\r\n/g, '\n');
    const f = await LK.leer(ruta);
    if (!f || f.digest === undefined) return { error: 'No se pudo leer el archivo (¿existe? ¿modo dev?)', f };
    const r = await fetch(`/api/internal/projects/${LK.P}/files/${enc(ruta)}`, {
      method: 'PUT', headers: H(), credentials: 'include',
      body: JSON.stringify({ file_contents: contenido, file_digest: f.digest })
    });
    const g = await LK.leer(ruta);
    const ok = g && g.contents !== undefined && (await sha(g.contents)) === (await sha(contenido));
    return { status: r.status, identico: ok, largoLocal: contenido.length, largoGuardado: g && g.contents && g.contents.length };
  };

  LK.validar = async () => {
    const v = await J(await fetch(`/api/internal/core/4.0/projects/${LK.P}/validate`, { method: 'POST', headers: H(), credentials: 'include' }));
    const errs = (v.errors || []).filter(e => e.severity === 'error').map(e => ({ msg: e.message, archivo: e.file_path, linea: e.line_number }));
    const warns = (v.errors || []).filter(e => e.severity === 'warning').length;
    return { errores: errs.length, detalle: errs, warnings: warns };
  };

  LK.modificados = async () => {
    const p = await J(await fetch(`/api/internal/projects/${LK.P}`, { headers: H(), credentials: 'include' }));
    const out = [];
    Object.values(p.files || {}).forEach(arr => (Array.isArray(arr) ? arr : []).forEach(f => {
      const st = f.git_status && f.git_status.full_status;
      if (st && !/^(unmodified|clean)?$/i.test(st)) out.push({ archivo: f.id || f.path, estado: st });
    }));
    return out;
  };

  LK.ramas = async () => J(await fetch(`/api/internal/core/4.0/projects/${LK.P}/git_branches`, { headers: H(), credentials: 'include' }));

  LK.sql = async (sql, conexion) => {
    let r = await fetch('/api/internal/core/4.0/sql_queries', { method: 'POST', headers: H(), credentials: 'include', body: JSON.stringify({ connection_name: conexion, sql }) });
    const j = await J(r); if (!j.slug) return { error: 'create', status: r.status, j };
    r = await fetch(`/api/internal/core/4.0/sql_queries/${j.slug}/run/json`, { method: 'POST', headers: H(), credentials: 'include' });
    return J(r);
  };

  LK.query = async (q, formato = 'json') => {
    const c = await J(await fetch('/api/internal/core/4.0/queries', { method: 'POST', headers: H(), credentials: 'include', body: JSON.stringify(q) }));
    if (!c.id) return { error: 'create', c };
    return { id: c.id, datos: await J(await fetch(`/api/internal/core/4.0/queries/${c.id}/run/${formato}`, { headers: H(), credentials: 'include' })) };
  };

  LK.exportarUdd = async id => (await J(await fetch(`/api/internal/core/4.0/dashboards/lookml/${id}`, { headers: H(), credentials: 'include' }))).lookml;

  LK.patchElemento = async (id, cuerpo) => {
    const r = await fetch(`/api/internal/core/4.0/dashboard_elements/${id}`, { method: 'PATCH', headers: H(), credentials: 'include', body: JSON.stringify(cuerpo) });
    return { status: r.status, body: await J(r) };
  };

  LK.patchLayout = async (id, pos) => {
    const r = await fetch(`/api/internal/core/4.0/dashboard_layout_components/${id}`, { method: 'PATCH', headers: H(), credentials: 'include', body: JSON.stringify(pos) });
    return { status: r.status };
  };
})();
'LK listo (proyecto ' + window.LK.P + ')';
