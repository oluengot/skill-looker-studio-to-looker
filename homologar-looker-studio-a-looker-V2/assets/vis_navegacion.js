// SOLO REFERENCIA (skill homologar-looker-studio-a-looker): barra de navegacion como vis.
// Se descarto en favor del banner en mosaico de texto porque el iframe sandbox de una vis no navega la ventana.

// Visualización personalizada Looker: "Club Urgencia - Navegación (pestañas Looker Studio)"
// Proyecto BI · 01_DM/INF_CLUB_URGENCIA/visualizaciones/club_urgencia_navegacion.js
//
// Réplica 1:1 de la barra de páginas del Looker Studio "Club Urgencia Interclínica":
// mismos íconos (Material, SVG originales), Google Sans 14px/500, gris #5f6368, activa en
// azul #1a73e8 con barra inferior de 3px.
//
// Cada página del Looker Studio es una pestaña nativa del dashboard Looker (269). Al hacer
// clic se abre esa pestaña con `?tab_name=<Página>` y se conservan los filtros del dashboard:
// la query de este mosaico escucha los filtros y la vis los lee de `applied_filters`
// (opción "Filtros a conservar": campo=nombre_del_filtro_del_dashboard).
// Si el dashboard se ve embebido (/embed/), los enlaces se arman también con /embed/.
//
// Query esperada: cualquier dimensión liviana que escuche los filtros del dashboard
// (p. ej. cu_captacion.nom_clinica_club). Los datos no se muestran.

