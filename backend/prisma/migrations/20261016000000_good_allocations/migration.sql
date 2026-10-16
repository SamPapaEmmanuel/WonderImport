-- Split-stock allocations: two or more clients can purchase shares of the
-- same good at the same time. Each row is one buyer's share; the allocate
-- endpoint consumes itemsLeft atomically so concurrent checkouts never oversell.
-- Backfill note: existing non-stock goods with quantitySold > 0 keep their
-- quantitySold as legacy sold units (attributed to Good.clientId). New sales
-- should go through POST /goods/:id/allocations.

-- CreateTable
CREATE TABLE "good_allocations" (
    "id" UUID NOT NULL,
    "good_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "selling_price" DECIMAL(14,2),
    "note" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "good_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "good_allocations_good_id_idx" ON "good_allocations"("good_id");

-- CreateIndex
CREATE INDEX "good_allocations_client_id_idx" ON "good_allocations"("client_id");

-- CreateIndex
CREATE INDEX "good_allocations_good_id_created_at_idx" ON "good_allocations"("good_id", "created_at");

-- AddForeignKey
ALTER TABLE "good_allocations" ADD CONSTRAINT "good_allocations_good_id_fkey" FOREIGN KEY ("good_id") REFERENCES "goods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "good_allocations" ADD CONSTRAINT "good_allocations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "good_allocations" ADD CONSTRAINT "good_allocations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
