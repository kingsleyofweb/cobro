import { Router } from "express";
import { listNotifications } from "../agent/notificationStore";

const router = Router();

router.get("/", async (req, res) => {
  const walletAddress = typeof req.query.walletAddress === "string" ? req.query.walletAddress : "";
  if (!walletAddress) { res.status(400).json({ error: "walletAddress is required" }); return; }
  try { res.json({ notifications: await listNotifications(walletAddress) }); }
  catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Unable to load notifications" }); }
});

export default router;
