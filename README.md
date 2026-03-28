# VisaBot v0.1

Self-hosted tool for generating Japan tourist visa application materials.

## What it does

Upload a passport photo + enter travel intent → auto-generate 5 visa documents:

1. **Visa Application Form** (PDF) - structured summary of all applicant info
2. **Travel Itinerary** (PDF) - day-by-day plan with hotels, activities, transport
3. **Hotel Confirmation** (PDF) - booking confirmations for all cities
4. **Employment Letter** (PDF) - bilingual (CN+EN) employment verification
5. **Passport Photo** (JPG) - cropped to Japan visa spec (45x35mm)

## Tech Stack

- Node.js + TypeScript (ESM strict)
- Express 5 + SSE for real-time progress
- pdf-lib for PDF generation
- sharp for image processing
- AI Gateway (Claude Sonnet) for OCR + content generation
- Alpine.js frontend (single HTML)

## Setup

```bash
cd visabot
npm install --include=dev
export AI_GATEWAY_API_KEY="your-key"
npm run dev
# → http://localhost:8080
```

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/ocr` | POST | Upload passport image for OCR |
| `/api/profile` | GET/POST | Read/write user profile |
| `/api/intent` | POST | Set travel intent |
| `/api/generate` | POST | Generate all materials |
| `/api/events` | GET | SSE progress stream |
| `/api/materials/:sid/:file` | GET | Download generated file |

## Roadmap

- v0.1: Material generation engine + web preview (current)
- v0.2: Ctrip auto-submission via browser automation
- v0.3: Progress tracking + status dashboard
