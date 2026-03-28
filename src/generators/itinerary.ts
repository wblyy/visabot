import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { callText } from '../ai.js';
import type { TravelIntent, PassportData, MaterialFile } from '../types.js';

const SYSTEM_PROMPT = `You are a travel itinerary specialist for Japan visa applications.
Generate a day-by-day travel itinerary in the following JSON format:

{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "city": "城市",
      "accommodation": "酒店名称",
      "activities": ["景点1", "景点2"],
      "transport": "交通方式"
    }
  ]
}

Rules:
- Use real, well-known attractions and hotels in Japan
- Include realistic transport between cities (新干线, JR, 地铁)
- First day: arrival, last day: departure
- Keep activities reasonable (2-3 per day)
- Return ONLY JSON, no markdown or explanation`;

interface ItineraryDay {
  date: string;
  city: string;
  accommodation: string;
  activities: string[];
  transport: string;
}

export async function generateItinerary(
  intent: TravelIntent,
  passport: PassportData,
  outputDir: string,
): Promise<MaterialFile> {
  const userPrompt = `Generate a travel itinerary for:
- Traveler: ${passport.nameCN} (${passport.surNameEN} ${passport.givenNameEN})
- Dates: ${intent.startDate} to ${intent.endDate}
- Cities: ${intent.cities.join(', ')}
- Purpose: ${intent.purpose}`;

  const raw = await callText(SYSTEM_PROMPT, userPrompt);
  const cleaned = raw.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
  const { days } = JSON.parse(cleaned) as { days: ItineraryDay[] };

  // Build PDF
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 10;
  const lineHeight = 16;
  const margin = 50;

  let page = pdf.addPage([595, 842]); // A4
  let y = 792;

  const drawText = (text: string, x: number, bold = false) => {
    if (y < margin + 20) {
      page = pdf.addPage([595, 842]);
      y = 792;
    }
    page.drawText(text, { x, y, size: fontSize, font: bold ? fontBold : font, color: rgb(0, 0, 0) });
  };

  // Title
  page.drawText('TRAVEL ITINERARY', { x: margin, y, size: 16, font: fontBold, color: rgb(0, 0, 0) });
  y -= 25;
  drawText(`Traveler: ${passport.surNameEN} ${passport.givenNameEN} / ${passport.nameCN}`, margin);
  y -= lineHeight;
  drawText(`Passport: ${passport.passportNo}`, margin);
  y -= lineHeight;
  drawText(`Period: ${intent.startDate} ~ ${intent.endDate}`, margin);
  y -= lineHeight * 2;

  // Table header
  const cols = [margin, margin + 80, margin + 160, margin + 260, margin + 400];
  for (const [i, h] of ['Date', 'City', 'Hotel', 'Activities', 'Transport'].entries()) {
    drawText(h, cols[i], true);
  }
  y -= lineHeight;
  page.drawLine({ start: { x: margin, y: y + 6 }, end: { x: 545, y: y + 6 }, thickness: 0.5, color: rgb(0, 0, 0) });
  y -= 4;

  // Rows
  for (const day of days) {
    drawText(day.date, cols[0]);
    drawText(day.city, cols[1]);
    drawText(day.accommodation.substring(0, 18), cols[2]);
    drawText(day.activities.join(', ').substring(0, 25), cols[3]);
    drawText(day.transport.substring(0, 20), cols[4]);
    y -= lineHeight;
  }

  const pdfBytes = await pdf.save();
  const outputPath = join(outputDir, 'itinerary.pdf');
  await writeFile(outputPath, pdfBytes);
  const info = await stat(outputPath);

  return {
    name: '旅行行程单',
    path: outputPath,
    type: 'pdf',
    size: info.size,
  };
}
