import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';

import { Test, TestingModule } from '@nestjs/testing';

import { EcbFxRateService } from './ecb-fx-rate.service';

const MOCK_CSV = [
  '#comment line',
  'KEY,FREQ,CURRENCY_DENOM,CURRENCY,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE',
  'D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2022-01-14,1.1342',
  'D.GBP.EUR.SP00.A,D,GBP,EUR,SP00,A,2022-01-14,0.8401'
].join('\n');

describe('EcbFxRateService', () => {
  let service: EcbFxRateService;
  let prismaService: { exchangeRate: { upsert: jest.Mock } };
  let fetchSpy: jest.SpyInstance;

  beforeEach(async () => {
    prismaService = {
      exchangeRate: {
        upsert: jest.fn().mockResolvedValue({})
      }
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EcbFxRateService,
        { provide: PrismaService, useValue: prismaService }
      ]
    }).compile();

    service = module.get<EcbFxRateService>(EcbFxRateService);

    fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(MOCK_CSV, { status: 200 }));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('gatherRates', () => {
    it('TC-004: fetches ECB feed and upserts parsed rates', async () => {
      await service.gatherRates(new Date('2022-01-14'));

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(prismaService.exchangeRate.upsert).toHaveBeenCalledTimes(2);
      expect(prismaService.exchangeRate.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            fromCurrency: 'EUR',
            rate: 1.1342
          })
        })
      );
    });

    it('TC-005: calling twice calls upsert each time (DB handles dedup via unique constraint)', async () => {
      fetchSpy
        .mockResolvedValueOnce(new Response(MOCK_CSV, { status: 200 }))
        .mockResolvedValueOnce(new Response(MOCK_CSV, { status: 200 }));

      await service.gatherRates(new Date('2022-01-14'));
      await service.gatherRates(new Date('2022-01-14'));

      expect(prismaService.exchangeRate.upsert).toHaveBeenCalledTimes(4);
    });

    it('TC-006: catches network errors and does not throw', async () => {
      fetchSpy.mockRejectedValue(new Error('Network error'));

      await expect(
        service.gatherRates(new Date('2022-01-14'))
      ).resolves.not.toThrow();

      expect(prismaService.exchangeRate.upsert).not.toHaveBeenCalled();
    });

    it('handles non-OK HTTP response without throwing', async () => {
      fetchSpy.mockResolvedValue(
        new Response('Service Unavailable', { status: 503 })
      );

      await expect(
        service.gatherRates(new Date('2022-01-14'))
      ).resolves.not.toThrow();

      expect(prismaService.exchangeRate.upsert).not.toHaveBeenCalled();
    });
  });

  describe('parseEcbCsv', () => {
    it('skips comment and header lines, parses data rows', () => {
      const records = service.parseEcbCsv(MOCK_CSV);

      expect(records).toHaveLength(2);
      expect(records[0]?.rate).toBe(1.1342);
    });

    it('skips rows with NaN rate', () => {
      const csvWithNaN = [
        'KEY,FREQ,CURRENCY_DENOM,CURRENCY,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE',
        'D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2022-01-14,NaN'
      ].join('\n');

      expect(service.parseEcbCsv(csvWithNaN)).toHaveLength(0);
    });
  });

  describe('backfillHistoricalRates', () => {
    it('calls gatherRates with 1999-01-04 start date', async () => {
      const spy = jest.spyOn(service, 'gatherRates').mockResolvedValue();

      await service.backfillHistoricalRates();

      expect(spy).toHaveBeenCalledWith(new Date('1999-01-04'));
    });
  });
});
