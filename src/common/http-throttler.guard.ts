import { Injectable, type ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/** Rate limit só para HTTP: o WebSocket tem anti-flood próprio no gateway. */
@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(
    context: ExecutionContext,
  ): Promise<boolean> {
    return context.getType() !== 'http' || super.shouldSkip(context);
  }
}
