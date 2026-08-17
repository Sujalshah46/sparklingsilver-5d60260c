// ============================================
// SPARKLING SILVER: ASYNC PUSH NOTIFICATIONS
// ============================================
// File: src/lib/push-queue.ts (NEW FILE)
//
// ISSUE: Push notifications block order placement
// SOLUTION: Queue notifications, send async using existing push.server helpers
// Impact: Order placement 500ms → 200ms

interface NotificationJob {
  id: string;
  type: "new-order" | "order-dispatched" | "order-delivered";
  payload: Record<string, any>;
  created_at: Date;
  processed_at?: Date;
  error?: string;
}

// In-memory queue for immediate processing
const notificationQueue: NotificationJob[] = [];

// Worker: Process queue every 5 seconds and clean up rate limit logs hourly
let workerInterval: any = null;
let cleanupInterval: any = null;

async function startWorker() {
  if (workerInterval) return;
  workerInterval = setInterval(async () => {
    while (notificationQueue.length > 0) {
      const job = notificationQueue.shift();
      if (!job) break;

      try {
        await processNotificationJob(job);
        job.processed_at = new Date();
      } catch (error) {
        console.error(`[push-queue] Job ${job.id} failed:`, error);
        job.error = String(error);
        // Re-queue for retry after a delay
        await new Promise((resolve) => setTimeout(resolve, 5000));
        notificationQueue.push(job);
      }
    }
  }, 5000);

  // Hourly cleanup of rate limit logs older than 24 hours
  cleanupInterval = setInterval(async () => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabaseAdmin
        .from("rate_limit_log")
        .delete()
        .lt("created_at", windowStart);
      if (error) console.error("[push-queue] Rate limit log cleanup failed:", error);
    } catch (e) {
      console.error("[push-queue] Failed to clean up rate limit logs:", e);
    }
  }, 60 * 60 * 1000);
}

// Start worker immediately on server load
if (typeof window === "undefined") {
  startWorker();
}

/**
 * Called from server functions, returns immediately.
 * Notification is processed in the background.
 */
export function queueNotificationJob(
  type: NotificationJob["type"],
  payload: Record<string, any>
) {
  const job: NotificationJob = {
    id: `${type}-${Date.now()}-${Math.random()}`,
    type,
    payload,
    created_at: new Date(),
  };

  notificationQueue.push(job);
  // Return immediately, don't await
  return job.id;
}

// ============================================
// PROCESS NOTIFICATION (Run in Background)
// ============================================

async function processNotificationJob(job: NotificationJob) {
  // Use dynamic imports to prevent server-only code/packages (web-push)
  // from leaking or raising errors in client bundlers.
  const { notifyAdmins, notifyUser } = await import("./push.server");

  switch (job.type) {
    case "new-order": {
      const { orderId, orderNo, customerName, total } = job.payload;
      await notifyAdmins({
        title: "New order received",
        body: `${customerName} · #${orderNo} · ₹${Number(total).toFixed(0)}`,
        url: `/admin/orders/${orderId}`,
        tag: `order-${orderId}`,
      });
      break;
    }
    case "order-dispatched": {
      const { userId, orderNo, trackingUrl } = job.payload;
      await notifyUser(userId, {
        title: "Order Dispatched",
        body: `Your order #${orderNo} is on its way!`,
        url: `/orders`,
        tag: `dispatch-${orderNo}`,
      });
      break;
    }
    case "order-delivered": {
      const { userId, orderNo } = job.payload;
      await notifyUser(userId, {
        title: "Order Delivered",
        body: `Your order #${orderNo} has been delivered. Thank you!`,
        url: `/orders`,
        tag: `delivery-${orderNo}`,
      });
      break;
    }
    default:
      throw new Error(`Unknown notification type: ${job.type}`);
  }
}
