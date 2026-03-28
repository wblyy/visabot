import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { callText } from '../ai.js';
import type { TravelIntent, PassportData, MaterialFile } from '../types.js';

const SYSTEM_PROMPT = `You are a hotel booking confirmation generator for Japan visa applications.
Generate hotel booking confirmations in the following JSON format:

{
  "bookings": [
    {
      "hotelName": "Hotel name in English",
      "hotelNameJP": "ホテル名（日本語）",
      "address": "Full address in English",
      "phone": "+81-XX-XXXX-XXXX",
      "checkIn": "YYYY-MM-DD",
      "checkOut": "YYYY-MM-DD",
      "confirmationNo": "BK-XXXXXXXX",
      "roomType": "Standard Double / Twin / etc",
      "guestName": "SURNAME GIVENNAME",
      "nights": 2,
      "totalPrice": "¥XX,XXX"
    }
  ]
}

Rules:
- Use real, well-known hotels in the specified cities
- Include realistic addresses and phone numbers
- Generate unique confirmation numbers (BK- prefix + 8 alphanumeric)
- Room prices should be reasonable for the hotel class
- Check-in at 15:00, check-out at 11:00 is standard
- Return ONLY JSON, no markdown or explanation`;

interface HotelBooking {
  hotelName: string;
  hotelNameJP: string;
  address: string;
  phone: string;
  checkIn: string;
  checkOut: string;
  confirmationNo: string;
  roomType: string;
  guestName: string;
  nights: number;
  totalPrice: string;
}

export async function generateHotelConfirmation(
  intent: TravelIntent,
  passport: PassportData,
  outputDir: string,
): Promise<MaterialFile> {
  const userPrompt = `Generate hotel booking confirmations for:
- Guest: ${passport.surNameEN} ${passport.givenNameEN}
- Dates: ${intent.startDate} to ${intent.endDate}
- Cities: ${intent.cities.join(', ')}
- Arrange hotels to cover all nights of the trip`;

  const raw = await callText(SYSTEM_PROMPT, userPrompt);
  const cleaned = raw.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
  const { bookings } = JSON.parse(cleaned) as { bookings: HotelBooking[] };

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 50;

  for (const booking of bookings) {
    const page = pdf.addPage([595, 842]);
    let y = 780;
    const ln = (size: number) => size * 1.4;

    // Header
    page.drawText('BOOKING CONFIRMATION', { x: margin, y, size: 18, font: fontBold, color: rgb(0, 0, 0) });
    y -= 30;
    page.drawLine({ start: { x: margin, y }, end: { x: 545, y }, thickness: 1, color: rgb(0, 0, 0) });
    y -= 25;

    const field = (label: string, value: string) => {
      page.drawText(label, { x: margin, y, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
      page.drawText(value, { x: margin + 160, y, size: 10, font, color: rgb(0, 0, 0) });
      y -= ln(10);
    };

    field('Confirmation No:', booking.confirmationNo);
    field('Hotel:', booking.hotelName);
    field('Address:', booking.address);
    field('Phone:', booking.phone);
    y -= 10;
    field('Guest Name:', booking.guestName);
    field('Room Type:', booking.roomType);
    y -= 10;
    field('Check-in:', `${booking.checkIn}  (15:00)`);
    field('Check-out:', `${booking.checkOut}  (11:00)`);
    field('Nights:', String(booking.nights));
    field('Total Price:', booking.totalPrice);

    y -= 30;
    page.drawLine({ start: { x: margin, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 20;
    page.drawText('This confirmation is generated for visa application purposes.', {
      x: margin, y, size: 8, font, color: rgb(0.5, 0.5, 0.5),
    });
  }

  const pdfBytes = await pdf.save();
  const outputPath = join(outputDir, 'hotel-confirmation.pdf');
  await writeFile(outputPath, pdfBytes);
  const info = await stat(outputPath);

  return {
    name: '酒店预订确认函',
    path: outputPath,
    type: 'pdf',
    size: info.size,
  };
}
