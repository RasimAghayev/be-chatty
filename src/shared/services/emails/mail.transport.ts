import nodemailer from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';
import Logger from 'bunyan';
import sendGridMail from '@sendgrid/mail';
import { config } from '@root/config';
import { BadRequestError } from '@global/helpers/error-handler';

interface IMailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
}

const log: Logger = config.createLogger('mailOptions');

sendGridMail.setApiKey(config.SENDERGRID_API_KEY!);

class MailTransport {
  public async sendEmail(receiverEmail: string, subject: string, body: string): Promise<void> {
    if (config.NODE_ENV === 'production') {
      await this.productionEmailSender(receiverEmail, subject, body);
      return;
    }
    await this.developmentEmailSender(receiverEmail, subject, body);

    // if (config.NODE_ENV === 'development' || config.NODE_ENV === 'test') {
    //   await this.developmentEmailSender(receiverEmail, subject, body);
    // } else if (config.NODE_ENV === 'production') {
    //   await this.productionEmailSender(receiverEmail, subject, body);
    // }
  }
  private async developmentEmailSender(receiverEmail: string, subject: string, body: string): Promise<void> {
    const transporter: Mail = nodemailer.createTransport({
      host: config.SENDER_HOST! as string,
      port: config.SENDER_PORT! as number,
      secure: false,
      auth: {
        user: config.SENDER_EMAIL! as string,
        pass: config.SENDER_EMAIL_PASSWORD! as string,
      },
    });

    const mailOptions: IMailOptions = {
      from: `Chatty App <${config.SENDER_EMAIL!}>` as string,
      to: receiverEmail,
      subject,
      html: body,
    };

    try {
      await transporter.sendMail(mailOptions);
      log.info('Development email sent successfully');
    } catch (error) {
      log.error('Error sending email', error);
      throw new BadRequestError('Email sending email');
    }
  }
  private async productionEmailSender(receiverEmail: string, subject: string, body: string): Promise<void> {
    const mailOptions: IMailOptions = {
      from: `Chatty App <${config.SENDER_EMAIL!}>` as string,
      to: receiverEmail,
      subject,
      html: body,
    };

    try {
      await sendGridMail.send(mailOptions);
      log.info('Production email sent successfully');
    } catch (error) {
      log.error('Error sending email', error);
      throw new BadRequestError('Email sending email');
    }
  }
}

export const mailTransport: MailTransport = new MailTransport();
