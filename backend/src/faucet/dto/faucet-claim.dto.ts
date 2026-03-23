import { IsString, Matches } from 'class-validator';

export class FaucetClaimDto {
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'recipient must be a valid 0x-prefixed address' })
  recipient!: string;

  /** Human decimal amount (token decimals applied on the server). */
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'amount must be a non-negative decimal string' })
  amount!: string;
}
