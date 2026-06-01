import { db } from "./lib/db";
import { careNotes, medicationLogs } from "../db/schema";
import { eq } from "drizzle-orm";
import { setCors, handleOptions } from "./lib/cors";

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === "OPTIONS") return handleOptions(res);

  try {
    if (req.method === "GET") {
      const { clientId, visitId } = req.query;
      let query = db.select().from(careNotes);
      if (clientId) query = query.where(eq(careNotes.clientId, Number(clientId))) as any;
      if (visitId) query = query.where(eq(careNotes.visitId, Number(visitId))) as any;
      const rows = await query;
      return res.status(200).json(rows);
    }

    if (req.method === "POST") {
      const body = req.body;
      const [inserted] = await db.insert(careNotes).values(body).returning();
      return res.status(201).json(inserted);
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error("[/api/notes] error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
}
