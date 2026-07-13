from __future__ import annotations

import re


GST_REGEX = re.compile(
    r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{3}$"
)


VEHICLE_REGEX = re.compile(
    r"^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$"
)


def is_valid_gst(
    gst: str,
) -> bool:

    return bool(
        GST_REGEX.match(
            gst.upper(),
        )
    )


def is_valid_vehicle(
    number: str,
) -> bool:

    cleaned = (
        number.replace(
            " ",
            "",
        )
        .upper()
    )

    return bool(
        VEHICLE_REGEX.match(
            cleaned,
        )
    )