import { callVision } from './ai.js';
import type { PassportData } from './types.js';

const OCR_PROMPT = `You are a passport OCR specialist. Extract all fields from this Chinese passport image.

Return ONLY a JSON object with these exact fields (no markdown, no explanation):
{
  "nameCN": "中文姓名",
  "surNameEN": "SURNAME in English",
  "givenNameEN": "GIVEN NAME in English",
  "passportNo": "passport number",
  "nationality": "CHN",
  "dob": "YYYY-MM-DD",
  "gender": "M or F",
  "issueDate": "YYYY-MM-DD",
  "expiryDate": "YYYY-MM-DD",
  "birthplace": "出生地 province/city",
  "issueAuthority": "签发机关"
}

Read the MRZ (machine readable zone) at the bottom for accurate data. Dates in MRZ are YYMMDD format.
If a field is not readable, use empty string "".`;

export async function extractPassport(imageBase64: string): Promise<PassportData> {
  const raw = await callVision(imageBase64, OCR_PROMPT);

  // Strip markdown code fences if present
  const cleaned = raw.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();

  try {
    const data = JSON.parse(cleaned) as PassportData;
    // Validate required fields
    if (!data.passportNo && !data.nameCN && !data.surNameEN) {
      throw new Error('OCR failed to extract key passport fields');
    }
    return data;
  } catch (e) {
    throw new Error(`Failed to parse OCR result: ${(e as Error).message}\nRaw: ${cleaned.substring(0, 500)}`);
  }
}
