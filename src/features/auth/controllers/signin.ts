import { Request, Response } from 'express';
import { config } from '@root/config';
import JWT from 'jsonwebtoken';
import { joiValidation } from '@global/decorators/joi-validation.decorators';
import HTTP_STATUS from 'http-status-codes';
import { authService } from '@service/db/auth.service';
import { BadRequestError } from '@global/helpers/error-handler';
import { loginSchema } from '@auth/schemes/signin';
import { IAuthDocument } from '@auth/interfaces/auth.interface';
import { IResetPasswordParams, IUserDocument } from '@user/interfaces/user.interface';
import { userService } from '@service/db/user.service';
// import { emailQueue } from '@service/queues/email.queue';
import publicIP from 'ip';
import dayjs from 'dayjs';
// import { forgotPasswordTemplate } from '@service/emails/templates/forgot-password/forgot-password-template';
// import { resetPasswordTemplate } from '@service/emails/templates/reset-password/reset-password-template';

export class SignIn {
  @joiValidation(loginSchema)
  public async read(req: Request, res: Response): Promise<void> {
    const { username, password } = req.body;
    // const existingUser: IAuthDocument = await authService.getUserByUsernameOrEmail(username);
    const existingUser: IAuthDocument = await authService.getAuthUserByUsername(username);
    if (!existingUser) {
      throw new BadRequestError('Invalid credentials');
    }
    const passwordMatch: boolean = await existingUser.comparePassword(password);
    if (!passwordMatch) {
      throw new BadRequestError('Invalid credentials');
    }

    const user: IUserDocument = await userService.getUserByAuthId(`${existingUser._id}`);
    const userJwt: string = JWT.sign(
      {
        userId: user._id,
        uId: existingUser.uId,
        email: existingUser.email,
        username: existingUser.username,
        avatarColor: existingUser.avatarColor,
      },
      config.JWT_TOKEN!
    );
    const templateParams: IResetPasswordParams = {
      username: existingUser.username!,
      email: existingUser.email!,
      ipaddress: publicIP.address(),
      date: dayjs().format('DD/MM/YYYY HH:mm:ss'),
    };
    // const resetLink = `${config.CLIENT_URL}/reset-password?token=${userJwt}`;
    // const template1: string = forgotPasswordTemplate.forgotPasswordConfirmationTemplate(existingUser.username!, resetLink);
    // const template2: string = resetPasswordTemplate.passwordResetConfirmationTemplate(templateParams);
    // emailQueue.addEmailJob('forgotPasswordEmail', {
    //   template: template1,
    //   receiverEmail: 'daphney19@ethereal.email',
    //   subject: 'forgotPasswordEmailTemplate',
    // });
    // emailQueue.addEmailJob('forgotPasswordEmail', {
    //   template: template2,
    //   receiverEmail: 'daphney19@ethereal.email',
    //   subject: 'passwordResetConfirmationTemplate',
    // });

    req.session = { jwt: userJwt };
    const userDocument: IUserDocument = {
      ...user,
      authId: existingUser!._id,
      username: existingUser!.username,
      email: existingUser!.email,
      avatarColor: existingUser!.avatarColor,
      uId: existingUser!.uId,
      createdAt: existingUser!.createdAt,
    } as IUserDocument;

    res.status(HTTP_STATUS.OK).json({
      message: 'User login successfully.',
      user: userDocument,
      token: userJwt,
    });
  }
}
