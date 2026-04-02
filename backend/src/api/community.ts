import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { CommunityService } from '../services/community.js';

const communityService = new CommunityService();

const createPostSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  category: z.enum(['discussion', 'question', 'tutorial', 'case-study', 'news', 'showcase']),
  tags: z.array(z.string()),
  attachments: z.array(z.string()).optional(),
  projectId: z.string().optional(),
});

const createCommentSchema = z.object({
  content: z.string().min(1),
  parentId: z.string().optional(),
});

export async function communityRoutes(fastify: FastifyInstance) {
  // 帖子相关
  fastify.get('/posts', {
    schema: {
      tags: ['Community'],
      summary: '获取帖子列表',
    },
  }, async (request: FastifyRequest<{ Querystring: { category?: string; tag?: string; sort?: string; page?: number; limit?: number } }>, reply: FastifyReply) => {
    const { category, tag, sort, page = 1, limit = 20 } = request.query;
    const posts = await communityService.listPosts({ category, tag, sort, page, limit });
    return reply.send(posts);
  });

  fastify.post('/posts', {
    schema: {
      tags: ['Community'],
      summary: '创建帖子',
    },
  }, async (request: FastifyRequest<{ Body: z.infer<typeof createPostSchema> }>, reply: FastifyReply) => {
    const body = createPostSchema.parse(request.body);
    const userId = request.user?.id;
    const post = await communityService.createPost({ ...body, authorId: userId });
    return reply.send(post);
  });

  fastify.get('/posts/:id', {
    schema: {
      tags: ['Community'],
      summary: '获取帖子详情',
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const post = await communityService.getPost(id);
    return reply.send(post);
  });

  fastify.post('/posts/:id/like', {
    schema: {
      tags: ['Community'],
      summary: '点赞帖子',
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const userId = request.user?.id;
    const result = await communityService.likePost(id, userId);
    return reply.send(result);
  });

  // 评论相关
  fastify.get('/posts/:id/comments', {
    schema: {
      tags: ['Community'],
      summary: '获取帖子评论',
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const comments = await communityService.getComments(id);
    return reply.send(comments);
  });

  fastify.post('/posts/:id/comments', {
    schema: {
      tags: ['Community'],
      summary: '添加评论',
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: z.infer<typeof createCommentSchema> }>, reply: FastifyReply) => {
    const { id } = request.params;
    const body = createCommentSchema.parse(request.body);
    const userId = request.user?.id;
    const comment = await communityService.createComment({ ...body, postId: id, authorId: userId });
    return reply.send(comment);
  });

  // 知识库
  fastify.get('/knowledge', {
    schema: {
      tags: ['Community'],
      summary: '获取知识库列表',
    },
  }, async (request: FastifyRequest<{ Querystring: { category?: string } }>, reply: FastifyReply) => {
    const { category } = request.query;
    const items = await communityService.listKnowledge(category);
    return reply.send(items);
  });

  // 标签
  fastify.get('/tags', {
    schema: {
      tags: ['Community'],
      summary: '获取热门标签',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tags = await communityService.getPopularTags();
    return reply.send(tags);
  });

  // 搜索
  fastify.get('/search', {
    schema: {
      tags: ['Community'],
      summary: '搜索社区内容',
    },
  }, async (request: FastifyRequest<{ Querystring: { q: string; type?: string } }>, reply: FastifyReply) => {
    const { q, type } = request.query;
    const results = await communityService.search(q, type);
    return reply.send(results);
  });
}
