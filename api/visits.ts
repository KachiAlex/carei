import { db } from "./lib/db";
import { visits, clients, users } from "../src/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { setCors, handleOptions } from "./lib/cors";

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === "OPTIONS") return handleOptions(res);

  try {
    if (req.method === "GET") {
      const { date, carerId, status } = req.query;

      let query = db
        .select({
          visit: visits,
          client: clients,
          carer: users,
        })
        .from(visits)
        .leftJoin(clients, eq(visits.clientId, clients.id))
        .leftJoin(users, eq(visits.carerId, users.id));

      if (carerId) query = query.where(eq(visits.carerId, Number(carerId))) as any;
      if (status) query = query.where(eq(visits.status, status)) as any;

      const rows = await query;
      const mapped = rows.map((r: any) => ({
        ...r.visit,
        client: r.client,
        carer: r.carer,
      }));

      return res.status(200).json(mapped);
    }

    if (req.method === "POST") {
      const body = req.body;
      const [inserted] = await db.insert(visits).values(body).returning();
      return res.status(201).json(inserted);
    }

    if (req.method === "PUT") {
      const { id, ...data } = req.body;
      const [updated] = await db.update(visits).set(data).where(eq(visits.id, id)).returning();
      return res.status(200).json(updated);
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error("[/api/visits] error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
}
