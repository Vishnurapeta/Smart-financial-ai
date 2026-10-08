import nodemailer, { Transporter } from 'nodemailer';
import { Types } from 'mongoose';
import {
  IDeliveryChannel,
  DeliveryPayload,
  ChannelDeliveryResult,
} from './channel.interface.js';
import { NotificationChannel } from '../../../models/notification.model.js';
import {
  NotificationDelivery,
  DeliveryStatus,
} from '../../../models/notification-delivery.model.js';
import { User } from '../../../models/user.model.js';
import { env } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';

export class EmailChannel implements IDeliveryChannel {
  public readonly channelName = NotificationChannel.EMAIL;
  private transporter: Transporter | null = null;
  private isConfigured = false;

  constructor() {
    this.initTransporter();
  }

  private initTransporter(): void {
    try {
      if (env.SMTP_ENABLED && env.SMTP_HOST && env.SMTP_USER) {
        this.transporter = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          },
        });
        this.isConfigured = true;
        logger.info(`[EmailChannel] Configured with SMTP server ${env.SMTP_HOST}:${env.SMTP_PORT}`);
      } else {
        // Resilient development/testing mock transport
        this.transporter = nodemailer.createTransport({
          streamTransport: true,
          newline: 'windows',
        });
        this.isConfigured = false;
        logger.info('[EmailChannel] SMTP disabled or not configured; utilizing mock mailer transport');
      }
    } catch (err: unknown) {
      const error = err as Error;
      logger.warn({ error: error.message }, '[EmailChannel] Failed to initialize mailer, fallback to mock');
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'windows',
      });
      this.isConfigured = false;
    }
  }

  public async send(payload: DeliveryPayload): Promise<ChannelDeliveryResult> {
    const now = new Date();
    let recipientEmail = payload.userEmail;

    try {
      // 1. Resolve recipient email if not provided
      if (!recipientEmail) {
        const user = await User.findById(payload.userId).select('email isEmailVerified');
        if (!user || !user.email) {
          logger.warn({ userId: payload.userId }, '[EmailChannel] Cannot send email: User email not found');
          return {
            channel: NotificationChannel.EMAIL,
            success: false,
            error: 'User email not found',
          };
        }
        recipientEmail = user.email;
      }

      if (!this.transporter) {
        this.initTransporter();
      }

      const mailOptions = {
        from: env.SMTP_FROM,
        to: recipientEmail,
        subject: `[SmartFin AI] ${payload.title}`,
        text: payload.message,
        html: payload.htmlBody || `<p>${payload.message}</p>`,
      };

      const info = await this.transporter!.sendMail(mailOptions);
      logger.info(
        { recipient: recipientEmail, messageId: info.messageId, isMock: !this.isConfigured },
        '[EmailChannel] Email dispatched successfully',
      );

      // Record delivery audit
      await NotificationDelivery.create({
        notificationId: new Types.ObjectId(payload.notificationId),
        userId: new Types.ObjectId(payload.userId),
        channel: NotificationChannel.EMAIL,
        status: DeliveryStatus.DELIVERED,
        recipient: recipientEmail,
        metadata: { messageId: info.messageId, isMock: !this.isConfigured },
        deliveredAt: now,
        attemptCount: 1,
      });

      return {
        channel: NotificationChannel.EMAIL,
        success: true,
        recipient: recipientEmail,
        deliveredAt: now,
      };
    } catch (err: unknown) {
      const error = err as Error;
      logger.error(
        { error: error.message, recipient: recipientEmail, notificationId: payload.notificationId },
        '[EmailChannel] Failed to deliver email',
      );

      try {
        await NotificationDelivery.create({
          notificationId: new Types.ObjectId(payload.notificationId),
          userId: new Types.ObjectId(payload.userId),
          channel: NotificationChannel.EMAIL,
          status: DeliveryStatus.FAILED,
          recipient: recipientEmail,
          error: error.message,
          failedAt: now,
          attemptCount: 1,
        });
      } catch {
        // Ignore audit logging error
      }

      return {
        channel: NotificationChannel.EMAIL,
        success: false,
        recipient: recipientEmail,
        error: error.message,
      };
    }
  }
}

export const emailChannel = new EmailChannel();
