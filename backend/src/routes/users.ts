import { Router } from "express";
import { upsertUser } from "../agent/userStore";

const router = Router();

router.post("/profile", async (req, res) => {
  const { username, walletAddress, role } = req.body;
  if (!username || !walletAddress || !["client", "freelancer"].includes(role)) {
    res.status(400).json({ error: "username, walletAddress and role are required" }); return;
  }
  try { res.json({ user: await upsertUser(username, walletAddress, role) }); }
  catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Unable to save profile" }); }
});

export default router;
