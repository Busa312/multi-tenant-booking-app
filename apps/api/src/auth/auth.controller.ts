import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { LoginRequest, LoginResponse, SetPasswordRequest } from "@booking/shared-types";
import { AuthService } from "./auth.service.js";
import { LoginRequestDto, LoginResponseDto, SetPasswordRequestDto } from "../common/dto.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";

@ApiTags("cms-auth")
@Controller("cms/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @ApiBody({ type: LoginRequestDto })
  @ApiOkResponse({ type: LoginResponseDto })
  login(@Body() body: LoginRequest): Promise<LoginResponse> {
    return this.authService.login(body);
  }

  // Consumes an invite link (R50) — no JwtAuthGuard, same reasoning as
  // login: there's no valid JWT yet at this point.
  @Post("set-password")
  @ApiBody({ type: SetPasswordRequestDto })
  @ApiOkResponse({ type: LoginResponseDto })
  setPassword(@Body() body: SetPasswordRequest): Promise<LoginResponse> {
    return this.authService.setPassword(body);
  }

  // remove later
  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ type: Boolean })
  logout(): Promise<boolean> {
    return this.authService.logout();
  }
}
