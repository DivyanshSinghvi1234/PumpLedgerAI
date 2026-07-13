import json


def extract_json(text: str) -> dict:
    """
    Extract JSON from an LLM response.
    """

    start = text.find("{")
    end = text.rfind("}")

    if start == -1 or end == -1:
        raise ValueError("No JSON found.")

    return json.loads(text[start : end + 1])