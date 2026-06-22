import os
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from typing import Optional

from .schemas import QuizGenerationResponse
from .services import extract_text_from_pdf, generate_quiz_from_text

# Load environment variables
load_dotenv()

app = FastAPI(title="Quizly AI Microservice", version="1.0.0")

# Enable CORS for local services
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "healthy", "model": os.getenv("GEMINI_MODEL", "gemini-2.5-flash")}

@app.post("/generate-quiz", response_model=QuizGenerationResponse)
async def generate_quiz(
    file: Optional[UploadFile] = File(None),
    topic: Optional[str] = Form(None)
):
    # Ensure at least one input is provided
    if not file and not topic:
        raise HTTPException(
            status_code=400,
            detail="You must provide either a PDF file upload or a topic text prompt."
        )
    
    extracted_text = ""
    quiz_topic = topic or "Ingested Document"
    
    # Process PDF file if uploaded
    if file:
        if not file.filename.endswith('.pdf'):
            raise HTTPException(
                status_code=400,
                detail="Only PDF files are supported for document ingestion."
            )
        try:
            file_bytes = await file.read()
            extracted_text = extract_text_from_pdf(file_bytes)
            
            filename_topic = os.path.splitext(file.filename)[0].replace("-", " ").replace("_", " ").title()
            
            if not extracted_text.strip():
                # Scanned or unreadable PDF: Fallback to generating a quiz about the filename's topic
                print(f"[AI Fallback] Empty text extracted from {file.filename}. Generating quiz using filename topic: {filename_topic}")
                extracted_text = f"Generate a quiz about the topic: {filename_topic}"
                quiz_topic = f"{filename_topic} (Scanned Document Fallback)"
            else:
                if not topic:
                    quiz_topic = filename_topic
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error reading PDF file: {str(e)}"
            )
    else:
        # Topic-only prompt
        extracted_text = f"Generate a quiz about the topic: {topic}"

    # Invoke Gemini API
    try:
        quiz_data = generate_quiz_from_text(extracted_text, topic=quiz_topic)
        return quiz_data
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate quiz: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
