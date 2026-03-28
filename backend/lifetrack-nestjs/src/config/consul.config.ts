import { registerAs } from '@nestjs/config';

export default registerAs('consul', () => ({
  host: process.env.CONSUL_HOST || 'localhost',
  port: parseInt(process.env.CONSUL_PORT || '8500', 10) || 8500,
  serviceName: process.env.SERVICE_NAME || 'lifetrack-medication-service',
  serviceId: process.env.SERVICE_ID || 'lifetrack-medication-service-1',
  serviceHost: process.env.SERVICE_HOST || 'localhost',
  servicePort: parseInt(process.env.SERVICE_PORT || '3001', 10) || 3001,
  healthCheckInterval: process.env.CONSUL_HEALTH_CHECK_INTERVAL || '10s',
  healthCheckTimeout: process.env.CONSUL_HEALTH_CHECK_TIMEOUT || '5s',
  tags: ['nestjs', 'medication', 'v1'],
}));
