import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "../../prisma/generated/client";
import { generateVisitPDF, getPdfPath } from "./pdf.service";

export interface CreateVisitDto {
  residentFullName: string;
  residentUnit: string;
  residentPhone: string;
  visitorFullName: string;
  visitorCarType: string;
  visitorLicensePlate: string;
  visitDate: string;
  visitTime: string;
  compound?: string;
}

export async function createVisit(prisma: PrismaClient, dto: CreateVisitDto) {
  const now = new Date();
  const visit = await prisma.visit.create({
    data: {
      id: uuidv4(),
      residentFullName: dto.residentFullName,
      residentUnit: dto.residentUnit,
      residentPhone: dto.residentPhone,
      visitorFullName: dto.visitorFullName,
      visitorCarType: dto.visitorCarType,
      visitorLicensePlate: dto.visitorLicensePlate,
      visitDate: new Date(dto.visitDate),
      visitTime: dto.visitTime,
      compound: dto.compound,
      updatedAt: now,
    },
  });

  await generateVisitPDF(visit);

  const pdfUrl = `${process.env.BASE_URL}/pdf/${visit.id}`;
  console.log(pdfUrl);
  const updated = await prisma.visit.update({
    where: { id: visit.id },
    data: {
      pdfUrl,
      qrCode: `${process.env.PUBLIC_URL}/qr-code/${visit.id}`,
      updatedAt: new Date(),
    },
  });

  return {
    message: "Visit created successfully.",
    visit: updated,
  };
}

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

  if (user?.role === "GUARD" && !visit.scanned && visit.compoundRef) {
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
