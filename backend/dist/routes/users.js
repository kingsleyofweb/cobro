"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userStore_1 = require("../agent/userStore");
const router = (0, express_1.Router)();
router.get("/profile", async (req, res) => {
    const walletAddress = typeof req.query.walletAddress === "string" ? req.query.walletAddress : "";
    if (!walletAddress) {
        res.status(400).json({ error: "walletAddress is required" });
        return;
    }
    try {
        res.json({ user: (await (0, userStore_1.findUserByWallet)(walletAddress)) ?? null });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unable to load profile" });
    }
});
router.post("/profile", async (req, res) => {
    const { username, walletAddress, role } = req.body;
    if (!username || !walletAddress || !["client", "freelancer"].includes(role)) {
        res.status(400).json({ error: "username, walletAddress and role are required" });
        return;
    }
    try {
        res.json({ user: await (0, userStore_1.upsertUser)(username, walletAddress, role) });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unable to save profile" });
    }
});
exports.default = router;
