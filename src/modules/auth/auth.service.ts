import { Injectable } from '@nestjs/common';

import { UserService } from '@modules/user/user.service';

@Injectable()
export class AuthService {
  constructor(private userService: UserService) {}
}
