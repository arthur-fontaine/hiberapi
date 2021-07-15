import { FastifyPluginAsync, FastifySchema } from 'fastify';
import prisma from '../../../utils/prisma';
import s3 from '../../../utils/s3';

const schema: FastifySchema = {};

interface IQuerystring {}
interface IParams {
  id: string;
}
interface IBody {}
interface IHeaders {}

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get<{
    Querystring: IQuerystring;
    Params: IParams;
    Body: IBody;
    Headers: IHeaders;
  }>('/', { schema }, async (request, reply) => {
    const file = await prisma.file.findUnique({
      where: { hiberfileId: request.params.id },
    });

    if (file === null) return reply.notFound();
    if (file.uploading) return reply.code(425).send();

    try {
      await s3
        .headObject({ Bucket: 'hiberstorage', Key: file.hiberfileId })
        .promise();
    } catch {
      return reply.notFound();
    }

    const downloadUrl = await s3.getSignedUrlPromise('getObject', {
      Bucket: 'hiberstorage',
      Key: file.hiberfileId,
      Expires: 60 * 60 * 2,
      ResponseContentDisposition: `attachment; filename ="${file.name}"`,
    });

    return reply.send({
      downloadUrl,
      filename: file.name,
      expire: file.expire,
    });
  });
};

export default route;