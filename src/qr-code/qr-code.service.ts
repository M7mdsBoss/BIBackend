import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "../../prisma/generated/client";
import { generateVisitPDF, getPdfPath } from "./pdf.service";
import { PUBLIC_URL } from "../helper/const/base";

// export interface CreateVisitDto {
//   residentFullName: string;
//   residentUnit: string;
//   residentPhone: string;
//   visitorFullName: string;
//   visitorCarType?: string;
//   visitorLicensePlate?: string;
//   visitDate: Date;
//   visitTime: string;
//   compound: string;
//   userToken: string;
//   pdfUrl?: string;
//   qrCode?: string;
// }

// function buildVisitCode(compoundName: string, sequence: number): string {
//   const prefix = compoundName.replace(/\s+/g, "").slice(0, 3).toUpperCase();
//   // padStart sets a minimum of 6 digits; if sequence exceeds 999999 it naturally
//   // grows to 7, 8, ... digits without any truncation.
//   const seq = String(sequence).padStart(6, "0");
//   return `${prefix}_${seq}`;
// }

// export async function createVisit(prisma: PrismaClient, dto: CreateVisitDto) {
//   const now = new Date();
//   const unit = await (prisma.unit as any).findUnique({
//     where: { slug: dto.residentUnit },
//   });
//   if (!unit) {
//     const err: any = new Error("unit-not-found");
//     err.status = 404;
//     throw err;
//   }

//   const compound = await (prisma.compound as any).findUnique({
//     where: { slug: dto.compound },
//   });
//   if (!compound) {
//     const err: any = new Error("compound-not-found");
//     err.status = 404;
//     throw err;
//   }

//   const visit = await prisma.$transaction(async (tx) => {
//     const count = await tx.visit.count({ where: { compound: dto.compound } });
//     const visitCode = buildVisitCode(compound.name, count + 1);

//     return tx.visit.create({
//       data: {
//         id: uuidv4(),
//         visitCode,
//         residentFullName: dto.residentFullName,
//         residentUnit: dto.residentUnit,
//         residentPhone: dto.residentPhone,
//         visitorFullName: dto.visitorFullName,
//         visitorCarType: dto.visitorCarType,
//         visitorLicensePlate: dto.visitorLicensePlate,
//         visitDate: dto.visitDate,
//         visitTime: dto.visitTime,
//         compound: dto.compound,
//         pdfUrl: dto.pdfUrl,
//         qrCode: dto.qrCode,
//         userToken: dto.userToken,
//         isExpired: false,
//         createdAt: now,
//         updatedAt: now,
//       },
//     });
//   });

//   await generateVisitPDF(visit);

//   const pdfUrl = `${process.env.BASE_URL}/pdf/${visit.id}`;
//   const qrCode = `${PUBLIC_URL}/scan/qr-code/${visit.id}`;

//   const updated = await prisma.visit.update({
//     where: { id: visit.id },
//     data: { pdfUrl, qrCode, updatedAt: new Date() },
//   });

//   const [compoundRef, residentUnitRef] = await Promise.all([
//     (prisma.compound as any).findUnique({
//       where: { slug: dto.compound },
//       select: { id: true, name: true, slug: true },
//     }),
//     (prisma.unit as any).findUnique({
//       where: { slug: dto.residentUnit },
//       select: { id: true, name: true, slug: true },
//     }),
//   ]);

//   return { ...updated, compoundRef, residentUnitRef };
// }

export async function getVisitById(
  prisma: PrismaClient,
  id: string,
  user: any,
) {
  const visit = await prisma.visit.findUnique({
    where: { id },
    include: { compoundRef: true },
  });

  if (!visit) {
    const err: any = new Error("Visit not found.");
    err.status = 404;
    throw err;
  }

  if (user?.role === "SECURITY" && !visit.scanned && visit.compoundRef) {
    if (!visit.compound) return visit;
    const assigned = await prisma.assignedCompound.findFirst({
      where: {
        compoundId: visit.compoundRef.id,
      },
    });

    if (!assigned) return visit;

    return prisma.visit.update({
      where: { id },
      data: { scanned: true },
    });
  }

  return visit;
}

export { getPdfPath };
