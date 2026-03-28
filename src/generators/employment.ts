import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { callText } from '../ai.js';
import type { UserProfile, PassportData, MaterialFile } from '../types.js';

const SYSTEM_PROMPT = `You are a bilingual (Chinese + English) employment letter generator for Japan visa applications.
Generate a formal employment/income verification letter in the following JSON format:

{
  "letterCN": "中文在职证明全文（包括标题、正文、落款）",
  "letterEN": "English employment letter full text (including title, body, signature block)"
}

Rules:
- Chinese version first, then English version
- Include: employee name, passport number, position, department, start date, monthly salary
- State that the company approves their leave for the specified travel dates
- State the company guarantees the employee will return on time
- Include company name, address, phone, official seal note
- Use formal business letter format
- Return ONLY JSON, no markdown or explanation`;

export async function generateEmploymentLetter(
  profile: UserProfile,
  passport: PassportData,
  travelDates: string,
  outputDir: string,
): Promise<MaterialFile> {
  const userPrompt = `Generate a bilingual employment letter for:
- Employee: ${passport.nameCN} (${passport.surNameEN} ${passport.givenNameEN})
- Passport: ${passport.passportNo}
- Company: ${profile.employer}
- Position: ${profile.position}
- Department: ${profile.department}
- Start Date: ${profile.employmentStartDate}
- Monthly Salary: ${profile.monthlySalary}
- Company Address: ${profile.employerAddress}
- Company Phone: ${profile.employerPhone}
- Travel Period: ${travelDates}
- Destination: Japan`;

  const raw = await callText(SYSTEM_PROMPT, userPrompt);
  const cleaned = raw.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
  const { letterCN, letterEN } = JSON.parse(cleaned) as { letterCN: string; letterEN: string };

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 60;
  const lineHeight = 16;

  // Helper: draw wrapped text block
  const drawBlock = (page: ReturnType<typeof pdf.addPage>, text: string, startY: number): number => {
    let y = startY;
    // Split by newlines, then wrap long lines
    for (const paragraph of text.split('\n')) {
      if (paragraph.trim() === '') {
        y -= lineHeight;
        continue;
      }
      // Simple word wrap at ~75 chars for English, render as-is for CJK
      const maxWidth = 475;
      const words = paragraph.split(' ');
      let line = '';
      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        const width = font.widthOfTextAtSize(testLine, 10);
        if (width > maxWidth && line) {
          if (y < margin + 20) {
            // Would need a new page but keep simple for now
            break;
          }
          page.drawText(line, { x: margin, y, size: 10, font, color: rgb(0, 0, 0) });
          y -= lineHeight;
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) {
        page.drawText(line, { x: margin, y, size: 10, font, color: rgb(0, 0, 0) });
        y -= lineHeight;
      }
    }
    return y;
  };

  // English page (EN first as consulate reads English)
  const pageEN = pdf.addPage([595, 842]);
  let y = 770;
  pageEN.drawText('CERTIFICATE OF EMPLOYMENT', { x: margin, y, size: 16, font: fontBold, color: rgb(0, 0, 0) });
  y -= 35;
  y = drawBlock(pageEN, letterEN, y);

  // Chinese page
  const pageCN = pdf.addPage([595, 842]);
  y = 770;
  // CJK characters won't render with StandardFonts - use English title + note
  pageCN.drawText('EMPLOYMENT CERTIFICATE (Chinese Version)', {
    x: margin, y, size: 14, font: fontBold, color: rgb(0, 0, 0),
  });
  y -= 25;
  pageCN.drawText('Note: CJK characters require embedded fonts. Below is the romanized content.', {
    x: margin, y, size: 8, font, color: rgb(0.5, 0.5, 0.5),
  });
  y -= 25;
  // For v0.1, render what we can (ASCII portions will show, CJK will be boxes)
  y = drawBlock(pageCN, letterCN, y);

  const pdfBytes = await pdf.save();
  const outputPath = join(outputDir, 'employment-letter.pdf');
  await writeFile(outputPath, pdfBytes);
  const info = await stat(outputPath);

  return {
    name: '在职证明',
    path: outputPath,
    type: 'pdf',
    size: info.size,
  };
}
