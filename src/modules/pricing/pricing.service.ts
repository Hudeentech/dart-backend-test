import { Injectable } from '@nestjs/common';
import { DeliveryQuoteRequestDto, DeliveryQuoteResponse } from './dto/quote.dto';

@Injectable()
export class PricingService {
  // Configurable base parameters (in Nigerian Naira NGN)
  private readonly BASE_FARE = 700.0; // Base pickup fee
  private readonly RATE_PER_KM = 120.0; // NGN per km
  private readonly RATE_PER_KG = 80.0; // NGN per kg above 1kg
  private readonly FRAGILE_SURCHARGE = 300.0;
  private readonly SENSITIVE_SURCHARGE = 200.0;
  private readonly PLATFORM_COMMISSION_PERCENT = 0.15; // 15% DART platform fee

  /**
   * Authoritative calculation of delivery price.
   * Client-supplied prices are strictly ignored across the system.
   */
  calculateQuote(dto: DeliveryQuoteRequestDto): DeliveryQuoteResponse {
    const pickupLat = dto.pickupLat ?? dto.originLat ?? 6.4474;
    const pickupLng = dto.pickupLng ?? dto.originLng ?? 3.4723;
    const destLat = dto.destinationLat ?? dto.destLat ?? 6.5244;
    const destLng = dto.destinationLng ?? dto.destLng ?? 3.3792;
    const weightKg = dto.weightKg ?? 1.0;

    const distanceKm = this.calculateDistanceKm(
      pickupLat,
      pickupLng,
      destLat,
      destLng,
    );

    // Urban traffic speed approximation (~25 km/h + 10 min pickup handling)
    const estimatedMinutes = Math.max(15, Math.round((distanceKm / 25) * 60 + 10));

    const basePrice = this.BASE_FARE;
    const distancePrice = Number((distanceKm * this.RATE_PER_KM).toFixed(2));
    
    // Weight fee for weight over 1kg
    const billableWeight = Math.max(0, weightKg - 1.0);
    const weightPrice = Number((billableWeight * this.RATE_PER_KG).toFixed(2));

    // Surcharges
    let surgePrice = 0;
    if (dto.isFragile) surgePrice += this.FRAGILE_SURCHARGE;
    if (dto.isSensitive) surgePrice += this.SENSITIVE_SURCHARGE;

    const totalPrice = Number(
      (basePrice + distancePrice + weightPrice + surgePrice).toFixed(2),
    );

    const platformFee = Number(
      (totalPrice * this.PLATFORM_COMMISSION_PERCENT).toFixed(2),
    );
    const riderSettlementFee = Number((totalPrice - platformFee).toFixed(2));

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min lock

    return {
      basePrice,
      distancePrice,
      weightPrice,
      surgePrice,
      totalPrice,
      platformFee,
      riderSettlementFee,
      distanceKm: Number(distanceKm.toFixed(2)),
      estimatedMinutes,
      expiresAt,
    };
  }

  private calculateDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const directDist = R * c;
    
    // Multiply by route winding factor (~1.25) to simulate road driving distance
    return Math.max(1.0, directDist * 1.25);
  }
}
