from __future__ import annotations

import argparse
import re
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable

TARGET_EXTENSIONS = {".html", ".js", ".css", ".md", ".txt", ".json"}
EXCLUDED_DIRS = {
    ".git",
    ".vscode",
    ".mojibake_backup",
    "node_modules",
    "dist",
    "build",
    "icons",
    "audio",
    "templates",
}

SUSPICIOUS_PATTERN = re.compile(r"(�|Ã|Â|â€™|â€œ|â€\x9d|â€“|â€”|ðŸ|S�)")

EXACT_REPLACEMENTS: list[tuple[str, str]] = [
    ("gi�", "già"),
    ("Gi�", "Già"),
    ("gia�", "già"),
    ("Gia�", "Già"),
    ("perch�", "perché"),
    ("Perch�", "Perché"),
    ("luned�", "lunedì"),
    ("Luned�", "Lunedì"),
    ("marted�", "martedì"),
    ("Marted�", "Martedì"),
    ("mercoled�", "mercoledì"),
    ("Mercoled�", "Mercoledì"),
    ("gioved�", "giovedì"),
    ("Gioved�", "Giovedì"),
    ("venerd�", "venerdì"),
    ("Venerd�", "Venerdì"),
    ("sabato�", "sabato"),
    ("domenica�", "domenica"),
    ("festivit�", "festività"),
    ("Festivit�", "Festività"),
    ("modalit�", "modalità"),
    ("Modalit�", "Modalità"),
    ("funzionalit�", "funzionalità"),
    ("Funzionalit�", "Funzionalità"),
    ("compatibilit�", "compatibilità"),
    ("Compatibilit�", "Compatibilità"),
    ("flessibilit�", "flessibilità"),
    ("visibilit�", "visibilità"),
    ("priorit�", "priorità"),
    ("leggibilit�", "leggibilità"),
    ("utilit�", "utilità"),
    ("realt�", "realtà"),
    ("velocit�", "velocità"),
    ("densit�", "densità"),
    ("opacit�", "opacità"),
    ("Localit�", "Località"),
    ("FESTIVIT�", "FESTIVITÀ"),
    ("propriet�", "proprietà"),
    ("Propriet�", "Proprietà"),
    ("attivit�", "attività"),
    ("Attivit�", "Attività"),
    ("pi�", "più"),
    ("Pi�", "Più"),
    ("pu�", "può"),
    ("Pu�", "Può"),
    ("c'�", "c'è"),
    ("C'�", "C'è"),
    ("cos�", "così"),
    ("s�", "sì"),
    ("sar�", "sarà"),
    ("dovr�", "dovrà"),
    ("aprir�", "aprirà"),
    ("non �", "non è"),
    ("Non �", "Non è"),
    (" e � ", " e è "),
    ("Trasferta: S�", "Trasferta: Sì"),
    ("details.join(' � ')", "details.join(' • ')") ,
    ("`�${", "`€${"),
    (" = `�${", " = `€${"),
    ("�/h", "€/h"),
    ("holidayDay) || 0, // �/giorno", "holidayDay) || 0, // €/giorno"),
    ("Normale: �${", "Normale: €${"),
    ("Notturno: �${", "Notturno: €${"),
    ("Festivo: �${", "Festivo: €${"),
    ("Trasferta: �${", "Trasferta: €${"),
    ("Malattia: �${", "Malattia: €${"),
    ("Ferie: �${", "Ferie: €${"),
    ("IGP Brescia: �${", "IGP Brescia: €${"),
    ("Totale: �${", "Totale: €${"),
    ("â€™", "’"),
    ("â€œ", "“"),
    ("â€\x9d", "”"),
    ("â€“", "–"),
    ("â€”", "—"),
    ("â€¦", "…"),
    ("Â€", "€"),
    ("(?:-|�|fino|a)", "(?:-|–|fino|a)"),
    ("/attivit[�a]", "/attivit[àa]"),
]

REGEX_REPLACEMENTS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bS�\b"), "Sì"),
    (re.compile(r"S�(?=\$)"), "Sì"),
    (re.compile(r"\bE�\b"), "È"),
    (re.compile(r"\bsezione �\b"), "sezione è"),
    (re.compile(r"(?<=\s)�(?=[\s,.;:!?])"), "è"),
]


@dataclass
class FileResult:
    path: Path
    changed: bool
    replacements: int
    suspicious_before: int
    suspicious_after: int


