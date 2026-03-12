import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@nestjs/common';
import { WhatsappTenantConfig } from '../entities/whatsapp-tenant-config.entity';
import { WhatsappConfigService } from '../services/whatsapp-config.service';
import { WhatsappConfigInput } from '../dto/whatsapp-config.input';
import { WhatsappTestResult } from '../dto/whatsapp-test-result';

@Resolver(() => WhatsappTenantConfig)
export class WhatsappConfigResolver {
  private readonly logger = new Logger(WhatsappConfigResolver.name);

  constructor(
    private readonly configService: WhatsappConfigService,
    private readonly httpService: HttpService,
  ) {}

  @Query(() => WhatsappTenantConfig, {
    name: 'whatsappConfig',
    nullable: true,
  })
  async getConfig(): Promise<WhatsappTenantConfig | null> {
    return this.configService.getConfig();
  }

  @Mutation(() => WhatsappTenantConfig, { name: 'upsertWhatsappConfig' })
  async upsertConfig(
    @Args('input') input: WhatsappConfigInput,
  ): Promise<WhatsappTenantConfig> {
    return this.configService.upsertConfig(input);
  }

  @Mutation(() => Boolean, { name: 'testWhatsappConnection' })
  async testConnection(): Promise<boolean> {
    try {
      const { config, apiKey } = await this.getConfigWithKey();
      if (!config || !apiKey) return false;

      const response = await firstValueFrom(
        this.httpService.get(`${config.gatewayUrl}/whatsapp/health`, {
          headers: {
            'x-tenant-id': config.tenantApiId,
            'x-tenant-api-key': apiKey,
          },
          timeout: 5000,
        }),
      );
      return response.status === 200;
    } catch (error: any) {
      this.logger.warn(`Connection test failed: ${error?.message}`);
      return false;
    }
  }

  @Mutation(() => WhatsappTestResult, { name: 'testWhatsappDirect' })
  async testDirect(
    @Args('phone') phone: string,
    @Args('name') name: string,
    @Args('message', { nullable: true }) message?: string,
  ): Promise<WhatsappTestResult> {
    try {
      const { config, apiKey } = await this.getConfigWithKey();
      if (!config || !apiKey) {
        return { success: false, message: 'Configurazione WhatsApp mancante o API key non decifrabile' };
      }

      const payload: any = { phone, name };
      if (message) payload.message = message;

      const response = await firstValueFrom(
        this.httpService.post(`${config.gatewayUrl}/whatsapp/test/direct`, payload, {
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': config.tenantApiId,
            'x-tenant-api-key': apiKey,
          },
          timeout: 10000,
        }),
      );

      return { success: true, message: 'Messaggio diretto inviato', data: response.data };
    } catch (error: any) {
      const gatewayResponse = error?.response?.data;
      this.logger.error(`Direct test failed: ${error?.message}`);
      this.logger.error(`Gateway response status: ${error?.response?.status}`);
      this.logger.error(`Gateway response body: ${JSON.stringify(gatewayResponse)}`);
      return {
        success: false,
        message: gatewayResponse?.message || error?.message,
        data: gatewayResponse,
      };
    }
  }

  @Mutation(() => WhatsappTestResult, { name: 'testWhatsappRecap' })
  async testRecap(
    @Args('phone') phone: string,
    @Args('name') name: string,
  ): Promise<WhatsappTestResult> {
    try {
      const { config, apiKey } = await this.getConfigWithKey();
      if (!config || !apiKey) {
        return { success: false, message: 'Configurazione WhatsApp mancante o API key non decifrabile' };
      }

      const response = await firstValueFrom(
        this.httpService.post(
          `${config.gatewayUrl}/whatsapp/test/recap`,
          { phone, name },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-id': config.tenantApiId,
              'x-tenant-api-key': apiKey,
            },
            timeout: 10000,
          },
        ),
      );

      return { success: true, message: 'Test recap schedulato (recap 60s, reminder 5min)', data: response.data };
    } catch (error: any) {
      const gatewayResponse = error?.response?.data;
      this.logger.error(`Recap test failed: ${error?.message}`);
      this.logger.error(`Gateway response status: ${error?.response?.status}`);
      this.logger.error(`Gateway response body: ${JSON.stringify(gatewayResponse)}`);
      return {
        success: false,
        message: gatewayResponse?.message || error?.message,
        data: gatewayResponse,
      };
    }
  }

  @Mutation(() => WhatsappTestResult, { name: 'testWhatsappFullFlow' })
  async testFullFlow(
    @Args('phone') phone: string,
    @Args('name') name: string,
  ): Promise<WhatsappTestResult> {
    try {
      const { config, apiKey } = await this.getConfigWithKey();
      if (!config || !apiKey) {
        return { success: false, message: 'Configurazione WhatsApp mancante o API key non decifrabile' };
      }

      const response = await firstValueFrom(
        this.httpService.post(
          `${config.gatewayUrl}/whatsapp/test/full-flow`,
          { phone, name },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-id': config.tenantApiId,
              'x-tenant-api-key': apiKey,
            },
            timeout: 10000,
          },
        ),
      );

      return {
        success: true,
        message: 'Test flusso completo schedulato (recap 60s, 3 reminder 5/6/7min)',
        data: response.data,
      };
    } catch (error: any) {
      const gatewayResponse = error?.response?.data;
      this.logger.error(`Full flow test failed: ${error?.message}`);
      this.logger.error(`Gateway response status: ${error?.response?.status}`);
      this.logger.error(`Gateway response body: ${JSON.stringify(gatewayResponse)}`);
      return {
        success: false,
        message: gatewayResponse?.message || error?.message,
        data: gatewayResponse,
      };
    }
  }

  private async getConfigWithKey(): Promise<{ config: WhatsappTenantConfig | null; apiKey: string | null }> {
    const config = await this.configService.getConfig();
    if (!config) return { config: null, apiKey: null };
    const apiKey = await this.configService.getDecryptedApiKey();
    return { config, apiKey };
  }
}
