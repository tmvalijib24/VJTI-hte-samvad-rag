import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        # Listen for console events
        page.on("console", lambda msg: print(f"Browser console ({msg.type}): {msg.text}"))
        
        # Listen for uncaught exceptions
        page.on("pageerror", lambda err: print(f"Browser Uncaught Exception: {err}"))
        
        try:
            await page.goto("http://localhost:5173", wait_until="networkidle", timeout=10000)
            await asyncio.sleep(2)
        except Exception as e:
            print(f"Error navigating: {e}")
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
