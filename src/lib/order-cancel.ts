/** Buyers may only cancel items that have not been confirmed by admin yet. */
export const BUYER_CANCELLABLE = ["pending", "accepted"] as const;
