#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""looker_deploy.py: aplicar cambios y llevarlos a produccion en Looker, sin tocar la UI.

Por que existe
    Desplegar por la UI del IDE (botones Commit / Pull & Merge / Deploy), por la API interna con cookie
    o escribiendo en el workspace dev compartido es fragil: la sesion expira, el foco se pierde en el
    editor Ace, otros equipos ensucian el dev y "Pull & Merge" se repite si producion avanza.

Como lo resuelve
    Git es la fuente de verdad. El script:
      1. clona/actualiza el repo remoto del proyecto Looker (cache local, nunca tu working copy);
      2. parte siempre de origin/<produccion> recien traido (adios "Pull & Merge");
      3. copia tus archivos LookML, commitea y sube una rama temporal;
      4. valida esa rama en el dev de la API (y separa errores tuyos de los ajenos);
      5. despliega a produccion con la API publica (deploy_to_production sobre la rama temporal);
      6. verifica que produccion quedo en tu commit; si produccion avanzo en el medio, repite solo.
    Solo usa la API publica 4.0 con API key (sin cookie, sin CSRF, sin navegador) + git.

Requisitos
    Python 3.9+, git, y credenciales de API de Looker (las mismas del MCP):
      LOOKER_BASE_URL, LOOKER_CLIENT_ID, LOOKER_CLIENT_SECRET   (o un looker.ini via --ini / LOOKERSDK_INI)
    Acceso de escritura al repo git del proyecto: credencial de git ya guardada (Git Credential Manager)
    o un token en LOOKER_GIT_TOKEN. No hace falta pip install de nada.

Comandos
    doctor [--deep]      verifica credenciales, permisos, git y (con --deep) el circuito completo sin tocar produccion
    status               produccion vs remoto vs dev de la API, y ultimo deploy hecho con esta herramienta
    lint                 reglas locales (trampas conocidas de la skill) sobre los archivos
    plan                 muestra que cambiaria (alta/modifica/borra y cambios ajenos) -- no escribe nada
    ship  ... --yes      plan + commit + validar + deploy + verificar (sin --yes se queda en plan)
    rollback --commit X --yes   revierte un commit con un commit nuevo y lo despliega
    validate             valida el LookML del dev de la API
    reset                resetea el dev de la API a produccion o al remoto

Ejemplos
    python looker_deploy.py doctor --deep
    python looker_deploy.py plan --map "C:/ruta/lookml/01_DM/INF_X=01_DM/INF_X" --file "C:/ruta/manifest.lkml=manifest.lkml"
    python looker_deploy.py ship --map "C:/ruta/lookml/01_DM/INF_X=01_DM/INF_X" -m "INF_X: ajustes" --yes

