<div align="center">

# 📚 Clutch | Ramp x AppDev Hack→Hired

### AI-powered pre-exam intelligence for students who refuse to fail

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-Visit_App-00ff88?style=for-the-badge)](https://clutch-cornell.vercel.app)
[![YouTube Demo](https://img.shields.io/badge/▶_Demo-Watch_Video-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://www.youtube.com/watch?v=HN_F9x72POU)
[![GitHub](https://img.shields.io/badge/GitHub-View_Code-181717?style=for-the-badge&logo=github)](https://github.com/bnudelman4/clutch)


![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Anthropic](https://img.shields.io/badge/Claude-Sonnet-CC785C?style=flat-square)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=flat-square&logo=vercel&logoColor=white)

---

**Upload your lecture notes. Get a personalized study plan.** Clutch analyzes your PDFs, extracts key topics, builds dependency-aware study workflows, and syncs with Google Calendar to schedule smart sessions around your existing commitments.

[Features](#-features) • [Live Demo](#-live-deployment) • [Architecture](#-architecture) • [Getting Started](#-getting-started) • [API](#-api-reference)

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 📄 **Smart Upload**
Drag-and-drop lecture notes (PDF, TXT, MD) with:
- Server-side PDF text extraction
- Intelligent truncation for large files
- Instant analysis feedback

</td>
<td width="50%">

### 🧠 **AI Analysis**
Claude-powered extraction of:
- Key topics & subtopics
- Auto-generated flashcards
- Practice audit questions

</td>
</tr>
<tr>
<td width="50%">

### 🌳 **Workflow Commit Tree**
Git-log-style dependency graph with:
- Topic nodes on a central spine
- Subtopics branching left/right
- Milestone markers & detail panels

</td>
<td width="50%">

### 📅 **Google Calendar Integration**
OAuth2 flow that:
- Reads your existing schedule
- Generates AI-optimized study sessions
- Fits sessions between commitments

</td>
</tr>
<tr>
<td width="50%">

### 🗂️ **Flashcard Engine**
- Auto-generated from uploaded notes
- Flip-to-reveal interaction
- Organized by topic

</td>
<td width="50%">

### 🔬 **Pre-Flight Audit**
- Practice questions before exam day
- Validates readiness per topic
- Instant answer feedback

</td>
</tr>
</table>

---

## 🌐 Live Deployment

| Service | URL | Status |
|---------|-----|--------|
| **App** | [clutch-cornell.vercel.app](https://clutch-cornell.vercel.app) | ![Vercel](https://img.shields.io/badge/Vercel-Live-00C244?style=flat-square&logo=vercel) |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────┐
│              Client (Browser)                │
│  React 18 · Next.js 14 · Tailwind CSS        │
│  ExamContext (state) · localStorage (persist)│
├──────────────────────────────────────────────┤
│              API Routes (Vercel)             │
│  /api/analyze    → PDF parse + Claude AI     │
│  /api/workflow   → Dependency graph gen      │
│  /api/calendar/* → Google OAuth + scheduling │
├──────────────────────────────────────────────┤
│            External Services                 │
│  Anthropic API (Claude) · Google Calendar API│
└──────────────────────────────────────────────┘
```

**Tech Stack:**

| Layer | Technologies |
|-------|-------------|
| **Framework** | Next.js 14 (App Router) |
| **Frontend** | React 18, TypeScript, Tailwind CSS |
| **AI** | Anthropic Claude Sonnet |
| **PDF Parsing** | pdf-parse (server-side extraction) |
| **Auth** | Google OAuth2 (popup flow + postMessage) |
| **State** | React Context + localStorage |
| **Deployment** | Vercel |

---

## 🚀 Getting Started

**Prerequisites:** Node.js 18+, npm

```bash
git clone https://github.com/bnudelman4/clutch.git
cd clutch
npm install
```

**Environment Variables** — create a `.env.local` file:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Run:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/analyze` | Upload notes (text or PDF) → topics, flashcards, audit questions |
| `POST` | `/api/workflow` | Generate dependency-aware workflow graph from topics |
| `GET` | `/api/calendar/auth` | Get Google OAuth2 authorization URL |
| `GET` | `/api/calendar/auth/callback` | OAuth2 callback — exchanges code for token |
| `POST` | `/api/calendar/plan` | Generate AI study schedule from calendar + topics |

---

## 📁 Project Structure

```
clutch/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── analyze/route.ts            # PDF/text analysis endpoint
│   │   │   ├── workflow/route.ts           # Workflow graph generation
│   │   │   └── calendar/
│   │   │       ├── auth/route.ts           # OAuth2 entry
│   │   │       ├── auth/callback/route.ts  # OAuth2 callback
│   │   │       └── plan/route.ts           # Study schedule generation
│   │   ├── layout.tsx                      # Root layout + ExamProvider
│   │   └── page.tsx                        # Main app page
│   ├── components/
│   │   ├── UploadView.tsx                  # File upload with drag-and-drop
│   │   ├── ContentView.tsx                 # Analysis results display
│   │   ├── Flashcards.tsx                  # Flashcard viewer
│   │   ├── TopicLedger.tsx                 # Topic breakdown
│   │   ├── PreFlightAudit.tsx              # Practice questions
│   │   ├── WorkflowView.tsx                # Commit tree visualization
│   │   ├── CalendarView.tsx                # Google Calendar integration
│   │   ├── ExamSwitcher.tsx                # Multi-exam management
│   │   └── Sidebar.tsx                     # Navigation sidebar
│   └── lib/
│       └── exam-context.tsx                # React Context + state management
├── public/
├── tailwind.config.ts
├── next.config.js
└── package.json
```

---

## 🎨 Design

- **Theme**: Dark mode (`#0d0d0d` background, `#00ff88` accent)
- **Workflow**: Vertical commit tree inspired by `git log --graph`
- **Typography**: Monospace throughout for a terminal-native aesthetic

---

## 🛠️ Development

```bash
# Type check
npx tsc --noEmit

# Build for production
npm run build

# Deploy (auto-deploys on push to main via Vercel)
git push origin main
```
