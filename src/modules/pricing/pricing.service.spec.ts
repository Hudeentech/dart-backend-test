import { Test, TestingModule } from '@nestjs/testing';
import { PricingService } from './pricing.service';
import { PackageCategory } from '@prisma/client';

describe('PricingService', () => {
  let service: PricingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PricingService],
    }).compile();

    service = module.get<PricingService>(PricingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should accurately calculate delivery price with distance, weight and surcharges', () => {
    const quote = service.calculateQuote({
      pickupLat: 6.4474,
      pickupLng: 3.4723,
      destinationLat: 6.5244,
      destinationLng: 3.3792,
      weightKg: 3.0,
      category: PackageCategory.PARCEL,
      isFragile: true,
      isSensitive: false,
    });

    expect(quote).toBeDefined();
    expect(quote.basePrice).toBe(700.0);
    expect(quote.distanceKm).toBeGreaterThan(0);
    expect(quote.distancePrice).toBeGreaterThan(0);
    expect(quote.weightPrice).toBe(160.0); // (3.0 - 1.0) * 80
    expect(quote.surgePrice).toBe(300.0); // Fragile surcharge
    expect(quote.totalPrice).toBe(
      Number(
        (
          quote.basePrice +
          quote.distancePrice +
          quote.weightPrice +
          quote.surgePrice
        ).toFixed(2),
      ),
    );
    expect(quote.platformFee).toBe(Number((quote.totalPrice * 0.15).toFixed(2)));
    expect(quote.riderSettlementFee).toBe(
      Number((quote.totalPrice - quote.platformFee).toFixed(2)),
    );
  });

  it('should not charge weight fee for packages <= 1kg', () => {
    const quote = service.calculateQuote({
      pickupLat: 6.4474,
      pickupLng: 3.4723,
      destinationLat: 6.45,
      destinationLng: 3.48,
      weightKg: 0.8,
      category: PackageCategory.DOCUMENT,
      isFragile: false,
      isSensitive: false,
    });

    expect(quote.weightPrice).toBe(0);
    expect(quote.surgePrice).toBe(0);
  });
});
