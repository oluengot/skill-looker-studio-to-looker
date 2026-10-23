# 09 · Commit, deploy y verificación en producción

## ¿Quién despliega?

- **Por defecto, el usuario.** El agente le entrega:
  - la lista exacta de archivos;
  - el mensaje de commit sugerido;
  - los pasos.
- **El agente**, solo si el usuario lo autorizó explícitamente. Registra esa autorización
  (memoria o notas del proyecto) con fecha.

## Pre-deploy (obligatorio)

1. **Validate con 0 errores de severidad `error` en todo el proyecto**
   (`POST /api/internal/core/4.0/projects/<P>/validate`). Si hay errores en archivos ajenos:
   - repórtalos al usuario con archivo, línea y mensaje;
   - no los corrijas sin su OK;
   - si autoriza, aplica el **mínimo** cambio.

   Casos reales: un dashboard duplicado en un archivo de otro equipo, y un campo inexistente.
2. **Archivos modificados**: lista los archivos con `git_status` modificado
   (`GET /api/internal/projects/<P>` → `.files[*].git_status.full_status`). Separa en dos grupos y
   avisa de los ajenos antes del commit:
   - los de esta migración;
   - los ajenos (otros equipos que comparten el workspace).
3. **Dev probado**: los dashboards cambiados renderizan bien en dev y la validación V2 está
   hecha.

## Camino por defecto: `tools/looker_deploy.py` (git + API pública)

Reemplaza a la UI del IDE. Causas que elimina: sesión expirada (401), foco perdido en el editor Ace,
errores de otros equipos en el dev compartido y el bucle "Pull & Merge".

1. **Una vez por PC:** `python tools/looker_deploy.py doctor --deep`. Comprueba credenciales, permisos
   `develop`+`deploy`, acceso git al repo del proyecto y el circuito completo con una rama temporal
   (no toca producción). Si falla, dice qué falta; no sigas con `ship` hasta que pase.
2. **Ver qué cambiaría:** `plan --map "<carpeta lookml local>=<carpeta en el repo>" [--file "<manifest>=manifest.lkml"]`.
   Lista altas/modificados/borrados y marca los archivos que **otro cambió en el remoto después de tu
   último deploy** (no los pisa sin `--force-overwrite`). Antes corre `lint` con las trampas conocidas
   (`label_short`, `/` inicial en el manifest, `.file.lkml`, tabs/YAML inválido, `NOT NULL`).
3. **Desplegar** (con la autorización del usuario): `ship --map ... -m "mensaje" --yes`. Internamente:
   fetch → rama desde `origin/<prod>` → copia + commit → push de rama temporal → crea la rama en el dev de
   la API → `validate` → `deploy_to_production` (sobre la rama temporal) → verifica `remote_ref`/`ref` de producción → borra la
   rama temporal. Si producción avanzó en el medio, rehace todo sobre la nueva base (hasta `--retries`, 4).
4. **Validación:** errores en archivos del deploy → se detiene. Errores en archivos ajenos → se detiene y se
   reportan; solo con OK del usuario se repite con `--ignore-foreign-errors`.
5. **Rollback:** `rollback --commit <sha> --yes` (commit de reversa + deploy, nunca reescribe historia).
6. `--delete-missing` borra del repo lo que ya no existe en la carpeta local (solo dentro de cada `--map`).

Credenciales: variables de entorno del MCP; git por Git Credential Manager o `LOOKER_GIT_TOKEN`. El commit
sale con la identidad del dueño de la API key (o `LOOKER_GIT_NAME`/`LOOKER_GIT_EMAIL`). Log y estado en
`~/.looker_deploy/<proyecto>/`. Tras el deploy sigue valiendo la verificación post-deploy de abajo (MCP/query).

## Plan B: commit + deploy por la UI del IDE

En `https://<instancia>/projects/<P>/files/<algún archivo>`, con el modo desarrollo activo, el
botón Git del IDE (arriba a la derecha) cambia de estado:

1. **"Validate LookML"**: clic y esperar.
2. **"Commit Changes & Push"**:
   - se abre un diálogo con la lista de archivos y un campo de mensaje;
   - revisa la lista; si hay ajenos y el usuario no autorizó incluirlos, detente;
   - escribe un mensaje descriptivo en el idioma del usuario. Ejemplo: `<Proyecto>: filtro de
     periodo por defecto 2025/01/01 to today en los 6 dashboards`;
   - haz clic en **Commit**.
3. **"Deploy to Production"**: clic. Confirma con el diálogo "Se envió la implementación"
   (o "Deployed") y ciérralo.
4. Si en lugar de Deploy aparece **"Pull & Merge Other Changes"**, otros desplegaron
   mientras tanto:
   - haz clic, revalida y despliega **de inmediato**;
   - puede pasar más de una vez si hay mucha actividad. Repite hasta que el deploy pase.
5. Si aparece **"Pull from Production"** o un conflicto, resuélvelo con el usuario. No fuerces
   nada.

Toma una captura de pantalla antes de cada clic para ubicar el botón. Su posición depende de la
resolución.

## Verificación post-deploy

1. `GET /api/internal/core/4.0/projects/<P>/git_branches`: el `remote_ref` de `master`/`main`
   debe ser tu commit. La rama dev debe quedar con `ahead/behind = 0`.
2. MCP (producción):
   - `get_dashboard("<modelo>::<pagina>")` para comprobar los filtros y los defaults;
   - `run_dashboard("<modelo>::<pagina>")` para comprobar los valores (V3).

   Si muestra la versión anterior, espera unos 20 s y repite.
3. Abre la URL embed en el navegador (`/embed/dashboards/<modelo>::<pagina>`) y prueba el banner.
4. Registra en el README y en la memoria del proyecto: commit, fecha y qué se verificó.

## Rollback

- Dashboard LookML o vista: haz un `git revert` del commit (por la UI del IDE o en el repo remoto)
  y despliega de nuevo.
- UDD legado: recréalo desde el `.dashboard.lookml` (importar) o restaura una copia.
- Vistas pasarela BigQuery: son `SELECT *`, así que el rollback casi nunca es necesario. Si lo es,
  haz `CREATE OR REPLACE VIEW` con el DDL anterior guardado en `sql/`, con OK del usuario.

## Errores típicos de deploy

| Error | Causa | Solución |
|---|---|---|
| El commit se bloquea por errores | Hay errores en cualquier archivo del proyecto | Corregir o pedir al dueño. Validate debe dar 0 errores |
| "Could not load model … Can't find visualization file" en todos los modelos | El `file:` del manifest tiene `/` inicial | Quitar la `/` inicial |
| `label_short` inválido | No es un parámetro LookML | Quitarlo y usar `renombrar`/`series_labels` |
| El botón vuelve a "Pull & Merge" | Producción avanzó entre el merge y el deploy | Repetir merge, validate y deploy sin pausa |
| El dashboard LookML no aparece | Falta el `include` de `*.dashboard` en el modelo, o el `- dashboard:` tiene otro nombre | Revisar el include y el nombre |
