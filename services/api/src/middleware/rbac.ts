import { FastifyRequest, FastifyReply } from 'fastify';

interface JwtPayload {
  sub: string;
  org: string;
  role: string;
}

export function requireRole(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const user = request.user as JwtPayload;

      if (!allowedRoles.includes(user.role)) {
        return reply.code(403).send({ error: 'Forbidden: Insufficient privileges' });
      }
    } catch (err) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  };
}
