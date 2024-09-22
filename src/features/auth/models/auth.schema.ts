import { hash, compare } from 'bcryptjs';
import { IAuthDocument } from '@auth/interfaces/auth.interface';
import { model, Model, Schema } from 'mongoose';

const SALT_ROUND = 10;

const authSchema: Schema = new Schema(
  {
    username: { type: String },
    uId: { type: String },
    email: { type: String },
    password: { type: String },
    avatarColor: { type: String },
    createdAt: { type: Date, default: Date.now },
    passwordResetToken: { type: String, default: '' },
    passwordResetExpires: { type: Number },
  },
  {
    toJSON: {
      transform(_doc, ret) {
        delete ret.password; // Remove password from output
        return ret;
      },
    },
  }
);

authSchema.pre('save', async function (this: IAuthDocument, next: () => void) {
  if (this.isModified('password')) {
    // Hash password only if it's been modified
    this.password = await hash(this.password as string, SALT_ROUND);
  }
  next();
});

authSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return compare(password, this.password as string);
};

authSchema.methods.hashPassword = async function (password: string): Promise<string> {
  return hash(password, SALT_ROUND);
};

// No need to specify collection name explicitly
const AuthModel: Model<IAuthDocument> = model<IAuthDocument>('Auth', authSchema);

export { AuthModel };
