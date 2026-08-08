from openai import OpenAI
import os

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))


def generate_certificate_text(
    holder_name: str,
    course_title: str,
    issuer_name: str,
    duration_weeks: int,
    skills_covered: list[str]
) -> str:
    """
    Uses GPT-4o-mini to generate a professional certificate body text.
    The SHA-256 hash of this text (combined with other fields) is what
    gets anchored on-chain — making it tamper-proof.
    """
    prompt = f"""
    Generate a formal certificate of completion text for the following:

    Recipient: {holder_name}
    Course/Program: {course_title}
    Issuing Organization: {issuer_name}
    Duration: {duration_weeks} weeks
    Skills Covered: {', '.join(skills_covered)}

    Write only the certificate body text (2-3 sentences).
    Professional, formal tone. No placeholders. No extra commentary.
    Include specific skills mentioned.
    """

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200,
        temperature=0.3
    )

    return response.choices[0].message.content.strip()
