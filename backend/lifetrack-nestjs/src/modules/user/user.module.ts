import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from '../../entities/auth/user.entity';
import { Elderly } from '../../entities/auth/elderly.entity';
import { Caregiver } from '../../entities/auth/caregiver.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Elderly, Caregiver])],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
