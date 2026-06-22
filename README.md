# Quizzly

Quizzly is an AI-powered, real-time multiplayer quiz platform. A host can create a quiz from a topic or PDF, invite players with a lobby code, and run a synchronized game with timed questions, live scoring, chat, answer explanations, and a personalized review at the end.

## How it works

Quizzly is split into three application services backed by MySQL:

- **Frontend:** A Next.js application that handles authentication, lobby and quiz interfaces, server actions, realtime client state, dynamic themes, and mathematical notation.
- **Realtime backend:** An Express and Socket.IO server that manages rooms, presence, synchronized timers, answers, scoring, chat, game progression, rematches, and session closure.
- **AI service:** A FastAPI service that extracts text from PDFs and asks Gemini to produce structured quiz questions, explanations, and visual theme data.
- **Database:** MySQL stores users, quiz sessions, questions, participants, host roles, and scores through Prisma.

## User and lobby flow

Users enter Quizzly with a guest username and receive an authenticated session. Every lobby has a UUID that acts as its lobby code.

A participant can have one of two lobby roles:

- **Host:** Creates and configures quizzes, starts games, generates another quiz for the same lobby, or closes the lobby by creating a new session.
- **Guest:** Joins with a lobby code, answers questions, views results, and uses lobby chat. Guests can see the quiz prompt control, but only the host can use it.

Creating a new session makes its creator the host. Joining an existing session preserves the host already assigned to that lobby.

## Quiz generation

The host can describe a subject in the lobby prompt. The frontend sends that prompt to the FastAPI service, which uses Gemini and Pydantic schemas to generate:

- Five multiple-choice questions
- Four choices for each question
- The exact correct answer
- An educational explanation
- A visual theme for the quiz card

The separate creation interface also supports PDF ingestion. Text is extracted with `pypdf` and used as source material. If a PDF contains no readable text, the service falls back to its filename as the topic.

Generated content preserves meaningful capitalization for identifiers, class names, acronyms, and symbols. Mathematical content can use LaTeX delimiters and is rendered in the frontend with KaTeX.

## Realtime gameplay

Socket.IO provides a shared room for every quiz session. The backend is authoritative for game state and broadcasts the same events to connected players.

A game proceeds as follows:

1. The host generates a quiz.
2. Everyone in the lobby sees that the quiz is ready.
3. The host starts the game.
4. The backend sends one question without exposing its answer.
5. Players have 30 seconds to answer.
6. Correct answers receive points based partly on response speed.
7. The correct answer and explanation are revealed.
8. After a 10-second review period, the backend automatically advances everyone.
9. At the end, players receive final standings and a personalized answer review.

Players joining during an active quiz receive the current question and synchronized remaining time. Their score begins at zero, so missed questions do not award points. Players joining during the review period receive the revealed answer and explanation.

## Scoring and review

A correct answer awards a base score plus a time-based bonus. Incorrect and unanswered questions award zero points.

During the reveal:

- The correct choice is always highlighted in green.
- A selected incorrect choice is highlighted in red.
- An unanswered question is labeled **No Answer**.

The final review contains every question, the player's submitted answer, the correct answer, and the generated explanation.

## Presence and session lifecycle

The realtime backend tracks every active socket for each participant. This allows reconnects and multiple connections without an older disconnect incorrectly marking a current player offline.

Offline participants remain visible in the player list with their presence status. If the host disconnects, a short grace period allows them to reconnect. If they do not return, the session closes and remaining players are told that the host forfeited. They can then enter another lobby code.

After a completed quiz, the host can generate another quiz from the same prompt control without disconnecting the lobby. Existing players remain together and scores reset when the next game begins. If the host chooses **New Session**, Quizzly warns that the current players will be disconnected before closing the lobby.

## Chat

Lobby chat is available before, during, and after a quiz. Each player receives a distinct color used consistently in chat, the player list, profile indicator, and leaderboard.

During gameplay, incoming chat messages appear beneath the quiz card and fade after five seconds so they do not cover the question. The chat control remains available throughout the game, and unread messages are shown on its notification badge.

## Dynamic presentation

Each generated quiz can include a theme describing fonts, colors, borders, option states, explanation styling, and card decoration. The main application interface remains consistent while the central quiz card changes to match the generated subject or requested visual style.

The frontend applies semantic result colors independently of the generated theme, ensuring that correct and incorrect states remain understandable even when the selected theme is monochrome.

## Data model

The database is organized around four primary models:

- **User:** Account identity, username, guest status, and optional account credentials.
- **QuizSession:** Lobby identifier, topic, creation time, questions, participants, and generated theme.
- **Question:** Question text, JSON answer choices, correct answer, and explanation.
- **Participant:** Connects a user to a quiz session and stores their host role and score.

## Repository structure

```text
quizly/
├── frontend/       Next.js interface, server actions, Zustand state, and Prisma client
├── backend/        Express and Socket.IO realtime game server
├── ai-service/     FastAPI, Gemini generation, PDF extraction, and Pydantic schemas
├── prisma/         Shared root Prisma schema
└── docker-compose.yml
```

Live timers, active sockets, current rounds, and temporary session-closure state are currently maintained by the realtime backend in memory. Persistent entities and scores are stored in MySQL.
