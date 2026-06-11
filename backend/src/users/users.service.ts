import { Injectable } from '@nestjs/common';
import { User } from '../entities/user.entity';
import { TenantContextService } from '@curandis/tenant-datasource';

@Injectable()
export class UsersService {
  constructor(
    private readonly tenantContext: TenantContextService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get usersRepository() { return this.dataSource.getRepository(User); }

  findAll(): Promise<User[]> {
    return this.usersRepository.find({
      where: { active: true },
      order: { name: 'ASC' }
    });
  }

  findOne(id: string): Promise<User> {
    return this.usersRepository.findOne({ where: { id } });
  }

  create(userData: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(userData);
    return this.usersRepository.save(user);
  }

  async update(id: string, userData: Partial<User>): Promise<User> {
    await this.usersRepository.update(id, userData);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.usersRepository.update(id, { active: false });
  }
}
