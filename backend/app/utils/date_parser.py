from datetime import datetime


def normalize_date(value: str | None) -> str | None:
    if value is None:
        return None

    formats = [
        "%d/%m/%y",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%Y-%m-%d",
    ]

    for fmt in formats:
        try:
            return datetime.strptime(
                value,
                fmt,
            ).strftime("%Y-%m-%d")
        except ValueError:
            pass

    return value