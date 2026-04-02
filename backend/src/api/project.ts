import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ProjectService } from '../services/project.js';

const projectService = new ProjectService();

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['building', 'bridge', 'tower', 'industrial', 'residential', 'other']),
  location: z.object({
    city: z.string(),
    province: z.string(),
    seismicZone: z.number(),
    windZone: z.number(),
  }).optional(),
  settings: z.object({
    designCode: z.enum(['GB50010', 'GB50017', 'GB50011', 'JGJ3', 'custom']),
    concreteGrade: z.string().optional(),
    steelGrade: z.string().optional(),
  }).optional(),
});

export async function projectRoutes(fastify: FastifyInstance) {
  // 创建项目
  fastify.post('/', {
    schema: {
      tags: ['Projects'],
      summary: '创建新项目',
    },
  }, async (request: FastifyRequest<{ Body: z.infer<typeof createProjectSchema> }>, reply: FastifyReply) => {
    const body = createProjectSchema.parse(request.body);
    const userId = request.user?.id;

    const project = await projectService.createProject({
      ...body,
      ownerId: userId,
    });

    return reply.send(project);
  });

  // 获取项目列表
  fastify.get('/', {
    schema: {
      tags: ['Projects'],
      summary: '获取项目列表',
    },
  }, async (request: FastifyRequest<{ Querystring: { status?: string; search?: string } }>, reply: FastifyReply) => {
    const { status, search } = request.query;
    const userId = request.user?.id;

    const projects = await projectService.listProjects(userId, { status, search });
    return reply.send(projects);
  });

  // 获取项目详情
  fastify.get('/:id', {
    schema: {
      tags: ['Projects'],
      summary: '获取项目详情',
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const project = await projectService.getProject(id);
    return reply.send(project);
  });

  // 更新项目
  fastify.patch('/:id', {
    schema: {
      tags: ['Projects'],
      summary: '更新项目',
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const { id } = request.params;
    const body = request.body as Record<string, unknown>;
    const project = await projectService.updateProject(id, body);
    return reply.send(project);
  });

  // 删除项目
  fastify.delete('/:id', {
    schema: {
      tags: ['Projects'],
      summary: '删除项目',
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    await projectService.deleteProject(id);
    return reply.send({ success: true });
  });

  // 项目成员管理
  fastify.post('/:id/members', {
    schema: {
      tags: ['Projects'],
      summary: '添加项目成员',
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { userId: string; role: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { userId, role } = request.body;
    const member = await projectService.addMember(id, userId, role);
    return reply.send(member);
  });

  // 项目统计
  fastify.get('/:id/stats', {
    schema: {
      tags: ['Projects'],
      summary: '获取项目统计',
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const stats = await projectService.getProjectStats(id);
    return reply.send(stats);
  });
}
