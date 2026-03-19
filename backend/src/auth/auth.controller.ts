import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { IsIn, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser, JwtUser } from './current-user.decorator';

class ChallengeDto {
  @IsString()
  @MinLength(3)
  accountId: string;
}

class VerifyDto {
  @IsString()
  accountId: string;

  @IsString()
  challengeId: string;

  @IsString()
  signatureHex: string;
}

class SetRoleDto {
  @IsIn(['borrower', 'lender', 'manager'])
  role: 'borrower' | 'lender' | 'manager';
}

@Controller('auth')
@SkipThrottle()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('challenge')
  challenge(@Body() dto: ChallengeDto) {
    return this.auth.createChallenge(dto.accountId);
  }

  @Post('verify')
  verify(@Body() dto: VerifyDto) {
    return this.auth.verifyAndLogin({
      accountId: dto.accountId,
      challengeId: dto.challengeId,
      signatureHex: dto.signatureHex,
    });
  }

  @Post('role')
  @UseGuards(JwtAuthGuard)
  setRole(@CurrentUser() user: JwtUser, @Body() dto: SetRoleDto) {
    return this.auth.setRole(user.accountId, dto.role);
  }
}
