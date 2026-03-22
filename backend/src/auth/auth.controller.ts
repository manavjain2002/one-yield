import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  IsEmail,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
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
  @MaxLength(64)
  username: string;

  @IsString()
  @MinLength(6)
  passwordPlain: string;

  @IsIn(['borrower', 'lender', 'manager'])
  role: 'borrower' | 'lender' | 'manager';

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  displayName: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(2)
  @MaxLength(128)
  country: string;
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
  @IsIn(['lender', 'manager'])
  role: 'lender' | 'manager';
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
    return this.auth.setRole(user.userId, dto.role);
  }


  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.loginWithCredentials(dto.username, dto.passwordPlain);
  }

  @Get('username-available')
  usernameAvailable(@Query('username') username: string) {
    return this.auth.checkUsernameAvailable(username ?? '');
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.registerWithCredentials({
      username: dto.username,
      passwordPlain: dto.passwordPlain,
      role: dto.role,
      displayName: dto.displayName,
      email: dto.email.trim().toLowerCase(),
      country: dto.country.trim(),
    });
  }

  @Post('refresh')
  refresh(@Headers('authorization') authorization?: string) {
    return this.auth.refreshAccessTokenFromBearer(authorization);
  }
}
