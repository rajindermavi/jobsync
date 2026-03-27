import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export const POST = async (req: NextRequest) => {
  // Auth
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || token !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve user from USER_EMAIL env var
  const userEmail = process.env.USER_EMAIL;
  if (!userEmail) {
    return NextResponse.json({ error: "USER_EMAIL not configured" }, { status: 500 });
  }
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 500 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    title,
    company,
    location,
    type,
    status,
    source,
    salaryRange = "",
    dueDate,
    dateApplied,
    jobDescription,
    jobUrl,
    applied = false,
  } = body;

  if (!title || !company || !jobDescription || !type || !status || !source) {
    return NextResponse.json(
      { error: "Missing required fields: title, company, jobDescription, type, status, source" },
      { status: 400 }
    );
  }

  try {
    // JobTitle — find or create by slugified value
    const titleValue = title.trim().toLowerCase().replace(/\s+/g, "-");
    const jobTitle = await prisma.jobTitle.upsert({
      where: { value: titleValue },
      update: {},
      create: { label: title.trim(), value: titleValue, createdBy: user.id },
    });

    // Company — find or create by slugified value
    const companyValue = company.trim().toLowerCase().replace(/\s+/g, "-");
    const companyRecord = await prisma.company.upsert({
      where: { value: companyValue },
      update: {},
      create: { label: company.trim(), value: companyValue, createdBy: user.id },
    });

    // Location — optional, find by value+user or create
    let locationId: string | undefined = undefined;
    if (location) {
      const locationValue = location.trim().toLowerCase();
      let locationRecord = await prisma.location.findFirst({
        where: { value: locationValue, createdBy: user.id },
      });
      if (!locationRecord) {
        locationRecord = await prisma.location.create({
          data: { label: location.trim(), value: locationValue, createdBy: user.id },
        });
      }
      locationId = locationRecord.id;
    }

    // JobStatus — must be one of the seeded values
    const statusRecord = await prisma.jobStatus.findUnique({
      where: { value: status.trim().toLowerCase() },
    });
    if (!statusRecord) {
      return NextResponse.json(
        { error: `Unknown status "${status}". Valid values: draft, applied, interview, offer, rejected, expired, archived` },
        { status: 400 }
      );
    }

    // JobSource — find seeded value or create a new one
    const sourceValue = source.trim().toLowerCase().replace(/\s+/g, "-");
    let sourceRecord = await prisma.jobSource.findUnique({ where: { value: sourceValue } });
    if (!sourceRecord) {
      sourceRecord = await prisma.jobSource.create({
        data: { label: source.trim(), value: sourceValue },
      });
    }

    const job = await prisma.job.create({
      data: {
        jobTitleId: jobTitle.id,
        companyId: companyRecord.id,
        locationId: locationId ?? null,
        statusId: statusRecord.id,
        jobSourceId: sourceRecord.id,
        salaryRange: salaryRange ?? "",
        createdAt: new Date(),
        dueDate: dueDate ? new Date(dueDate) : null,
        appliedDate: dateApplied ? new Date(dateApplied) : null,
        description: jobDescription,
        jobType: type,
        userId: user.id,
        jobUrl: jobUrl ?? null,
        applied: applied ?? false,
      },
    });

    return NextResponse.json({ success: true, job }, { status: 201 });
  } catch (error) {
    console.error("Error creating job via API:", error);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }
};
