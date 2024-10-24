import dotenv from 'dotenv';
import bunyan from 'bunyan';
import cloudinary from 'cloudinary';

dotenv.config();

class Config {
  public SERVER_PORT: number | undefined;
  public DATABASE_URL: string | undefined;
  public JWT_TOKEN: string | undefined;
  public NODE_ENV: string | undefined;
  public SECRET_KEY_ONE: string | undefined;
  public SECRET_KEY_TWO: string | undefined;
  public CLIENT_URL: string | undefined;
  public REDIS_URL: string | undefined;
  public CLOUD_NAME: string | undefined;
  public CLOUD_API_KEY: string | undefined;
  public CLOUD_API_SECRET: string | undefined;
  public SENDER_HOST: string | undefined;
  public SENDER_PORT: number | undefined;
  public SENDER_EMAIL: string | undefined;
  public SENDER_EMAIL_PASSWORD: string | undefined;
  public SENDERGRID_API_KEY: string | undefined;
  public SENDERGRID_SENDER: string | undefined;

  private readonly DEFAULT_SERVER_PORT: number = Number(process.env.SERVER_PORT) || 5000;
  private readonly DEFAULT_NODE_ENV: string = process.env.NODE_ENV || 'development';

  private readonly DEFAULT_JWT_TOKEN: string = process.env.JWT_TOKEN || 'ThisIsATokenFromMe';
  private readonly DEFAULT_SECRET_KEY_ONE: string = process.env.SECRET_KEY_ONE || 'ThisIsaSecretCookieKeyOne';
  private readonly DEFAULT_SECRET_KEY_TWO: string = process.env.SECRET_KEY_TWO || 'ThisIsaSecretCookieKeyTwo';

  private readonly DEFAULT_DATABASE_URL: string =
    process.env.DATABASE_URL || 'mongodb://root:root@localhost:27017/chattyapp?authSource=admin';
  private readonly DEFAULT_CLIENT_URL: string = process.env.CLIENT_URL || 'http://localhost:3000';
  private readonly DEFAULT_REDIS_URL: string = process.env.REDIS_URL || 'redis://default:eYVX7EwVmmxKPCDmwMtyKVge8oLd2t81@localhost:6379';

  private readonly DEFAULT_CLOUD_NAME: string = process.env.CLOUD_NAME || '';
  private readonly DEFAULT_CLOUD_API_KEY: string = process.env.CLOUD_API_KEY || '';
  private readonly DEFAULT_CLOUD_API_SECRET: string = process.env.CLOUD_API_SECRET || '';

  private readonly DEFAULT_SENDER_HOST: string = process.env.SENDER_HOST || '';
  private readonly DEFAULT_SENDER_PORT: number = Number(process.env.SENDER_PORT) || 587;
  private readonly DEFAULT_SENDER_EMAIL: string = process.env.SENDER_EMAIL || '';
  private readonly DEFAULT_SENDER_EMAIL_PASSWORD: string = process.env.SENDER_EMAIL_PASSWORD || '';
  private readonly DEFAULT_SENDERGRID_API_KEY: string = process.env.SENDERGRID_API_KEY || '';
  private readonly DEFAULT_SENDERGRID_SENDER: string = process.env.SENDERGRID_SENDER || '';
  constructor() {
    this.SERVER_PORT = this.DEFAULT_SERVER_PORT;
    this.DATABASE_URL = this.DEFAULT_DATABASE_URL;
    this.JWT_TOKEN = this.DEFAULT_JWT_TOKEN;
    this.NODE_ENV = this.DEFAULT_NODE_ENV;
    this.SECRET_KEY_ONE = this.DEFAULT_SECRET_KEY_ONE;
    this.SECRET_KEY_TWO = this.DEFAULT_SECRET_KEY_TWO;
    this.CLIENT_URL = this.DEFAULT_CLIENT_URL;
    this.REDIS_URL = this.DEFAULT_REDIS_URL;
    this.CLOUD_NAME = this.DEFAULT_CLOUD_NAME;
    this.CLOUD_API_KEY = this.DEFAULT_CLOUD_API_KEY;
    this.CLOUD_API_SECRET = this.DEFAULT_CLOUD_API_SECRET;
    this.SENDER_HOST = this.DEFAULT_SENDER_HOST;
    this.SENDER_PORT = this.DEFAULT_SENDER_PORT;
    this.SENDER_EMAIL = this.DEFAULT_SENDER_EMAIL;
    this.SENDER_EMAIL_PASSWORD = this.DEFAULT_SENDER_EMAIL_PASSWORD;
    this.SENDERGRID_API_KEY = this.DEFAULT_SENDERGRID_API_KEY;
    this.SENDERGRID_SENDER = this.DEFAULT_SENDERGRID_SENDER;
  }

  public createLogger(name: string): bunyan {
    return bunyan.createLogger({
      name,
      src: false,
      level: 'debug',
      // streams: [
      //   {
      //     path: './logs/all.log',
      //     type: 'rotating-file',
      //     // period: '1d', // daily rotation
      //     // count: 3, // keep 3 back copies
      //   },
      //   {
      //     level: 'info',
      //     stream: process.stdout, // log INFO and above to stdout
      //   },
      //   {
      //     level: 'error',
      //     path: './logs/error.log', // log ERROR and above to a file
      //     type: 'rotating-file',
      //     // period: '1d', // daily rotation
      //     // count: 3, // keep 3 back copies
      //   },
      //   {
      //     level: 'warn',
      //     path: './logs/warning.log', // log ERROR and above to a file
      //     type: 'rotating-file',
      //     // period: '1d', // daily rotation
      //     // count: 3, // keep 3 back copies
      //   },
      // ],
    });
  }
  public validateConfig(): void {
    for (const [key, value] of Object.entries(this)) {
      if (value === undefined) {
        throw new Error(`Configuration ${key} is undefined.`);
      }
    }
  }

  public cloudinaryConfig(): void {
    cloudinary.v2.config({
      cloud_name: this.CLOUD_NAME,
      api_key: this.CLOUD_API_KEY,
      api_secret: this.CLOUD_API_SECRET,
    });
  }
}

export const config: Config = new Config();
