import os
import io
import json
import pypdf
from typing import Optional
from .schemas import QuizGenerationResponse, QuestionSchema

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extracts raw text from PDF file bytes using pypdf."""
    pdf_reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    text = ""
    for page in pdf_reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"
    return text

PRE_CRAFTED_THEMES_JSON = """
{
  "neon-synthwave": {
    "layoutType": "neon-synthwave",
    "fontFamily": "Press Start 2P",
    "fontUrl": "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap",
    "backgroundColor": "bg-gradient-to-br from-fuchsia-950 via-purple-900 to-slate-950 border-2 border-pink-500 rounded-none shadow-[0_0_25px_rgba(236,72,153,0.4)] p-6",
    "questionStyle": "text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-cyan-300 font-extrabold uppercase tracking-widest text-center text-xs mb-4 leading-loose",
    "optionNormalStyle": "bg-black/50 border border-pink-500/40 text-pink-300 hover:border-pink-500 hover:bg-pink-950/20 rounded-none",
    "optionSelectedStyle": "bg-pink-950/40 border-2 border-pink-500 text-white font-bold shadow-[0_0_15px_rgba(236,72,153,0.6)] rounded-none",
    "optionCorrectStyle": "bg-emerald-950/40 border-2 border-emerald-500 text-emerald-300 font-bold shadow-[0_0_15px_rgba(16,185,129,0.6)] rounded-none",
    "optionIncorrectStyle": "bg-red-950/40 border-2 border-red-500 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.4)] rounded-none",
    "explanationStyle": "bg-purple-950/40 border border-purple-500/30 text-purple-300 p-4 rounded-none",
    "cardDecorationHtml": "<div class='absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] pointer-events-none opacity-40 z-0'></div>"
  },
  "parchment-scroll": {
    "layoutType": "parchment-scroll",
    "fontFamily": "Cinzel",
    "fontUrl": "https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&display=swap",
    "backgroundColor": "bg-[#f2e6d0] border-[6px] double border-[#8c6d31] rounded-none shadow-xl text-amber-950 p-6",
    "questionStyle": "text-amber-900 font-black text-center text-lg md:text-xl font-serif border-b border-amber-800/20 pb-4 mb-4",
    "optionNormalStyle": "bg-[#eaddc5] border border-amber-850/40 text-amber-950 hover:bg-[#dfd1b8] hover:border-amber-800 rounded-none",
    "optionSelectedStyle": "bg-[#d5c3a3] border-2 border-amber-800 text-amber-950 font-bold rounded-none",
    "optionCorrectStyle": "bg-emerald-100 border-2 border-emerald-600 text-emerald-950 font-bold shadow-md rounded-none",
    "optionIncorrectStyle": "bg-red-100 border-2 border-red-600 text-red-950 rounded-none",
    "explanationStyle": "bg-[#e3d4b6] border border-amber-850/20 text-amber-900 p-4 italic rounded-none",
    "cardDecorationHtml": "<div class='absolute inset-2 border border-amber-800/10 pointer-events-none z-0'></div>"
  },
  "chalkboard": {
    "layoutType": "chalkboard",
    "fontFamily": "Permanent Marker",
    "fontUrl": "https://fonts.googleapis.com/css2?family=Permanent+Marker&display=swap",
    "backgroundColor": "bg-[#1e3f20] border-[12px] border-[#5c4033] rounded-none shadow-2xl text-white p-6",
    "questionStyle": "text-white font-normal text-center text-lg md:text-xl tracking-wide mb-6",
    "optionNormalStyle": "bg-transparent border-2 border-dashed border-white/40 text-white/90 hover:border-white hover:bg-white/5 rounded-none",
    "optionSelectedStyle": "bg-white/10 border-2 border-solid border-white text-white font-bold rounded-none",
    "optionCorrectStyle": "bg-emerald-500/10 border-2 border-solid border-emerald-400 text-emerald-200 font-bold rounded-none",
    "optionIncorrectStyle": "bg-red-500/10 border-2 border-solid border-red-400 text-red-200 rounded-none",
    "explanationStyle": "bg-white/5 border border-dashed border-white/20 text-white/80 p-4 font-sans rounded-none",
    "cardDecorationHtml": "<div class='absolute inset-0 bg-white/[0.02] pointer-events-none z-0'></div>"
  },
  "cyberpunk-hacker": {
    "layoutType": "cyberpunk-hacker",
    "fontFamily": "Share Tech Mono",
    "fontUrl": "https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap",
    "backgroundColor": "bg-[#08180a] border-2 border-emerald-400 rounded-none shadow-[0_0_25px_rgba(16,185,129,0.4)] text-emerald-400 p-6",
    "questionStyle": "text-emerald-400 font-mono tracking-widest text-center text-sm md:text-md mb-6 uppercase",
    "optionNormalStyle": "bg-black border border-emerald-500/30 text-emerald-500/80 hover:text-emerald-300 hover:border-emerald-400 hover:bg-emerald-950/10 rounded-none",
    "optionSelectedStyle": "bg-emerald-950/20 border-2 border-emerald-400 text-white font-bold shadow-[0_0_15px_rgba(52,211,153,0.5)] rounded-none",
    "optionCorrectStyle": "bg-emerald-500 text-black border-2 border-emerald-400 font-bold shadow-[0_0_20px_#10b981] rounded-none",
    "optionIncorrectStyle": "bg-red-950/30 border-2 border-red-500 text-red-400 font-bold shadow-[0_0_15px_rgba(239,68,68,0.5)] rounded-none",
    "explanationStyle": "bg-emerald-950/10 border border-emerald-500/20 text-emerald-500 p-4 font-mono text-[10px] rounded-none",
    "cardDecorationHtml": "<div class='absolute inset-0 pointer-events-none opacity-20 z-0 bg-[linear-gradient(rgba(16,185,129,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.08)_1px,transparent_1px)] bg-[size:16px_16px]'></div>"
  },
  "sunset-glow": {
    "layoutType": "sunset-glow",
    "fontFamily": "Outfit",
    "fontUrl": "https://fonts.googleapis.com/css2?family=Outfit:wght@600;800&display=swap",
    "backgroundColor": "bg-gradient-to-br from-amber-500 via-orange-600 to-rose-700 border-2 border-yellow-300 rounded-none shadow-[0_0_30px_rgba(245,158,11,0.3)] text-white p-6",
    "questionStyle": "text-white font-extrabold text-center text-lg md:text-xl tracking-tight mb-6 shadow-sm",
    "optionNormalStyle": "bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:border-white/40 rounded-none",
    "optionSelectedStyle": "bg-white/30 border-2 border-white text-white font-bold shadow-lg rounded-none",
    "optionCorrectStyle": "bg-emerald-600 border-2 border-yellow-300 text-white font-bold shadow-lg rounded-none",
    "optionIncorrectStyle": "bg-red-600 border-2 border-white/60 text-white rounded-none",
    "explanationStyle": "bg-black/20 border border-white/10 text-orange-100 p-4 rounded-none",
    "cardDecorationHtml": ""
  },
  "ocean-breeze": {
    "layoutType": "ocean-breeze",
    "fontFamily": "Outfit",
    "fontUrl": "https://fonts.googleapis.com/css2?family=Outfit:wght@600;800&display=swap",
    "backgroundColor": "bg-gradient-to-br from-teal-900 via-cyan-900 to-sky-950 border-2 border-cyan-400 rounded-none shadow-[0_0_25px_rgba(34,211,238,0.25)] text-cyan-50 p-6",
    "questionStyle": "text-cyan-300 font-extrabold text-center text-lg md:text-xl tracking-wide mb-6",
    "optionNormalStyle": "bg-black/40 border border-cyan-500/30 text-cyan-200 hover:border-cyan-400 hover:bg-cyan-950/20 rounded-none",
    "optionSelectedStyle": "bg-cyan-950/40 border-2 border-cyan-400 text-white font-bold shadow-[0_0_15px_rgba(34,211,238,0.5)] rounded-none",
    "optionCorrectStyle": "bg-emerald-950/40 border-2 border-emerald-400 text-emerald-300 font-bold shadow-[0_0_15px_rgba(52,211,153,0.5)] rounded-none",
    "optionIncorrectStyle": "bg-red-950/40 border-2 border-red-500 text-red-300 rounded-none",
    "explanationStyle": "bg-cyan-950/50 border border-cyan-500/20 text-cyan-200 p-4 rounded-none",
    "cardDecorationHtml": ""
  }
}
"""

def generate_quiz_from_text(text: str, topic: str = "Custom Topic") -> QuizGenerationResponse:
    """Generates structured quiz questions from input text using Gemini API."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set")
    
    prompt = f"""
    You are an expert educator and visual designer. Create a comprehensive, high-quality quiz based on the following text or topic.
    Generate exactly 5 challenging multiple-choice questions.
    For each question, provide 4 options, designate the exact correct answer (which MUST be one of the options), and write a clear, educational explanation.

    CONTENT FORMATTING RULES:
    - Preserve normal sentence casing and all case-sensitive identifiers exactly (for example, Python class names, constants, acronyms, and chemical symbols).
    - Never convert question text or answer choices to all caps for visual styling.
    - For mathematics, physics, chemistry, or other symbolic content, format inline expressions with `$...$` and display equations with `$$...$$` using valid LaTeX.
    - Use readable Unicode text for ordinary prose and LaTeX only where structured notation improves clarity.
    
    You MUST also generate a custom UI theme configuration (`theme`) for the central quiz card container.
    
    CRITICAL INSTRUCTION FOR THE CARD THEME:
    The central quiz section card must look visually distinct and have a separate color and styling.
    
    - If the user's prompt explicitly mentions how it should be styled (e.g., "make it blue", "styled like roman parchment", "minimalist black and white style", "matrix green text"), design a custom UI style configuration matching that style.
    
    - If the user's prompt does NOT mention how the quiz should be styled, you MUST choose one of the following pre-crafted visual themes AT RANDOM (or create an equally colorful, vibrant, and distinct custom styling theme with gradients, neon colors, and borders) so that it stands out completely from the rest of the dark metro interface.
    
    PRE-CRAFTED THEME TEMPLATES:
    {PRE_CRAFTED_THEMES_JSON}
    
    When returning the theme:
    1. Select a Google Font and provide its correct fontFamily name and import url from google fonts.
    2. Provide Tailwind class lists for:
       - `backgroundColor` of the main container card (include borders, MUST use rounded-none for corners, padding, background gradients/colors, shadows/glows, etc.).
       - `questionStyle` for the question text (MUST use rounded-none if there are any bordered segments).
       - `optionNormalStyle` for default option buttons (MUST use rounded-none).
       - `optionSelectedStyle` for selected options (MUST use rounded-none).
       - `optionCorrectStyle` for correct answers (MUST use rounded-none).
       - `optionIncorrectStyle` for incorrect selections (MUST use rounded-none).
       - `explanationStyle` for explanation panels (MUST use rounded-none).
       - ANY Tailwind CSS styles you output for container or button classes MUST NOT contain "rounded", "rounded-sm", "rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl", "rounded-3xl", or "rounded-full". Use "rounded-none" instead.
       - Do not include `uppercase`, `lowercase`, or `capitalize` in question or option styles.
    3. `cardDecorationHtml` can contain custom SVGs or HTML overlays (such as neon gridlines, terminal scanlines, chalkboard scratches, antique border corners, etc.) to enhance the visual aesthetic. Ensure the HTML/SVG is clean, valid, and absolutely positioned to overlay correctly.
    
    Topic Context: {topic}
    Source Material:
    {text[:30000]}
    """
    
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    
    try:
        from google import genai
        from google.genai import types
        
        client = genai.Client(api_key=api_key)
        
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=QuizGenerationResponse,
                temperature=0.2,
            ),
        )
        return response.parsed
    except ImportError:
        import google.generativeai as legacy_genai
        
        legacy_genai.configure(api_key=api_key)
        legacy_model = "gemini-1.5-flash"
        
        response = legacy_genai.GenerativeModel(legacy_model).generate_content(
            prompt,
            generation_config={
                "response_mime_type": "application/json",
                "response_schema": QuizGenerationResponse,
                "temperature": 0.2,
            }
        )
        
        data = json.loads(response.text)
        return QuizGenerationResponse(**data)
    except Exception as e:
        try:
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=QuizGenerationResponse,
                    temperature=0.2,
                ),
            )
            return response.parsed
        except Exception as inner_e:
            raise RuntimeError(f"Gemini generation failed: {inner_e} (Original error: {e})") from e
