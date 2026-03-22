import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { IsIn, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser, JwtUser } from './current-user.decorator';

class LoginDto {
  @IsString()
  @MinLength(3)
  username: string;

  @IsString()
  @MinLength(6)
  passwordPlain: string;
}

class RegisterDto {
  @IsString()
  @MinLength(3)
  username: string;

  @IsString()
  @MinLength(6)
  passwordPlain: string;

  @IsIn(['borrower', 'lender', 'manager'])
  role: 'borrower' | 'lender' | 'manager';
}

class ChallengeDto {
  @IsString()
  @MinLength(3)
  walletAddress: string;
}

class VerifyDto {
  @IsString()
  walletAddress: string;

  @IsString()
  challengeId: string;

  @IsString()
  signatureHex: string;
}

class SetRoleDto {
  @IsIn(['borrower', 'lender', 'manager', 'admin'])
  role: 'borrower' | 'lender' | 'manager' | 'admin';
}

@Controller('auth')
@SkipThrottle()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('challenge')
  challenge(@Body() dto: ChallengeDto) {
    return this.auth.createChallenge(dto.walletAddress);
  }

  @Post('verify')
  verify(@Body() dto: VerifyDto) {
    return this.auth.verifyAndLogin({
      walletAddress: dto.walletAddress,
      challengeId: dto.challengeId,
      signatureHex: dto.signatureHex,
    });
  }

  @Post('role')
  @UseGuards(JwtAuthGuard)
  setRole(@CurrentUser() user: JwtUser, @Body() dto: SetRoleDto) {
    return this.auth.setRole(user.walletAddress, dto.role);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.loginWithCredentials(dto.username, dto.passwordPlain);
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.registerWithCredentials(dto.username, dto.passwordPlain, dto.role);
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  refresh(@CurrentUser() user: any) {
    return this.auth.refreshToken(user.userId);
  }
}
