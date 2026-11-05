import { ExchangeRateDataService } from './exchange-rate-data.service';

const BASE_DATE = new Date('2022-01-14T00:00:00.000Z');

const makeExchangeRate = (
  fromCurrency: string,
  toCurrency: string,
  rate: number,
  date = BASE_DATE
) => ({ date, fromCurrency, id: 'test-id', rate, toCurrency });

describe('ExchangeRateDataService — historical rate methods', () => {
  let service: ExchangeRateDataService;
  let prismaFindFirst: jest.Mock;
  let prismaFindMany: jest.Mock;

  beforeEach(() => {
    prismaFindFirst = jest.fn().mockResolvedValue(null);
    prismaFindMany = jest.fn().mockResolvedValue([]);

    service = new ExchangeRateDataService(
      { getDataSourceForExchangeRates: jest.fn() } as any,
      { get: jest.fn() } as any,
      {
        exchangeRate: {
          findFirst: prismaFindFirst,
          findMany: prismaFindMany
        }
      } as any,
      {} as any
    );
  });

  describe('getHistoricalRate', () => {
    it('TC-012: returns 1 for same currency without DB query', async () => {
      const rate = await service.getHistoricalRate('EUR', 'EUR', BASE_DATE);

      expect(rate).toBe(1);
      expect(prismaFindFirst).not.toHaveBeenCalled();
    });

    it('TC-007: returns direct rate when found in ExchangeRate table', async () => {
      prismaFindFirst.mockResolvedValueOnce(
        makeExchangeRate('EUR', 'USD', 1.1342)
      );

      const rate = await service.getHistoricalRate('EUR', 'USD', BASE_DATE);

      expect(rate).toBe(1.1342);
    });

    it('TC-011: derives reverse pair USD/EUR from stored EUR/USD', async () => {
      prismaFindFirst
        .mockResolvedValueOnce(null) // direct USD/EUR not found
        .mockResolvedValueOnce(makeExchangeRate('EUR', 'USD', 1.1342)); // reverse

      const rate = await service.getHistoricalRate('USD', 'EUR', BASE_DATE);

      expect(rate).toBeCloseTo(1 / 1.1342, 4);
    });

    it('TC-010: triangulates GBP/CHF via EUR when direct pair absent', async () => {
      prismaFindFirst
        .mockResolvedValueOnce(null) // direct GBP/CHF
        .mockResolvedValueOnce(null) // reverse CHF/GBP
        .mockResolvedValueOnce(makeExchangeRate('EUR', 'GBP', 0.84)) // EUR/GBP
        .mockResolvedValueOnce(makeExchangeRate('EUR', 'CHF', 1.043)); // EUR/CHF

      const rate = await service.getHistoricalRate('GBP', 'CHF', BASE_DATE);

      expect(rate).toBeCloseTo(1.043 / 0.84, 4);
    });

    it('TC-013: falls back to previous day when exact date has no rate', async () => {
      // All 4 lookups on the original date return null
      // Then day-1 direct lookup returns a rate
      prismaFindFirst
        .mockResolvedValueOnce(null) // exact day: direct
        .mockResolvedValueOnce(null) // exact day: reverse
        .mockResolvedValueOnce(null) // exact day: triangulation EUR/from
        .mockResolvedValueOnce(null) // exact day: triangulation EUR/to
        .mockResolvedValueOnce(makeExchangeRate('EUR', 'USD', 1.1342)); // day-1: direct

      const saturdayDate = new Date('2022-01-15T00:00:00.000Z');
      const rate = await service.getHistoricalRate('EUR', 'USD', saturdayDate);

      expect(rate).toBe(1.1342);
    });

    it('TC-014: returns undefined when no rate found within 7 days', async () => {
      // All lookups return null (default mock)
      const rate = await service.getHistoricalRate('EUR', 'USD', BASE_DATE);

      expect(rate).toBeUndefined();
    });
  });

  describe('getManyHistoricalRates', () => {
    it('TC-016: issues exactly 1 Prisma query for multiple pairs', async () => {
      prismaFindMany.mockResolvedValue([
        makeExchangeRate('EUR', 'USD', 1.1342),
        makeExchangeRate('EUR', 'GBP', 0.84)
      ]);

      const pairs = [
        { date: BASE_DATE, fromCurrency: 'EUR', toCurrency: 'USD' },
        { date: BASE_DATE, fromCurrency: 'EUR', toCurrency: 'GBP' }
      ];

      const result = await service.getManyHistoricalRates(pairs);

      expect(prismaFindMany).toHaveBeenCalledTimes(1);
      expect(result.size).toBe(2);
    });

    it('returns empty map for empty input without querying DB', async () => {
      const result = await service.getManyHistoricalRates([]);

      expect(prismaFindMany).not.toHaveBeenCalled();
      expect(result.size).toBe(0);
    });
  });

  describe('toCurrencyAtDate — ExchangeRate table integration (AC-003)', () => {
    it('TC-007-integration: routes through ExchangeRate table for past date, returns historical value', async () => {
      prismaFindFirst.mockResolvedValueOnce(
        makeExchangeRate('EUR', 'USD', 1.1342)
      );

      const result = await service.toCurrencyAtDate(
        100,
        'EUR',
        'USD',
        BASE_DATE
      );

      expect(result).toBeCloseTo(100 * 1.1342, 2);
      expect(prismaFindFirst).toHaveBeenCalled();
    });

    it('TC-009-integration: falls back to MarketData when ExchangeRate table returns undefined', async () => {
      // All ExchangeRate lookups return null
      prismaFindFirst.mockResolvedValue(null);

      // Should fall through to existing MarketData path without throwing
      const result = await service.toCurrencyAtDate(
        100,
        'EUR',
        'USD',
        BASE_DATE
      );

      // result is undefined (MarketData also mocked as returning nothing) — no throw
      expect(result).toBeUndefined();
    });
  });
});
