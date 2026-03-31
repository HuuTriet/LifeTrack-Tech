import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Consul from 'consul';

@Injectable()
export class ConsulService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConsulService.name);
  private client: Consul.Consul | null = null;
  private serviceId: string = '';

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const consulHost = this.configService.get<string>('consul.host') || 'localhost';
    const consulPort = this.configService.get<number>('consul.port') || 8500;

    try {
      this.client = new Consul({
        host: consulHost,
        port: String(consulPort),
        promisify: true,
      });
      await this.registerService();
    } catch (err: any) {
      this.logger.warn(`Consul unavailable, running without service discovery: ${err.message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.deregisterService();
  }

  private async registerService(): Promise<void> {
    if (!this.client) return;

    const serviceName = this.configService.get<string>('consul.serviceName') || 'lifetrack-nestjs';
    const serviceId = this.configService.get<string>('consul.serviceId') || 'lifetrack-nestjs-1';
    const serviceHost = this.configService.get<string>('consul.serviceHost') || 'localhost';
    const servicePort = this.configService.get<number>('consul.servicePort') || 3000;
    const healthCheckInterval = this.configService.get<string>('consul.healthCheckInterval') || '10s';
    const tags = this.configService.get<string[]>('consul.tags') || [];

    this.serviceId = serviceId;

    try {
      await (this.client.agent.service as any).register({
        id: serviceId,
        name: serviceName,
        address: serviceHost,
        port: servicePort,
        tags,
        check: {
          http: `http://${serviceHost}:${servicePort}/health`,
          interval: healthCheckInterval,
          deregistercriticalserviceafter: '30s',
        },
      });
      this.logger.log(`Service [${serviceId}] registered with Consul`);
    } catch (err: any) {
      this.logger.warn(`Consul registration skipped: ${err.message}`);
    }
  }

  private async deregisterService(): Promise<void> {
    if (!this.client || !this.serviceId) return;
    try {
      await this.client.agent.service.deregister(this.serviceId);
    } catch {
      // ignore
    }
  }

  async discoverService(serviceName: string): Promise<{ host: string; port: number } | null> {
    if (!this.client) return null;
    try {
      const result: any = await this.client.health.service({ service: serviceName, passing: true });
      if (!result || !Array.isArray(result) || result.length === 0) return null;
      const instance = result[Math.floor(Math.random() * result.length)];
      return { host: instance.Service.Address, port: instance.Service.Port };
    } catch {
      return null;
    }
  }

  async getServiceUrl(serviceName: string, fallbackUrl: string): Promise<string> {
    const instance = await this.discoverService(serviceName);
    if (instance) return `http://${instance.host}:${instance.port}`;
    return fallbackUrl;
  }
}
