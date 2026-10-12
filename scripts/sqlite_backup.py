"""Consistent SQLite snapshots and verified restore to a NEW path only."""

import argparse
import os
from pathlib import Path
import sqlite3
import tempfile
import time


def verify(path):
    path = Path(path).resolve(strict=True)
    with sqlite3.connect(path.as_uri() + "?mode=ro", uri=True, timeout=5) as connection:
        if connection.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise ValueError("SQLite integrity check failed.")
        if connection.execute("PRAGMA foreign_key_check").fetchone():
            raise ValueError("SQLite foreign key check failed.")
        tables = connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ).fetchall()
        return {
            name: connection.execute(
                'SELECT count(*) FROM "' + name.replace('"', '""') + '"'
            ).fetchone()[0]
            for (name,) in tables
        }


def snapshot(source, destination):
    source = Path(source).resolve(strict=True)
    destination = Path(destination).absolute()
    if os.path.lexists(destination):
        raise FileExistsError("Destination already exists; no data was overwritten.")
    if not destination.parent.is_dir():
        raise ValueError(
            "Create a private destination directory before running this command."
        )
    fd, temporary_name = tempfile.mkstemp(
        prefix=".english-ai-snapshot-", dir=destination.parent
    )
    os.close(fd)
    temporary = Path(temporary_name)
    try:
        deadline = time.monotonic() + 30

        def progress(_status, _remaining, _total):
            if time.monotonic() > deadline:
                raise TimeoutError(
                    "SQLite snapshot exceeded 30 seconds; retry when writes are less busy."
                )

        with sqlite3.connect(
            source.as_uri() + "?mode=ro", uri=True, timeout=5
        ) as original:
            with sqlite3.connect(temporary) as target:
                original.backup(target, pages=128, progress=progress, sleep=0.05)
        counts = verify(temporary)
        with temporary.open("rb") as stream:
            os.fsync(stream.fileno())
        # Linking publishes atomically and fails if a competing operation
        # created the final name. The private temporary file is always removed.
        os.link(temporary, destination)
        directory_fd = os.open(destination.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
        return counts
    finally:
        temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["backup", "restore", "verify"])
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path, nargs="?")
    args = parser.parse_args()
    try:
        if args.operation == "verify":
            if args.destination:
                parser.error("verify accepts only a source.")
            verify(args.source)
        else:
            if args.destination is None:
                parser.error("backup/restore require a new destination.")
            snapshot(args.source, args.destination)
    except (OSError, ValueError, sqlite3.Error) as error:
        # Exception bodies may contain paths or database content; report type only.
        parser.exit(
            1,
            f"{args.operation} failed ({type(error).__name__}); existing files were preserved.\n",
        )
    print(f"{args.operation}: SQLite integrity and foreign keys verified.")


if __name__ == "__main__":
    main()
