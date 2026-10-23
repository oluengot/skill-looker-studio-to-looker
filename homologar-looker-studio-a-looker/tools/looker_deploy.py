#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Herramienta de automatización de despliegue en Looker via Looker SDK (API 4.0).

Uso:
    python tools/looker_deploy.py status   [--project BI]
    python tools/looker_deploy.py validate [--project BI]
    python tools/looker_deploy.py deploy   [--project BI] [--branch main] [--ref <commit>]
    python tools/looker_deploy.py reset    [--project BI] [--to-remote | --to-production]
"""

import argparse
import os
import sys

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_SCRIPT_DIR)
_AUTO_INI = os.path.join(_PROJECT_ROOT, "Credenciales", "looker.ini")
DEFAULT_INI = os.environ.get("LOOKERSDK_INI", _AUTO_INI if os.path.exists(_AUTO_INI) else r"F:\Mi unidad\Credenciales\looker.ini")
DEFAULT_PROJECT = "BI"


def get_sdk(ini_path=DEFAULT_INI):
    """Inicializa el cliente de Looker SDK 4.0."""
    try:
        import looker_sdk
    except ImportError:
        print("[ERROR] El paquete 'looker-sdk' no está instalado. Ejecuta: pip install looker-sdk", file=sys.stderr)
        sys.exit(1)

    if not os.path.exists(ini_path):
        print(f"[ERROR] Archivo de configuración no encontrado: {ini_path}", file=sys.stderr)
        sys.exit(1)

    return looker_sdk.init40(config_file=ini_path)


def cmd_status(sdk, project_id):
    """Muestra el estado de la conexión, usuario, ramas Git y estado del proyecto."""
    from looker_sdk import models40

    user = sdk.me()
    print(f"[Looker] Conectado como: {user.display_name} ({user.email})")

    # Estado en Producción
    sdk.update_session(models40.WriteApiSession(workspace_id="production"))
    proj = sdk.project(project_id)
    prod_branch = sdk.git_branch(project_id)

    print(f"\n--- Proyecto '{project_id}' (Producción) ---")
    print(f"  Git Remote:   {proj.git_remote_url}")
    print(f"  Branch Prod:  {prod_branch.name}")
    print(f"  Commit Ref:   {prod_branch.ref}")

    # Estado en Modo Desarrollo
    sdk.update_session(models40.WriteApiSession(workspace_id="dev"))
    dev_branch = sdk.git_branch(project_id)
    print(f"\n--- Modo Desarrollo (Workspace 'dev') ---")
    print(f"  Rama Dev:     {dev_branch.name}")
    print(f"  Commit Ref:   {dev_branch.ref}")
    ahead = dev_branch.ahead_count or 0
    behind = dev_branch.behind_count or 0
    print(f"  Sincronización: {ahead} commits adelante / {behind} commits atrás de producción")

    if dev_branch.error:
        print(f"  [ALERTA Git]: {dev_branch.error}")


def cmd_validate(sdk, project_id):
    """Ejecuta la validación de LookML en el proyecto dentro de Modo Desarrollo."""
    from looker_sdk import models40

    sdk.update_session(models40.WriteApiSession(workspace_id="dev"))
    print(f"[Looker] Validando LookML en el proyecto '{project_id}'...")

    val = sdk.validate_project(project_id)
    errors = val.errors or []

    if not errors:
        print("[OK] LookML validado sin errores. Listo para desplegar.")
        return True

    print(f"[AVISO] Se detectaron {len(errors)} alertas/errores en la validación:")
    for i, err in enumerate(errors[:10], start=1):
        pos = f"{err.file_path}:{err.line_number}" if err.file_path else "general"
        print(f"  {i}. {err.message} ({pos})")

    if len(errors) > 10:
        print(f"  ... y {len(errors) - 10} más.")
    return False


def cmd_deploy(sdk, project_id, branch=None, ref=None):
    """Despliega a producción el proyecto especificado."""
    from looker_sdk import models40

    # Looker API requiere sesión en 'dev' para invocar deploy_to_production
    sdk.update_session(models40.WriteApiSession(workspace_id="dev"))

    if ref or branch:
        target = ref or f"branch '{branch}'"
        print(f"[Looker] Desplegando ref específico ({target}) a producción en '{project_id}'...")
        res = sdk.deploy_ref_to_production(project_id=project_id, branch=branch, ref=ref)
    else:
        print(f"[Looker] Desplegando cambios a producción en '{project_id}'...")
        res = sdk.deploy_to_production(project_id=project_id)

    # Verificar producción tras despliegue
    sdk.update_session(models40.WriteApiSession(workspace_id="production"))
    prod_branch = sdk.git_branch(project_id)

    print("[EXITO] Proyecto desplegado en Producción exitosamente.")
    print(f"  Rama Producción: {prod_branch.name}")
    print(f"  Nuevo Commit:    {prod_branch.ref}")
    if res:
        print(f"  Respuesta API:   {res}")


def cmd_reset(sdk, project_id, to_remote=False):
    """Resetea el espacio de desarrollo al estado de producción o al remoto de Git."""
    from looker_sdk import models40

    sdk.update_session(models40.WriteApiSession(workspace_id="dev"))

    if to_remote:
        print(f"[Looker] Reseteando espacio de desarrollo al remoto de Git...")
        res = sdk.reset_project_to_remote(project_id=project_id)
    else:
        print(f"[Looker] Reseteando espacio de desarrollo al estado de producción...")
        res = sdk.reset_project_to_production(project_id=project_id)

    print(f"[OK] Espacio de trabajo reseteado.")


def main():
    common_parser = argparse.ArgumentParser(add_help=False)
    common_parser.add_argument("--ini", default=DEFAULT_INI, help=f"Ruta a looker.ini (default: {DEFAULT_INI})")
    common_parser.add_argument("--project", default=DEFAULT_PROJECT, help=f"ID del proyecto Looker (default: {DEFAULT_PROJECT})")

    parser = argparse.ArgumentParser(
        description="Despliegue y validación automatizada de Looker via Looker SDK.",
        parents=[common_parser]
    )

    subparsers = parser.add_subparsers(dest="action", required=True)

    # Subcomando status
    subparsers.add_parser("status", parents=[common_parser], help="Muestra el estado de conexión y del proyecto")

    # Subcomando validate
    subparsers.add_parser("validate", parents=[common_parser], help="Valida el LookML del proyecto")

    # Subcomando deploy
    p_deploy = subparsers.add_parser("deploy", parents=[common_parser], help="Despliega a producción")
    p_deploy.add_argument("--branch", help="Nombre de rama remota a desplegar")
    p_deploy.add_argument("--ref", help="Commit hash específico a desplegar")

    # Subcomando reset
    p_reset = subparsers.add_parser("reset", parents=[common_parser], help="Resetea la rama de desarrollo")
    p_reset.add_argument("--to-remote", action="store_true", help="Resetear al remoto de Git en vez de Producción")

    args = parser.parse_args()

    sdk = get_sdk(args.ini)

    if args.action == "status":
        cmd_status(sdk, args.project)
    elif args.action == "validate":
        cmd_validate(sdk, args.project)
    elif args.action == "deploy":
        cmd_deploy(sdk, args.project, branch=args.branch, ref=args.ref)
    elif args.action == "reset":
        cmd_reset(sdk, args.project, to_remote=args.to_remote)


if __name__ == "__main__":
    main()
