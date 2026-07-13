from __future__ import annotations

import csv
import io
from collections.abc import Iterable
from typing import Any

from fastapi.responses import StreamingResponse


def csv_streaming_response(
    filename: str,
    header: list[str],
    rows: Iterable[list[Any]],
) -> StreamingResponse:
    """
    Stream a CSV file download.

    Uses the stdlib ``csv`` module for correct quoting/escaping, writes to
    an in-memory buffer, and sets the ``Content-Disposition`` header so the
    browser downloads it as ``filename``.
    """

    def generate() -> Iterable[str]:
        buffer = io.StringIO()
        writer = csv.writer(buffer)

        writer.writerow(header)
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)

        for row in rows:
            writer.writerow(row)
            yield buffer.getvalue()
            buffer.seek(0)
            buffer.truncate(0)

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"'
            ),
        },
    )