def iter_target_files(root: Path) -> Iterable[Path]:
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in EXCLUDED_DIRS for part in path.parts):
            continue
        if path.suffix.lower() in TARGET_EXTENSIONS:
            yield path


def read_text_safe(path: Path) -> str:
    data = path.read_bytes()
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return data.decode("utf-8", errors="replace")


def apply_replacements(text: str) -> tuple[str, int]:
    total = 0
    for source, target in EXACT_REPLACEMENTS:
        if source in text:
            count = text.count(source)
            text = text.replace(source, target)
            total += count

    for pattern, replacement in REGEX_REPLACEMENTS:
        text, count = pattern.subn(replacement, text)
        total += count

    return text, total


def backup_file(path: Path, backup_root: Path, project_root: Path) -> None:
    rel = path.relative_to(project_root)
    dest = backup_root / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dest)


def process_file(path: Path, apply: bool, backup_root: Path | None, project_root: Path) -> FileResult:
    original = read_text_safe(path)
    suspicious_before = len(SUSPICIOUS_PATTERN.findall(original))
    updated, replacements = apply_replacements(original)
    suspicious_after = len(SUSPICIOUS_PATTERN.findall(updated))

    changed = updated != original
    if apply and changed:
        if backup_root is not None:
            backup_file(path, backup_root, project_root)
        path.write_text(updated, encoding="utf-8", newline="")

    return FileResult(
        path=path,
        changed=changed,
        replacements=replacements,
        suspicious_before=suspicious_before,
        suspicious_after=suspicious_after,
    )


def print_report(results: list[FileResult], apply: bool, backup_root: Path | None, project_root: Path) -> None:
    total_files = len(results)
    changed_files = sum(1 for r in results if r.changed)
    total_replacements = sum(r.replacements for r in results)
    suspicious_before = sum(r.suspicious_before for r in results)
    suspicious_after = sum(r.suspicious_after for r in results)

    print("=" * 72)
    print("FIX MOJIBAKE REPORT")
    print("=" * 72)
    print(f"Modalità             : {'APPLY' if apply else 'DRY-RUN'}")
    print(f"File analizzati      : {total_files}")
    print(f"File modificati      : {changed_files}")
    print(f"Sostituzioni totali  : {total_replacements}")
    print(f"Pattern sospetti pre : {suspicious_before}")
    print(f"Pattern sospetti post: {suspicious_after}")
    if apply and backup_root is not None:
        print(f"Backup               : {backup_root.relative_to(project_root)}")
    print("-" * 72)

    interesting = [r for r in results if r.changed or r.suspicious_after > 0]
    for r in interesting[:120]:
        rel = r.path.relative_to(project_root)
        print(
            f"{rel} | changed={r.changed} | repl={r.replacements} | "
            f"suspect {r.suspicious_before}->{r.suspicious_after}"
        )

    remaining = [r for r in results if r.suspicious_after > 0]
    if remaining:
        print("-" * 72)
        print("ATTENZIONE: sono rimasti pattern sospetti in questi file:")
        for r in remaining:
            print(f" - {r.path.relative_to(project_root)} ({r.suspicious_after})")
        print("Suggerimento: rilancia e verifica le righe residue manualmente.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Corregge automaticamente caratteri mojibake/emoji danneggiate nei file testuali."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Applica le modifiche ai file (senza questo flag fa solo dry-run).",
    )
    parser.add_argument(
        "--only",
        nargs="*",
        default=[],
        help="Percorsi specifici da processare (es: index.html iveco.js).",
    )
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parent

    if args.only:
        targets: list[Path] = []
        for item in args.only:
            candidate = (project_root / item).resolve()
            if candidate.is_file() and candidate.suffix.lower() in TARGET_EXTENSIONS:
                targets.append(candidate)
            else:
                print(f"[SKIP] Non valido o non supportato: {item}")
    else:
        targets = list(iter_target_files(project_root))

    if not targets:
        print("Nessun file target trovato.")
        return

    backup_root = None
    if args.apply:
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_root = project_root / ".mojibake_backup" / stamp
        backup_root.mkdir(parents=True, exist_ok=True)

    results = [process_file(path, args.apply, backup_root, project_root) for path in targets]
    print_report(results, args.apply, backup_root, project_root)


if __name__ == "__main__":
    main()
