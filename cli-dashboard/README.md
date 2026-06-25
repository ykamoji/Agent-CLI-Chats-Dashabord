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
| `/dashboard` | Main table, stats, insights, profile dropdown. Supports `?demo=<username>` for public access without login. |
| `/profile`   | Account details + update-password form, back-to-dashboard   |

## Auth and API Integration

The frontend uses an API client (`src/lib/api.ts`) that connects to a Flask backend API. 
Authentication tokens are stored locally in `sessionStorage` and sent as `Bearer` tokens on subsequent API requests. The API client also provides a `getDemoChats` method which supports fetching public sample data for "viewer" roles, completely bypassing login requirements.

## Getting started

Install dependencies and start the development server using your package manager of choice (the project uses `pnpm` workspace definitions, but `npm` is also supported):

```bash
cd cli-dashboard
pnpm install  # or npm install
pnpm run dev  # or npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
