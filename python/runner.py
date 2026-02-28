"""
One-shot browser-use runner.

Runs a single task using the selected model/provider, then exits.

Usage:
    python runner.py <provider> <model> <task...>

    provider: browser-use | google | openai | anthropic
    model:    model name (e.g. gemini-2.5-flash, gpt-4o, claude-sonnet-4-6)
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


async def main(provider: str, model: str, task: str):
    llm = get_llm(provider, model)

    browser = Browser()
    agent = Agent(
        task=task,
        llm=llm,
        browser=browser,
    )

    try:
        await agent.run()
    finally:
        if hasattr(browser, 'close'):
            await browser.close()


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python runner.py <provider> <model> <task>")
        sys.exit(1)

    provider = sys.argv[1]
    model = sys.argv[2]
    prompt = " ".join(sys.argv[3:])
    asyncio.run(main(provider, model, prompt))