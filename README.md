# Gesture Charades

Two+ teams act out short phrases. A client-side CLIP model guesses — no video ever leaves the actor's device.

## Quick start

```bash
npm install --prefix server
npm install --prefix client
npm install
npm run dev
```

- Client: http://localhost:5173  
- Server: http://localhost:3001  

Camera access requires `localhost` or HTTPS.

## Stack

| Layer | Choice |
|-------|--------|
| Frontend | React + TypeScript + Vite + Tailwind |
| Realtime | Node + Express + Socket.IO |
| AI | Transformers.js · `Xenova/clip-vit-base-patch32` (browser) |

## Defaults

- `roundsPerTeam = 1`
- Teams type their own words (profanity filtered server-side)
- 5 words per team, 90s turns

Open **AI camera lab** on the landing page to sanity-check CLIP before a full game.
