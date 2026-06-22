from pydantic import BaseModel, Field
from typing import List, Optional

class QuizUiThemeSchema(BaseModel):
    layoutType: str = Field(description="Visual layout pattern: e.g. 'retro-arcade', 'cyberpunk-terminal', 'parchment-scroll', 'neon-synthwave', 'chalkboard', 'glassmorphism-aurora', or another creative name representing the custom theme.")
    fontFamily: str = Field(description="Name of the Google Font to load, e.g. 'Press Start 2P', 'Courier Prime', 'Share Tech Mono', 'Cinzel', 'VT323', 'Outfit', 'Permanent Marker', 'Space Mono', etc.")
    fontUrl: str = Field(description="Google Font CSS URL to load, e.g. 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap'")
    backgroundColor: str = Field(description="Tailwind classes for the center container card background, borders, and shadows (e.g. 'bg-zinc-900 border-4 border-yellow-500 rounded-none shadow-[0_0_20px_#eab308]', 'bg-[#1b1917] border-2 border-[#b89f5d] rounded-sm', 'bg-black border-2 border-emerald-500 shadow-[0_0_15px_#10b981]')")
    questionStyle: str = Field(description="Tailwind classes for question styling. Do not include uppercase, lowercase, or capitalize because authored casing may be semantically important.")
    optionNormalStyle: str = Field(description="Tailwind classes for option buttons in normal/default state.")
    optionSelectedStyle: str = Field(description="Tailwind classes for selected option button.")
    optionCorrectStyle: str = Field(description="Tailwind classes for correct option button.")
    optionIncorrectStyle: str = Field(description="Tailwind classes for incorrect option button.")
    explanationStyle: str = Field(description="Tailwind classes for the AI explanation text card.")
    cardDecorationHtml: Optional[str] = Field(description="Raw HTML/SVG string to inject into the card for custom decorative elements (like SVG grid patterns, retro scanlines overlay, glowing borders, chalkboard sketches, etc.) matching the generated theme. Keep it simple, neat, and valid.")

class QuestionSchema(BaseModel):
    questionText: str = Field(description="The multiple choice question text. Preserve semantically meaningful capitalization. Wrap inline LaTeX in $...$ and display equations in $$...$$.")
    options: List[str] = Field(description="A list of 4 distinct choices/options. Preserve case and use $...$ or $$...$$ for mathematical notation when needed.")
    correctAnswer: str = Field(description="The correct answer, which must match exactly one of the items in the options list.")
    explanation: str = Field(description="A detailed explanation of why the correct answer is correct, using $...$ or $$...$$ for mathematical notation when needed.")

class QuizGenerationResponse(BaseModel):
    topic: str = Field(description="The main topic or subject of the generated quiz.")
    questions: List[QuestionSchema] = Field(description="The list of structured quiz questions.")
    theme: QuizUiThemeSchema = Field(description="Custom UI theme configurations for rendering this quiz dynamically.")
