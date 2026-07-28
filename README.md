# Camrades

Multiplayer charades where the judge is a computer vision model, not your friends.

Teams write words and phrases for a rival team to act out. The performer's own camera feeds a CLIP-based image classifier running entirely in the browser, which tries to pick the right answer out of a small set of decoys. It guesses live, while everyone watches the AI's confidence bars flicker in real time.

> **Status: pre-alpha / actively being built.** This README describes the target design. See [`docs/BUILD_SPEC.md`](./docs/BUILD_SPEC.md) for the phased implementation plan and current progress.

---

## How it plays

1. **Form teams.** 2–3 players per team, any number of teams.
2. **Submit words.** Each team privately writes a short list of words/phrases (default: 5) for another team to act out. Keep entries short and concrete: think "riding a bike," not a full sentence.
3. **Get assigned.** With 2 teams, lists simply swap. With 3+ teams, assignment is randomized so no team ever acts out its own list.
4. **Perform.** On a team's turn, players take turns acting out their assigned words one at a time, camera on, no talking. The AI is shown the real word plus 2–3 decoys from the same category and has to figure out which one is being acted out, purely from the video feed.
5. **Score.** A correct AI guess scores the point and advances to the next word. Get through as many as possible before the clock runs out.

The AI picks from a small multiple-choice pool rather than guessing freely. Open-ended "watch anything and name it" recognition isn't realistic with a lightweight browser model, so this is a deliberate design choice to keep the AI's judgment actually reliable instead of just frustrating.

## Features

- 🎭 Real-time multiplayer across separate devices, no shared screen needed
- 🤖 On-device AI judge (CLIP zero-shot image classification), no server-side inference, no API keys, no per-request cost
- 🔀 Fair word assignment via random derangement, so you never act out your own words
- 📊 Live "what the AI is thinking" confidence bars visible to everyone during a performance
- 🔄 Automatic actor rotation within a team, so everyone performs during their team's turn
- 📱 Designed mobile-first, since performers need to move around

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Realtime sync | Node.js, Express, Socket.IO |
| AI inference | [Transformers.js](https://huggingface.co/docs/transformers.js) (`@huggingface/transformers`), running `Xenova/clip-vit-base-patch32` client-side |
| State | In-memory on the server (rooms are ephemeral by design, no database) |

No video is ever streamed between players' devices. The AI only ever looks at the performer's own local camera, so the app stays lightweight compared to a video-call-based approach.

## Project structure

```
charadai/
├── client/           # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   ├── aiGuesser.ts    # client-side CLIP inference engine
│   │   └── ...
│   └── package.json
├── server/           # Node.js + Socket.IO game server
│   ├── src/
│   │   ├── rooms.ts
│   │   ├── words.json      # built-in word bank / decoy fallback pool
│   │   └── ...
│   └── package.json
├── docs/
│   └── BUILD_SPEC.md       # phased implementation plan
└── package.json      # root scripts to run client + server together
```

## Getting started

### Prerequisites

- Node.js 18+
- A webcam and a browser that supports `getUserMedia` (Chrome, Firefox, Safari, Edge, all current versions)

### Installation

```bash
git clone https://github.com/<your-username>/charadai.git
cd charadai
npm install
```

### Running locally

```bash
npm run dev
```

This starts the client (`http://localhost:5173`) and server (`http://localhost:3001`) together. Open the client URL in multiple browser tabs or devices on the same network to test multiplayer locally.

> **Camera access note:** `getUserMedia` requires a secure context (`https://` or `localhost`). Local dev on `localhost` works fine; if you test across devices on your LAN using your machine's IP address instead of `localhost`, the camera will be blocked unless you set up HTTPS for dev too.

### Environment variables

None required for local development. The app runs fully client-side for AI inference and in-memory on the server for game state. If you deploy and add persistence (see [Roadmap](#roadmap)), document connection strings here.

## Roadmap

- [ ] Core game loop (rooms → teams → word submission → turns → scoring)
- [ ] Client-side CLIP guessing engine
- [ ] Visual/UX polish pass
- [ ] Persistent room state (Redis) for multi-instance hosting
- [ ] Deployed demo

## Known limitations

- The AI chooses from a fixed multiple-choice pool per word, not a free-form guess. This is intentional (see [How it plays](#how-it-plays)), not a bug.
- Recognition accuracy depends on lighting, camera angle, and how literally a word can be acted out. Abstract phrases are harder for the AI than concrete physical actions.
- Room state lives in server memory; a server restart clears any in-progress games.

## Contributing

This is currently a solo/learning project built in phases (see `docs/BUILD_SPEC.md`). Issues and suggestions are welcome; PRs are easiest to review if they correspond to one phase of the build plan at a time.
