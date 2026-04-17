import * as QRCode from 'qrcode';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import PdfPrinter from 'pdfmake';
import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';
import { PUBLIC_URL } from '../helper/const/base';

const PDF_DIR = path.resolve(process.env.PDF_STORAGE_PATH || './pdfs');

if (!fs.existsSync(PDF_DIR)) {
  fs.mkdirSync(PDF_DIR, { recursive: true });
}

const FONT_REGULAR = path.join(process.cwd(), 'public', 'fonts', 'Cairo-Regular.ttf');
const FONT_BOLD = path.join(process.cwd(), 'public', 'fonts', 'Cairo-Bold.ttf');
const LOGO_PATH = path.join(process.cwd(), 'public', 'logo.png');

const hasCairoFont = fs.existsSync(FONT_REGULAR) && fs.existsSync(FONT_BOLD);

function buildFontConfig() {
  if (!hasCairoFont) {
    throw new Error(
      `Cairo fonts not found. Place Cairo-Regular.ttf and Cairo-Bold.ttf in: ${path.join(process.cwd(), 'public', 'fonts')}`,
    );
  }
  return { Cairo: { normal: FONT_REGULAR, bold: FONT_BOLD } };
}

let printer: PdfPrinter | null = null;

function getPrinter(): PdfPrinter {
  if (!printer) printer = new PdfPrinter(buildFontConfig());
  return printer;
}

const LOGO_URL = 'https://res.cloudinary.com/dcsjywfui/image/upload/v1771925146/bi_bctaie.png';
let cachedLogoDataUrl: string | null | undefined = undefined;

async function getLogoDataUrl(): Promise<string | null> {
  // Use local file if present
  if (fs.existsSync(LOGO_PATH)) {
    return `data:image/png;base64,${fs.readFileSync(LOGO_PATH).toString('base64')}`;
  }
  // Return cached remote result
  if (cachedLogoDataUrl !== undefined) return cachedLogoDataUrl;
  // Fetch from Cloudinary
  cachedLogoDataUrl = await new Promise<string | null>((resolve) => {
    https.get(LOGO_URL, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const mime = res.headers['content-type'] ?? 'image/png';
        resolve(`data:${mime};base64,${Buffer.concat(chunks).toString('base64')}`);
      });
      res.on('error', () => resolve(null));
    }).on('error', () => resolve(null));
  });
  return cachedLogoDataUrl;
}

async function generateQRCode(visitId: string) {
  const verifyUrl = `${PUBLIC_URL}/scan/qr-code/${visitId}`;
  const qrBuffer = await QRCode.toBuffer(verifyUrl, {
    width: 150,
    margin: 2,
    color: { dark: '#1F2937', light: '#FFFFFF' },
  });
  return {
    qrDataUrl: `data:image/png;base64,${qrBuffer.toString('base64')}`,
    verifyUrl,
  };
}

// ── Table layouts ──────────────────────────────────────────────────────────────

// Bottom border only (used for section headers)
const sectionLayout = {
  hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
    i === node.table.body.length ? 1 : 0,
  vLineWidth: () => 0,
  hLineColor: () => '#E5E7EB',
  paddingTop: () => 0,
  paddingBottom: () => 6,
  paddingLeft: () => 0,
  paddingRight: () => 0,
};

