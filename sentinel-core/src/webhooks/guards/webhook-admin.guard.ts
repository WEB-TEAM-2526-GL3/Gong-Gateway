import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

const ADMIN_KEY_HEADER = 'x-sentinel-admin-key';

interface HeaderReadableRequest {
  headers: Record<string, string | string[] | undefined>;
}

@Injectable()
export class WebhookAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expectedKey = process.env.WEBHOOK_ADMIN_KEY;

    if (!expectedKey) {
      throw new ServiceUnavailableException(
        'Webhook admin key is not configured',
      );
    }

    const request = context.switchToHttp().getRequest<HeaderReadableRequest>();
    const providedHeader = request.headers[ADMIN_KEY_HEADER];
    const providedKey = Array.isArray(providedHeader)
      ? providedHeader[0]
      : providedHeader;

    if (!providedKey || !this.matches(providedKey, expectedKey)) {
      throw new UnauthorizedException('Missing or invalid webhook admin key');
    }

    return true;
  }

  private matches(providedKey: string, expectedKey: string): boolean {
    const provided = Buffer.from(providedKey);
    const expected = Buffer.from(expectedKey);

    return (
      provided.length === expected.length && timingSafeEqual(provided, expected)
    );
  }
}
