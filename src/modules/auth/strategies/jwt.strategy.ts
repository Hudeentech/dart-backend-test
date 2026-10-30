import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/database/prisma.service';
import { InMemoryStore } from '@/database/in-memory-store';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret'),
    });
  }

  async validate(payload: JwtPayload) {
    if (this.prisma.isConnected) {
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          include: {
            riderProfile: true,
            walletAccount: true,
          },
        });

        if (user) {
          if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
            throw new UnauthorizedException('Account has been suspended or deactivated');
          }
          return user;
        }
      } catch (err: any) {
        // Fallback to in-memory store
      }
    }

    const memUser = InMemoryStore.getInstance().users.get(payload.sub);
    if (memUser) {
      if (memUser.status === 'SUSPENDED' || memUser.status === 'DEACTIVATED') {
        throw new UnauthorizedException('Account has been suspended or deactivated');
      }
      return memUser;
    }

    // User not found in database or active session store
    throw new UnauthorizedException('User no longer exists or session has expired');
  }
}