Codigos de salida: 0 ok o nada que desplegar; 1 error; 2 detenido por seguridad (lint, validacion,
cambios ajenos, confirmacion pendiente).
"""

import argparse
import base64
import configparser
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

DEFAULT_PROJECT = "BI"
HOME_DIR = Path(os.environ.get("LOOKER_DEPLOY_HOME", str(Path.home() / ".looker_deploy")))
ALLOWED_EXT = (".lkml", ".lookml", ".js", ".md", ".json", ".topojson")
EXCLUDED_DIRS = {".git", "node_modules", "__pycache__", ".equipo", "scratch"}

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


class Abort(Exception):
    """Detiene la ejecucion de forma controlada."""

    def __init__(self, msg, code=2):
        super().__init__(msg)
        self.code = code


def say(msg=""):
    print(msg, flush=True)


# --------------------------------------------------------------------------- config / API

def load_config(ini_path=None):
    base = os.environ.get("LOOKER_BASE_URL", "")
    cid = os.environ.get("LOOKER_CLIENT_ID", "")
    sec = os.environ.get("LOOKER_CLIENT_SECRET", "")
    ini = ini_path or os.environ.get("LOOKERSDK_INI")
    if not (base and cid and sec) and ini and Path(ini).exists():
        cp = configparser.ConfigParser()
        cp.read(ini, encoding="utf-8")
        sect = cp["Looker"] if "Looker" in cp else cp[cp.sections()[0]]
        base = base or sect.get("base_url", "")
        cid = cid or sect.get("client_id", "")
        sec = sec or sect.get("client_secret", "")
    if not base:  # respaldo: la URL no es secreta y ya vive en la config del MCP de Looker
        try:
            cj = json.loads((Path.home() / ".claude.json").read_text(encoding="utf-8"))
            base = cj["mcpServers"]["looker"]["env"]["LOOKER_BASE_URL"]
        except Exception:
            pass
    missing = [n for n, v in (("LOOKER_BASE_URL", base), ("LOOKER_CLIENT_ID", cid),
                              ("LOOKER_CLIENT_SECRET", sec)) if not v]
    if missing:
        raise Abort("Faltan variables de entorno: " + ", ".join(missing) +
                    " (o pasa --ini con un looker.ini). Si las definiste hace poco, abre una consola nueva.", 1)
    base = re.sub(r"/api/\d+(\.\d+)?/?$", "", base.rstrip("/"))
    return {"base": base, "client_id": cid, "client_secret": sec}


class ApiError(Exception):
    def __init__(self, status, body, method, path):
        super().__init__(f"{method} {path} -> HTTP {status}: {str(body)[:400]}")
        self.status, self.body = status, str(body)


class Looker:
    def __init__(self, cfg):
        self.cfg, self.token, self.workspace = cfg, None, None

    def login(self):
        data = urllib.parse.urlencode({"client_id": self.cfg["client_id"],
                                       "client_secret": self.cfg["client_secret"]}).encode()
        rq = urllib.request.Request(self.cfg["base"] + "/api/4.0/login", data=data, method="POST")
        try:
            with urllib.request.urlopen(rq, timeout=60) as r:
                self.token = json.loads(r.read())["access_token"]
        except urllib.error.HTTPError as e:
            hint = " (claves invalidas o revocadas)" if e.code in (401, 404) else ""
            raise Abort(f"Login en Looker fallo: HTTP {e.code}{hint}", 1)
        if self.workspace:  # el token nuevo vuelve a produccion: restituir
            self.set_workspace(self.workspace)

    def _req(self, method, path, body=None, query=None, timeout=120):
        if not self.token:
            self.login()
        url = self.cfg["base"] + "/api/4.0" + path + ("?" + urllib.parse.urlencode(query) if query else "")
        data = json.dumps(body).encode() if body is not None else None
        for attempt in range(4):
            headers = {"Accept": "application/json", "Authorization": "token " + self.token}
            if data is not None:
                headers["Content-Type"] = "application/json"
            try:
                with urllib.request.urlopen(urllib.request.Request(url, data=data, method=method, headers=headers),
                                            timeout=timeout) as r:
                    raw = r.read()
                    if not raw:
                        return None
                    try:
                        return json.loads(raw)
                    except ValueError:
                        return raw.decode("utf-8", "replace")
            except urllib.error.HTTPError as e:
                raw = e.read().decode("utf-8", "replace")
                if e.code == 401 and attempt < 3:
                    self.login()
                    continue
                if e.code in (429, 502, 503, 504) and attempt < 3:
                    time.sleep(2 ** attempt)
                    continue
                raise ApiError(e.code, raw, method, path)
            except (urllib.error.URLError, TimeoutError):
                if method == "GET" and attempt < 3:
                    time.sleep(2 ** attempt)
                    continue
                raise
        raise ApiError(0, "reintentos agotados", method, path)

    # sesion / proyecto
    def me(self):
        return self._req("GET", "/user")

    def set_workspace(self, ws):
        self._req("PATCH", "/session", {"workspace_id": ws})
        self.workspace = ws

    def project(self, pid):
        return self._req("GET", f"/projects/{pid}")

    def git_branch(self, pid):
        return self._req("GET", f"/projects/{pid}/git_branch")

    def git_branches(self, pid):
        return self._req("GET", f"/projects/{pid}/git_branches") or []

    def create_branch(self, pid, name, ref):
        return self._req("POST", f"/projects/{pid}/git_branch", {"name": name, "ref": ref})

    def checkout_branch(self, pid, name):
        return self._req("PUT", f"/projects/{pid}/git_branch", {"name": name})

    def delete_branch(self, pid, name):
        return self._req("DELETE", f"/projects/{pid}/git_branch/{urllib.parse.quote(name, safe='')}")

    def reset_to_remote(self, pid):
        return self._req("POST", f"/projects/{pid}/reset_to_remote")

    def reset_to_production(self, pid):
        return self._req("POST", f"/projects/{pid}/reset_to_production")

    def validate(self, pid):
        return self._req("POST", f"/projects/{pid}/validate", timeout=600) or {}

    def deploy_ref(self, pid, branch=None, ref=None):
        q = {k: v for k, v in (("branch", branch), ("ref", ref)) if v}
        return self._req("POST", f"/projects/{pid}/deploy_ref_to_production", query=q, timeout=600)

    def deploy_to_production(self, pid):
        return self._req("POST", f"/projects/{pid}/deploy_to_production", timeout=600)

    def permissions(self):
        uid = self.me().get("id")
        roles = self._req("GET", f"/users/{uid}/roles", query={"direct_association_only": "false"}) or []
        perms = set()
        for r in roles:
            perms.update((r.get("permission_set") or {}).get("permissions") or [])
        return perms


# --------------------------------------------------------------------------- git

class GitError(Exception):
    pass


class Git:
    def __init__(self, repo, token=None, name=None, email=None):
        self.repo = Path(repo)
        self.token = token
        self.base = ["git"]
        if token:
            b64 = base64.b64encode(f"x-access-token:{token}".encode()).decode()
            self.base += ["-c", f"http.extraheader=Authorization: Basic {b64}"]
        if name and email:
            self.base += ["-c", f"user.name={name}", "-c", f"user.email={email}"]
        self.base += ["-c", "commit.gpgsign=false", "-c", "core.autocrlf=false", "-c", "core.safecrlf=false"]
        self.env = dict(os.environ, GIT_TERMINAL_PROMPT="0")

    def run(self, *args, check=True, cwd=True, binary=False):
        p = subprocess.run(self.base + list(args), cwd=str(self.repo) if cwd else None,
                           capture_output=True, env=self.env)
        out = p.stdout if binary else p.stdout.decode("utf-8", "replace")
        err = p.stderr.decode("utf-8", "replace")
        if check and p.returncode != 0:
            if self.token:
                err = err.replace(self.token, "***")
            raise GitError(f"git {' '.join(args[:3])} fallo ({p.returncode}): {err.strip()[:600]}")
        return p.returncode, out, err

    def ensure_clone(self, url):
        if not (self.repo / ".git").exists():
            self.repo.parent.mkdir(parents=True, exist_ok=True)
            say(f"[git] clonando {url} (solo la primera vez)...")
            self.run("clone", "--quiet", url, str(self.repo), cwd=False)
        else:
            self.run("remote", "set-url", "origin", url)

    def fetch(self):
        self.run("fetch", "--quiet", "--prune", "origin")

    def tree(self, ref):
        """{ruta: blob_sha} de todo el arbol de `ref`."""
        _, out, _ = self.run("ls-tree", "-r", "-z", ref)
        res = {}
        for ent in out.split("\0"):
            if ent:
                meta, path = ent.split("\t", 1)
                res[path] = meta.split()[2]
        return res

    def fresh_checkout(self, ref):
        self.run("checkout", "--quiet", "-f", "-B", "work", ref)
        self.run("clean", "-fdxq")

    def rev(self, ref):
        return self.run("rev-parse", ref)[1].strip()


def blob_sha(data: bytes) -> str:
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


# --------------------------------------------------------------------------- archivos locales, lint

def normalize(data: bytes) -> bytes:
    if data.startswith(b"\xef\xbb\xbf"):
        data = data[3:]
    return data.replace(b"\r\n", b"\n")


def parse_pair(spec, what):
    if "=" not in spec:
        raise Abort(f"{what} debe ser LOCAL=REMOTO (recibido: {spec})", 1)
    a, b = spec.rsplit("=", 1)
    return a.strip().strip('"'), b.strip().strip("/")


def collect_local(maps, files):
    """-> (dict ruta_remota -> bytes normalizados, lista de carpetas destino)."""
    out, dests = {}, []
    for spec in maps or []:
        src, dest = parse_pair(spec, "--map")
        src = Path(src)
        if not src.is_dir():
            raise Abort(f"--map: carpeta inexistente: {src}", 1)
        dests.append(dest)
        for p in sorted(src.rglob("*")):
            if (p.is_file() and p.suffix.lower() in ALLOWED_EXT
                    and not (set(p.relative_to(src).parts[:-1]) & EXCLUDED_DIRS)):
                rel = p.relative_to(src).as_posix()
                out[f"{dest}/{rel}" if dest else rel] = normalize(p.read_bytes())
    for spec in files or []:
        local, remote = parse_pair(spec, "--file")
        if not Path(local).is_file():
            raise Abort(f"--file: archivo inexistente: {local}", 1)
        out[remote] = normalize(Path(local).read_bytes())
    if not out:
        raise Abort("No hay archivos: usa --map LOCAL=REMOTO y/o --file LOCAL=REMOTO.", 1)
    return out, dests


def lint(local):
    """Trampas conocidas (references/11_trampas_y_lecciones.md). -> (errores, avisos)."""
    errors, warns = [], []
    try:
        import yaml
    except ImportError:
        yaml = None
        warns.append("PyYAML no instalado: no se valida el YAML de los dashboards (pip install pyyaml)")
    for path, data in sorted(local.items()):
        text = data.decode("utf-8", "replace")
        if path.endswith(".file.lkml"):
            errors.append(f"{path}: extension .file.lkml (se creo con type 'file'; usa view/model/dashboard)")
        if path.endswith((".lkml", ".lookml")):
            for i, line in enumerate(text.split("\n"), 1):
                if re.match(r"\s*label_short\s*:", line):
                    errors.append(f"{path}:{i}: 'label_short' no existe en LookML (rompe el deploy)")
                if re.search(r"orden_por_posicion\s*:\s*[0-9]+\s*,", line):
                    warns.append(f"{path}:{i}: lista separada por comas sin comillas (se parsea como numero)")
                if re.search(r"""['"]?NOT NULL['"]?\s*$""", line) and "filter" in line.lower():
                    warns.append(f"{path}:{i}: usa '-NULL' en vez de 'NOT NULL' en filtros")
        if path.endswith(".dashboard.lookml"):
            if "\t" in text:
                errors.append(f"{path}: contiene tabulaciones (invalido en YAML)")
            if yaml:
                try:
                    yaml.safe_load(text)
                except Exception as e:
                    errors.append(f"{path}: YAML invalido: {str(e).splitlines()[0]}")
        if path.endswith("manifest.lkml") and re.search(r'file\s*:\s*"/', text):
            errors.append(f"{path}: 'file:' con '/' inicial (rompe TODOS los modelos)")
    return errors, warns


