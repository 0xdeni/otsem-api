import { RolesGuard } from './roles.guard';
import { OwnerOrAdminGuard } from './owner-or-admin.guard';
import { JwtStrategy } from './jwt.strategy';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

function createMockExecutionContext(overrides: {
  user?: any;
  params?: any;
  handlerMetadata?: any;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: overrides.user,
        params: overrides.params || {},
      }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('should allow access when no roles are required', () => {
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);
    const ctx = createMockExecutionContext({ user: { role: 'CUSTOMER' } });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow access when roles array is empty', () => {
    jest.spyOn(reflector, 'get').mockReturnValue([]);
    const ctx = createMockExecutionContext({ user: { role: 'CUSTOMER' } });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow access when user has required role', () => {
    jest.spyOn(reflector, 'get').mockReturnValue(['ADMIN']);
    const ctx = createMockExecutionContext({ user: { role: 'ADMIN' } });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should deny access when user does not have required role', () => {
    jest.spyOn(reflector, 'get').mockReturnValue(['ADMIN']);
    const ctx = createMockExecutionContext({ user: { role: 'CUSTOMER' } });

    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('should deny access when user is not present', () => {
    jest.spyOn(reflector, 'get').mockReturnValue(['ADMIN']);
    const ctx = createMockExecutionContext({ user: undefined });

    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('should deny access when user has no role property', () => {
    jest.spyOn(reflector, 'get').mockReturnValue(['ADMIN']);
    const ctx = createMockExecutionContext({ user: { email: 'test@test.com' } });

    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('should allow access when user has one of multiple required roles', () => {
    jest.spyOn(reflector, 'get').mockReturnValue(['ADMIN', 'CUSTOMER']);
    const ctx = createMockExecutionContext({ user: { role: 'CUSTOMER' } });

    expect(guard.canActivate(ctx)).toBe(true);
  });
});

describe('OwnerOrAdminGuard', () => {
  let guard: OwnerOrAdminGuard;

  const mockPrisma = {
    wallet: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new OwnerOrAdminGuard(mockPrisma as any);
  });

  it('should deny access when no user is present', async () => {
    const ctx = createMockExecutionContext({ user: undefined });

    expect(await guard.canActivate(ctx)).toBe(false);
  });

  it('should allow access for ADMIN users', async () => {
    const ctx = createMockExecutionContext({
      user: { userId: 'admin-1', role: 'ADMIN' },
      params: { id: 'wallet-1' },
    });

    expect(await guard.canActivate(ctx)).toBe(true);
    expect(mockPrisma.wallet.findUnique).not.toHaveBeenCalled();
  });

  it('should deny access when wallet id param is missing', async () => {
    const ctx = createMockExecutionContext({
      user: { userId: 'user-1', role: 'CUSTOMER' },
      params: {},
    });

    expect(await guard.canActivate(ctx)).toBe(false);
  });

  it('should deny access when wallet is not found', async () => {
    mockPrisma.wallet.findUnique.mockResolvedValue(null);
    const ctx = createMockExecutionContext({
      user: { userId: 'user-1', role: 'CUSTOMER' },
      params: { id: 'wallet-1' },
    });

    expect(await guard.canActivate(ctx)).toBe(false);
  });

  it('should allow access when user owns the wallet', async () => {
    mockPrisma.wallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      customerId: 'user-1',
      customer: { id: 'user-1' },
    });
    const ctx = createMockExecutionContext({
      user: { userId: 'user-1', role: 'CUSTOMER' },
      params: { id: 'wallet-1' },
    });

    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('should deny access when user does not own the wallet', async () => {
    mockPrisma.wallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      customerId: 'other-user',
      customer: { id: 'other-user' },
    });
    const ctx = createMockExecutionContext({
      user: { userId: 'user-1', role: 'CUSTOMER' },
      params: { id: 'wallet-1' },
    });

    expect(await guard.canActivate(ctx)).toBe(false);
  });
});

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    strategy = new JwtStrategy();
  });

  it('should return user payload when valid', async () => {
    const payload = {
      sub: 'user-1',
      email: 'test@test.com',
      role: 'CUSTOMER',
      customerId: 'cust-1',
    };

    const result = await strategy.validate(payload);

    expect(result).toEqual({
      sub: 'user-1',
      email: 'test@test.com',
      role: 'CUSTOMER',
      customerId: 'cust-1',
    });
  });

  it('should throw UnauthorizedException when sub is missing', async () => {
    const payload = { email: 'test@test.com', role: 'CUSTOMER' };

    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when email is missing', async () => {
    const payload = { sub: 'user-1', role: 'CUSTOMER' };

    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
