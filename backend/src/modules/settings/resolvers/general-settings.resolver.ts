import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { GeneralSettingsService } from '../services/general-settings.service';
import { GeneralSettings } from '../entities/general-settings.entity';
import { GraphQLJSONObject } from 'graphql-type-json';

@Resolver(() => GeneralSettings)
export class GeneralSettingsResolver {
  constructor(
    private readonly settingsService: GeneralSettingsService
  ) {}

  // ==================== QUERIES ====================

  /**
   * Ottieni tutte le impostazioni
   */
  @Query(() => [GeneralSettings], { name: 'generalSettings' })
  async getAllSettings(): Promise<GeneralSettings[]> {
    return this.settingsService.findAll();
  }

  /**
   * Ottieni impostazioni per categoria
   */
  @Query(() => [GeneralSettings], { name: 'generalSettingsByCategory' })
  async getSettingsByCategory(
    @Args('category') category: string
  ): Promise<GeneralSettings[]> {
    return this.settingsService.findByCategory(category);
  }

  /**
   * Ottieni singola impostazione per chiave
   */
  @Query(() => GeneralSettings, { name: 'generalSetting', nullable: true })
  async getSetting(
    @Args('key') key: string
  ): Promise<GeneralSettings | null> {
    return this.settingsService.findByKey(key);
  }

  // ==================== MUTATIONS ====================

  /**
   * Aggiorna valore di un'impostazione
   */
  @Mutation(() => GeneralSettings, { name: 'updateGeneralSetting' })
  async updateSetting(
    @Args('key') key: string,
    @Args('value', { type: () => GraphQLJSONObject }) value: any
  ): Promise<GeneralSettings> {
    return this.settingsService.updateValue(key, value);
  }

  /**
   * Crea o aggiorna un'impostazione completa
   */
  @Mutation(() => GeneralSettings, { name: 'upsertGeneralSetting' })
  async upsertSetting(
    @Args('key') key: string,
    @Args('value', { type: () => GraphQLJSONObject }) value: any,
    @Args('description', { nullable: true }) description?: string,
    @Args('valueType', { nullable: true }) valueType?: string,
    @Args('category', { nullable: true }) category?: string
  ): Promise<GeneralSettings> {
    return this.settingsService.upsert(key, value, {
      description,
      valueType,
      category
    });
  }

  /**
   * Elimina un'impostazione
   */
  @Mutation(() => Boolean, { name: 'deleteGeneralSetting' })
  async deleteSetting(
    @Args('key') key: string
  ): Promise<boolean> {
    return this.settingsService.delete(key);
  }

  /**
   * Inizializza impostazioni predefinite
   */
  @Mutation(() => Boolean, { name: 'initializeDefaultSettings' })
  async initializeDefaults(): Promise<boolean> {
    await this.settingsService.initializeDefaults();
    return true;
  }
}
