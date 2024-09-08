import Joi from 'joi';
import { signupSchema } from '@auth/schemes/signup';

describe('signupSchema', () => {
  it('should validate correct signup data', () => {
    const { error } = signupSchema.validate({
      username: 'user123',
      password: 'pass123',
      email: 'user@example.com',
      avatarColor: 'blue',
      avatarImage: 'imageurl',
    });
    expect(error).toBeUndefined();
  });

  it('should fail for username that is too short', () => {
    const { error } = signupSchema.validate({
      username: 'usr',
      password: 'pass123',
      email: 'user@example.com',
      avatarColor: 'blue',
      avatarImage: 'imageurl',
    });
    expect(error?.details[0]?.message).toBe('Invalid username');
  });

  it('should fail for username that is too long', () => {
    const { error } = signupSchema.validate({
      username: 'user12345',
      password: 'pass123',
      email: 'user@example.com',
      avatarColor: 'blue',
      avatarImage: 'imageurl',
    });
    expect(error?.details[0]?.message).toBe('Invalid username');
  });

  it('should fail for missing username', () => {
    const { error } = signupSchema.validate({
      password: 'pass123',
      email: 'user@example.com',
      avatarColor: 'blue',
      avatarImage: 'imageurl',
    });
    expect(error?.details[0]?.message).toBe('"username" is required');
  });

  it('should fail for password that is too short', () => {
    const { error } = signupSchema.validate({
      username: 'user123',
      password: 'pwd',
      email: 'user@example.com',
      avatarColor: 'blue',
      avatarImage: 'imageurl',
    });
    expect(error?.details[0]?.message).toBe('Invalid password');
  });

  it('should fail for password that is too long', () => {
    const { error } = signupSchema.validate({
      username: 'user123',
      password: 'password123',
      email: 'user@example.com',
      avatarColor: 'blue',
      avatarImage: 'imageurl',
    });
    expect(error?.details[0]?.message).toBe('Invalid password');
  });

  it('should fail for missing password', () => {
    const { error } = signupSchema.validate({
      username: 'user123',
      email: 'user@example.com',
      avatarColor: 'blue',
      avatarImage: 'imageurl',
    });
    expect(error?.details[0]?.message).toBe('"password" is required');
  });

  it('should fail for invalid email format', () => {
    const { error } = signupSchema.validate({
      username: 'user123',
      password: 'pass123',
      email: 'userexample.com', // Invalid email format
      avatarColor: 'blue',
      avatarImage: 'imageurl',
    });
    expect(error?.details[0]?.message).toBe('Email must be valid');
  });

  it('should fail for missing email', () => {
    const { error } = signupSchema.validate({
      username: 'user123',
      password: 'pass123',
      avatarColor: 'blue',
      avatarImage: 'imageurl',
    });
    expect(error?.details[0]?.message).toBe('"email" is required');
  });

  it('should fail for missing avatar color', () => {
    const { error } = signupSchema.validate({
      username: 'user123',
      password: 'pass123',
      email: 'user@example.com',
      avatarImage: 'imageurl',
    });
    expect(error?.details[0]?.message).toBe('Avatar color is required');
  });

  it('should fail for missing avatar image', () => {
    const { error } = signupSchema.validate({
      username: 'user123',
      password: 'pass123',
      email: 'user@example.com',
      avatarColor: 'blue',
    });
    expect(error?.details[0]?.message).toBe('Avatar image is required');
  });
});
