import {
  Controller,
  Post,
  Delete,
  Body,
  Req,
  UseGuards,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { PushNotificationsService } from './push-notifications.service';
import { CustomersService } from '../customers/customers.service';
import { CreatePushSubscriptionDto } from './dto/create-push-subscription.dto';
import { SendPushDto } from './dto/send-push.dto';
import type { AuthRequest } from '../auth/jwt-payload.type';

@ApiTags('Push Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class PushNotificationsController {
  constructor(
    private readonly push: PushNotificationsService,
    private readonly customers: CustomersService,
  ) {}

  @Post('push-subscription')
  @ApiOperation({ summary: 'Register a push subscription for the current customer' })
  async subscribe(
    @Req() req: AuthRequest,
    @Body() dto: CreatePushSubscriptionDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    const customer = await this.customers.findByUserId(req.user!.sub);
    const sub = await this.push.subscribe(
      customer.id,
      dto.endpoint,
      dto.keys.p256dh,
      dto.keys.auth,
      userAgent,
    );
    return { id: sub.id, message: 'Subscription registered' };
  }

  @Delete('push-subscription')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a push subscription for the current customer' })
  async unsubscribe(
    @Req() req: AuthRequest,
    @Body('endpoint') endpoint: string,
  ) {
    const customer = await this.customers.findByUserId(req.user!.sub);
    if (endpoint) {
      await this.push.unsubscribe(customer.id, endpoint);
    } else {
      await this.push.unsubscribeAll(customer.id);
    }
  }

  @Post('push-notification/send')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Send a push notification (admin only)' })
  async send(@Body() dto: SendPushDto) {
    const payload = {
      title: dto.title,
      body: dto.body,
      url: dto.url,
      icon: dto.icon,
    };

    if (dto.customerIds?.length) {
      return this.push.sendToCustomers(dto.customerIds, payload);
    }
    return this.push.sendToAll(payload);
  }
}
