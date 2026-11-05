import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';

import { Injectable, Logger } from '@nestjs/common';
import { format, subDays } from 'date-fns';

import { EcbRateRecord } from './interfaces/ecb-rate-record.interface';

@Injectable()
export class EcbFxRateService {
  private static readonly ECB_URL =
    'https://data-api.ecb.europa.eu/service/data/EXR/D..EUR.SP00.A';

  private static readonly UPSERT_BATCH_SIZE = 100;

  private readonly logger = new Logger(EcbFxRateService.name);

  public constructor(private readonly prismaService: PrismaService) {}

  public async backfillHistoricalRates(): Promise<void> {
    this.logger.log('Starting ECB historical FX rate backfill from 1999-01-04');
    await this.gatherRates(new Date('1999-01-04'));
    this.logger.log('ECB historical FX rate backfill complete');
  }

  public async gatherRates(startDate?: Date): Promise<void> {
    const start = startDate ?? subDays(new Date(), 1);
    const end = new Date();
    const startPeriod = format(start, 'yyyy-MM-dd');
    const endPeriod = format(end, 'yyyy-MM-dd');

    const url = `${EcbFxRateService.ECB_URL}?format=csvdata&startPeriod=${startPeriod}&endPeriod=${endPeriod}`;

    let csvText: string;

    try {
      const response = await globalThis.fetch(url);

      if (!response.ok) {
        throw new Error(`ECB API returned status ${response.status}`);
      }

      csvText = await response.text();
    } catch (error) {
      this.logger.warn(
        `Failed to fetch ECB rates: ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      return;
    }

    const records = this.parseEcbCsv(csvText);

    if (records.length === 0) {
      this.logger.warn('No records parsed from ECB response');

      return;
    }

    await this.upsertRates(records);
    this.logger.log(`Upserted ${records.length} FX rate records`);
  }

  public parseEcbCsv(csvText: string): EcbRateRecord[] {
    const records: EcbRateRecord[] = [];
    const lines = csvText.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('KEY')) {
        continue;
      }

      const columns = trimmed.split(',');

      if (columns.length < 8) {
        continue;
      }

      const currency = columns[2]?.trim();
      const date = columns[6]?.trim();
      const rateStr = columns[7]?.trim();

      if (!currency || !date || !rateStr || rateStr === 'NaN') {
        continue;
      }

      const rate = parseFloat(rateStr);

      if (isNaN(rate) || rate <= 0) {
        continue;
      }

      records.push({ currency, date, rate });
    }

    return records;
  }

  private async upsertRates(records: EcbRateRecord[]): Promise<void> {
    for (
      let i = 0;
      i < records.length;
      i += EcbFxRateService.UPSERT_BATCH_SIZE
    ) {
      const batch = records.slice(i, i + EcbFxRateService.UPSERT_BATCH_SIZE);

      await Promise.all(
        batch.map(({ currency, date, rate }) => {
          const parsedDate = new Date(date);

          return this.prismaService.exchangeRate.upsert({
            create: {
              date: parsedDate,
              fromCurrency: 'EUR',
              rate,
              toCurrency: currency
            },
            update: { rate },
            where: {
              date_fromCurrency_toCurrency: {
                date: parsedDate,
                fromCurrency: 'EUR',
                toCurrency: currency
              }
            }
          });
        })
      );
    }
  }
}
