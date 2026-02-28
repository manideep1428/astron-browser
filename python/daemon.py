"""
Persistent browser-use daemon.

Keeps a single Browser instance alive across multiple tasks.
Reads prompts line-by-line from stdin.
Prints __DONE__ after each task so the calling process knows when output is complete.

Usage:
    python daemon.py [provider] [model]

    provider: browser-use | google | openai | anthropic
    model:    model name (e.g. gemini-2.5-flash-preview-05-20, gpt-4o, claude-sonnet-4-6)
"""

import sys
import asyncio
from browser_use import Agent, Browser


def get_llm(provider: str, model: str):
    """Create the LLM instance based on provider and model."""
    provider = provider.lower().strip()

    if provider == "google":
        from browser_use import ChatGoogle
        return ChatGoogle(model=model)

    elif provider == "openai":
        from browser_use import ChatOpenAI
        return ChatOpenAI(model=model)

    elif provider == "anthropic":
        from browser_use import ChatAnthropic
        return ChatAnthropic(model=model)

    else:
        # Default: browser-use
        from browser_use import ChatBrowserUse
        return ChatBrowserUse()


async def daemon():
    # Parse provider/model from args
    provider = sys.argv[1] if len(sys.argv) > 1 else "browser-use"
    model = sys.argv[2] if len(sys.argv) > 2 else "default"

    llm = get_llm(provider, model)

    browser = Browser()
    print(f"[daemon] Browser started. Provider: {provider}, Model: {model}", flush=True)

    try:
        while True:
            line = await asyncio.get_event_loop().run_in_executor(
                None, sys.stdin.readline
            )

            if not line:  # EOF — parent closed stdin
                break

            prompt = line.strip()
            if not prompt:
                continue

            print(f"\n[agent] Running: {prompt}", flush=True)

            agent = Agent(
                task=prompt,
                llm=llm,
                browser=browser,
            )

            try:
                await agent.run()
            except Exception as e:
                print(f"[error] {e}", flush=True)

            print("__DONE__", flush=True)

    finally:
        if hasattr(browser, 'close'):
            await browser.close()
        print("[daemon] Browser closed.", flush=True)


if __name__ == "__main__":
    asyncio.run(daemon())