// No borders, vertical padding between rows
const fieldsLayout = {
  hLineWidth: () => 0,
  vLineWidth: () => 0,
  paddingTop: () => 6,
  paddingBottom: () => 6,
  paddingLeft: () => 0,
  paddingRight: () => 0,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Reverse word order so pdfmake (LTR renderer) displays Arabic text correctly when right-aligned */
function ar(text: string): string {
  return text.split(' ').reverse().join('  ');
}

function sectionHeader(enTitle: string, arTitle: string): Content {
  return {
    table: {
      widths: ['*', '*'],
      body: [
        [
          { text: enTitle, color: '#2563eb', fontSize: 13, bold: true, characterSpacing: 0.7 },
          { text: ar(arTitle), color: '#2563eb', fontSize: 13, bold: true, alignment: 'right' },
        ],
      ],
    },
    layout: sectionLayout,
    margin: [0, 12, 0, 0],
  } as Content;
}

function fieldRow(label: string, value: string, arLabel: string) {
  return [
    { text: label, color: '#9CA3AF', fontSize: 13 },
    { text: value, color: '#1F2937', bold: true, fontSize: 13, alignment: 'center' },
    { text: ar(arLabel), color: '#9CA3AF', fontSize: 13, alignment: 'right' },
  ];
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function generateVisitPDF(visit: {
  id: string;
  residentFullName: string;
  residentUnit: string;
  residentPhone: string;
  visitorFullName: string;
  visitorCarType?: string;
  visitorLicensePlate?: string;
  visitDate: Date;
  visitTime: string;
  createdAt: Date;
}): Promise<{ filePath: string; fileName: string; qrDataUrl: string; verifyUrl: string }> {
  const { qrDataUrl, verifyUrl } = await generateQRCode(visit.id);

  const fileName = `visit_${visit.id}.pdf`;
  const filePath = path.join(PDF_DIR, fileName);

  const issuedDate = new Date(visit.createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const visitDateStr = new Date(visit.visitDate).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const logoDataUrl = await getLogoDataUrl();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logoColumn: any = logoDataUrl
    ? { image: logoDataUrl, width: 55, height: 55 }
    : { text: '', width: 55 };

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    defaultStyle: { font: 'Cairo' },

    content: [

      // ── Header ──────────────────────────────────────────────────────────────
      {
        columns: [
          logoColumn,
          { text: '', width: '*' },
          {
            stack: [
              { text: ['Visit Pass - ', ar('تصريح زائر')], fontSize: 20, bold: true, color: '#1F2937' },
              { text: [`Issued on ${issuedDate} `, ar('تاريخ الإصدار')], fontSize: 12, color: '#1F2937', margin: [0, 4, 0, 0] },
            ],
            alignment: 'right',
          },
        ],
        margin: [0, 0, 0, 0],
      },

      // ── Resident Information ─────────────────────────────────────────────────
      sectionHeader('RESIDENT INFORMATION', 'معلومات الساكن'),
      {
        table: {
          widths: [160, '*', 160],
          body: [
            fieldRow('Resident Name', visit.residentFullName || '—', 'اسم الساكن'),
            fieldRow('Unit', visit.residentUnit || '—', 'رقم الوحدة'),
            fieldRow('Resident Phone', visit.residentPhone || '—', 'رقم هاتف'),
          ],
        },
        layout: fieldsLayout,
        margin: [0, 0, 0, 0],
      } as Content,

      // ── Visitor Information ──────────────────────────────────────────────────
      sectionHeader('VISITOR INFORMATION', 'معلومات الزائر'),
      {
        table: {
          widths: [160, '*', 160],
          body: [
            fieldRow('Visitor Name', visit.visitorFullName || '—', 'اسم الزائر'),
            fieldRow('Car Type', visit.visitorCarType || '—', 'نوع السيارة'),
            fieldRow('License Plate', visit.visitorLicensePlate || '—', 'رقم لوحة السيارة'),
            fieldRow('Visit Date', visitDateStr, 'تاريخ الزيارة'),
            fieldRow('Visit Time', visit.visitTime || '—', 'وقت الزيارة'),
          ],
        },
        layout: fieldsLayout,
        margin: [0, 0, 0, 0],
      } as Content,

      // ── Verification QR Code ─────────────────────────────────────────────────
      sectionHeader('VERIFICATION QR CODE', 'رمز QR للتحقق'),
      {
        columns: [
          { image: qrDataUrl, width: 150, height: 150 },
          {
            stack: [
              {
                text: ['Scan to Verify - ', ar('قم بالمسح للتحقق')],
                fontSize: 12, bold: true, color: '#1F2937', alignment: 'center', margin: [0, 0, 0, 6],
              },
              {
                text: 'This QR code links to the official verification page for this visit record. Scan it to confirm the authenticity of this document.',
                fontSize: 10, color: '#9CA3AF', alignment: 'center', margin: [0, 0, 0, 6],
              },
              {
                text: ar('يرتبط رمز QR بصفحة التحقق الرسمية الخاصة بسجل هذه الزيارة.'),
                fontSize: 10, color: '#9CA3AF', alignment: 'center', margin: [0, 0, 0, 3],
              },
              {
                text: ar('قم بمسحه للتأكد من صحة هذه الوثيقة.'),
                fontSize: 10, color: '#9CA3AF', alignment: 'center', margin: [0, 0, 0, 6],
              },
              { text: verifyUrl, fontSize: 9, color: '#2563eb', alignment: 'center' },
            ],
            margin: [16, 8, 0, 0],
          },
        ],
        margin: [0, 10, 0, 0],
      } as Content,

      // ── Footer ───────────────────────────────────────────────────────────────
      {
        stack: [
          {
            canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#E5E7EB' }],
          },
          {
            text: `Visit ID: ${visit.id}  |  This document is system-generated`,
            fontSize: 10, color: '#9CA3AF', alignment: 'center', margin: [0, 8, 0, 0],
          },
        ],
        margin: [0, 10, 0, 0],
      } as Content,

    ],
  };

  return new Promise((resolve, reject) => {
    const doc = getPrinter().createPdfKitDocument(docDefinition);
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    doc.end();
    stream.on('finish', () => resolve({ filePath, fileName, qrDataUrl, verifyUrl }));
    stream.on('error', reject);
  });
}

export function getPdfPath(visitId: string): string {
  return path.join(PDF_DIR, `visit_${visitId}.pdf`);
}
