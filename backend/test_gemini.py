from pathlib import Path

from app.providers.gemini import GeminiProvider


async def main():
    provider = GeminiProvider()

    result = await provider.extract_data(
        "storage/invoices/test.jpg"
    )

    print(result)


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())