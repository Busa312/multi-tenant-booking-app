import { Body, Controller, Post } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { LoginRequest, LoginResponse } from "@booking/shared-types";
import { AuthService } from "./auth.service.js";
import { LoginRequestDto, LoginResponseDto } from "../common/dto.js";

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
}
