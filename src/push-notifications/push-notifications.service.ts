import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webPush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  [key: string]: unknown;
}

@Injectable()
export class PushNotificationsService implements OnModuleInit {
  private readonly logger = new Logger(PushNotificationsService.name);
  private enabled = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT') || 'mailto:no-reply@otsembank.com';

    if (publicKey && privateKey) {
      webPush.setVapidDetails(subject, publicKey, privateKey);
      this.enabled = true;
      this.logger.log('VAPID keys configured — push notifications enabled');
    } else {
      this.logger.warn('VAPID keys not set — push notifications disabled');
    }
  }

  async subscribe(customerId: string, endpoint: string, p256dh: string, auth: string, userAgent?: string) {
    return this.prisma.pushSubscription.upsert({
      where: { customerId_endpoint: { customerId, endpoint } },
      update: { p256dh, auth, userAgent },
      create: { customerId, endpoint, p256dh, auth, userAgent },
    });
  }

  async unsubscribe(customerId: string, endpoint: string) {
    return this.prisma.pushSubscription.deleteMany({
      where: { customerId, endpoint },
    });
  }

  async unsubscribeAll(customerId: string) {
    return this.prisma.pushSubscription.deleteMany({
      where: { customerId },
    });
  }

  async sendToCustomer(customerId: string, payload: PushPayload) {
    if (!this.enabled) {
      this.logger.warn('Push disabled — skipping notification');
      return { sent: 0, failed: 0 };
    }

    const subs = await this.prisma.pushSubscription.findMany({
      where: { customerId },
    });

    return this.sendToSubscriptions(subs, payload);
  }

  async sendToCustomers(customerIds: string[], payload: PushPayload) {
    if (!this.enabled) {
      this.logger.warn('Push disabled — skipping notification');
      return { sent: 0, failed: 0 };
    }

    const subs = await this.prisma.pushSubscription.findMany({
      where: { customerId: { in: customerIds } },
    });

    return this.sendToSubscriptions(subs, payload);
  }

  async sendToAll(payload: PushPayload) {
    if (!this.enabled) {
      this.logger.warn('Push disabled — skipping notification');
      return { sent: 0, failed: 0 };
    }

    const subs = await this.prisma.pushSubscription.findMany();
    return this.sendToSubscriptions(subs, payload);
  }

  private async sendToSubscriptions(
    subs: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>,
    payload: PushPayload,
  ) {
    let sent = 0;
    let failed = 0;
    const staleIds: string[] = [];

    const body = JSON.stringify(payload);

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webPush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body,
          );
          sent++;
        } catch (err: any) {
          failed++;
          // 404 or 410 means the subscription is no longer valid
          if (err.statusCode === 404 || err.statusCode === 410) {
            staleIds.push(sub.id);
          } else {
            this.logger.error(`Push failed for ${sub.endpoint}: ${err.message}`);
          }
        }
      }),
    );

    // Clean up stale subscriptions
    if (staleIds.length > 0) {
      await this.prisma.pushSubscription.deleteMany({
        where: { id: { in: staleIds } },
      });
      this.logger.log(`Removed ${staleIds.length} stale push subscription(s)`);
    }

    this.logger.log(`Push sent: ${sent}, failed: ${failed}, stale removed: ${staleIds.length}`);
    return { sent, failed, staleRemoved: staleIds.length };
  }
}
