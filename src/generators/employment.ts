import { PDFDocument, rgb } from 'pdf-lib';
import { writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { callText } from '../ai.js';
import { embedFonts } from '../fonts.js';
import type { UserProfile, PassportData, MaterialFile } from '../types.js';

const SYSTEM_PROMPT = `You are a Chinese employment letter generator for Korea visa applications.
Generate a formal employment/income verification letter in Chinese, addressed to the Korean consulate.

Return JSON format:
{
  "letterCN": "中文在职证明全文（包括标题、正文、落款）"
}

Rules:
- Letter header: "韩国驻华大使馆/总领事馆签证处"
- Include: employee name, passport number, ID card number, position, department, start date, monthly salary
- State that the company approves their leave for the specified travel dates to South Korea
- State the company guarantees the employee will return on time
- Include company name, address, phone, official seal note, responsible person signature line
- Use formal Chinese business letter format
- Return ONLY JSON, no markdown or explanation`;

export async function generateEmploymentLetter(
  profile: UserProfile,
  passport: PassportData,
  travelDates: string,
  outputDir: string,
): Promise<MaterialFile> {
  const userPrompt = `Generate a Chinese employment letter for Korea visa:
- Employee: ${passport.nameCN} (${passport.surNameEN} ${passport.givenNameEN})
- Passport: ${passport.passportNo}
- ID Card: ${profile.idCardNo || 'N/A'}
- Company: ${profile.employer}
- Position: ${profile.position}
- Department: ${profile.department}
- Start Date: ${profile.employmentStartDate}
- Monthly Salary: ${profile.monthlySalary}
- Company Address: ${profile.employerAddress}
- Company Phone: ${profile.employerPhone}
- Travel Period: ${travelDates}
- Destination: South Korea (韩国)`;

  const raw = await callText(SYSTEM_PROMPT, userPrompt);
  const cleaned = raw.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
  const { letterCN } = JSON.parse(cleaned) as { letterCN: string };

  const pdf = await PDFDocument.create();
  const { cjk: font } = await embedFonts(pdf);
  const margin = 60;
  const lineHeight = 16;

  // Helper: draw wrapped text block with CJK character-level wrapping and auto-pagination
  let currentPage = pdf.addPage([595, 842]);
  const drawBlock = (text: string, startY: number): number => {
    let y = startY;
    const maxWidth = 475;
    const fontSize = 10;
    const textColor = rgb(0, 0, 0);

    for (const paragraph of text.split('\n')) {
      if (paragraph.trim() === '') {
        y -= lineHeight;
        if (y < margin + 20) {
          currentPage = pdf.addPage([595, 842]);
          y = 770;
        }
        continue;
      }
      // Character-level wrapping for CJK text
      let line = '';
      for (const char of paragraph) {
        const testLine = line + char;
        const width = font.widthOfTextAtSize(testLine, fontSize);
        if (width > maxWidth && line) {
          if (y < margin + 20) {
            currentPage = pdf.addPage([595, 842]);
            y = 770;
          }
          currentPage.drawText(line, { x: margin, y, size: fontSize, font, color: textColor });
          y -= lineHeight;
          line = char;
        } else {
          line = testLine;
        }
      }
      if (line) {
        if (y < margin + 20) {
          currentPage = pdf.addPage([595, 842]);
          y = 770;
        }
        currentPage.drawText(line, { x: margin, y, size: fontSize, font, color: textColor });
        y -= lineHeight;
      }
    }
    return y;
  };

  // Chinese page only — Korean consulate accepts Chinese
  let y = 770;
  currentPage.drawText('在职证明', { x: margin, y, size: 16, font, color: rgb(0, 0, 0) });
  y -= 35;
  y = drawBlock(letterCN, y);

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
