import { Injectable } from '@nestjs/common';

/**
 * Ensures transactions for the same Hedera account execute strictly sequentially,
 * avoiding nonce / account sequence conflicts.
 */
@Injectable()
export class WalletSequenceService {
  private readonly chains = new Map<string, Promise<unknown>>();

  run<T>(walletKey: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.chains.get(walletKey) ?? Promise.resolve();
    const next = prev.then(fn, fn) as Promise<T>;
    this.chains.set(
      walletKey,
      next.then(
        () => undefined,
        () => undefined,
      ),
    );
    return next;
  }
}
