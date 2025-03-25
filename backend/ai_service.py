import os
import openai
from dotenv import load_dotenv
from typing import Dict, Any
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize OpenAI client
openai_api_key = os.getenv("OPENAI_API_KEY")
client = openai.OpenAI(api_key=openai_api_key)


async def generate_text(prompt: str) -> Dict[str, Any]:
    """
    Generate text using OpenAI's API

    Args:
        prompt: The user's input prompt

    Returns:
        Dict containing the generated text and metadata
    """
    try:
        logger.info(f"Generating text for prompt: {prompt}")

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful writing assistant."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1000,
            temperature=0.7
        )

        generated_text = response.choices[0].message.content
        # Log first 100 chars
        logger.info(f"Successfully generated text: {generated_text[:100]}...")

        return {
            "success": True,
            "text": generated_text,
            "model": "gpt-3.5-turbo"
        }
    except Exception as e:
        logger.error(f"Error generating text: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }
