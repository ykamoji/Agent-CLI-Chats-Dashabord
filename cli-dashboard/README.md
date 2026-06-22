# CLI Dashboard

A Next.js (App Router) + TypeScript + Tailwind app that displays a dashboard of
your CLI agent conversation history — your input, the tools used, and the
output — and surfaces key insights to help you improve your vibe coding prompts.

## Stack

- **Next.js 15** (App Router) with React 19
- **TypeScript** (`.tsx` / `.ts`)
- **Tailwind CSS** — modern black & white materialistic theme

## Pages & routing

| Route        | Page                                                        |
| ------------ | ----------------------------------------------------------- |
| `/`          | Landing page with a styled description of the app           |
| `/auth`      | Sign in / sign up (toggle). `/auth?mode=signup` opens signup |
| `/dashboard` | Main table (sample data), stats, insights, profile dropdown |
| `/profile`   | Account details + update-password form, back-to-dashboard   |

Auth is a lightweight client-side stub backed by `localStorage`
(`src/lib/auth.ts`) — swap it for a real provider/API when wiring the backend.

## Getting started

```bash
cd cli-dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
