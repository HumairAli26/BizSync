import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { onSchedule } from "firebase-functions/v2/scheduler";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

const BATCH_SIZE = 500;

export const expireSubscriptions = onSchedule(
  {
    schedule: "every day 00:15",
    timeZone: "Asia/Karachi",
    retryCount: 3,
  },
  async () => {
    const now = Timestamp.now();

    const expiredOrgsSnap = await db
      .collection("organizations")
      .where("subscription.plan", "==", "pro")
      .where("subscription.expiresAt", "<", now)
      .get();

    if (expiredOrgsSnap.empty) {
      logger.info("expireSubscriptions: no expired Pro orgs found.");
      return;
    }

    logger.info(
      `expireSubscriptions: found ${expiredOrgsSnap.size} expired Pro org(s). Downgrading...`,
    );

    const docs = expiredOrgsSnap.docs;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const chunk = docs.slice(i, i + BATCH_SIZE);
      const batch = db.batch();

      for (const orgDoc of chunk) {
        batch.update(orgDoc.ref, {
          "subscription.plan": "basic",
          "subscription.status": "expired",
          "subscription.downgradedAt": now,
        });
      }

      await batch.commit();
      logger.info(
        `expireSubscriptions: downgraded ${chunk.length} org(s) in this batch.`,
      );
    }

    logger.info(
      `expireSubscriptions: done. Downgraded ${docs.length} org(s) total.`,
    );
  },
);
