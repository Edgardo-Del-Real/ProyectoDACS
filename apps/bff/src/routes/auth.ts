import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';

interface RegisterBody {
  email: string;
  password: string;
  nombre?: string;
  rol?: 'AGRICULTOR' | 'COOPERATIVA' | 'TECNICO';
}

interface LoginBody {
  email: string;
  password: string;
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  // US-02: Registro de usuario
  app.post<{ Body: RegisterBody }>(
    '/register',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            nombre: { type: 'string' },
            rol: {
              type: 'string',
              enum: ['AGRICULTOR', 'COOPERATIVA', 'TECNICO'],
              default: 'AGRICULTOR',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password, nombre, rol = 'AGRICULTOR' } = request.body;

      const normalizedEmail = email.toLowerCase().trim();

      // Criterio 2: Validar si el email ya existe
      const existingUser = await prisma.usuario.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'El correo electrónico ya está registrado',
        });
      }

      // Criterio 4: Guardar contraseña con hash bcrypt
      const passwordHash = await bcrypt.hash(password, 10);

      const user = await prisma.usuario.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          nombre: nombre?.trim() || null,
          rol,
        },
        select: {
          id: true,
          email: true,
          nombre: true,
          rol: true,
          createdAt: true,
        },
      });

      return reply.code(201).send({
        message: 'Usuario registrado exitosamente',
        user,
      });
    }
  );

  // US-03: Inicio de sesión
  app.post<{ Body: LoginBody }>(
    '/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;
      const normalizedEmail = email.toLowerCase().trim();

      const user = await prisma.usuario.findUnique({
        where: { email: normalizedEmail },
      });

      // Criterio 2: Si falla, responder 401 sin indicar cuál de los datos falló
      if (!user) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Credenciales inválidas',
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Credenciales inválidas',
        });
      }

      // Criterio 1: Token JWT con expiración
      const token = app.jwt.sign({
        id: user.id,
        email: user.email,
        rol: user.rol,
      });

      return reply.code(200).send({
        token,
        user: {
          id: user.id,
          email: user.email,
          nombre: user.nombre,
          rol: user.rol,
        },
      });
    }
  );

  // Verificación de sesión / usuario actual (Ruta protegida)
  app.get(
    '/me',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const user = await prisma.usuario.findUnique({
        where: { id: request.user.id },
        select: {
          id: true,
          email: true,
          nombre: true,
          rol: true,
          createdAt: true,
        },
      });

      if (!user) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Usuario no encontrado',
        });
      }

      return reply.code(200).send({ user });
    }
  );
};
