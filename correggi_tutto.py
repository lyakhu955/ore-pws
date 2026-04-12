from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def run(mode: str) -> int:
    project_root = Path(__file__).resolve().parent
    fixer = project_root / "fix_mojibake.py"

    if not fixer.exists():
        print("❌ File non trovato: fix_mojibake.py")
        return 1

    cmd = [sys.executable, str(fixer)]
    if mode == "apply":
        cmd.append("--apply")

    print("=" * 72)
    print("CORREGGI TUTTO - AVVIO")
    print("=" * 72)
    print(f"Modalità: {mode.upper()}")
    print(f"Comando : {' '.join(cmd)}")
    print("-" * 72)

    completed = subprocess.run(cmd, cwd=str(project_root))
    return completed.returncode


def main() -> None:
    parser = argparse.ArgumentParser(
        description="One-shot: controlla o corregge tutti i file del progetto in una volta sola."
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Esegue solo controllo (dry-run), senza modificare file.",
    )
    args = parser.parse_args()

    mode = "check" if args.check else "apply"
    code = run(mode)
    raise SystemExit(code)


if __name__ == "__main__":
    main()
