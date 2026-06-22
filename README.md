# ⚡ Quizzly!
> Because regular exams make people cry, but real-time quizzes with lightning bolts make them competitive.

Quizzly is a zero-friction, chaotic, real-time multiplayer assessment platform. You don't need an account, you don't need a password, and you don't need to give us your email. Just type a goofy nickname, grab a lobby code, and host a live lobby where you can test your friends on literally anything under the sun using AI.

```text
    [Host: "Let's learn about Organic Chemistry!"]
                       │
                       ▼
          [Gemini AI cooks some questions]
                       │
                       ▼
    [Guest 1: "I didn't study"]  ───►  [Guest 2: *furiously typing in chat*]
```

---

## 🛠️ The Tech Stack (What's holding this ship together)

Quizzly is split into three services, behaving like a cooperative team:

*   **The Face (Frontend)**: Next.js. Renders all the pretty components, LaTeX math equations (using KaTeX so your math symbols actually look like math), and strictly square boxes (`rounded-none` for life, because curves are overrated).
*   **The Heart (Sockets Backend)**: Node/Express + Socket.io. Authoritative game loops, synchronized lobby countdowns, chat handling, and score calculations. (It also handles host rage-quits with a grace period so the lobby doesn't instantly die).
*   **The Brain (AI Service)**: FastAPI + Google Gemini 3.5 Flash. It ingests your prompt or a PDF document, extracts the text, and designs a customized quiz complete with questions, choices, explanations, and matching visual themes.
*   **The Vault (Database)**: MySQL database connected via Prisma. Remembers your scores, who is hosting, and keeps the generated questions intact.

---

## 🕹️ How a Game Goes Down (Authoritative Chaos)

1.  **Lobby Standby**: The host connects and gets a shiny lobby UUID. Guests paste the UUID to jump in.
2.  **The Wait**: Guests are locked out of the controls (grayed-out lightning prompt button) and see: *"please wait while the host initiates a quizzly"*. They can spam the chat box to pass the time.
3.  **The Generation**: The host inputs a prompt (e.g. *"90s cartoon trivia"* or uploads a PDF syllabus). Gemini cooks 5 multiple-choice questions, incorrect options, detailed explanations, and a visual theme.
4.  **Game Start**: The host clicks **Start Quiz**. The backend fires the first question (keeping the correct answer hidden so nobody can cheat via browser inspectors).
5.  **30-Second Panic**: Players have 30 seconds to click an option. The faster you click the correct answer, the more points you steal.
6.  **The Reveal**: The timer hits 0. The correct answer highlights green, wrong choices go red, and an educational explanation slides in for 10 seconds.
7.  **The Podium**: After 5 rounds, final scores are computed and a personalized review page displays showing how badly (or well) you did.

---

## 🔌 Reconnection & Fail-Safes
We know your Wi-Fi might drop out when you're winning:
*   **Double-socket presence**: The backend allows multiple sockets per user. Reconnecting or opening a new tab won't accidentally mark you offline.
*   **Host Grace Period**: If the host disconnects, they have a short window to return. If they abandon you, the server announces that the host has forfeited and closes the room.

---

## 📂 Repository Layout

```text
quizly/
├── frontend/       Next.js app, Vercel host, Zustand client state, and Server Actions
├── backend/        Express + Socket.io authoritative real-time server (GCP Cloud Run)
├── ai-service/     FastAPI + Gemini AI generator and PDF text extraction (GCP Cloud Run)
├── prisma/         Database models linking Users, Sessions, and Participants
└── docker-compose.yml
```

Now go paste your lobby code, invite some suspects, and prove you know more than them!
