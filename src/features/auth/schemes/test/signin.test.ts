import Joi from 'joi';
import { loginSchema } from '@auth/schemes/signin';

describe('loginSchema', () => {
  it('should validate correct username and password', () => {
    const { error } = loginSchema.validate({
      username: 'user123',
      password: 'pass123',
    });
    expect(error).toBeUndefined();
  });

  it('should fail for username that is too short', () => {
    const { error } = loginSchema.validate({
      username: 'usr',
      password: 'pass123',
    });
    expect(error?.details[0]?.message).toBe('Invalid username');
  });

  it('should fail for username that is too long', () => {
    const { error } = loginSchema.validate({
      username: 'username123',
      password: 'pass123',
    });
    expect(error?.details[0]?.message).toBe('Invalid username');
  });

  it('should fail for missing username', () => {
    const { error } = loginSchema.validate({
      password: 'pass123',
    });
    expect(error?.details[0]?.message).toBe('"username" is required');
  });

  it('should fail for password that is too short', () => {
    const { error } = loginSchema.validate({
      username: 'user123',
      password: 'pwd',
    });
    expect(error?.details[0]?.message).toBe('Invalid password');
  });

  it('should fail for password that is too long', () => {
    const { error } = loginSchema.validate({
      username: 'user123',
      password: 'password123',
    });
    expect(error?.details[0]?.message).toBe('Invalid password');
  });

  it('should fail for missing password', () => {
    const { error } = loginSchema.validate({
      username: 'user123',
    });
    expect(error?.details[0]?.message).toBe('"password" is required');
  });
});
