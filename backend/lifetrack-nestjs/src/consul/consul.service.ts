import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Consul from 'consul';

@Injectable()
export class ConsulService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConsulService.name);
  private client: Consul.Consul;
  private serviceId: string;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const consulHost = this.configService.get<string>('consul.host');
    const consulPort = this.configService.get<number>('consul.port');

    this.client = new Consul({
      host: consulHost,
      port: consulPort.toString(),
      promisify: true,
    });

    await this.registerService();
  }

  async onModuleDestroy(): Promise<void> {
    await this.deregisterService();
  }

  /**
   * Register this NestJS service instance with Consul.
   * Consul will perform HTTP health checks against /health endpoint.
   */
  private async registerService(): Promise<void> {
    const serviceName = this.configService.get<string>('consul.serviceName');
    const serviceId = this.configService.get<string>('consul.serviceId');
    const serviceHost = this.configService.get<string>('consul.serviceHost');
    const servicePort = this.configService.get<number>('consul.servicePort');
    const healthCheckInterval = this.configService.get<string>(
      'consul.healthCheckInterval',
    );
    const healthCheckTimeout = this.configService.get<string>(
      'consul.healthCheckTimeout',
    );
    const tags = this.configService.get<string[]>('consul.tags');

    this.serviceId = serviceId;

    const registrationPayload: Consul.Agent.Service.RegisterOptions = {
      id: serviceId,
      name: serviceName,
      address: serviceHost,
      port: servicePort,
      tags,
      check: {
        http: `http://${serviceHost}:${servicePort}/health`,
        interval: healthCheckInterval,
        timeout: healthCheckTimeout,
        deregistercriticalserviceafter: '30s',
      },
      meta: {
        version: '1.0.0',
        framework: 'nestjs',
        domain: 'medication',
      },
    };

    try {
      await this.client.agent.service.register(registrationPayload);
      this.logger.log(
        `Service [${serviceId}] registered with Consul at ${consulHost}:${consulPort}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to register service with Consul: ${err.message}`,
        err.stack,
      );
      // Non-fatal: service continues to run without Consul registration
    }
  }

  private async deregisterService(): Promise<void> {
    if (!this.serviceId) return;
    try {
      await this.client.agent.service.deregister(this.serviceId);
      this.logger.log(`Service [${this.serviceId}] deregistered from Consul`);
    } catch (err) {
      this.logger.warn(
        `Failed to deregister service from Consul: ${err.message}`,
      );
    }
  }

  /**
   * Discover healthy instances of a given service from Consul catalog.
   * Used for inter-service communication (e.g. calling OCR service, Drug Interaction API).
   */
  async discoverService(
    serviceName: string,
  ): Promise<{ host: string; port: number } | null> {
    try {
      const result = await this.client.health.service({
        service: serviceName,
        passing: true, // only healthy instances
      });

      if (!result || result.length === 0) {
        this.logger.warn(
          `No healthy instances found for service: ${serviceName}`,
        );
        return null;
      }

      // Simple random load balancing among healthy instances
      const instance = result[Math.floor(Math.random() * result.length)];
      const { Address, Port } = instance.Service;
      return { host: Address, port: Port };
    } catch (err) {
      this.logger.error(
        `Consul service discovery failed for [${serviceName}]: ${err.message}`,
      );
      return null;
    }
  }

  /**
   * Get the URL for a discovered service (http://host:port).
   * Falls back to environment variable if Consul is unavailable.
   */
  async getServiceUrl(
    serviceName: string,
    fallbackUrl: string,
  ): Promise<string> {
    const instance = await this.discoverService(serviceName);
    if (instance) {
      return `http://${instance.host}:${instance.port}`;
    }
    this.logger.warn(
      `Using fallback URL for ${serviceName}: ${fallbackUrl}`,
    );
    return fallbackUrl;
  }
}
