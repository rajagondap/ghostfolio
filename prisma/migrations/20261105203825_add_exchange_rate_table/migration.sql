-- CreateTable
CREATE TABLE "ExchangeRate" (
    "date" DATE NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "toCurrency" TEXT NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExchangeRate_date_fromCurrency_toCurrency_idx" ON "ExchangeRate"("date", "fromCurrency", "toCurrency");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_date_fromCurrency_toCurrency_key" ON "ExchangeRate"("date", "fromCurrency", "toCurrency");
