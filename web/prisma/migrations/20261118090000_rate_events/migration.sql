-- Rate limits in the database (SOCIAL_TODO C2): counted actions survive a restart and work with several servers.
-- CreateTable
CREATE TABLE "RateEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "RateEvent_key_at_idx" ON "RateEvent"("key", "at");

-- CreateIndex
CREATE INDEX "RateEvent_at_idx" ON "RateEvent"("at");
