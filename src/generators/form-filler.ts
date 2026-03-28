import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { PassportData, UserProfile, TravelIntent, MaterialFile } from '../types.js';

/**
 * v0.1: Generate a clean visa application summary PDF from scratch.
 * Official MOFA template filling is deferred — requires obtaining the exact AcroForm PDF.
 */
export async function generateVisaForm(
  passport: PassportData,
  profile: UserProfile,
  intent: TravelIntent,
  outputDir: string,
): Promise<MaterialFile> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 50;
  const lineHeight = 18;
  const labelColor = rgb(0.3, 0.3, 0.3);
  const valueColor = rgb(0, 0, 0);

  const page = pdf.addPage([595, 842]);
  let y = 780;

  // Title
  page.drawText('VISA APPLICATION SUMMARY', { x: margin, y, size: 18, font: fontBold, color: valueColor });
  y -= 15;
  page.drawText('(For Japan Single-Entry Tourist Visa)', { x: margin, y, size: 10, font, color: labelColor });
  y -= 30;
  page.drawLine({ start: { x: margin, y }, end: { x: 545, y }, thickness: 1, color: valueColor });
  y -= 25;

  const section = (title: string) => {
    y -= 10;
    page.drawText(title, { x: margin, y, size: 12, font: fontBold, color: valueColor });
    y -= 5;
    page.drawLine({ start: { x: margin, y }, end: { x: 545, y }, thickness: 0.5, color: labelColor });
    y -= lineHeight;
  };

  const field = (label: string, value: string) => {
    page.drawText(label, { x: margin, y, size: 9, font: fontBold, color: labelColor });
    page.drawText(value || 'N/A', { x: margin + 180, y, size: 10, font, color: valueColor });
    y -= lineHeight;
  };

  // Section 1: Personal Information
  section('1. PERSONAL INFORMATION');
  field('Full Name (CN):', passport.nameCN);
  field('Surname (EN):', passport.surNameEN);
  field('Given Name (EN):', passport.givenNameEN);
  field('Gender:', passport.gender === 'M' ? 'Male' : 'Female');
  field('Date of Birth:', passport.dob);
  field('Birthplace:', passport.birthplace);
  field('Nationality:', passport.nationality || 'CHN');
  field('Phone:', profile.phone);
  field('Email:', profile.email);
  field('Address:', profile.address);

  // Section 2: Passport Information
  section('2. PASSPORT INFORMATION');
  field('Passport Number:', passport.passportNo);
  field('Date of Issue:', passport.issueDate);
  field('Date of Expiry:', passport.expiryDate);
  field('Issuing Authority:', passport.issueAuthority);

  // Section 3: Employment Information
  section('3. EMPLOYMENT INFORMATION');
  field('Employer:', profile.employer);
  field('Position:', profile.position);
  field('Department:', profile.department);
  field('Employer Address:', profile.employerAddress);
  field('Employer Phone:', profile.employerPhone);
  field('Monthly Salary:', profile.monthlySalary);

  // Section 4: Travel Information
  section('4. TRAVEL INFORMATION');
  field('Purpose:', intent.purpose);
  field('Departure Date:', intent.startDate);
  field('Return Date:', intent.endDate);
  field('Cities to Visit:', intent.cities.join(', '));
  field('Visa Type:', 'Single Entry Tourist');

  // Section 5: Emergency Contact
  if (profile.emergencyContact) {
    section('5. EMERGENCY CONTACT');
    field('Name:', profile.emergencyContact.name);
    field('Relationship:', profile.emergencyContact.relationship);
    field('Phone:', profile.emergencyContact.phone);
  }

  // Footer
  y -= 30;
  page.drawLine({ start: { x: margin, y }, end: { x: 545, y }, thickness: 0.5, color: labelColor });
  y -= 15;
  page.drawText(`Generated: ${new Date().toISOString().split('T')[0]}`, {
    x: margin, y, size: 8, font, color: labelColor,
  });
  page.drawText('This document is a summary for visa application reference.', {
    x: margin + 200, y, size: 8, font, color: labelColor,
  });

  const pdfBytes = await pdf.save();
  const outputPath = join(outputDir, 'visa-application.pdf');
  await writeFile(outputPath, pdfBytes);
  const info = await stat(outputPath);

  return {
    name: '签证申请表',
    path: outputPath,
    type: 'pdf',
    size: info.size,
  };
}