(function () {
  var ICONOS = {
    people: ["M15 8c0-1.42-.5-2.73-1.33-3.76.42-.14.86-.24 1.33-.24 2.21 0 4 1.79 4 4s-1.79 4-4 4c-.43 0-.84-.09-1.23-.21-.03-.01-.06-.02-.1-.03A5.98 5.98 0 0 0 15 8zm1.66 5.13C18.03 14.06 19 15.32 19 17v3h4v-3c0-2.18-3.58-3.47-6.34-3.87zM9 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m0 9c-2.7 0-5.8 1.29-6 2.01V18h12v-1c-.2-.71-3.3-2-6-2M9 4c2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4 1.79-4 4-4zm0 9c2.67 0 8 1.34 8 4v3H1v-3c0-2.66 5.33-4 8-4z"],
    grade: ["M12 7.13l.97 2.29.47 1.11 1.2.1 2.47.21-1.88 1.63-.91.79.27 1.18.56 2.41-2.12-1.28-1.03-.64-1.03.62-2.12 1.28.56-2.41.27-1.18-.91-.79-1.88-1.63 2.47-.21 1.2-.1.47-1.11.97-2.27M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z"],
    paid: ["M11 17h2v-1h1c.55 0 1-.45 1-1v-3c0-.55-.45-1-1-1h-3v-1h4V8h-2V7h-2v1h-1c-.55 0-1 .45-1 1v3c0 .55.45 1 1 1h3v1H9v2h2v1zm1-15C6.49 2 2 6.49 2 12s4.49 10 10 10 10-4.49 10-10S17.51 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"],
    tag: ["M20 10V8h-4V4h-2v4h-4V4H8v4H4v2h4v4H4v2h4v4h2v-4h4v4h2v-4h4v-2h-4v-4h4zm-6 4h-4v-4h4v4z"],
    miscellaneous_services: ["M14.17 13.71l1.4-2.42c.09-.15.05-.34-.08-.45l-1.48-1.16c.03-.22.05-.45.05-.68s-.02-.46-.05-.69l1.48-1.16c.13-.11.17-.3.08-.45l-1.4-2.42c-.09-.15-.27-.21-.43-.15l-1.74.7c-.36-.28-.75-.51-1.18-.69l-.26-1.85a.364.364 0 0 0-.35-.29h-2.8c-.17 0-.32.13-.35.3L6.8 4.15c-.42.18-.82.41-1.18.69l-1.74-.7c-.16-.06-.34 0-.43.15l-1.4 2.42c-.09.15-.05.34.08.45l1.48 1.16c-.03.22-.05.45-.05.68s.02.46.05.69l-1.48 1.16c-.13.11-.17.3-.08.45l1.4 2.42c.09.15.27.21.43.15l1.74-.7c.36.28.75.51 1.18.69l.26 1.85c.03.16.18.29.35.29h2.8c.17 0 .32-.13.35-.3l.26-1.85c.42-.18.82-.41 1.18-.69l1.74.7c.16.06.34 0 .43-.15zM8.81 11c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm13.11 7.67l-.96-.74c.02-.14.04-.29.04-.44 0-.15-.01-.3-.04-.44l.95-.74c.08-.07.11-.19.05-.29l-.9-1.55c-.05-.1-.17-.13-.28-.1l-1.11.45c-.23-.18-.48-.33-.76-.44l-.17-1.18a.216.216 0 0 0-.21-.2h-1.79c-.11 0-.21.08-.22.19l-.17 1.18c-.27.12-.53.26-.76.44l-1.11-.45a.23.23 0 0 0-.28.1l-.9 1.55c-.05.1-.04.22.05.29l.95.74a3.145 3.145 0 0 0 0 .88l-.95.74c-.08.07-.11.19-.05.29l.9 1.55c.05.1.17.13.28.1l1.11-.45c.23.18.48.33.76.44l.17 1.18c.02.11.11.19.22.19h1.79c.11 0 .21-.08.22-.19l.17-1.18c.27-.12.53-.26.75-.44l1.12.45c.1.04.22 0 .28-.1l.9-1.55c.06-.09.03-.21-.05-.28zm-4.29.16a1.35 1.35 0 1 1 .001-2.701 1.35 1.35 0 0 1-.001 2.701z"],
    face: ["M10.25 13a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0zM15 11.75a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5zm7 .25c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2s10 4.48 10 10zm-2 0c0-.78-.12-1.53-.33-2.24-.7.15-1.42.24-2.17.24a10 10 0 0 1-7.76-3.69A10.016 10.016 0 0 1 4 11.86c.01.04 0 .09 0 .14 0 4.41 3.59 8 8 8s8-3.59 8-8z"],
    article: ["M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z", "M14 17H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"]
  };

  // Páginas del Looker Studio, en su orden y con su ícono.
  var PAGINAS = [
    ["Inscripciones", "people"],
    ["KPI de Éxito", "grade"],
    ["Venta URG", "paid"],
    ["Actividad URG", "tag"],
    ["Sinergia", "miscellaneous_services"],
    ["Sinergia UPC", "miscellaneous_services"],
    ["KPI de Servicio", "face"],
    ["Glosario", "article"]
  ];

  looker.plugins.visualizations.add({
    id: "club_urgencia_navegacion",
    label: "Club Urgencia - Navegación (pestañas Looker Studio)",
    options: {
      pagina_activa: {
        type: "string",
        label: "Página activa",
        display: "select",
        values: PAGINAS.map(function (p) { var o = {}; o[p[0]] = p[0]; return o; }),
        default: "Inscripciones",
        order: 1
      },
      dashboard_id: {
        type: "string",
        label: "ID del dashboard (pestañas nativas = páginas)",
        default: "269",
        order: 2
      },
      filtros: {
        type: "string",
        label: "Filtros a conservar (campo=filtro; ...)",
        default: "cu_captacion.fecha_date=periodo; cu_captacion.nom_clinica_club=clinica; cu_captacion.pilar=pilar",
        order: 3
      },
      instancia: {
        type: "string",
        label: "URL de Looker",
        default: "https://interclinica.cloud.looker.com",
        order: 4
      }
    },

    create: function (element) {
      element.innerHTML = `<style>
* { box-sizing: border-box; }
html, body { margin: 0; }
.cun-bar {
  width: 100%; height: 100%; min-height: 64px; background: #ffffff;
  display: flex; align-items: stretch; overflow-x: auto; overflow-y: hidden;
  font-family: "Google Sans", Roboto, Arial, sans-serif;
}
.cun-bar::-webkit-scrollbar { display: none; }
.cun-tab {
  position: relative; flex: 0 0 auto; height: 64px; padding: 0 16px;
  display: inline-flex; flex-direction: column; align-items: center; justify-content: center;
  color: #5f6368; text-decoration: none; font-size: 14px; font-weight: 500; letter-spacing: .15px;
  white-space: nowrap; cursor: pointer; border-radius: 4px; transition: background-color .15s;
}
.cun-tab:hover { background: rgba(95, 99, 104, .06); }
.cun-tab svg { width: 20px; height: 20px; fill: currentColor; margin-bottom: 4px; display: block; }
.cun-tab.is-active { color: #1a73e8; cursor: default; }
.cun-tab.is-active:hover { background: transparent; }
.cun-lbl { position: relative; display: inline-block; }
.cun-tab.is-active .cun-lbl::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: -12px; height: 3px;
  background: #1a73e8; border-radius: 3px 3px 0 0;
}
</style>
<nav class="cun-bar"></nav>`;
    },

    updateAsync: function (data, element, config, queryResponse, details, done) {
      this.clearErrors();
      var bar = element.querySelector(".cun-bar");
      if (!bar) { this.create(element); bar = element.querySelector(".cun-bar"); }

      try {
        var activa = config.pagina_activa || "Inscripciones";
        var base = (config.instancia || "https://interclinica.cloud.looker.com").replace(/\/+$/, "");
        var embebido = /\/embed\//.test(document.referrer || "");
        var ruta = base + (embebido ? "/embed" : "") + "/dashboards/" + encodeURIComponent(config.dashboard_id || "269");

        // Filtros vigentes del dashboard (vienen aplicados a la query de este mosaico).
        var params = [];
        var aplicados = (queryResponse && queryResponse.applied_filters) || {};
        String(config.filtros || "").split(";").forEach(function (par) {
          var i = par.indexOf("=");
          if (i <= 0) return;
          var campo = par.slice(0, i).trim();
          var nombre = par.slice(i + 1).trim();
          var f = aplicados[campo];
          var valor = f && (f.value !== undefined ? f.value : f.expression);
          params.push(encodeURIComponent(nombre) + "=" + encodeURIComponent(valor == null ? "" : valor));
        });

        bar.innerHTML = PAGINAS.map(function (p) {
          var nombre = p[0];
          var svg = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
            ICONOS[p[1]].map(function (d) { return '<path d="' + d + '"></path>'; }).join("") + "</svg>";
          var cuerpo = svg + '<span class="cun-lbl">' + nombre + "</span>";
          if (nombre === activa) return '<span class="cun-tab is-active">' + cuerpo + "</span>";
          var url = ruta + "?" + ["tab_name=" + encodeURIComponent(nombre)].concat(params).join("&");
          return '<a class="cun-tab" target="_top" href="' + url + '">' + cuerpo + "</a>";
        }).join("");
      } catch (err) {
        console.error("club_urgencia_navegacion:", err);
      }
      done();
    }
  });
})();
