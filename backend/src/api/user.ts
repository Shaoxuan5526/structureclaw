import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { UserService } from '../services/user.js';

const userService = new UserService();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  organization: z.string().optional(),
  title: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const updateProfileSchema = z.object({
  name: z.string().optional(),
  organization: z.string().optional(),
  title: z.string().optional(),
  avatar: z.string().optional(),
  bio: z.string().optional(),
  expertise: z.array(z.string()).optional(),
});

export async function userRoutes(fastify: FastifyInstance) {
  // 用户注册
  fastify.post('/register', {
    schema: {
      tags: ['Users'],
      summary: '用户注册',
    },
  }, async (request: FastifyRequest<{ Body: z.infer<typeof registerSchema> }>, reply: FastifyReply) => {
    const body = registerSchema.parse(request.body);
    const result = await userService.register(body);
    return reply.send(result);
  });

  // 用户登录
  fastify.post('/login', {
    schema: {
      tags: ['Users'],
      summary: '用户登录',
    },
  }, async (request: FastifyRequest<{ Body: z.infer<typeof loginSchema> }>, reply: FastifyReply) => {
    const body = loginSchema.parse(request.body);
    const result = await userService.login(body);
    return reply.send(result);
  });

  // 获取当前用户
  fastify.get('/me', {
    schema: {
      tags: ['Users'],
      summary: '获取当前用户信息',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user?.id;
    const user = await userService.getUserById(userId);
    return reply.send(user);
  });

  // 更新用户资料
  fastify.patch('/me', {
    schema: {
      tags: ['Users'],
      summary: '更新用户资料',
    },
  }, async (request: FastifyRequest<{ Body: z.infer<typeof updateProfileSchema> }>, reply: FastifyReply) => {
    const body = updateProfileSchema.parse(request.body);
    const userId = request.user?.id;
    const user = await userService.updateProfile(userId, body);
    return reply.send(user);
  });

  // 获取用户公开资料
  fastify.get('/:id', {
    schema: {
      tags: ['Users'],
      summary: '获取用户公开资料',
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const user = await userService.getPublicProfile(id);
    return reply.send(user);
  });

  // 获取用户技能
  fastify.get('/:id/skills', {
    schema: {
      tags: ['Users'],
      summary: '获取用户创建的技能',
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const skills = await userService.getUserSkills(id);
    return reply.send(skills);
  });

  // 获取用户项目
  fastify.get('/:id/projects', {
    schema: {
      tags: ['Users'],
      summary: '获取用户项目',
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const projects = await userService.getUserProjects(id);
    return reply.send(projects);
  });
}