# --------------------------------------------------------------------------- plan

STATE_FILE = "state.json"


def project_dir(pid):
    d = HOME_DIR / pid
    d.mkdir(parents=True, exist_ok=True)
    return d


def load_state(pid):
    p = project_dir(pid) / STATE_FILE
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {"files": {}}


def save_state(pid, state):
    (project_dir(pid) / STATE_FILE).write_text(json.dumps(state, indent=1, sort_keys=True), encoding="utf-8")


def log_event(pid, **ev):
    ev["at"] = datetime.now().isoformat(timespec="seconds")
    with open(project_dir(pid) / "deploy.log.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps(ev, ensure_ascii=False) + "\n")


def compute_plan(local, dests, tree, state, delete_missing):
    plan = {"add": [], "mod": [], "del": [], "same": [], "foreign": [], "nobase": []}
    for path, data in sorted(local.items()):
        h = blob_sha(data)
        rh = tree.get(path)
        if rh is None:
            plan["add"].append(path)
        elif rh == h:
            plan["same"].append(path)
        else:
            plan["mod"].append(path)
            known = state["files"].get(path)
            if known is None:
                plan["nobase"].append(path)
            elif known != rh:
                plan["foreign"].append(path)  # alguien cambio el archivo despues de tu ultimo deploy
    if delete_missing:
        for d in dests:
            if not d:
                raise Abort("--delete-missing exige --map con carpeta destino no vacia.", 1)
            for path in tree:
                if path.startswith(d + "/") and path.endswith(ALLOWED_EXT) and path not in local:
                    plan["del"].append(path)
    return plan


def print_plan(plan):
    say(f"Plan: +{len(plan['add'])} nuevos, ~{len(plan['mod'])} modificados, -{len(plan['del'])} borrados, "
        f"{len(plan['same'])} sin cambios")
    for tag, key in (("+", "add"), ("~", "mod"), ("-", "del")):
        for p in plan[key][:40]:
            say(f"  {tag} {p}")
        if len(plan[key]) > 40:
            say(f"  {tag} ... y {len(plan[key]) - 40} mas")
    if plan["foreign"]:
        say("\nATENCION: estos archivos cambiaron en el remoto DESPUES de tu ultimo deploy con esta herramienta "
            "(alguien mas los toco). Sobrescribirlos borraria ese trabajo:")
        for p in plan["foreign"]:
            say(f"  ! {p}")
    shared = [p for p in plan["mod"] + plan["del"] if p.endswith("manifest.lkml")]
    if shared:
        say("\nPELIGRO: el manifest.lkml es COMPARTIDO por todos los equipos. Una copia local desactualizada "
            "borra sus visualizaciones. Haz diff contra produccion y sube solo tus bloques, o no lo subas:")
        for p in shared:
            say(f"  !! {p}")
    if plan["nobase"]:
        say(f"\nAviso: {len(plan['nobase'])} archivos modificados no tienen historial local (primer deploy); "
            "revisa el diff si dudas.")


# --------------------------------------------------------------------------- contexto comun

class Ctx:
    pass


def make_ctx(args):
    ctx = Ctx()
    ctx.args = args
    ctx.pid = args.project
    ctx.api = Looker(load_config(args.ini))
    ctx.api.login()
    ctx.proj = ctx.api.project(ctx.pid)
    ctx.prod = ctx.proj.get("git_production_branch_name") or "master"
    ctx.url = args.remote or ctx.proj.get("git_remote_url")
    if not ctx.url:
        raise Abort(f"El proyecto {ctx.pid} no tiene git_remote_url; usa --remote.", 1)
    me = ctx.api.me()
    name = os.environ.get("LOOKER_GIT_NAME") or me.get("display_name") or "Looker Deploy"
    email = os.environ.get("LOOKER_GIT_EMAIL") or me.get("email") or "looker-deploy@localhost"
    ctx.ident = (name, email)
    ctx.git = Git(project_dir(ctx.pid) / "repo", os.environ.get("LOOKER_GIT_TOKEN"), name, email)
    ctx.git.ensure_clone(ctx.url)
    return ctx


def push_branch(ctx, branch, sha):
    ctx.git.run("push", "--force", "origin", f"{sha}:refs/heads/{branch}")


def drop_remote_branch(ctx, branch):
    ctx.git.run("push", "origin", "--delete", branch, check=False)


def dev_checkout(ctx, branch, sha):
    """Deja el dev de la API en la rama temporal. Devuelve el nombre de la rama dev previa."""
    api = ctx.api
    api.set_workspace("dev")
    prev = (api.git_branch(ctx.pid) or {}).get("name")
    try:
        api.git_branches(ctx.pid)  # refresca la lista de ramas remotas de Looker
    except ApiError:
        pass
    # La rama ya existe en el remoto (la acabamos de subir): lo normal es hacerle checkout, no crearla.
    attempts = (
        ("checkout", lambda: api.checkout_branch(ctx.pid, branch)),
        ("checkout+ref", lambda: api._req("PUT", f"/projects/{ctx.pid}/git_branch",
                                           {"name": branch, "ref": f"origin/{branch}"})),
        ("crear desde sha", lambda: api.create_branch(ctx.pid, branch, sha)),
    )
    errs = []
    for label, fn in attempts:
        try:
            fn()
            cur = (api.git_branch(ctx.pid) or {}).get("name")
            if cur == branch:
                return prev
            errs.append(f"{label}: respondio OK pero la rama activa es '{cur}'")
        except ApiError as e:
            errs.append(f"{label}: {e}")
    raise Abort(f"No pude dejar el dev de Looker en la rama '{branch}':\n  " + "\n  ".join(errs), 1)


def dev_restore(ctx, branch, prev):
    api = ctx.api
    try:
        api.set_workspace("dev")
        if prev and prev != branch:
            api.checkout_branch(ctx.pid, prev)
        api.delete_branch(ctx.pid, branch)
    except Exception as e:  # limpieza best-effort
        say(f"[aviso] no pude limpiar la rama dev temporal '{branch}': {e}")


def validate_branch(ctx, changed, allow_foreign):
    say("[looker] validando LookML...")
    ctx.api.set_workspace("dev")
    v = ctx.api.validate(ctx.pid)
    errs = [e for e in (v.get("errors") or []) if e.get("severity") in (None, "error")]
    mine = [e for e in errs if e.get("file_path") in changed]
    foreign = [e for e in errs if e.get("file_path") not in changed]

    def show(title, lst):
        say(title)
        for e in lst[:15]:
            say(f"  - {e.get('file_path') or 'general'}:{e.get('line_number') or ''} {e.get('message')}")
        if len(lst) > 15:
            say(f"  ... y {len(lst) - 15} mas")

    if mine:
        show(f"[ERROR] {len(mine)} errores en archivos de este deploy:", mine)
        raise Abort("Validacion con errores propios: corrige y reintenta (no se despliega).", 2)
    if foreign:
        show(f"[AVISO] {len(foreign)} errores en archivos AJENOS (otros equipos):", foreign)
        if not allow_foreign:
            raise Abort("Hay errores ajenos. La skill exige reportarlos al usuario antes de desplegar; "
                        "si el usuario autoriza, repite con --ignore-foreign-errors.", 2)
    else:
        say("[OK] validacion sin errores.")


def verify_prod(ctx, sha, wait=90):
    deadline = time.time() + wait
    while True:
        ctx.api.set_workspace("production")
        ref = (ctx.api.git_branch(ctx.pid) or {}).get("ref") or ""
        ctx.git.fetch()
        remote = ctx.git.rev(f"origin/{ctx.prod}")
        if ref.startswith(sha[:12]) or ref == sha or remote == sha:
            return ref or remote
        if time.time() > deadline:
            raise Abort(f"Produccion no quedo en {sha[:10]} (Looker={ref[:10]}, remoto={remote[:10]}).", 1)
        time.sleep(5)


STALE_HINTS = ("fast", "behind", "merge", "diverg", "out of date", "up to date", "stale", "conflict")


def publish(ctx, build, label, allow_foreign):
    """Ciclo completo con reintentos: base fresca -> build -> push -> validar -> deploy -> verificar."""
    last_stale = None
    for attempt in range(1, ctx.args.retries + 1):
        ctx.git.fetch()
        ctx.git.fresh_checkout(f"origin/{ctx.prod}")
        base = ctx.git.rev("HEAD")
        built = build(ctx.git)
        if built is None:
            say("[OK] No hay diferencias contra produccion: nada que desplegar.")
            return None
        sha, changed = built
        branch = "claude-deploy-" + datetime.now().strftime("%Y%m%d-%H%M%S")
        say(f"[git] intento {attempt}/{ctx.args.retries}: commit {sha[:10]} sobre {ctx.prod}@{base[:10]}")
        push_branch(ctx, branch, sha)
        prev = None
        try:
            prev = dev_checkout(ctx, branch, sha)
            validate_branch(ctx, changed, allow_foreign)
            say(f"[looker] desplegando {sha[:10]} a produccion...")
            try:
                ctx.api.set_workspace("dev")
                tried = []
                for label, fn in (
                        # verificado en vivo (2026-10-23): deploy_to_production funciona; deploy_ref_* dio 404
                        ("deploy_to_production", lambda: ctx.api.deploy_to_production(ctx.pid)),
                        ("deploy_ref(branch)", lambda: ctx.api.deploy_ref(ctx.pid, branch=branch)),
                        ("deploy_ref(ref)", lambda: ctx.api.deploy_ref(ctx.pid, ref=sha))):
                    try:
                        fn()
                        say(f"[looker] deploy con {label}")
                        break
                    except ApiError as e:
                        if e.status not in (404, 422):
                            raise
                        tried.append(f"{label}: {e}")
                else:
                    raise Abort("Ningun metodo de deploy funciono:\n  " + "\n  ".join(tried), 1)
            except ApiError as e:
                if e.status in (400, 409, 422, 500) and any(h in e.body.lower() for h in STALE_HINTS):
                    last_stale = e
                    say(f"[aviso] produccion avanzo mientras desplegabamos ({e.status}); repito sobre la nueva base...")
                    continue
                raise Abort(f"El deploy fallo: {e}", 1)
        finally:
            dev_restore(ctx, branch, prev)
            if not ctx.args.keep_branch:
                drop_remote_branch(ctx, branch)
        ref = verify_prod(ctx, sha)
        say(f"[EXITO] produccion en {ref[:10]} (commit {sha[:10]}).")
        log_event(ctx.pid, action=label, sha=sha, changed=sorted(changed))
        return sha, changed
    raise Abort(f"No se logro desplegar tras {ctx.args.retries} intentos (produccion no deja de avanzar): {last_stale}", 1)


# --------------------------------------------------------------------------- comandos

def local_from_args(args):
    local, dests = collect_local(args.map, args.file)
    errors, warns = lint(local)
    for w in warns:
        say(f"[lint aviso] {w}")
    if errors:
        for e in errors:
            say(f"[lint ERROR] {e}")
        raise Abort(f"Lint: {len(errors)} errores en los archivos locales. Corrigelos antes de subir.", 2)
    return local, dests


def cmd_lint(args):
    local_from_args(args)
    say("[OK] lint sin errores.")


def prepare_plan(ctx, local, dests):
    ctx.git.fetch()
    tree = ctx.git.tree(f"origin/{ctx.prod}")
    plan = compute_plan(local, dests, tree, load_state(ctx.pid), ctx.args.delete_missing)
    print_plan(plan)
    return plan


def cmd_plan(args):
    local, dests = local_from_args(args)
    ctx = make_ctx(args)
    say(f"Proyecto {ctx.pid} | produccion = {ctx.prod} | commits como {ctx.ident[0]} <{ctx.ident[1]}>")
    prepare_plan(ctx, local, dests)


def cmd_ship(args):
    local, dests = local_from_args(args)
    ctx = make_ctx(args)
    say(f"Proyecto {ctx.pid} | produccion = {ctx.prod} | commits como {ctx.ident[0]} <{ctx.ident[1]}>")
    plan = prepare_plan(ctx, local, dests)
    if not (plan["add"] or plan["mod"] or plan["del"]):
        say("[OK] Nada que desplegar.")
        return
    if any(p.endswith("manifest.lkml") for p in plan["mod"] + plan["del"]) and not args.force_overwrite:
        raise Abort("El plan modifica manifest.lkml (archivo compartido). Quita el --file del manifest o, tras "
                    "revisar el diff, repite con --force-overwrite.", 2)
    if plan["foreign"] and not args.force_overwrite:
        raise Abort("Hay archivos con cambios ajenos. Revisalos; si el usuario autoriza sobrescribir, "
                    "repite con --force-overwrite.", 2)
    if not args.yes:
        raise Abort("Dry-run: nada se subio. El deploy requiere autorizacion explicita: repite con --yes.", 2)
    msg = args.message or "Actualizacion LookML via looker_deploy.py"

    def build(git):
        tree = git.tree("HEAD")
        p = compute_plan(local, dests, tree, {"files": {}}, args.delete_missing)
        if not (p["add"] or p["mod"] or p["del"]):
            return None
        for path in p["add"] + p["mod"]:
            f = git.repo / path
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_bytes(local[path])
        for path in p["del"]:
            (git.repo / path).unlink(missing_ok=True)
        git.run("add", "-A")
        git.run("commit", "--quiet", "-m", msg)
        return git.rev("HEAD"), set(p["add"] + p["mod"] + p["del"])

    res = publish(ctx, build, "ship", args.ignore_foreign_errors)
    if res:
        state = load_state(ctx.pid)
        for path in local:
            state["files"][path] = blob_sha(local[path])
        for path in plan["del"]:
            state["files"].pop(path, None)
        state["last_sha"], state["last_at"] = res[0], datetime.now().isoformat(timespec="seconds")
        save_state(ctx.pid, state)


def cmd_rollback(args):
    ctx = make_ctx(args)
    if not args.yes:
        raise Abort("Rollback requiere autorizacion explicita: repite con --yes.", 2)

    def build(git):
        git.run("revert", "--no-edit", args.commit)
        sha = git.rev("HEAD")
        _, out, _ = git.run("diff", "--name-only", "HEAD~1", "HEAD")
        return sha, {x for x in out.split("\n") if x}

    res = publish(ctx, build, f"rollback {args.commit}", args.ignore_foreign_errors)
    if res:
        st = load_state(ctx.pid)
        st["files"] = {}  # el baseline cambio: se reconstruye en el proximo ship
        save_state(ctx.pid, st)


def cmd_validate(args):
    api = Looker(load_config(args.ini))
    api.login()
    api.set_workspace("dev")
    v = api.validate(args.project)
    errs = [e for e in (v.get("errors") or []) if e.get("severity") in (None, "error")]
    say(f"[looker] {len(errs)} errores de validacion en el dev de la API.")
    for e in errs[:20]:
        say(f"  - {e.get('file_path')}:{e.get('line_number')} {e.get('message')}")
    if errs:
        raise Abort("Validacion con errores.", 2)


def cmd_reset(args):
    api = Looker(load_config(args.ini))
    api.login()
    api.set_workspace("dev")
    (api.reset_to_remote if args.to_remote else api.reset_to_production)(args.project)
    say("[OK] dev de la API reseteado " + ("al remoto." if args.to_remote else "a produccion."))


def cmd_status(args):
    ctx = make_ctx(args)
    api = ctx.api
    me = api.me()
    say(f"[Looker] {ctx.api.cfg['base']} | API key de {me.get('display_name')} ({me.get('email')})")
    api.set_workspace("production")
    pb = api.git_branch(ctx.pid) or {}
    ctx.git.fetch()
    say(f"\nProduccion: {pb.get('name')} @ {(pb.get('ref') or '')[:10]}")
    say(f"Remoto:     origin/{ctx.prod} @ {ctx.git.rev('origin/' + ctx.prod)[:10]}  ({ctx.url})")
    api.set_workspace("dev")
    db = api.git_branch(ctx.pid) or {}
    say(f"Dev (API):  {db.get('name')} @ {(db.get('ref') or '')[:10]}  "
        f"+{db.get('ahead_count') or 0}/-{db.get('behind_count') or 0}  {db.get('error') or ''}")
    st = load_state(ctx.pid)
    say(f"Ultimo deploy con esta herramienta: {st.get('last_sha', '-')[:10]} ({st.get('last_at', '-')})")


def cmd_doctor(args):
    ok = True

    def check(label, fn):
        nonlocal ok
        try:
            res = fn()
            say(f"[OK]   {label}" + (f": {res}" if res else ""))
            return True
        except Exception as e:
            ok = False
            say(f"[FALLA] {label}: {e}")
            return False

    if shutil.which("git") is None:
        raise Abort("git no esta instalado o no esta en el PATH.", 1)
    say(f"Python {sys.version.split()[0]} | git OK | datos en {HOME_DIR}")
    ctx = {}
    check("Credenciales + login", lambda: (ctx.update(api=Looker(load_config(args.ini))), ctx["api"].login()) and None)
    if "api" not in ctx:
        raise Abort("Sin login no se puede seguir.", 1)
    api = ctx["api"]
    check("Usuario de la API key", lambda: (lambda m: f"{m.get('display_name')} <{m.get('email')}>")(api.me()))

    def perms():
        p = api.permissions()
        missing = [x for x in ("develop", "deploy") if x not in p]
        if missing:
            raise Abort("faltan permisos de Looker: " + ", ".join(missing), 1)
        return "develop + deploy"

    check("Permisos (develop, deploy)", perms)
    proj = {}
    check(f"Proyecto {args.project}", lambda: proj.update(api.project(args.project)) or
          f"{proj.get('git_remote_url')} (prod: {proj.get('git_production_branch_name')})")
    url = args.remote or proj.get("git_remote_url")
    if url:
        g = Git(project_dir(args.project) / "repo", os.environ.get("LOOKER_GIT_TOKEN"))
        check("Acceso git al remoto (lectura)", lambda: g.run("ls-remote", "--heads", url, cwd=False)[1].count("\n")
              and "ok")
    check("PyYAML (lint de dashboards)", lambda: __import__("yaml").__name__)
    if args.deep and ok:
        say("\n--- Prueba profunda (no toca produccion): rama temporal -> push -> dev -> validate -> limpieza ---")
        args.retries = 1
        try:
            cx = make_ctx(args)
            cx.git.fetch()
            cx.git.fresh_checkout(f"origin/{cx.prod}")
            branch = "claude-doctor-" + datetime.now().strftime("%Y%m%d-%H%M%S")
            sha = cx.git.rev("HEAD")
            push_branch(cx, branch, sha)
            say(f"[OK]   push de rama temporal {branch}")
            prev = None
            try:
                prev = dev_checkout(cx, branch, sha)
                say("[OK]   Looker creo la rama dev desde el remoto")
                v = cx.api.validate(cx.pid)
                say(f"[OK]   validate ejecutado ({len(v.get('errors') or [])} mensajes en todo el proyecto)")
            finally:
                dev_restore(cx, branch, prev)
                drop_remote_branch(cx, branch)
                say("[OK]   limpieza (rama dev y remota borradas)")
        except Exception as e:
            ok = False
            say(f"[FALLA] prueba profunda: {e}")
    say("\n" + ("Todo listo." if ok else "Hay fallas: corrigelas antes de usar 'ship'."))
    if not ok:
        raise Abort("doctor con fallas", 1)


def main():
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--project", default=DEFAULT_PROJECT, help=f"ID del proyecto Looker (default {DEFAULT_PROJECT})")
    common.add_argument("--ini", help="looker.ini alternativo (por defecto se usan las variables de entorno)")
    common.add_argument("--remote", help="URL git del repo (por defecto la del proyecto en Looker)")
    common.add_argument("--retries", type=int, default=4, help="reintentos si produccion avanza (default 4)")
    common.add_argument("--keep-branch", action="store_true", help="no borrar la rama temporal remota")

    src = argparse.ArgumentParser(add_help=False)
    src.add_argument("--map", action="append", metavar="LOCAL=REMOTO",
                     help="carpeta local = carpeta en el repo (repetible). Ej: C:/x/lookml/01_DM/INF=01_DM/INF")
    src.add_argument("--file", action="append", metavar="LOCAL=REMOTO", help="archivo suelto (ej: manifest.lkml)")
    src.add_argument("--delete-missing", action="store_true",
                     help="borrar en el repo lo que ya no existe localmente (solo dentro de las carpetas --map)")

    ap = argparse.ArgumentParser(description="Aplicar y desplegar cambios de Looker por git + API publica.",
                                 formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__.split("Comandos")[1])
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("doctor", parents=[common], help="diagnostico de requisitos")
    p.add_argument("--deep", action="store_true", help="prueba el circuito completo sin tocar produccion")
    sub.add_parser("status", parents=[common], help="estado de produccion/remoto/dev")
    sub.add_parser("lint", parents=[common, src], help="reglas locales")
    sub.add_parser("plan", parents=[common, src], help="que cambiaria (no escribe nada)")
    p = sub.add_parser("ship", parents=[common, src], help="commit + validar + deploy + verificar")
    p.add_argument("-m", "--message", help="mensaje de commit")
    p.add_argument("--yes", action="store_true", help="autorizacion explicita del usuario para desplegar")
    p.add_argument("--force-overwrite", action="store_true", help="sobrescribir archivos con cambios ajenos")
    p.add_argument("--ignore-foreign-errors", action="store_true", help="desplegar aunque haya errores en archivos ajenos")
    p = sub.add_parser("rollback", parents=[common], help="revertir un commit y desplegar")
    p.add_argument("--commit", required=True)
    p.add_argument("--yes", action="store_true")
    p.add_argument("--ignore-foreign-errors", action="store_true")
    sub.add_parser("validate", parents=[common], help="validar el dev de la API")
    p = sub.add_parser("reset", parents=[common], help="resetear el dev de la API")
    p.add_argument("--to-remote", action="store_true", help="al remoto (default: a produccion)")

    args = ap.parse_args()
    try:
        {"doctor": cmd_doctor, "status": cmd_status, "lint": cmd_lint, "plan": cmd_plan, "ship": cmd_ship,
         "rollback": cmd_rollback, "validate": cmd_validate, "reset": cmd_reset}[args.cmd](args)
    except Abort as e:
        say(f"\n[DETENIDO] {e}")
        sys.exit(e.code)
    except (ApiError, GitError, urllib.error.URLError) as e:
        say(f"\n[ERROR] {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
