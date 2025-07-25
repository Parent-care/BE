require('dotenv').config();
const Hapi = require('@hapi/hapi');
const winston = require('./utils/logger');
const { initDB } = require('./config/db');

const fs = require('fs');
const path = require('path');

const Inert = require('@hapi/inert');

const forumRoutes = require('./routes/forum.routes');
const parentMatchRoutes = require('./routes/parentmatch.routes');
const authRoutes = require('./routes/auth.routes');

const init = async () => {
  try {
    console.log("🚀 Starting ParentCare backend...");
    const PORT = process.env.PORT;

    if (!PORT) {
      throw new Error("🚨 Environment variable PORT belum tersedia. Railway membutuhkan ini!");
    }

    const server = Hapi.server({
      port: PORT,
      host: '0.0.0.0',
      routes: {
        cors: {
          credentials: true,
        },
        files: {
          relativeTo: path.join(__dirname, 'public')
        }
      }
    });

    server.ext('onRequest', (request, h) => {
      winston.info(`[REQ] ${request.method.toUpperCase()} ${request.path}`);
      return h.continue;
    });

    await initDB();
    await server.register(Inert);

    server.route([
      {
        method: 'GET',
        path: '/',
        handler: (request, h) => {
          return h.response({ status: 'ok', message: 'ParentCare Backend is alive!' });
        }
      },
      ...forumRoutes,
      ...parentMatchRoutes,
      ...authRoutes,
      {
        method: 'OPTIONS',
        path: '/{any*}',
        handler: (request, h) => {
          return h
            .response('OK')
            .code(200)
            .header('Access-Control-Allow-Origin', 'https://front-parent.vercel.app')
            .header('Access-Control-Allow-Credentials', 'true')
            .header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            .header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        }
      }
    ]);

    server.route({
      method: 'GET',
      path: '/uploads/{param*}',
      handler: {
        directory: {
          path: 'uploads',
          listing: false,
          index: false
        }
      }
    });

    server.route({
      method: 'GET',
      path: '/debug/uploads',
      handler: (request, h) => {
        const uploadPath = path.join(__dirname, 'public', 'uploads', 'avatars');
        if (!fs.existsSync(uploadPath)) {
          return h.response({ error: 'Folder not found' }).code(404);
        }

        const files = fs.readdirSync(uploadPath);
        return h.response({ files });
      }
    });

    server.ext('onPreResponse', (request, h) => {
      const response = request.response;
      const cookies = response.headers?.['set-cookie'] || response.output?.headers?.['set-cookie'];
      console.log('🍪 Set-Cookie Headers:', cookies);

      const corsHeaders = {
        'Access-Control-Allow-Origin': 'https://front-parent.vercel.app',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
      };

      if (response.isBoom) {
        Object.entries(corsHeaders).forEach(([key, value]) => {
          response.output.headers[key] = value;
        });
        return h.continue;
      }

      winston.info(`🔧 CORS headers added for ${request.path}`);

      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.header(key, value);
      });

      return h.continue;
    });

    await server.start();
    console.log(`✅ Server running at: ${server.info.uri}`);
    winston.info(`Server running at: ${server.info.uri}`);
  } catch (err) {
    console.error('❌ Server failed to start:', err);
    winston.error(err);
    process.exit(1);
  }
};

process.on('unhandledRejection', (err) => {
  console.error('🚨 Unhandled Rejection:', err);
  winston.error(err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('🔥 Uncaught Exception:', err);
  winston.error(err);
  process.exit(1);
});

init();
