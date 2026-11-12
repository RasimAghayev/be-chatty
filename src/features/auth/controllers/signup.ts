import { ObjectId } from 'mongodb';
import { Request, Response } from 'express';
import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { signupSchema } from '@auth/schemes/signup';
import { IAuthDocument, ISignUpData } from '@auth/interfaces/auth.interface';
import { authService } from '@service/db/auth.service';
import { BadRequestError } from '@global/helpers/error-handler';
import { Helpers } from '@global/helpers/helpers';
import { UploadApiResponse } from 'cloudinary';
import { uploads } from '@global/helpers/cloudinary-upload';
import HTTP_STATUS from 'http-status-codes';
import { IUserDocument } from '@user/interfaces/user.interface';
import { UserCache } from '@service/redis/user.cache';
import { config } from '@root/config';
// import Logger from 'bunyan';
import { omit } from 'lodash';
import JWT from 'jsonwebtoken';
import { authQueue } from '@service/queues/auth.queue';
import { userQueue } from '@service/queues/user.queue';

const userCache: UserCache = new UserCache();
// const log: Logger = config.createLogger('userCache');

export class SignUp {
  @joiValidation(signupSchema)
  public async create(req: Request, res: Response): Promise<void> {
    // log.warn(`create user: ${JSON.stringify(req.body)}`);
    const { username, email, password, avatarColor, avatarImage } = req.body;

    const checkIfUserExist: IAuthDocument = await authService.getUserByUsernameOrEmail(username, email);
    if (checkIfUserExist) {
      // log.warn(`User already exist ${JSON.stringify(checkIfUserExist)}`);
      throw new BadRequestError('Invalid credentials');
    }
    // log.warn(`User ${JSON.stringify(checkIfUserExist)}`);

    const authObjectId: ObjectId = new ObjectId();
    // log.warn(`AuhObjectId: ${JSON.stringify(authObjectId)}`);

    const uId = `${Helpers.generateRandomIntegers(12)}`;
    // log.warn(`uId: ${JSON.stringify(uId)}`);

    const authData: IAuthDocument = SignUp.prototype.signUpData({
      _id: authObjectId,
      uId,
      username,
      email,
      password,
      avatarColor,
    });
    // log.warn(`authData: ${JSON.stringify(authData)}`);

    const userObjectId: ObjectId = new ObjectId();
    // log.warn(`userObjectId: ${JSON.stringify(userObjectId)}`);

    const result: UploadApiResponse = (await uploads(avatarImage, `${userObjectId}`, true, true)) as UploadApiResponse;
    if (!result?.public_id) {
      // log.warn(`result not found: ${JSON.stringify(result)}`);
      throw new BadRequestError(' File upload: Error occurred. Try again');
    }
    // log.warn(`result: ${JSON.stringify(result)}`);

    // log.warn(`authData, userObjectId: ${JSON.stringify({ authObjectId, userObjectId })}`);
    const userDataForCache: IUserDocument = SignUp.prototype.userData(authData, userObjectId);
    userDataForCache.profilePicture = `https://res.cloudinary.com/${config.CLOUD_NAME}/image/upload/v${result.version}/${userObjectId}`;
    // log.warn(`userDataForCache: ${JSON.stringify(userDataForCache)}`);

    // log.warn(`userObjectId, uId, userDataForCache: ${JSON.stringify({ userObjectId, uId, userDataForCache })}`);
    await userCache.saveUserToCache(`${userObjectId}`, uId, userDataForCache);

    omit(userDataForCache, ['uID', 'username', 'email', 'avatarColor', 'password']);

    // log.warn(`authQueue.addAuthUserJob: ${JSON.stringify({ value: authData })}`);
    authQueue.addAuthUserJob('addAuthUserToDB', { value: authData });

    // log.warn(`userQueue.addUserJob: ${JSON.stringify({ value: userDataForCache })}`);
    userQueue.addUserJob('addUserToDB', { value: userDataForCache });

    // log.warn(`authData, userObjectId: ${JSON.stringify({ authData, userObjectId })}`);
    const userJwt: string = SignUp.prototype.signupToken(authData, userObjectId);

    req.session = { jwt: userJwt };

    // log.warn(`userDataForCache, userJwt: ${JSON.stringify({ user: userDataForCache, token: userJwt })}`);

    res.status(HTTP_STATUS.CREATED).json({
      message: 'User created successfully.',
      user: userDataForCache,
      token: userJwt,
    });
  }
  private signupToken(data: IAuthDocument, userObjectId: ObjectId): string {
    return JWT.sign(
      {
        userId: userObjectId,
        uId: data.uId,
        email: data.email,
        username: data.username,
        avatarColor: data.avatarColor,
      },
      config.JWT_TOKEN!
    );
  }

  private signUpData(data: ISignUpData): IAuthDocument {
    const { _id, uId, username, email, password, avatarColor } = data;
    return {
      _id,
      uId,
      username: Helpers.firstLetterUppercase(username),
      email: Helpers.lowerCase(email),
      password,
      avatarColor,
      createdAt: new Date(),
    } as IAuthDocument;
  }
  private userData(data: IAuthDocument, userObjectId: ObjectId): IUserDocument {
    // log.warn(`result: ${JSON.stringify({ data, userObjectId })}`);
    const { _id, username, email, uId, password, avatarColor } = data;
    // log.warn(`result: ${JSON.stringify({ _id, username, email, uId, password, avatarColor })}`);
    return {
      _id: userObjectId,
      authId: _id,
      uId,
      username: Helpers.firstLetterUppercase(username),
      email,
      password,
      avatarColor,
      profilePicture: '',
      blocked: [],
      blockedBy: [],
      work: '',
      location: '',
      school: '',
      quote: '',
      bgImageVersion: '',
      bgImageId: '',
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      notifications: {
        messages: true,
        reactions: true,
        comments: true,
        follows: true,
      },
      social: {
        facebook: '',
        instagram: '',
        twitter: '',
        youtube: '',
      },
    } as unknown as IUserDocument;
  }
}
